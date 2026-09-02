"""MindMap Core（M2b-001）：用户思考空间的 CRUD。

ADR-019 冻结：
  - MindMap ≠ Universe
  - 不改变 mastery
  - 不生成 learning_event
  - concept binding 是引用（concept_id nullable）
  - 用户布局属于用户数据

P1-MINDMAP-TRUTH（2026-09-02）：sidecar producer——恢复 ADR-002「结构真相 =
*.mindmap.json 旁车」。SQLite 三表降为可重建缓存（与 notes/vault 同一教义）：
  - 路径：workspace/mind_maps/<map_id>.mindmap.json（M7 Sync 白名单
    mind_maps/**/*.mindmap.json；文件名用 id——改名不产生文件 churn、跨设备稳定）
  - schema：状态快照（version/type/map/nodes/edges 全列含 id），**不是**
    ADR-021 交换格式（交换格式重分配 id，无法承担「从文件重建」）
  - 每次 map 级 mutation 提交后整体重写该 map 的 sidecar；delete_map 删文件
  - sidecar 写失败只 logger.warning，不阻断 API（下次 mutation 重写自愈；
    DB 侧仍可由 rebuild_mindmaps 从文件反推修复）
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from ..db import connect, workspace_root

logger = logging.getLogger(__name__)

SIDECAR_VERSION = "1"
SIDECAR_TYPE = "mindmap_state"
SIDECAR_DIR = "mind_maps"


# ── Sidecar producer（P1-MINDMAP-TRUTH）──────────────────────────

def sidecar_relpath(map_id: int) -> str:
    """sidecar 相对 workspace 的 POSIX 路径。"""
    return f"{SIDECAR_DIR}/{map_id}.mindmap.json"


def _dump_map_state(conn, map_id: int) -> dict[str, Any] | None:
    """读 map 全量状态（含 id 的行快照），供 sidecar 序列化。"""
    row = conn.execute(
        "SELECT id, title, created_at, updated_at FROM mind_maps WHERE id=?",
        (map_id,),
    ).fetchone()
    if row is None:
        return None
    return {
        "version": SIDECAR_VERSION,
        "type": SIDECAR_TYPE,
        "map": dict(row),
        "nodes": _get_nodes(conn, map_id),
        "edges": _get_edges(conn, map_id),
    }


def write_sidecar(conn, map_id: int, workspace: Path | None = None) -> bool:
    """把 map 全量状态写入 sidecar 文件（整体重写，幂等）。

    失败（磁盘/序列化）返回 False 并记日志，不抛异常——调用方在
    mutation 主路径上，文件失败不得回滚已提交的 DB 变更。
    """
    try:
        state = _dump_map_state(conn, map_id)
        if state is None:
            return False
        ws = workspace or workspace_root()
        out = ws / SIDECAR_DIR / f"{map_id}.mindmap.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".json.tmp")
        tmp.write_text(
            json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        tmp.replace(out)  # 原子替换（同盘 rename）
        return True
    except Exception:  # noqa: BLE001 — 文件失败不阻断主流程
        logger.exception("mindmap sidecar write failed for map %s", map_id)
        return False


def delete_sidecar(map_id: int, workspace: Path | None = None) -> None:
    """删除 map 对应的 sidecar 文件（不存在时静默）。"""
    try:
        ws = workspace or workspace_root()
        out = ws / SIDECAR_DIR / f"{map_id}.mindmap.json"
        out.unlink(missing_ok=True)
    except Exception:  # noqa: BLE001
        logger.exception("mindmap sidecar delete failed for map %s", map_id)


def rebuild_mindmaps(
    conn,
    workspace: Path | None = None,
    *,
    prune_missing: bool = True,
) -> dict[str, int]:
    """从 workspace/mind_maps/*.mindmap.json 重建 SQLite 三表（DB=cache 教义）。

    规则：
      - 逐文件整体替换：delete 旧 map（CASCADE）→ 按文件内 id 重插（id 保留，
        表为纯 INTEGER PRIMARY KEY，新 rowid 自动 = max+1，无需修 sequence）
      - concept_id 本地不存在 → 置 NULL（FK 硬约束；与 import_map 语义一致；
        跨设备 concept id 对齐属稳定 ID 债务，ADR-024 P1-2）
      - 坏 JSON / 缺字段：跳过并计数，不中断
      - prune_missing=True：DB 中存在但 sidecar 缺失的 map 删除（mirror 文件）
      - 幂等：可反复执行
    """
    ws = workspace or workspace_root()
    stats = {
        "files_scanned": 0,
        "maps_rebuilt": 0,
        "maps_dropped": 0,
        "nodes_restored": 0,
        "edges_restored": 0,
        "broken_files": 0,
        "bindings_dropped": 0,
    }
    sidecar_dir = ws / SIDECAR_DIR
    files = sorted(sidecar_dir.glob("*.mindmap.json")) if sidecar_dir.exists() else []

    seen_ids: set[int] = set()
    for f in files:
        stats["files_scanned"] += 1
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            m = data["map"]
            map_id = int(m["id"])
            title = str(m["title"])
            nodes = data.get("nodes", [])
            edges = data.get("edges", [])
        except Exception:  # noqa: BLE001 — 坏文件跳过
            logger.warning("mindmap sidecar unreadable, skipped: %s", f)
            stats["broken_files"] += 1
            continue

        if map_id in seen_ids:
            logger.warning("duplicate mindmap sidecar id %s: %s", map_id, f)
            stats["broken_files"] += 1
            continue
        seen_ids.add(map_id)

        # 整体替换（CASCADE 清 nodes/edges）
        conn.execute("DELETE FROM mind_maps WHERE id=?", (map_id,))
        conn.execute(
            "INSERT INTO mind_maps (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (map_id, title, m.get("created_at"), m.get("updated_at")),
        )
        for n in nodes:
            concept_id = n.get("concept_id")
            if concept_id is not None:
                exists = conn.execute(
                    "SELECT id FROM concepts WHERE id=?", (concept_id,)
                ).fetchone()
                if exists is None:
                    concept_id = None
                    stats["bindings_dropped"] += 1
            conn.execute(
                "INSERT INTO mind_map_nodes "
                "(id, map_id, concept_id, label, note, position_x, position_y, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    int(n["id"]), map_id, concept_id,
                    str(n.get("label", "")), str(n.get("note") or ""),
                    float(n.get("position_x", 0)), float(n.get("position_y", 0)),
                    n.get("created_at"),
                ),
            )
            stats["nodes_restored"] += 1
        for e in edges:
            conn.execute(
                "INSERT INTO mind_map_edges "
                "(id, map_id, source, target, relation, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    int(e["id"]), map_id, int(e["source"]), int(e["target"]),
                    str(e.get("relation", "related")), e.get("created_at"),
                ),
            )
            stats["edges_restored"] += 1
        stats["maps_rebuilt"] += 1

    # prune：DB 有、文件无 → 删（DB 是镜像缓存）
    if prune_missing:
        for row in conn.execute("SELECT id FROM mind_maps").fetchall():
            if row["id"] not in seen_ids:
                conn.execute("DELETE FROM mind_maps WHERE id=?", (row["id"],))
                stats["maps_dropped"] += 1

    return stats


# ── Map CRUD ─────────────────────────────────────────────────────

def create_map(title: str, conn=None) -> dict[str, Any]:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "INSERT INTO mind_maps (title) VALUES (?)", (title,)
        )
        conn.commit()
        result = get_map(cur.lastrowid, conn=conn)
        write_sidecar(conn, cur.lastrowid)
        return result
    finally:
        if close:
            conn.close()


def list_maps(conn=None) -> list[dict[str, Any]]:
    close = conn is None
    conn = conn or connect()
    try:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM mind_maps ORDER BY updated_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if close:
            conn.close()


def get_map(map_id: int, conn=None) -> dict[str, Any] | None:
    close = conn is None
    conn = conn or connect()
    try:
        row = conn.execute(
            "SELECT id, title, created_at, updated_at FROM mind_maps WHERE id=?",
            (map_id,),
        ).fetchone()
        if row is None:
            return None
        nodes = _get_nodes(conn, map_id)
        edges = _get_edges(conn, map_id)
        return {**dict(row), "nodes": nodes, "edges": edges}
    finally:
        if close:
            conn.close()


def delete_map(map_id: int, conn=None) -> bool:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute("DELETE FROM mind_maps WHERE id=?", (map_id,))
        conn.commit()
        deleted = cur.rowcount > 0
        if deleted:
            delete_sidecar(map_id)
        return deleted
    finally:
        if close:
            conn.close()


# ── Node CRUD ────────────────────────────────────────────────────

def add_node(
    map_id: int,
    label: str,
    concept_id: int | None = None,
    position_x: float = 0,
    position_y: float = 0,
    note: str = "",
    conn=None,
) -> dict[str, Any]:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "INSERT INTO mind_map_nodes (map_id, concept_id, label, note, position_x, position_y) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (map_id, concept_id, label, note, position_x, position_y),
        )
        conn.execute(
            "UPDATE mind_maps SET updated_at=datetime('now') WHERE id=?",
            (map_id,),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM mind_map_nodes WHERE id=?", (cur.lastrowid,)
        ).fetchone()
        write_sidecar(conn, map_id)
        return dict(row)
    finally:
        if close:
            conn.close()


def update_node_position(
    node_id: int, x: float, y: float, conn=None
) -> bool:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "UPDATE mind_map_nodes SET position_x=?, position_y=? WHERE id=?",
            (x, y, node_id),
        )
        if cur.rowcount > 0:
            conn.execute(
                "UPDATE mind_maps SET updated_at=datetime('now') WHERE id="
                "(SELECT map_id FROM mind_map_nodes WHERE id=?)",
                (node_id,),
            )
        conn.commit()
        if cur.rowcount > 0:
            write_sidecar(conn, _node_map_id(conn, node_id))
        return cur.rowcount > 0
    finally:
        if close:
            conn.close()


def update_node_label(node_id: int, label: str, conn=None) -> bool:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "UPDATE mind_map_nodes SET label=? WHERE id=?",
            (label, node_id),
        )
        if cur.rowcount > 0:
            conn.execute(
                "UPDATE mind_maps SET updated_at=datetime('now') WHERE id="
                "(SELECT map_id FROM mind_map_nodes WHERE id=?)",
                (node_id,),
            )
        conn.commit()
        if cur.rowcount > 0:
            write_sidecar(conn, _node_map_id(conn, node_id))
        return cur.rowcount > 0
    finally:
        if close:
            conn.close()


def delete_node(node_id: int, conn=None) -> bool:
    close = conn is None
    conn = conn or connect()
    try:
        map_id = _node_map_id(conn, node_id)
        cur = conn.execute(
            "DELETE FROM mind_map_nodes WHERE id=?", (node_id,)
        )
        conn.commit()
        if cur.rowcount > 0 and map_id is not None:
            write_sidecar(conn, map_id)
        return cur.rowcount > 0
    finally:
        if close:
            conn.close()


# ── Concept Binding（ADR-019：引用，不是复制）────────────────────

def bind_concept(node_id: int, concept_id: int, conn=None) -> dict[str, Any] | None:
    """将 MindMap 节点绑定到 Concept（只写 concept_id，不改任何其他表）。

    ADR-019 铁律：
      - 不创建 learning_event
      - 不修改 concept_mastery
      - 不修改 review_queue
      - 不修改 links 表
    """
    close = conn is None
    conn = conn or connect()
    try:
        # 验证 concept 存在
        concept = conn.execute(
            "SELECT id, title FROM concepts WHERE id=?", (concept_id,)
        ).fetchone()
        if concept is None:
            return None
        # 验证 node 存在
        node = conn.execute(
            "SELECT id FROM mind_map_nodes WHERE id=?", (node_id,)
        ).fetchone()
        if node is None:
            return None
        # 绑定（只改 mind_map_nodes.concept_id）
        conn.execute(
            "UPDATE mind_map_nodes SET concept_id=? WHERE id=?",
            (concept_id, node_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM mind_map_nodes WHERE id=?", (node_id,)
        ).fetchone()
        write_sidecar(conn, _node_map_id(conn, node_id))
        return dict(row)
    finally:
        if close:
            conn.close()


def unbind_concept(node_id: int, conn=None) -> bool:
    """解除 MindMap 节点的 Concept 绑定（concept_id → NULL）。"""
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "UPDATE mind_map_nodes SET concept_id=NULL WHERE id=?",
            (node_id,),
        )
        conn.commit()
        if cur.rowcount > 0:
            write_sidecar(conn, _node_map_id(conn, node_id))
        return cur.rowcount > 0
    finally:
        if close:
            conn.close()


def search_concepts(query: str, limit: int = 20, conn=None) -> list[dict[str, Any]]:
    """搜索 Concepts（用于 MindMap 绑定选择）。"""
    close = conn is None
    conn = conn or connect()
    try:
        rows = conn.execute(
            "SELECT id, title, domain, status FROM concepts "
            "WHERE title LIKE ? OR domain LIKE ? "
            "ORDER BY title LIMIT ?",
            (f"%{query}%", f"%{query}%", limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if close:
            conn.close()


# ── Edge CRUD ────────────────────────────────────────────────────

def add_edge(
    map_id: int,
    source: int,
    target: int,
    relation: str = "related",
    conn=None,
) -> dict[str, Any]:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "INSERT INTO mind_map_edges (map_id, source, target, relation) "
            "VALUES (?, ?, ?, ?)",
            (map_id, source, target, relation),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM mind_map_edges WHERE id=?", (cur.lastrowid,)
        ).fetchone()
        write_sidecar(conn, map_id)
        return dict(row)
    finally:
        if close:
            conn.close()


def delete_edge(edge_id: int, conn=None) -> bool:
    close = conn is None
    conn = conn or connect()
    try:
        row = conn.execute(
            "SELECT map_id FROM mind_map_edges WHERE id=?", (edge_id,)
        ).fetchone()
        map_id = row["map_id"] if row else None
        cur = conn.execute(
            "DELETE FROM mind_map_edges WHERE id=?", (edge_id,)
        )
        conn.commit()
        if cur.rowcount > 0 and map_id is not None:
            write_sidecar(conn, map_id)
        return cur.rowcount > 0
    finally:
        if close:
            conn.close()


# ── Export / Import（ADR-021 MindMap Exchange Format v1）────────

def export_map(map_id: int, conn=None) -> dict[str, Any] | None:
    """导出 MindMap 为 ADR-021 Exchange Format v1。"""
    close = conn is None
    conn = conn or connect()
    try:
        m = conn.execute(
            "SELECT id, title, created_at, updated_at FROM mind_maps WHERE id=?",
            (map_id,),
        ).fetchone()
        if m is None:
            return None
        nodes = _get_nodes(conn, map_id)
        edges = _get_edges(conn, map_id)
        return {
            "version": "1.0",
            "type": "mindmap",
            "map": {
                "title": m["title"],
                "nodes": [
                    {
                        "id": n["id"],
                        "label": n["label"],
                        "note": n["note"],
                        "concept_id": n["concept_id"],
                        "position": {"x": n["position_x"], "y": n["position_y"]},
                    }
                    for n in nodes
                ],
                "edges": [
                    {
                        "source": e["source"],
                        "target": e["target"],
                        "relation": e["relation"],
                    }
                    for e in edges
                ],
            },
        }
    finally:
        if close:
            conn.close()


def import_map(data: dict[str, Any], conn=None) -> dict[str, Any] | None:
    """导入 ADR-021 Exchange Format v1 → 新建 MindMap。

    规则（ADR-021）：
      - ID 重新分配
      - concept_id 验证存在，不存在则置 NULL
      - 不创建 concept
      - 不产生 learning_event / mastery 变化
    """
    if data.get("type") != "mindmap":
        return None
    map_data = data.get("map")
    if not map_data or not map_data.get("title"):
        return None

    close = conn is None
    conn = conn or connect()
    try:
        # 创建 Map
        cur = conn.execute(
            "INSERT INTO mind_maps (title) VALUES (?)",
            (map_data["title"],),
        )
        new_map_id = cur.lastrowid

        # ID 重映射
        old_to_new: dict[int, int] = {}
        for n in map_data.get("nodes", []):
            # 验证 concept_id
            concept_id = n.get("concept_id")
            if concept_id is not None:
                exists = conn.execute(
                    "SELECT id FROM concepts WHERE id=?", (concept_id,)
                ).fetchone()
                if exists is None:
                    concept_id = None

            pos = n.get("position", {"x": 0, "y": 0})
            node_cur = conn.execute(
                "INSERT INTO mind_map_nodes "
                "(map_id, concept_id, label, note, position_x, position_y) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    new_map_id,
                    concept_id,
                    n.get("label", "Untitled"),
                    n.get("note") or "",
                    pos.get("x", 0),
                    pos.get("y", 0),
                ),
            )
            old_to_new[n["id"]] = node_cur.lastrowid

        # 导入 edges（重映射 source/target）
        for e in map_data.get("edges", []):
            src = old_to_new.get(e["source"])
            tgt = old_to_new.get(e["target"])
            if src and tgt:
                conn.execute(
                    "INSERT INTO mind_map_edges (map_id, source, target, relation) "
                    "VALUES (?, ?, ?, ?)",
                    (new_map_id, src, tgt, e.get("relation", "related")),
                )

        conn.commit()
        write_sidecar(conn, new_map_id)
        return {
            "id": new_map_id,
            "title": map_data["title"],
            "node_count": len(old_to_new),
            "edge_count": len([
                e for e in map_data.get("edges", [])
                if old_to_new.get(e["source"]) and old_to_new.get(e["target"])
            ]),
        }
    finally:
        if close:
            conn.close()


# ── Internal ─────────────────────────────────────────────────────

def _node_map_id(conn, node_id: int) -> int | None:
    row = conn.execute(
        "SELECT map_id FROM mind_map_nodes WHERE id=?", (node_id,)
    ).fetchone()
    return row["map_id"] if row else None


def _get_nodes(conn, map_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM mind_map_nodes WHERE map_id=? ORDER BY id",
        (map_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _get_edges(conn, map_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM mind_map_edges WHERE map_id=? ORDER BY id",
        (map_id,),
    ).fetchall()
    return [dict(r) for r in rows]


# ── B18 大纲反解析（mindmap 结构 → Markdown 大纲段）────────────────

# md 内「结构大纲」片段的标记（ADR-002）：结构唯一事实源是 *.mindmap.json，
# 大纲段为派生视图；这里从 json 结构生成该派生段。
GENERATED_MINDMAP_MARKER = "<!-- generated:mindmap -->"


def build_outline(map_data: dict[str, Any]) -> str:
    """把导出后的 map 结构转为 Markdown 嵌套列表大纲（含标记）。

    规则（ADR-002 / TECH_DESIGN §7.8）：
      - 无边向层级以「边 source=父，target=子」推导
      - 根节点 = 无入边的节点；环/孤点兜底避免漏项
      - 每个节点渲染为 ``- [[label]]`` 编号层级缩进（原生 wikilink，供 ADR-008 建链）
    """
    nodes = {n["id"]: n for n in map_data.get("nodes", [])}
    if not nodes:
        return GENERATED_MINDMAP_MARKER + "\n"

    def label_of(nid: int) -> str:
        n = nodes[nid]
        return (n.get("label") or "").strip() or f"节点{nid}"

    children: dict[int, list[int]] = {nid: [] for nid in nodes}
    incoming: dict[int, set[int]] = {nid: set() for nid in nodes}
    for e in map_data.get("edges", []):
        s, t = e.get("source"), e.get("target")
        if s in nodes and t in nodes and s != t:
            children[s].append(t)
            incoming[t].add(s)

    roots = [nid for nid in nodes if not incoming[nid]]
    if not roots:
        roots = [min(nodes)]  # 纯环：取单一入口兜底

    lines = [GENERATED_MINDMAP_MARKER]
    visited: set[int] = set()

    def walk(nid: int, depth: int) -> None:
        if nid in visited:
            return
        visited.add(nid)
        lines.append(f"{'  ' * depth}- [[{label_of(nid)}]]")
        for c in children[nid]:
            walk(c, depth + 1)

    for r in roots:
        walk(r, 0)
    for nid in nodes:  # 兜底：非树可达的孤立/环残留节点
        if nid not in visited:
            walk(nid, 0)

    return "\n".join(lines) + "\n"


def get_map_outline(map_id: int, conn=None) -> str | None:
    """生成某 Map 的 Markdown 大纲段。Map 不存在返回 None。"""
    close = conn is None
    conn = conn or connect()
    try:
        m = conn.execute(
            "SELECT id FROM mind_maps WHERE id=?", (map_id,)
        ).fetchone()
        if m is None:
            return None
        nodes = _get_nodes(conn, map_id)
        edges = _get_edges(conn, map_id)
        return build_outline({"nodes": nodes, "edges": edges})
    finally:
        if close:
            conn.close()


# ── B6 AI 生成导图（LLM → 建议结构，不自动写库，ADR-019）────────────

MINDMAP_SUGGEST_PROMPT = """Generate a mind-map tree for the topic below.

Output ONLY valid JSON:
{{
  "topic": "<topic>",
  "root": {{
    "label": "<topic>",
    "children": [
      {{"label": "<branch>", "children": [{{"label": "<leaf>", "children": []}}]}}
    ]
  }}
}}

Rules: 3-6 top branches, depth ≤ 3, labels concise. Only the given topic, nothing invented.

Topic: {topic}"""


def suggest_structure(provider, topic: str, max_chars: int = 4000) -> dict | None:
    """LLM 生成导图结构建议（不写库）。返回 {"topic", "root"}；失败返回 None。"""
    prompt = {
        "system": "You generate mind-map trees as JSON.",
        "messages": [{"role": "user",
                      "content": MINDMAP_SUGGEST_PROMPT.format(topic=(topic or "")[:max_chars])}],
        "metadata": {"context_version": "1", "mode": "mindmap", "truncated": False},
    }
    try:
        text = provider.complete(prompt).strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        data = json.loads(text)
    except Exception:  # noqa: BLE001 — 生成失败仅返回 None，不阻断
        return None
    root = data.get("root")
    if not isinstance(root, dict) or "label" not in root:
        return None
    return {"topic": data.get("topic") or topic, "root": root}
