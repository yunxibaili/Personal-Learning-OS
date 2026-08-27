"""MindMap API（M2b-001/002）：用户思考空间 CRUD + Concept Binding。

ADR-019 冻结：
  - 不改变 mastery / learning_events
  - concept binding 是引用（concept_id nullable）

Endpoints:
  GET    /api/v1/mindmaps           — 列出所有 Map
  POST   /api/v1/mindmaps           — 创建 Map
  GET    /api/v1/mindmaps/{id}      — 获取 Map（含 nodes + edges）
  DELETE /api/v1/mindmaps/{id}      — 删除 Map
  POST   /api/v1/mindmaps/{id}/nodes  — 添加节点
  PATCH  /api/v1/mindmaps/{id}/nodes/{nid} — 更新节点位置/标签
  DELETE /api/v1/mindmaps/{id}/nodes/{nid} — 删除节点
  POST   /api/v1/mindmaps/{id}/nodes/{nid}/bind — 绑定 Concept
  DELETE /api/v1/mindmaps/{id}/nodes/{nid}/bind — 解除绑定
  POST   /api/v1/mindmaps/{id}/edges  — 添加边
  DELETE /api/v1/mindmaps/{id}/edges/{eid} — 删除边
  GET    /api/v1/mindmaps/concepts/search?q= — 搜索 Concepts
"""
from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query

from ..core.mindmap import (
    add_edge,
    add_node,
    bind_concept,
    create_map,
    delete_edge,
    delete_map,
    delete_node,
    get_map,
    list_maps,
    search_concepts,
    unbind_concept,
    update_node_label,
    update_node_position,
)

router = APIRouter(prefix="/api/v1/mindmaps", tags=["mindmap"])


# ── Request Bodies ───────────────────────────────────────────────

class MapCreate(BaseModel):
    title: str


class NodeCreate(BaseModel):
    label: str
    concept_id: int | None = None
    position_x: float = 0
    position_y: float = 0
    note: str = ""


class NodeUpdate(BaseModel):
    label: str | None = None
    position_x: float | None = None
    position_y: float | None = None
    note: str | None = None


class EdgeCreate(BaseModel):
    source: int
    target: int
    relation: str = "related"


# ── Map Endpoints ────────────────────────────────────────────────

@router.get("")
def api_list_maps() -> list[dict]:
    return list_maps()


@router.post("", status_code=201)
def api_create_map(body: MapCreate) -> dict:
    if not body.title.strip():
        raise HTTPException(400, "title required")
    return create_map(body.title.strip())


@router.get("/{map_id}")
def api_get_map(map_id: int) -> dict:
    m = get_map(map_id)
    if m is None:
        raise HTTPException(404, "map not found")
    return m


@router.delete("/{map_id}")
def api_delete_map(map_id: int) -> dict:
    if not delete_map(map_id):
        raise HTTPException(404, "map not found")
    return {"ok": True}


# ── Node Endpoints ───────────────────────────────────────────────

@router.post("/{map_id}/nodes", status_code=201)
def api_add_node(map_id: int, body: NodeCreate) -> dict:
    m = get_map(map_id)
    if m is None:
        raise HTTPException(404, "map not found")
    return add_node(
        map_id=map_id,
        label=body.label,
        concept_id=body.concept_id,
        position_x=body.position_x,
        position_y=body.position_y,
        note=body.note,
    )


@router.patch("/{map_id}/nodes/{node_id}")
def api_update_node(map_id: int, node_id: int, body: NodeUpdate) -> dict:
    m = get_map(map_id)
    if m is None:
        raise HTTPException(404, "map not found")
    if body.position_x is not None and body.position_y is not None:
        update_node_position(node_id, body.position_x, body.position_y)
    if body.label is not None:
        update_node_label(node_id, body.label)
    return {"ok": True}


@router.delete("/{map_id}/nodes/{node_id}")
def api_delete_node(map_id: int, node_id: int) -> dict:
    if not delete_node(node_id):
        raise HTTPException(404, "node not found")
    return {"ok": True}


# ── Concept Binding（ADR-019：引用，不改 mastery/event）────────

class BindConcept(BaseModel):
    concept_id: int


@router.post("/{map_id}/nodes/{node_id}/bind")
def api_bind_concept(map_id: int, node_id: int, body: BindConcept) -> dict:
    """绑定 MindMap 节点到 Concept（只写 concept_id）。"""
    m = get_map(map_id)
    if m is None:
        raise HTTPException(404, "map not found")
    result = bind_concept(node_id, body.concept_id)
    if result is None:
        raise HTTPException(404, "node or concept not found")
    return result


@router.delete("/{map_id}/nodes/{node_id}/bind")
def api_unbind_concept(map_id: int, node_id: int) -> dict:
    """解除 MindMap 节点的 Concept 绑定。"""
    m = get_map(map_id)
    if m is None:
        raise HTTPException(404, "map not found")
    if not unbind_concept(node_id):
        raise HTTPException(404, "node not found")
    return {"ok": True}


# ── Concept Search ───────────────────────────────────────────────

@router.get("/concepts/search")
def api_search_concepts(q: str = Query(""), limit: int = Query(20)) -> list[dict]:
    """搜索 Concepts（用于 MindMap 绑定选择）。"""
    return search_concepts(q, limit)


# ── Edge Endpoints ───────────────────────────────────────────────

@router.post("/{map_id}/edges", status_code=201)
def api_add_edge(map_id: int, body: EdgeCreate) -> dict:
    m = get_map(map_id)
    if m is None:
        raise HTTPException(404, "map not found")
    return add_edge(
        map_id=map_id,
        source=body.source,
        target=body.target,
        relation=body.relation,
    )


@router.delete("/{map_id}/edges/{edge_id}")
def api_delete_edge(map_id: int, edge_id: int) -> dict:
    if not delete_edge(edge_id):
        raise HTTPException(404, "edge not found")
    return {"ok": True}
