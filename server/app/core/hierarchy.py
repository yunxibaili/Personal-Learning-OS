"""主/副笔记关系解析（ADR-024）。

**唯一 RelationResolver**——`/graph`、`/universe`、review 一律走这里，
禁止各视图自行推断（ADR-024 §2.2 铁规则 5）。

事实源是 vault 里的 Markdown frontmatter（`parent: "[[标题]]"`），不是 SQLite。
本模块每次调用都读文件重建，SQLite 只是派生索引缓存（ADR-001）。

失败语义（ADR-024 §2.3）：
  - parent 目标不存在 → orphan 警告，**保留声明值**，绝不自动删除
  - parent 自指 / 成环 → 标记 invalid，不建立关系
  - 删 parent 文件 → child 不静默删，降级 orphan
"""
from __future__ import annotations

from . import knowledge as K

EXPLICIT = "explicit"
INFERRED = "inferred"

REASON_ORPHAN = "orphan"      # parent 目标不存在
REASON_SELF = "self"          # parent 自指
REASON_CYCLE = "cycle"        # parent 链成环


def _detect_cycles(parent_of: dict[int, int]) -> set[int]:
    """返回处于环上的节点 id 集合（沿 parent 链走，命中已在本次路径上的节点即成环）。

    必须在**当前路径**内检测回头（否则 A→B→A 这类环会无限遍历）。
    """
    cyclic: set[int] = set()
    visited: set[int] = set()
    for start in list(parent_of):
        if start in visited:
            continue
        path: list[int] = []
        cur: int | None = start
        while cur is not None and cur in parent_of:
            if cur in path:                      # 本次路径内回头 → 成环
                cyclic.update(path[path.index(cur):])
                break
            if cur in visited:                   # 已被其它起点归纳，不再重复走
                break
            path.append(cur)
            cur = parent_of[cur]
        visited.update(path)
    return cyclic


def resolve_hierarchy(conn) -> dict:
    """解析全库主/副关系。**显式 parent 优先，wikilink 推断仅作 legacy fallback**。

    legacy fallback 规则（仅对**完全没有声明** `parent` 的旧笔记生效）：
    正文恰好有一条指向已存在笔记的 wikilink → 视其为主笔记。
    声明过 `parent` 但校验失败的笔记**不参与推断**（避免结果摇摆）。

    返回：
        parent_of  {child_id: parent_id}            仅有效关系
        children   {parent_id: [child_id, ...]}     反向派生（不持久化，铁规则 2）
        roots      [note_id, ...]                   无有效 parent 的笔记（含 invalid）
        source     {child_id: "explicit" | "inferred"}
        invalid    [{note_id, title, declared_parent, reason}, ...]
        stats      计数
    """
    rows = conn.execute(
        "SELECT id, path, title FROM notes ORDER BY id"
    ).fetchall()

    title_to_id: dict[str, int] = {}
    for r in rows:
        title_to_id.setdefault(r["title"], r["id"])

    # 1. 读全部 frontmatter（vault = 事实源）
    declared: dict[int, str] = {}      # note_id -> 声明的 parent 标题
    has_key: set[int] = set()          # 显式声明过 parent 的（无论校验成败）
    bodies: dict[int, str] = {}
    for r in rows:
        try:
            meta, _, body = K.parse_frontmatter(
                K.resolve_vault_file(r["path"]).read_text(encoding="utf-8")
            )
        except (OSError, ValueError):
            continue                    # 文件缺失/越界：索引残留，跳过不致命
        bodies[r["id"]] = body
        if K.PARENT_KEY in meta:
            has_key.add(r["id"])
            title = K.parse_parent(meta)
            if title:
                declared[r["id"]] = title

    # 2. 显式关系校验
    parent_of: dict[int, int] = {}
    source: dict[int, str] = {}
    invalid: list[dict] = []
    title_of = {r["id"]: r["title"] for r in rows}

    for nid in sorted(declared):
        pt = declared[nid]
        if pt == title_of.get(nid):
            invalid.append({"note_id": nid, "title": title_of.get(nid),
                            "declared_parent": pt, "reason": REASON_SELF})
            continue                    # 自指：不建立关系，但保留文件里的值
        pid = title_to_id.get(pt)
        if pid is None:
            invalid.append({"note_id": nid, "title": title_of.get(nid),
                            "declared_parent": pt, "reason": REASON_ORPHAN})
            continue                    # orphan：保留值，绝不自动删除
        parent_of[nid] = pid
        source[nid] = EXPLICIT

    # 3. legacy fallback：仅对「完全没声明过 parent」的笔记，用唯一出链推断
    for r in rows:
        nid = r["id"]
        if nid in has_key or nid in parent_of:
            continue
        targets = [
            title_to_id[t] for t in K.extract_wikilinks(bodies.get(nid, ""))
            if t in title_to_id and title_to_id[t] != nid
        ]
        if len(targets) == 1:
            parent_of[nid] = targets[0]
            source[nid] = INFERRED

    # 4. 环检测：环上节点全部判 invalid，关系不成立
    for nid in sorted(_detect_cycles(parent_of)):
        pid = parent_of.pop(nid)
        source.pop(nid, None)
        invalid.append({
            "note_id": nid,
            "title": title_of.get(nid),
            "declared_parent": title_of.get(pid),
            "reason": REASON_CYCLE,
        })

    # 5. 反向派生 children + roots（children 永不持久化，铁规则 2）
    children: dict[int, list[int]] = {}
    for cid, pid in parent_of.items():
        children.setdefault(pid, []).append(cid)
    for lst in children.values():
        lst.sort()
    roots = sorted(r["id"] for r in rows if r["id"] not in parent_of)

    return {
        "parent_of": parent_of,
        "children": children,
        "roots": roots,
        "source": source,
        "invalid": invalid,
        "stats": {
            "notes": len(rows),
            "explicit": sum(1 for s in source.values() if s == EXPLICIT),
            "inferred": sum(1 for s in source.values() if s == INFERRED),
            "invalid": len(invalid),
            "roots": len(roots),
        },
    }


def hierarchy_of(conn, note_id: int) -> dict:
    """单篇视角：该笔记的 parent / children / 是否有效。供 detail 端点复用。"""
    h = resolve_hierarchy(conn)
    pid = h["parent_of"].get(note_id)
    return {
        "parent_id": pid,
        "child_ids": h["children"].get(note_id, []),
        "source": h["source"].get(note_id),
        "invalid": next(
            (i for i in h["invalid"] if i["note_id"] == note_id), None
        ),
    }


def build_note_forest(
    created_at: dict[int, str],
    parent_of: dict[int, int],
    children: dict[int, list[int]],
    *,
    depth: int,
    root_id: int | None = None,
) -> list[dict]:
    """树投影的**纯结构**构建（ADR-026 §3.2）。序列化 note 字段由调用方负责。

    输入必须来自 `resolve_hierarchy()`（ADR-024 红线 2：禁止绕过 resolver 拼树）；
    cycle/orphan 已被 resolver 判 invalid，不在 `children` 里出现——本函数零防御重复。

    规则（ADR-026 v3）：
      - **后端剪枝**：构建到第 `depth` 层即停，更深层不序列化；
        剪枝处节点 `truncated=True` 且 `children=[]`（前端据此渲染「…」懒加载入口）；
      - **同层排序 = created_at 升序**（v3 修订：弃 updated_at 降序——改错别字不应
        导致同级重排），tiebreak 按 id 升序；
      - `root_id` 指定时只构建该节点为根的子树（懒加载入口），None = 全森林。

    参数：
        created_at: {note_id: created_at}（排序键，来自 notes 表既有列，零 migration）
        parent_of / children: `resolve_hierarchy()` 的输出
        depth: 构建层数（1 = 只根层；调用方负责 1~10 校验）
        root_id: 懒加载子树根；不在 notes 里时由调用方先 404

    返回：`[{note_id, children: [同结构], truncated: bool}, ...]`
    """

    def sort_key(nid: int):
        return (created_at.get(nid, ""), nid)

    def build(nid: int, level: int) -> dict:
        # 层数语义：根/当前节点 = 第 1 层；level == depth 时其子层被剪枝
        kids = sorted(children.get(nid, []), key=sort_key)
        if level >= depth:
            return {"note_id": nid, "children": [], "truncated": bool(kids)}
        return {
            "note_id": nid,
            "children": [build(c, level + 1) for c in kids],
            "truncated": False,
        }

    if root_id is not None:
        return [build(root_id, 1)]
    roots = sorted(
        (nid for nid in created_at if nid not in parent_of),
        key=sort_key,
    )
    return [build(nid, 1) for nid in roots]


PARENT_RELATION = "parent"
PARENT_ORIGIN = "markdown"          # parent 边派生自 frontmatter（markdown），非 DB-only


def resolve_parent_title(conn, title: str) -> int | None:
    """parent 标题 → 笔记 id（仅 note）。复用 K.resolve_title（一致性：note 优先）。

    parent 语义上是「笔记」，若同名只有 concept 而无 note，视为未命中（orphan）。
    """
    for etype, eid in K.resolve_title(conn, title):
        if etype == "note":
            return eid
    return None


def sync_note_parent(conn, note_id: int) -> int | None:
    """单篇：重算该笔记的 `links(relation='parent')` 派生边，并返回其权威父 id。

    ADR-024 §2.4（派生索引）+ §2.6 红线：
      - 事实源是 frontmatter，这里只把结果**镜像**进 links（可重建的索引）；
      - 自指 / 目标不存在 → **清空**该边（invalid 由 `resolve_hierarchy` 运行时标记，
        不因写库而丢失用户的原始 frontmatter 值）；
      - 只接受「同名笔记」为目标（parent 是 note）。
    幂等：先删旧边再插新边（单父，无残留）。
    """
    conn.execute(
        "DELETE FROM links WHERE source_type='note' AND source_id=? "
        "AND relation=?",
        (note_id, PARENT_RELATION),
    )
    row = conn.execute(
        "SELECT id, path, title FROM notes WHERE id=?", (note_id,)
    ).fetchone()
    if row is None:
        return None
    try:
        meta, _, _ = K.parse_frontmatter(
            K.resolve_vault_file(row["path"]).read_text(encoding="utf-8")
        )
    except (OSError, ValueError):
        return None
    pt = K.parse_parent(meta)
    if not pt or pt == row["title"]:
        return None
    pid = resolve_parent_title(conn, pt)
    if pid is None or pid == note_id:
        return None
    conn.execute(
        "INSERT OR IGNORE INTO links "
        "(source_type, source_id, target_type, target_id, relation, origin) "
        "VALUES ('note', ?, 'note', ?, ?, ?)",
        (note_id, pid, PARENT_RELATION, PARENT_ORIGIN),
    )
    return pid


def materialize_parent_links(conn) -> dict:
    """全量：清空所有 `relation='parent'` 派生边，按 `resolve_hierarchy()` 重算。

    仅在全量 reindex 时调用（ADR-024 §2.4：「重建（reindex）时全量重算」）。
    结果存进 links 作为**派生索引**——任何业务不得把它当 hierarchy 权威
    （权威 = `resolve_hierarchy()`，见红线 2/3）。返回 ({explicit, inferred})。
    """
    conn.execute("DELETE FROM links WHERE relation=?", (PARENT_RELATION,))
    h = resolve_hierarchy(conn)
    counts = {"explicit": 0, "inferred": 0}
    for cid, pid in h["parent_of"].items():
        conn.execute(
            "INSERT OR IGNORE INTO links "
            "(source_type, source_id, target_type, target_id, relation, origin) "
            "VALUES ('note', ?, 'note', ?, ?, ?)",
            (cid, pid, PARENT_RELATION, PARENT_ORIGIN),
        )
        key = "explicit" if h["source"].get(cid) == EXPLICIT else "inferred"
        counts[key] += 1
    return counts


__all__ = ["resolve_hierarchy", "hierarchy_of", "resolve_parent_title",
           "sync_note_parent", "materialize_parent_links", "build_note_forest",
           "PARENT_RELATION", "PARENT_ORIGIN",
           "EXPLICIT", "INFERRED",
           "REASON_ORPHAN", "REASON_SELF", "REASON_CYCLE"]
