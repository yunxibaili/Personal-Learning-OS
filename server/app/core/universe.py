"""Universe Projection（M3b-001）：Graph Data → Universe 可视化格式。

职责：
  - 查询 concepts + links + mastery
  - 组装为后端定义的 nodes/edges 可视化格式
  - 不做布局计算（布局属于可视化层，ADR-007/018）

禁止：
  - 修改 concepts / links / mastery 表
  - 引入 FastAPI
  - 引入前端可视化库（布局/渲染职责不在 core）
"""
from __future__ import annotations

import json
from typing import Any

from ..db import connect


def get_universe_projection(conn=None) -> dict[str, Any]:
    """返回完整的 Universe 投影：{ nodes: [...], edges: [...] }。

    nodes: [{ id, label, type, mastery }]
    edges: [{ source, target, relation }]
    """
    close = False
    if conn is None:
        conn = connect()
        close = True
    try:
        return _build_projection(conn)
    finally:
        if close:
            conn.close()


def _build_projection(conn) -> dict[str, Any]:
    nodes = _build_nodes(conn)
    edges = _build_edges(conn)
    return {"nodes": nodes, "edges": edges}


def _build_nodes(conn) -> list[dict[str, Any]]:
    """构建 Universe 节点列表。"""
    rows = conn.execute(
        "SELECT id, title, domain, status FROM concepts ORDER BY id"
    ).fetchall()

    nodes: list[dict[str, Any]] = []
    for r in rows:
        mastery = _get_mastery(conn, r["id"])
        nodes.append({
            "id": r["id"],
            "label": r["title"],
            "type": "concept",
            "domain": r["domain"] or None,
            "status": r["status"],
            "mastery": mastery,
        })
    return nodes


def _get_mastery(conn, concept_id: int) -> dict[str, Any] | None:
    """获取单个 concept 的 mastery 数据。"""
    row = conn.execute(
        "SELECT dimensions, effective FROM concept_mastery WHERE concept_id=?",
        (concept_id,),
    ).fetchone()
    if row is None:
        return None
    dims = json.loads(row["dimensions"]) if row["dimensions"] else {}
    return {
        "effective": row["effective"],
        "knowledge": dims.get("knowledge", 0.0),
        "practice": dims.get("practice", 0.0),
        "recall": dims.get("recall", 0.0),
        "transfer": dims.get("transfer", 0.0),
    }


def _build_edges(conn) -> list[dict[str, Any]]:
    """构建 Universe 边列表。"""
    rows = conn.execute(
        "SELECT source_type, source_id, target_type, target_id, relation "
        "FROM links ORDER BY id"
    ).fetchall()

    # 只保留 concept ↔ concept 的边（Universe 只展示概念节点）
    edges: list[dict[str, Any]] = []
    for r in rows:
        if r["source_type"] == "concept" and r["target_type"] == "concept":
            edges.append({
                "source": r["source_id"],
                "target": r["target_id"],
                "relation": r["relation"],
            })
    return edges
