"""知识库核心：标题安全化、frontmatter、哈希、索引管线、FTS 检索。

纯逻辑层：不 import FastAPI，可被 pytest 直接测试（separation.md §一）。
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

from ..db import connect, workspace_root

_ILLEGAL = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_FRONT_RE = re.compile(r"^---\n(.*?)\n---\n?", re.S)
_ATTACH_NAME_RE = re.compile(r"^[0-9a-f]{12}\.[a-z0-9]+$")


# ---------- 标题与路径 ----------

def sanitize_title(raw: str) -> str:
    """清洗用户输入的笔记标题：去非法字符、压缩空白；空则抛 ValueError。"""
    t = _ILLEGAL.sub("", (raw or "").strip())
    t = re.sub(r"\s+", " ", t).strip().strip(".")
    if not t:
        raise ValueError("empty title")
    return t


def vault_root() -> Path:
    root = workspace_root() / "vault"
    root.mkdir(parents=True, exist_ok=True)
    return root


def attachments_dir() -> Path:
    d = workspace_root() / "attachments"
    d.mkdir(parents=True, exist_ok=True)
    return d


def resolve_vault_file(rel_path: str) -> Path:
    """把 notes.path 解析为 vault 内绝对路径；越界即拒绝。"""
    p = (vault_root() / rel_path).resolve()
    if not str(p).startswith(str(vault_root().resolve()) + os.sep):
        raise ValueError(f"path escapes vault: {rel_path}")
    return p


def is_safe_attachment_name(name: str) -> bool:
    return bool(_ATTACH_NAME_RE.match(name))


# ---------- Frontmatter / 哈希 ----------

def parse_frontmatter(text: str) -> tuple[dict[str, str], list[str], str]:
    """返回 (meta, tags, body)。仅支持顶层 key: value 与逗号分隔 tags。"""
    meta: dict[str, str] = {}
    body = text
    m = _FRONT_RE.match(text)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = text[m.end():]
    tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
    return meta, tags, body.lstrip("\n")


def compose_file(tags: list[str], body: str) -> str:
    """组合完整 .md 文件内容；无 tags 时不写 frontmatter。"""
    if not tags:
        return body
    return "---\ntags: " + ", ".join(tags) + "\n---\n\n" + body


def atomic_write_file(path: Path, content: str) -> None:
    """原子写入文件（write → fsync → rename），防止部分写入。

    原理：
      1. 写入 .tmp 临时文件
      2. fsync 确保数据落盘
      3. os.replace 原子替换目标文件（POSIX/Windows 均保证）

    如果进程在步骤 1/2 崩溃，目标文件不受影响。
    如果在步骤 3 崩溃，要么旧文件完整，要么新文件完整。
    """
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        # 原子替换
        os.replace(tmp, path)
    except Exception:
        # 清理临时文件
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise


def body_hash(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


# ---------- 索引管线 ----------

def upsert_note_index(
    conn,
    *,
    note_id: int,
    path: str,
    title: str,
    tags: list[str],
    body: str,
    mtime: float,
) -> None:
    """notes 表 upsert + FTS 全量重建（该行）。调用方负责 commit/rollback。"""
    conn.execute(
        """
        INSERT INTO notes (id, path, title, tags_json, content_hash, mtime,
                           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          path = excluded.path,
          title = excluded.title,
          tags_json = excluded.tags_json,
          content_hash = excluded.content_hash,
          mtime = excluded.mtime,
          updated_at = datetime('now')
        """,
        (note_id, path, title, json.dumps(tags, ensure_ascii=False),
         body_hash(body), mtime),
    )
    conn.execute("DELETE FROM notes_fts WHERE note_id = ?", (note_id,))
    conn.execute(
        "INSERT INTO notes_fts (title, body, note_id) VALUES (?, ?, ?)",
        (title, body, note_id),
    )


def drop_note_index(conn, note_id: int) -> None:
    conn.execute("DELETE FROM notes_fts WHERE note_id = ?", (note_id,))
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))


def sanitize_fts_query(q: str) -> str:
    """用户输入 → 安全 FTS5 查询：双引号包裹短语，阻止 FTS 操作符解释。"""
    text = q.strip()
    if not text:
        return ""
    escaped = text.replace('"', '""')
    return f'"{escaped}"'


def search_notes(conn, q: str, limit: int = 50) -> list[dict]:
    safe_q = sanitize_fts_query(q)
    if not safe_q:
        return []
    # FTS5 default tokenizer 大小写敏感；用 LOWER 做大小写无关匹配
    rows = conn.execute(
        """
        SELECT n.id AS note_id, n.title AS title
        FROM notes_fts f JOIN notes n ON n.id = f.note_id
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT ?
        """,
        (safe_q, limit),
    ).fetchall()
    if rows:
        return [{"note_id": r["note_id"], "title": r["title"]} for r in rows]
    # fallback: LIKE 大小写无关
    rows = conn.execute(
        "SELECT id AS note_id, title FROM notes "
        "WHERE LOWER(title) LIKE LOWER(?) OR id IN "
        "(SELECT note_id FROM notes_fts WHERE notes_fts MATCH ?) "
        "ORDER BY id LIMIT ?",
        (f"%{q}%", safe_q, limit),
    ).fetchall()
    return [{"note_id": r["note_id"], "title": r["title"]} for r in rows]


# ---------- Wiki 链接解析与实体解析（M2，ADR-008/009）----------

_WIKILINK_RE = re.compile(r"\[\[([^\[\]]+?)\]\]")
_FORBIDDEN_MEDIA_RE = re.compile(r"!\[[^\]]*\]\(\s*(?:file://|[A-Za-z]:[\\/])")

# Knowledge Radar 冻结常量（ADR-012，M3.5-A 评审批准）
MAX_SUGGEST_MATCHES = 5
MAX_RELATED_CONCEPTS = 5


def extract_wikilinks(body: str) -> list[str]:
    """抽取正文中的 [[标题]]，保序去重。"""
    seen: list[str] = []
    for t in _WIKILINK_RE.findall(body or ""):
        t = t.strip()
        if t and t not in seen:
            seen.append(t)
    return seen


def has_forbidden_media_path(text: str) -> bool:
    """附件路径守卫：禁止绝对盘符 / file:// 进入 Markdown（ADR-008 冻结政策）。"""
    return bool(_FORBIDDEN_MEDIA_RE.search(text or ""))


def resolve_title(conn, title: str) -> list[tuple[str, int]]:
    """类型中立解析：标题 → [(entity_type, entity_id)]。

    命中顺序确定性：note 优先于 concept（同库内按 id 升序）；
    不在此处判断"应该是什么类型"——类型由已存在的事实决定（ADR-009）。
    """
    out: list[tuple[str, int]] = []
    r = conn.execute("SELECT id FROM notes WHERE title = ?", (title,)).fetchone()
    if r:
        out.append(("note", r["id"]))
    for row in conn.execute(
        "SELECT id, aliases_json FROM concepts WHERE title = ?", (title,)
    ):
        out.append(("concept", row["id"]))
    for row in conn.execute("SELECT id, aliases_json FROM concepts"):
        try:
            if title in json.loads(row["aliases_json"] or "[]"):
                if ("concept", row["id"]) not in out:
                    out.append(("concept", row["id"]))
        except json.JSONDecodeError:
            pass
    return out


def ensure_entity_by_title(conn, title: str) -> tuple[str, int, bool]:
    """字符串 → Entity。不存在则创建 concept 桩（origin=markdown, status=unconfirmed）。

    返回 (entity_type, entity_id, created)。
    新建桩时同步初始化学习状态（mastery + review_queue）。
    """
    matches = resolve_title(conn, title)
    if matches:
        etype, eid = matches[0]
        return etype, eid, False
    cur = conn.execute(
        "INSERT INTO concepts (title, origin, status) VALUES (?, 'markdown', 'unconfirmed')",
        (title,),
    )
    concept_id = cur.lastrowid
    # 初始化学习状态（惰性：mastery + review_queue）
    from .mastery import ensure_concept_learning_state
    ensure_concept_learning_state(conn, concept_id)
    return "concept", concept_id, True


def promote_stub_to_note(conn, note_id: int, title: str) -> int:
    """若存在同名 unconfirmed markdown 桩，将其升级为笔记：迁移 links → 删除桩。

    在 notes router create 之后、rebuild 之前调用。返回受影响的 link 数。
    """
    stub = conn.execute(
        "SELECT id FROM concepts WHERE title=? AND origin='markdown' AND status='unconfirmed'",
        (title,),
    ).fetchone()
    if stub is None:
        return 0
    stub_id = stub["id"]
    # 把指向该桩的 link 改指向新笔记
    conn.execute(
        "UPDATE links SET target_type='note', target_id=? "
        "WHERE target_type='concept' AND target_id=?",
        (note_id, stub_id),
    )
    affected = conn.total_changes
    conn.execute("DELETE FROM concepts WHERE id=?", (stub_id,))
    return affected


def rebuild_note_links(conn, note_id: int, body: str) -> dict:
    """依据正文重建该笔记的 wikilink 边（幂等：先删后写 + 唯一约束兜底）。

    返回统计 {extracted, created_stubs, self_skipped}。调用方负责 commit。
    """
    conn.execute(
        "DELETE FROM links WHERE source_type='note' AND source_id=? "
        "AND relation='wikilink'",
        (note_id,),
    )
    stats = {"extracted": 0, "created_stubs": 0, "self_skipped": 0}
    for title in extract_wikilinks(body):
        stats["extracted"] += 1
        etype, eid, created = ensure_entity_by_title(conn, title)
        if created:
            stats["created_stubs"] += 1
        if etype == "note" and eid == note_id:
            stats["self_skipped"] += 1
            continue
        conn.execute(
            "INSERT OR IGNORE INTO links "
            "(source_type, source_id, target_type, target_id, relation, origin) "
            "VALUES ('note', ?, ?, ?, 'wikilink', 'markdown')",
            (note_id, etype, eid),
        )
    return stats


def cascade_drop_entity(conn, entity_type: str, entity_id: int) -> None:
    """删除实体时级联清理其全部 links（多态无外键，完整性由此函数保证）。"""
    conn.execute(
        "DELETE FROM links WHERE (source_type=? AND source_id=?) "
        "OR (target_type=? AND target_id=?)",
        (entity_type, entity_id, entity_type, entity_id),
    )


def local_graph(conn, root_type: str, root_id: int | None, depth: int) -> dict:
    """读模型：以 root 为中心 depth 层内子图；root=None 时返回全量（个人规模上限保护）。

    节点附带 learning 字段占位（M3 接入真实掌握度，ADR 评审条件 4）。
    """
    if root_id is not None:
        rows = conn.execute(
            """
            WITH RECURSIVE walk(etype, eid, d) AS (
                SELECT ?, ?, 0
                UNION
                SELECT CASE WHEN l.source_type = w.etype AND l.source_id = w.eid
                            THEN l.target_type ELSE l.source_type END,
                        CASE WHEN l.source_type = w.etype AND l.source_id = w.eid
                             THEN l.target_id ELSE l.source_id END,
                        w.d + 1
                FROM links l JOIN walk w
                  ON (l.source_type = w.etype AND l.source_id = w.eid)
                  OR (l.target_type = w.etype AND l.target_id = w.eid)
                WHERE w.d < ?
            )
            SELECT DISTINCT etype, eid FROM walk
            """,
            (root_type, root_id, depth),
        ).fetchall()
    else:
        rows = [
            ("note", r["id"])
            for r in conn.execute("SELECT id FROM notes")
        ] + [
            ("concept", r["id"])
            for r in conn.execute("SELECT id FROM concepts")
        ]
        rows = [(t, i) for (t, i) in rows]

    nodes: list[dict] = []
    edge_filter_ids: list[tuple[str, int]] = []
    for etype, eid in rows:
        if etype == "note":
            r = conn.execute(
                "SELECT id, title, tags_json FROM notes WHERE id=?", (eid,)
            ).fetchone()
            if r is None:
                continue
            nodes.append({
                "id": f"note-{eid}", "type": "note", "ref_id": eid,
                "title": r["title"], "domain": None, "status": "active",
                "learning": {"mastery": None, "review_due": None},
            })
        else:
            r = conn.execute(
                "SELECT id, title, domain, status FROM concepts WHERE id=?", (eid,)
            ).fetchone()
            if r is None:
                continue
            nodes.append({
                "id": f"concept-{eid}", "type": "concept", "ref_id": eid,
                "title": r["title"], "domain": r["domain"] or None,
                "status": r["status"],
                "learning": {"mastery": None, "review_due": None},
            })
        edge_filter_ids.append((etype, eid))

    edges: list[dict] = []
    id_set = set(edge_filter_ids)
    for l in conn.execute("SELECT * FROM links").fetchall():
        s = (l["source_type"], l["source_id"])
        t = (l["target_type"], l["target_id"])
        if s in id_set and t in id_set:
            edges.append({
                "source": f"{l['source_type']}-{l['source_id']}",
                "target": f"{l['target_type']}-{l['target_id']}",
                "relation": l["relation"],
            })
    return {"nodes": nodes, "edges": edges}


def backlinks_of_note(conn, note_id: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT n.id AS note_id, n.title AS title
        FROM links l JOIN notes n
          ON l.source_type='note' AND l.source_id = n.id
        WHERE l.target_type='note' AND l.target_id=?
          AND l.relation IN ('wikilink', 'mentions')
        ORDER BY n.title
        """,
        (note_id,),
    ).fetchall()
    return [{"note_id": r["note_id"], "title": r["title"]} for r in rows]


# ---------- Knowledge Radar / Omniscience Mode（M3.5-A，ADR-012）----------

def suggest_for_context(
    conn, query: str, note_id: int | None = None, limit: int = 5
) -> dict:
    """上下文感知知识建议：FTS匹配 + concept LIKE + 图谱邻居 + memory占位。

    M3.5-A 阶段 memory 全部返回 null（等 M3 concept_mastery 表就绪后接入）。
    """
    if not query or not query.strip():
        return {"matches": [], "related": [], "memory": {"mastery": None, "review_due": None, "last_mistake": None}}

    q = query.strip()

    # 1. FTS 笔记匹配（P8-003D：snippet 从硬编码 None 修为真实片段）
    matches: list[dict] = []
    fts_rows = search_notes(conn, q, limit=limit)
    for r in fts_rows:
        snippet = ""
        row = get_note_row(conn, r["note_id"])
        if row is not None:
            try:
                _, body = read_note_file(row["path"])
                snippet = extract_snippet(body, query=q, max_chars=200)
            except (OSError, ValueError):
                snippet = ""
        matches.append({
            "type": "note", "id": r["note_id"],
            "title": r["title"], "snippet": snippet or None, "score": 0.9,
        })

    # 2. Concept 标题 LIKE 匹配（补 FTS 未覆盖的概念）
    concept_rows = conn.execute(
        "SELECT id, title, domain, status FROM concepts "
        "WHERE LOWER(title) LIKE LOWER(?) LIMIT ?",
        (f"%{q}%", limit),
    ).fetchall()
    existing_ids = {m["id"] for m in matches}
    for r in concept_rows:
        if r["id"] not in existing_ids:
            matches.append({
                "type": "concept", "id": r["id"],
                "title": r["title"], "snippet": None, "score": 0.8,
                "domain": r["domain"], "status": r["status"],
            })

    # 3. 图谱邻居：以当前笔记为根 depth=1，取邻居中与 query 相关的
    related: list[dict] = []
    if note_id is not None:
        graph = local_graph(conn, "note", note_id, depth=1)
        for node in graph["nodes"]:
            # ref_id 是纯数字 ID，跳过自身
            if node["type"] == "note" and node["ref_id"] == note_id:
                continue
            # 简单相关度：标题包含 query 或 query 包含标题
            t = node["title"].lower()
            ql = q.lower()
            if ql in t or t in ql:
                related.append({"title": node["title"], "relation": "neighbor"})

    # 4. Memory 占位（M3.5-B 接入真实数据）
    memory = {"mastery": None, "review_due": None, "last_mistake": None}

    return {"matches": matches[:MAX_SUGGEST_MATCHES], "related": related[:MAX_RELATED_CONCEPTS], "memory": memory}




# ---------- 便捷读取 ----------

def read_note_file(rel_path: str) -> tuple[list[str], str]:
    """读文件并解析回 (tags, body)。文件缺失时抛 FileNotFoundError。"""
    _, tags, body = parse_frontmatter(
        resolve_vault_file(rel_path).read_text(encoding="utf-8")
    )
    return tags, body


def extract_snippet(body: str, query: str | None = None, max_chars: int = 600) -> str:
    """从笔记正文提取确定性片段（P8-003D）。

    规则：压缩空白后，有 query 且命中时取命中点前 80 字符起的窗口，
    否则取正文开头。首尾用 … 标记截断。纯函数，可复算（连通性断言依赖）。
    """
    text = " ".join((body or "").split())
    if not text:
        return ""
    if query:
        q = " ".join(query.split()).lower()
        pos = text.lower().find(q) if q else -1
        if pos >= 0:
            start = max(0, pos - 80)
            window = text[start:start + max_chars]
            prefix = "…" if start > 0 else ""
            suffix = "…" if start + len(window) < len(text) else ""
            return prefix + window + suffix
    snippet = text[:max_chars]
    return snippet + ("…" if len(text) > max_chars else "")


def get_note_row(conn, note_id: int):
    return conn.execute(
        "SELECT * FROM notes WHERE id = ?", (note_id,)
    ).fetchone()


__all__ = [
    "sanitize_title", "vault_root", "attachments_dir", "resolve_vault_file",
    "is_safe_attachment_name", "parse_frontmatter", "compose_file",
    "body_hash", "upsert_note_index", "drop_note_index", "search_notes",
    "read_note_file", "get_note_row", "connect",
    "extract_wikilinks", "has_forbidden_media_path", "resolve_title",
    "ensure_entity_by_title", "promote_stub_to_note", "rebuild_note_links",
    "cascade_drop_entity", "local_graph", "backlinks_of_note",
    "suggest_for_context", "MAX_SUGGEST_MATCHES", "MAX_RELATED_CONCEPTS",
    "extract_snippet",
]
