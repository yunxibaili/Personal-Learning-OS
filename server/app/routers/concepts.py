"""Concepts API (P8-001A) - /api/v1/concepts 端点。

职责：
- GET /concepts - 列表（支持 domain/origin 过滤）
- GET /concepts/{id} - 详情
- POST /concepts - 创建 concept（不产生学习状态）
- PATCH /concepts/{id} - 更新 metadata（domain/summary/aliases/status）

边界：
- Router 只调用 core，不直接读写 DB
- 不处理 mastery/review/events/links
- 不提供 DELETE（暂缓，避免破坏冻结边界）
- origin 为唯一事实来源；不再使用 source_type
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..core.concepts import (
    VALID_ORIGINS,
    create_concept,
    get_concept,
    get_concept_by_title,
    list_concepts,
    update_concept,
    get_concept_domains,
)
from ..core.universe import _get_mastery
from ..db import connect

router = APIRouter(prefix="/api/v1/concepts", tags=["concepts"])


class ConceptCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    domain: str = Field(default="", max_length=100)
    origin: str = Field(default="manual")
    aliases: list[str] = Field(default_factory=list)
    summary: str = Field(default="", max_length=1000)

    def model_post_init(self, __context):
        if self.origin not in VALID_ORIGINS:
            raise ValueError(f"origin must be one of {VALID_ORIGINS}")


class ConceptPatch(BaseModel):
    domain: str | None = Field(default=None, max_length=100)
    summary: str | None = Field(default=None, max_length=1000)
    aliases: list[str] | None = None
    status: str | None = Field(default=None, pattern="^(active|archived|unconfirmed)$")


def _concept_to_response(conn, concept) -> dict:
    """将 Concept 转换为 API 响应格式（含 mastery）。"""
    mastery = _get_mastery(conn, concept.id)
    return {
        "id": concept.id,
        "title": concept.title,
        "aliases": concept.aliases,
        "summary": concept.summary,
        "domain": concept.domain or None,
        "origin": concept.origin,
        "created_at": concept.created_at,
        "updated_at": concept.updated_at,
        "status": concept.status,
        "mastery": mastery,
    }


@router.get("")
def list_concepts_api(
    domain: str | None = Query(default=None),
    origin: str | None = Query(default=None),
    status: str = Query(default="active"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """获取 concept 列表。"""
    conn = connect()
    try:
        concepts = list_concepts(
            conn,
            domain=domain,
            origin=origin,
            status=status,
            limit=limit,
            offset=offset,
        )
        # 批量获取 mastery
        concept_ids = [c.id for c in concepts]
        mastery_map = {}
        if concept_ids:
            placeholders = ",".join("?" * len(concept_ids))
            rows = conn.execute(
                f"SELECT concept_id, dimensions, effective FROM concept_mastery WHERE concept_id IN ({placeholders})",
                concept_ids,
            ).fetchall()
            for r in rows:
                import json
                dims = json.loads(r["dimensions"]) if r["dimensions"] else {}
                mastery_map[r["concept_id"]] = {
                    "effective": r["effective"],
                    "knowledge": dims.get("knowledge", 0.0),
                    "practice": dims.get("practice", 0.0),
                    "recall": dims.get("recall", 0.0),
                    "transfer": dims.get("transfer", 0.0),
                }
        return {
            "concepts": [
                {
                    "id": c.id,
                    "title": c.title,
                    "aliases": c.aliases,
                    "summary": c.summary,
                    "domain": c.domain or None,
                    "origin": c.origin,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                    "status": c.status,
                    "mastery": mastery_map.get(c.id),
                }
                for c in concepts
            ]
        }
    finally:
        conn.close()


@router.get("/domains")
def list_domains() -> dict:
    """获取所有已使用的 domain 列表。"""
    conn = connect()
    try:
        domains = get_concept_domains(conn)
        return {"domains": domains}
    finally:
        conn.close()


@router.get("/{concept_id}")
def get_concept_api(concept_id: int) -> dict:
    """获取单个 concept 详情。"""
    conn = connect()
    try:
        concept = get_concept(conn, concept_id)
        if not concept:
            raise HTTPException(status_code=404, detail="concept not found")
        return _concept_to_response(conn, concept)
    finally:
        conn.close()


@router.post("", status_code=201)
def create_concept_api(body: ConceptCreate) -> dict:
    """创建新 concept（不产生 learning_event/mastery/review/links）。"""
    conn = connect()
    try:
        # 检查同名 concept
        existing = get_concept_by_title(conn, body.title)
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"concept already exists: {body.title}",
            )

        concept = create_concept(
            conn,
            title=body.title,
            domain=body.domain,
            origin=body.origin,
            aliases=body.aliases,
            summary=body.summary,
        )
        conn.commit()
        return _concept_to_response(conn, concept)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.patch("/{concept_id}")
def patch_concept_api(concept_id: int, body: ConceptPatch) -> dict:
    """更新 concept metadata（domain/summary/aliases/status）。"""
    conn = connect()
    try:
        concept = update_concept(
            conn,
            concept_id,
            domain=body.domain,
            summary=body.summary,
            aliases=body.aliases,
            status=body.status,
        )
        if not concept:
            raise HTTPException(status_code=404, detail="concept not found")
        conn.commit()
        return _concept_to_response(conn, concept)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()