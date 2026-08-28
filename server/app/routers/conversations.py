"""Conversations & Chat API（B7）：对话持久化 + 最小非流式对话端点。

- GET  /conversations              对话列表
- POST /conversations              新建空对话
- GET  /conversations/{id}/messages 消息回放（含 context 快照）
- DELETE /conversations/{id}        删除（messages 级联）
- POST /chat                        一轮对话：context → provider → 落库

Chat 编排：build_tutor_context（可选 concept/note 引用）→ TutorService.ask
（settings 驱动 factory）→ 双消息落库。非流式；SSE（B2）增量叠加。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..core.ai.config import create_provider, load_llm_config
from ..core.ai.errors import ProviderError, ProviderTimeout
from ..core.ai.service import TutorService
from ..core.conversations import (
    ConversationNotFoundError,
    append_message,
    conversation_exists,
    create_conversation,
    delete_conversation,
    get_messages,
    list_conversations,
)
from ..core.tutor_context import (
    ConceptNotFoundError,
    NoteNotFoundError,
    build_tutor_context,
)
from ..core.tutor_types import TutorMode
from ..db import connect

router = APIRouter(prefix="/api/v1", tags=["conversations"])

MAX_QUERY_CHARS = 2000  # 与 core/ai/constants.QUERY_CHAR_LIMIT 对齐：超限 400 拒绝，避免"落库原文≠模型所见"的静默截断不一致


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


@router.get("/conversations")
def get_conversations() -> dict:
    conn = connect()
    try:
        return {"conversations": list_conversations(conn)}
    finally:
        conn.close()


@router.post("/conversations", status_code=201)
def post_conversation(body: ConversationCreate) -> dict:
    conn = connect()
    try:
        conv_id = create_conversation(conn, body.title or "")
        return {"id": conv_id, "title": (body.title or "").strip() or "新对话"}
    finally:
        conn.close()


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: int) -> dict:
    conn = connect()
    try:
        return {"messages": get_messages(conn, conversation_id)}
    except ConversationNotFoundError:
        return _err(404, "conversation_not_found",
                    f"conversation {conversation_id} not found")
    finally:
        conn.close()


@router.delete("/conversations/{conversation_id}")
def delete_conversation_by_id(conversation_id: int) -> dict:
    conn = connect()
    try:
        delete_conversation(conn, conversation_id)
    except ConversationNotFoundError:
        return _err(404, "conversation_not_found",
                    f"conversation {conversation_id} not found")
    finally:
        conn.close()
    return {"ok": True}


# ── 最小非流式对话（B7 核心端点）────────────────────────────────────

class ChatRequest(BaseModel):
    concept_id: int | None = None
    note_ids: list[int] | None = None  # P8-003D 甲路线透传，≤2
    auto_notes: bool = False
    conversation_id: int | None = None
    query: str = Field(..., min_length=1, max_length=MAX_QUERY_CHARS)
    mode: TutorMode = "explain"


@router.post("/chat")
def post_chat(body: ChatRequest) -> dict:
    query = body.query.strip()
    if not query:
        return _err(400, "empty_query", "query 不能为空")
    note_ids = body.note_ids or []
    if len(note_ids) > 2:
        return _err(400, "too_many_notes", "note_ids 最多 2 篇")

    conn = connect()
    try:
        # 1. 对话定位（已有对话校验存在）
        conv_id = body.conversation_id
        if conv_id is not None and not conversation_exists(conn, conv_id):
            return _err(404, "conversation_not_found",
                        f"conversation {conv_id} not found")

        # 2. context（concept 可选；引用/自动笔记可选）
        context: dict = {}
        if body.concept_id is not None:
            context = dict(build_tutor_context(
                conn, body.concept_id, note_ids=list(dict.fromkeys(note_ids)),
                auto_notes=body.auto_notes,
            ))

        # 3. provider（settings 驱动 factory）→ 回答
        #    P1 修正：ask 在建对话之前——provider 失败不再残留孤儿空对话
        provider = create_provider(load_llm_config(conn))
        answer = TutorService(provider).ask(context, query, mode=body.mode)

        # 4. 落库（仅 ask 成功后）：新建对话 + user/assistant 双消息
        if conv_id is None:
            conv_id = create_conversation(conn, title=query[:50])
        append_message(conn, conv_id, role="user", content=query)
        append_message(conn, conv_id, role="assistant", content=answer,
                       context=context)

        return {"conversation_id": conv_id, "answer": answer}
    except ConceptNotFoundError:
        return _err(404, "concept_not_found",
                    f"concept {body.concept_id} not found")
    except NoteNotFoundError as exc:
        return _err(404, "note_not_found", str(exc))
    except ProviderTimeout as exc:
        return _err(504, "provider_timeout", str(exc))
    except ProviderError as exc:
        return _err(502, "provider_error", str(exc))
    finally:
        conn.close()
