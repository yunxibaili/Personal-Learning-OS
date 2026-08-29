"""Mistakes API（B12）：错题本读 / 更新 / 删除 / 统计。

补足 mistakes 表的消费面——生产者（update_mastery on answer_wrong）已有，
此路由让错题本「可见、可改已解决、可删、可统计」。
"""
from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..core import mistakes as M
from ..db import connect

router = APIRouter(prefix="/api/v1", tags=["mistakes"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


class MistakePatch(BaseModel):
    resolved: bool = Field(...)


# 注意：'/mistakes/stats' 必须声明在 '/mistakes/{mistake_id}' 之前，避免被 {id} 捕获


@router.get("/mistakes")
def list_mistakes_endpoint(
    resolved: bool | None = Query(default=None),
    concept_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    sort: str = Query(default="occurred_at", pattern="^(occurred_at|concept)$"),
) -> dict:
    conn = connect()
    try:
        return {"mistakes": M.list_mistakes(
            conn, resolved=resolved, concept_id=concept_id,
            limit=limit, offset=offset, sort=sort)}
    finally:
        conn.close()


@router.get("/mistakes/stats")
def mistakes_stats() -> dict:
    conn = connect()
    try:
        return {"stats": M.mistake_stats(conn)}
    finally:
        conn.close()


@router.get("/mistakes/{mistake_id}")
def get_mistake_endpoint(mistake_id: int) -> dict:
    conn = connect()
    try:
        return {"mistake": M.get_mistake(conn, mistake_id)}
    except M.MistakeNotFoundError:
        return _err(404, "mistake_not_found",
                    f"mistake {mistake_id} not found")
    finally:
        conn.close()


@router.patch("/mistakes/{mistake_id}")
def patch_mistake(mistake_id: int, body: MistakePatch) -> dict:
    conn = connect()
    try:
        return {"mistake": M.set_mistake_resolved(conn, mistake_id, body.resolved)}
    except M.MistakeNotFoundError:
        return _err(404, "mistake_not_found",
                    f"mistake {mistake_id} not found")
    finally:
        conn.close()


@router.delete("/mistakes/{mistake_id}")
def delete_mistake(mistake_id: int) -> dict:
    conn = connect()
    try:
        M.delete_mistake(conn, mistake_id)
    except M.MistakeNotFoundError:
        return _err(404, "mistake_not_found",
                    f"mistake {mistake_id} not found")
    finally:
        conn.close()
    return {"ok": True}
