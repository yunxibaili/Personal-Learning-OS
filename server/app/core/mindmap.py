"""MindMap Core（M2b-001）：用户思考空间的 CRUD。

ADR-019 冻结：
  - MindMap ≠ Universe
  - 不改变 mastery
  - 不生成 learning_event
  - concept binding 是引用（concept_id nullable）
  - 用户布局属于用户数据
"""
from __future__ import annotations

from typing import Any

from ..db import connect


# ── Map CRUD ─────────────────────────────────────────────────────

def create_map(title: str, conn=None) -> dict[str, Any]:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "INSERT INTO mind_maps (title) VALUES (?)", (title,)
        )
        conn.commit()
        return get_map(cur.lastrowid, conn=conn)
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
        return cur.rowcount > 0
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
        conn.commit()
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
        conn.commit()
        return cur.rowcount > 0
    finally:
        if close:
            conn.close()


def delete_node(node_id: int, conn=None) -> bool:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "DELETE FROM mind_map_nodes WHERE id=?", (node_id,)
        )
        conn.commit()
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
        return dict(row)
    finally:
        if close:
            conn.close()


def delete_edge(edge_id: int, conn=None) -> bool:
    close = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute(
            "DELETE FROM mind_map_edges WHERE id=?", (edge_id,)
        )
        conn.commit()
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
