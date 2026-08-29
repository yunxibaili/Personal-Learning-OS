"""Tutor API（M4-A/C）：AI Tutor 上下文查询 + Smoke 测试端点。

只负责 HTTP 层：参数校验 → 调用 core → 返回 JSON。
不负责：prompt 组装、LLM 调用（M4-B/C 已分离）。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core.tutor_context import (
    build_tutor_context,
    ConceptNotFoundError,
    NoteNotFoundError,
    MAX_NOTE_EXCERPTS,
)
from ..core.ai.config import create_provider, load_llm_config
from ..core.ai.errors import ProviderError, ProviderTimeout
from ..core.ai.providers.mock import MockProvider
from ..core.ai.service import TutorService
from ..db import connect

router = APIRouter(prefix="/api/v1/tutor", tags=["tutor"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


@router.get("/context/{concept_id}")
def get_tutor_context(concept_id: int) -> dict:
    """返回 AI Tutor 所需的结构化学习上下文（无笔记引用，notes=[]）。"""
    conn = connect()
    try:
        return build_tutor_context(conn, concept_id)
    except ConceptNotFoundError:
        return _err(404, "concept_not_found", f"concept {concept_id} not found")
    finally:
        conn.close()


# ── P8-003D：显式笔记引用（甲路线，ADR-014:114 + 附录 §2.8.1）────────

class TutorContextRequest(BaseModel):
    concept_id: int
    note_ids: list[int] | None = None  # 用户显式引用，≤2 篇
    auto_notes: bool = False  # P8-003E：FTS5 自动检索补缺（默认关闭）


@router.post("/context")
def post_tutor_context(body: TutorContextRequest) -> dict:
    """带可选笔记引用的结构化上下文。

    note_ids 由用户在 UI 显式选择（TutorPanel 选择器）——不自动检索；
    注入时 related/recent 预算收缩（DATA_MODEL.md §C 预算增记）。
    """
    note_ids = body.note_ids or []
    if len(note_ids) > MAX_NOTE_EXCERPTS:
        return _err(400, "too_many_notes",
                    f"note_ids 最多 {MAX_NOTE_EXCERPTS} 篇")
    note_ids = list(dict.fromkeys(note_ids))  # 去重保序（≤2 时无害）
    conn = connect()
    try:
        return build_tutor_context(conn, body.concept_id, note_ids=note_ids,
                                   auto_notes=body.auto_notes)
    except ConceptNotFoundError:
        return _err(404, "concept_not_found",
                    f"concept {body.concept_id} not found")
    except NoteNotFoundError as exc:
        return _err(404, "note_not_found", str(exc))
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
        provider = create_provider(load_llm_config(conn))  # conn 打开期间读 settings
    except ConceptNotFoundError:
        return _err(404, "concept_not_found", f"concept {body.concept_id} not found")
    finally:
        conn.close()

    svc = TutorService(provider)
    try:
        answer = svc.ask(context, body.query, mode=body.mode)
        prompt = svc.build_prompt_only(context, body.query, mode=body.mode)
    except ProviderTimeout as exc:
        return _err(504, "provider_timeout", str(exc))
    except ProviderError as exc:
        return _err(502, "provider_error", str(exc))

    return {
        "answer": answer,
        "metadata": {
            "mode": prompt["metadata"]["mode"],
            "concept": context.get("concept", {}).get("title") if isinstance(context.get("concept"), dict) else None,
            "mastery_effective": context.get("mastery", {}).get("effective") if isinstance(context.get("mastery"), dict) else None,
            "provider": "mock" if isinstance(provider, MockProvider) else type(provider).__name__,
        },
    }
