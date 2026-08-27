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
