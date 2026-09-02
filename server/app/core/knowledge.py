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
from . import cjk_bigram

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

# YAML 标量安全：以下字符开头的值必须加引号，否则解析器会当成结构/类型。
_YAML_UNSAFE_LEAD = "-?:,[]{}#&*!|>'\"%@`"
# 值内部出现 ": " 或 " #" 也必须引号包裹。
_YAML_UNSAFE_INNER = (": ", " #")
# 会被 YAML 解析成布尔/空的字面量。
_YAML_RESERVED = {"true", "false", "null", "yes", "no", "on", "off", "~", ""}


def _unquote(v: str) -> str:
    """去掉 YAML 标量的包裹引号（单/双）；双引号内做基本反转义。"""
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        inner = v[1:-1]
        if v[0] == '"':
            inner = inner.replace('\\"', '"').replace("\\\\", "\\")
        return inner
    return v


def _needs_quote(v: str) -> bool:
    if v.strip() != v or v.lower() in _YAML_RESERVED:
        return True
    if v[0] in _YAML_UNSAFE_LEAD:
        return True
    return any(s in v for s in _YAML_UNSAFE_INNER)


def _quote(v: str) -> str:
    if not _needs_quote(v):
        return v
    return '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"'


def parse_frontmatter(text: str) -> tuple[dict[str, str], list[str], str]:
    """返回 (meta, tags, body)。支持任意顶层 `key: value` 与逗号分隔 tags。

    **round-trip 契约（ADR-024 §3）**：`meta` 保留文件里的**原始 key 顺序与全部
    未知 key**，供 `compose_file` 原样回写。加新字段不必再改本函数——
    旧版只提取 tags，导致其余 key 保存时被静默丢弃。
    """
    meta: dict[str, str] = {}
    body = text
    m = _FRONT_RE.match(text)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                k = k.strip()
                if k:
                    meta[k] = _unquote(v)
        body = text[m.end():]
    tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
    return meta, tags, body.lstrip("\n")


def compose_file(meta: dict[str, str], body: str) -> str:
    """组合完整 .md 文件内容：frontmatter + body。

    **round-trip 契约（ADR-024 §3）**：
      - 回写**任意** meta key（不只 tags），未知 key 不丢；
      - 删除 = 调用方从 meta 里 `pop` 掉 → 不会残留空值行（「真删除」）；
      - 无任何 key 时不写 `---` 块（保持纯文本笔记干净）；
      - 保持 meta 插入顺序（parse 时为文件原序），避免无意义 diff。

    签名变更（2026-09-01）：原为 `compose_file(tags, body)`，只能写 tags。
    """
    items = [
        (k, v) for k, v in (meta or {}).items()
        if str(k).strip() and str(v).strip()
    ]
    if not items:
        return body
    lines = "".join(f"{k}: {_quote(str(v))}\n" for k, v in items)
    return "---\n" + lines + "---\n\n" + body


def set_meta_tags(meta: dict[str, str], tags: list[str] | None) -> dict[str, str]:
    """返回新 meta：写回 tags（逗号分隔）；空/None 则删除该 key。"""
    out = dict(meta or {})
    clean = [t.strip() for t in (tags or []) if t.strip()]
    if clean:
        out["tags"] = ", ".join(clean)
    else:
        out.pop("tags", None)
    return out


# ---------- 主/副笔记 parent 关系（ADR-024） ----------

PARENT_KEY = "parent"
_PARENT_ANCHORED_RE = re.compile(r"^\[\[(.+?)\]\]$")


def parse_parent(meta: dict[str, str]) -> str | None:
    """从 frontmatter meta 取 parent 标题；兼容 `[[标题]]` 与裸标题两种写法。

    返回 None 表示未声明 parent。调用方负责校验目标是否存在
    （不存在 → orphan，见 ADR-024 §2.3）。
    """
    raw = (meta or {}).get(PARENT_KEY, "").strip()
    if not raw:
        return None
    m = _PARENT_ANCHORED_RE.match(raw)
    title = (m.group(1).strip() if m else raw).strip()
    return title or None


def set_meta_parent(meta: dict[str, str], parent_title: str | None) -> dict[str, str]:
    """返回新 meta：写 `parent: "[[标题]]"`；None/空则**真删除**该 key。

    ADR-024 §2.2 铁规则 2：只在 child 写 parent，永不持久化 children。
    """
    out = dict(meta or {})
    title = (parent_title or "").strip()
    if title:
        out[PARENT_KEY] = f"[[{title}]]"
    else:
        out.pop(PARENT_KEY, None)
    return out


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
    # notes_fts 列存「检索文本」（cjk_bigram.segment 预分词，ADR-027），
    # 不是原文快照——原文唯一事实源是 vault/ 的 Markdown 文件。
    conn.execute(
        "INSERT INTO notes_fts (title, body, note_id) VALUES (?, ?, ?)",
        (cjk_bigram.segment(title), cjk_bigram.segment(body), note_id),
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
    """全文检索（FTS5 + CJK bigram 预分词，ADR-027）。

    写入（upsert_note_index）与查询共用 `cjk_bigram.segment` —— 同一切分
    保证「短语匹配 ≈ 子串命中」。这是唯一的搜索主路径：
    B9 的 `_cjk_search` 全表 bigram 重叠扫描已随 ADR-027 删除。

    兜底（仅当 FTS 未命中或不可用时）：
      - 单字中文查询 → LIKE 扫检索文本（bigram 索引不含 run 内单字词元，
        而 segment 后文本保留全部汉字字符，LIKE 可精确命中——单字查询
        不再静默 0 命中）；
      - 其余 → 标题 LIKE（M1 以来的旧行为）。
    """
    text = (q or "").strip()
    if not text:
        return []

    # 单字中文：bigram 词元不覆盖 run 内单字，直接走 LIKE 兜底
    if cjk_bigram.is_single_cjk(text):
        return _like_body_search(conn, text, limit)

    seg = cjk_bigram.segment(text)
    if not cjk_bigram.has_token(seg):
        # 纯标点/符号等无词元查询：FTS 无从匹配，退化为标题 LIKE
        return _title_like_search(conn, text, limit)

    rows = conn.execute(
        """
        SELECT n.id AS note_id, n.title AS title
        FROM notes_fts f JOIN notes n ON n.id = f.note_id
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT ?
        """,
        (sanitize_fts_query(seg), limit),
    ).fetchall()
    if rows:
        return [{"note_id": r["note_id"], "title": r["title"]} for r in rows]
    # fallback: 标题 LIKE 大小写无关（旧行为保留）
    return _title_like_search(conn, text, limit)


def _like_body_search(conn, text: str, limit: int) -> list[dict]:
    """单字中文兜底：LIKE 扫 notes_fts 检索文本（segment 保留全部汉字字符）。"""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    rows = conn.execute(
        """
        SELECT n.id AS note_id, n.title AS title
        FROM notes_fts f JOIN notes n ON n.id = f.note_id
        WHERE f.body LIKE ? ESCAPE '\\' OR f.title LIKE ? ESCAPE '\\'
        ORDER BY n.id
        LIMIT ?
        """,
        (pattern, pattern, limit),
    ).fetchall()
    return [{"note_id": r["note_id"], "title": r["title"]} for r in rows]


def _title_like_search(conn, text: str, limit: int) -> list[dict]:
    """标题 LIKE 兜底（大小写无关）。"""
    rows = conn.execute(
        "SELECT id AS note_id, title FROM notes "
        "WHERE LOWER(title) LIKE LOWER(?) "
        "ORDER BY id LIMIT ?",
        (f"%{text}%", limit),
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


def ensure_entity_by_title(conn, title: str, *,
                           origin: str = "markdown") -> tuple[str, int, bool]:
    """字符串 → Entity。不存在则创建 concept 桩（status=unconfirmed）。

    origin 默认 markdown（wikilink 管线）；B3 extractor 传 ai_suggested
    （C4：来源字段诚实，Accept 只改 status）。
    返回 (entity_type, entity_id, created)。
    新建桩时同步初始化学习状态（mastery + review_queue）。
    """
    matches = resolve_title(conn, title)
    if matches:
        etype, eid = matches[0]
        return etype, eid, False
    cur = conn.execute(
        "INSERT INTO concepts (title, origin, status) VALUES (?, ?, 'unconfirmed')",
        (title, origin),
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

def _resolve_concept_for_memory(conn, q: str, matches: list[dict]) -> int | None:
    """为 memory 定位唯一 concept_id；无法确定则返回 None。

    定位顺序（从强到弱，命中即止）：
      1. matches 中 type=concept 的第一条——它已由 LIKE 匹配确认相关
      2. 精确标题匹配（concepts.title = q）
      3. LIKE 唯一命中——**多个候选中选不定就放弃**
         （宁可返回 null，也不能把 A 的掌握度当成 B 的；这是学习数据的语义错误）
    """
    for m in matches:
        if m.get("type") == "concept":
            return int(m["id"])

    row = conn.execute(
        "SELECT id FROM concepts WHERE title = ?", (q,)
    ).fetchone()
    if row:
        return int(row["id"])

    rows = conn.execute(
        "SELECT id FROM concepts WHERE LOWER(title) LIKE LOWER(?) LIMIT 2",
        (f"%{q}%",),
    ).fetchall()
    if len(rows) == 1:
        return int(rows[0]["id"])
    return None


def _memory_for_concept(conn, concept_id: int | None) -> dict:
    """M3.5-B：从 mastery / review_queue / mistakes 取真实学习状态。

    三字段独立取值，任一缺失即 None——不抛异常（suggest 是辅助能力，
    查不到学习状态不该让整个雷达失败）。
    """
    empty = {"mastery": None, "review_due": None, "last_mistake": None}
    if concept_id is None:
        return empty

    # 1. 掌握度：concept_mastery.effective（0~1）
    mrow = conn.execute(
        "SELECT effective FROM concept_mastery WHERE concept_id=?", (concept_id,)
    ).fetchone()
    mastery = float(mrow["effective"]) if mrow else None

    # 2. 复习到期：仅取待办项（status='pending'）；已完成的没有"到期"语义
    rrow = conn.execute(
        "SELECT due_at FROM review_queue WHERE concept_id=? AND status='pending'",
        (concept_id,),
    ).fetchone()
    review_due = rrow["due_at"] if rrow else None

    # 3. 最近一次错题：mistakes.description（DDL 见 migrations/001_init.sql §68）
    srow = conn.execute(
        "SELECT description, occurred_at FROM mistakes "
        "WHERE concept_id=? ORDER BY occurred_at DESC, id DESC LIMIT 1",
        (concept_id,),
    ).fetchone()
    last_mistake = None
    if srow:
        last_mistake = (srow["description"] or "").strip() or None

    return {"mastery": mastery, "review_due": review_due, "last_mistake": last_mistake}


def suggest_for_context(
    conn, query: str, note_id: int | None = None, limit: int = 5
) -> dict:
    """上下文感知知识建议：FTS匹配 + concept LIKE + 图谱邻居 + 学习状态。

    M3.5-A：matches / related。
    M3.5-B（本次）：memory 三字段接真实数据——掌握度 / 复习到期 / 最近错题。
    定位不到唯一 concept 时 memory 全为 None（见 _resolve_concept_for_memory）。
    """
    if not query or not query.strip():
        return {"matches": [], "related": [],
                "memory": {"mastery": None, "review_due": None, "last_mistake": None}}

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

    # 4. Memory（M3.5-B：真实学习状态；定位不到唯一 concept 则全 None）
    concept_id = _resolve_concept_for_memory(conn, q, matches)
    memory = _memory_for_concept(conn, concept_id)

    return {"matches": matches[:MAX_SUGGEST_MATCHES], "related": related[:MAX_RELATED_CONCEPTS], "memory": memory}




# ---------- 便捷读取 ----------

def read_note_file(rel_path: str) -> tuple[list[str], str]:
    """读文件并解析回 (tags, body)。文件缺失时抛 FileNotFoundError。"""
    _, tags, body = parse_frontmatter(
        resolve_vault_file(rel_path).read_text(encoding="utf-8")
    )
    return tags, body


def read_note_meta(rel_path: str) -> tuple[dict[str, str], list[str], str]:
    """读文件并解析回 (meta, tags, body)，**保留全部 frontmatter key**。

    改文件前必须走这个入口而不是 `read_note_file`——后者丢弃 meta，
    回写时会导致未知 key（含 `parent`）被静默删除（ADR-024 §3）。
    """
    return parse_frontmatter(
        resolve_vault_file(rel_path).read_text(encoding="utf-8")
    )


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
    "set_meta_tags", "PARENT_KEY", "parse_parent", "set_meta_parent",
    "body_hash", "upsert_note_index", "drop_note_index", "search_notes",
    "read_note_file", "read_note_meta", "get_note_row", "connect",
    "extract_wikilinks", "has_forbidden_media_path", "resolve_title",
    "ensure_entity_by_title", "promote_stub_to_note", "rebuild_note_links",
    "cascade_drop_entity", "local_graph", "backlinks_of_note",
    "suggest_for_context", "MAX_SUGGEST_MATCHES", "MAX_RELATED_CONCEPTS",
    "extract_snippet",
]
