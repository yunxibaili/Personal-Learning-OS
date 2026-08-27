"""Tutor API（M4-A/C）：AI Tutor 上下文查询 + Smoke 测试端点。

只负责 HTTP 层：参数校验 → 调用 core → 返回 JSON。
不负责：prompt 组装、LLM 调用（M4-B/C 已分离）。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core.tutor_context import build_tutor_context, ConceptNotFoundError
from ..core.ai.service import TutorService
from ..core.ai.providers.mock import MockProvider
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


# ── Smoke Test Endpoint（M4-C 验证用，M4-D 后移除或替换）────────────

class TutorTestRequest(BaseModel):
    concept_id: int
    query: str
    mode: str = "explain"


@router.post("/test")
def tutor_smoke_test(body: TutorTestRequest) -> dict:
    """临时端点：验证 Context → Prompt → Provider → Response 全链路。

    使用 MockProvider，不调用真实 LLM。
    M4-D 完成后此端点可保留为集成测试入口。
    """
    conn = connect()
    try:
        context = build_tutor_context(conn, body.concept_id)
    except ConceptNotFoundError:
        return _err(404, "concept_not_found", f"concept {body.concept_id} not found")
    finally:
        conn.close()

    provider = MockProvider()
    svc = TutorService(provider)
    answer = svc.ask(context, body.query, mode=body.mode)  # type: ignore[arg-type]
    prompt = svc.build_prompt_only(context, body.query, mode=body.mode)  # type: ignore[arg-type]

    return {
        "answer": answer,
        "metadata": {
            "mode": prompt["metadata"]["mode"],
            "concept": context.get("concept", {}).get("title") if isinstance(context.get("concept"), dict) else None,
            "mastery_effective": context.get("mastery", {}).get("effective") if isinstance(context.get("mastery"), dict) else None,
            "provider": "mock",
        },
    }
