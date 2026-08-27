"""Tutor API（M4-A）：AI Tutor 上下文查询。

只负责 HTTP 层：参数校验 → 调用 core → 返回 JSON。
不负责：prompt 组装、LLM 调用。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..core.tutor_context import build_tutor_context, ConceptNotFoundError
from ..db import connect

router = APIRouter(prefix="/api/v1/tutor", tags=["tutor"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


@router.get("/context/{concept_id}")
def get_tutor_context(concept_id: int) -> dict:
    """返回 AI Tutor 所需的结构化学习上下文。"""
    conn = connect()
    try:
        return build_tutor_context(conn, concept_id)
    except ConceptNotFoundError:
        return _err(404, "concept_not_found", f"concept {concept_id} not found")
    finally:
        conn.close()
