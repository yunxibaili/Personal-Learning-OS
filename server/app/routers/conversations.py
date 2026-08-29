"""Conversations & Chat API（B7）：对话持久化 + 最小非流式对话端点。

- GET  /conversations              对话列表
- POST /conversations              新建空对话
- GET  /conversations/{id}/messages 消息回放（含 context 快照）
- DELETE /conversations/{id}        删除（messages 级联）
- POST /chat                        一轮对话：context → provider → 落库

Chat 编排：build_tutor_context（可选 concept/note 引用）→ TutorService.ask / ask_stream
（settings 驱动 factory）→ 双消息落库。默认非流式 JSON；stream=true 走 SSE（B2）。
"""
from __future__ import annotations

import json
import logging
from collections.abc import Iterator

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from ..core.ai import extractor as ai_extractor
from ..core.ai.config import create_provider, load_llm_config
from ..core.ai.errors import ProviderError, ProviderTimeout, TutorError
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["conversations"])

MAX_QUERY_CHARS = 2000  # 与 core/ai/constants.QUERY_CHAR_LIMIT 对齐：超限 400 拒绝，避免"落库原文≠模型所见"的静默截断不一致

# 流式错误事件码 ← TutorError 子类：与主对话错误码保持一致（前端按 event: error 分支）
_TUTOR_ERROR_CODES = {
    "ProviderTimeout": "provider_timeout",
    "ProviderError": "provider_error",
    "ProviderUnavailable": "provider_unavailable",
}


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


def _sse(event: str | None, data: dict) -> bytes:
    """SSE 帧序列化。``event=None`` 为默认 data 帧；否则 ``event: <name>`` + ``data:``。"""
    payload = json.dumps(data, ensure_ascii=False)
    if event:
        return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")
    return f"data: {payload}\n\n".encode("utf-8")


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
    stream: bool = False  # B2：true → SSE 流式（text/event-stream）；false（默认）→ 非流式 JSON


# ── B3 extractor 共用步骤（非流式 / 流式 finally 复用，避免双写分歧）──

def _apply_turn_extractor(
    conn,
    *,
    query: str,
    answer: str,
    assistant_msg_id: int,
    concept_id: int | None,
    concept_titles_for_notes: list[str],
) -> None:
    """回合后二次 LLM 调用（B3）：静默跳过，不阻断主回复。

    与主对话解耦：任何异常仅记日志，上报调用方继续 commit 主消息。
    """
    cfg = load_llm_config(conn)
    try:
        result = ai_extractor.run_extractor(
            conn,
            provider=ai_extractor.new_extractor_provider(cfg),
            query=query,
            answer=answer,
            message_id=assistant_msg_id,
            concept_id=concept_id,
            concepts_json=json.dumps(concept_titles_for_notes, ensure_ascii=False),
        )
        if result:
            conn.commit()
    except Exception:  # noqa: BLE001 — spec：静默跳过，主对话不受影响；带日志
        logger.warning("extractor: skipped", exc_info=True)


def _chat_stream(body: ChatRequest, query: str, note_ids: list[int]) -> Iterator[bytes]:
    """B2 SSE 流式生成器：逐块下发扬出的回答增量，结尾 event: done。

    关键风险防护（前置③）：assistant 消息落库与 extractor 均置于 ``try/finally``——
    即便客户端中途断开（GeneratorExit 于某个 yield 触发），finally 依然
    以已累积的增量拼装整段回答落库，随后关闭连接。

    SSE 帧契约（与 shared/types/tutor.ts 对齐）：
      - 数据帧   ``data: {"text": "<chunk>"}`` ×N
      - 正常收尾 ``event: done``   ``data: {"conversation_id": N}``
      - 出错     ``event: error``  ``data: {"code": "...", "message": "..."}``
    """
    conn = connect()
    try:
        if body.conversation_id is not None and not conversation_exists(
            conn, body.conversation_id):
            try:
                yield _sse("error", {"code": "conversation_not_found",
                                     "message": f"conversation {body.conversation_id} not found"})
            finally:
                conn.close()
            return

        conv_id = body.conversation_id
        context: dict = {}
        if body.concept_id is not None:
            context = dict(build_tutor_context(
                conn, body.concept_id,
                note_ids=list(dict.fromkeys(note_ids)),
                auto_notes=body.auto_notes,
            ))

        provider = create_provider(load_llm_config(conn))
        if conv_id is None:
            conv_id = create_conversation(conn, title=query[:50])
        append_message(conn, conv_id, role="user", content=query)
        conn.commit()

        svc = TutorService(provider)
        tokens: list[str] = []
        assistant_msg_id: int | None = None
        failed = False
        try:
            for chunk in svc.ask_stream(context, query, mode=body.mode):
                if not chunk:
                    continue
                tokens.append(chunk)
                yield _sse(None, {"text": chunk})
        except TutorError as exc:
            failed = True
            yield _sse("error", {
                "code": _TUTOR_ERROR_CODES.get(type(exc).__name__, "provider_error"),
                "message": exc.user_message,
            })
        finally:
            try:
                answer = "".join(tokens)
                assistant_msg_id = append_message(
                    conn, conv_id, role="assistant", content=answer, context=context)
                _apply_turn_extractor(
                    conn, query=query, answer=answer,
                    assistant_msg_id=assistant_msg_id, concept_id=body.concept_id,
                    concept_titles_for_notes=(
                        [context["concept"]["title"]] if context.get("concept") else []),
                )
                conn.commit()
            finally:
                conn.close()

        if not failed and assistant_msg_id is not None:
            yield _sse("done", {"conversation_id": conv_id})
    except (ConceptNotFoundError, NoteNotFoundError) as exc:
        conn.close()
        yield _sse("error", {
            "code": "concept_not_found" if isinstance(exc, ConceptNotFoundError) else "note_not_found",
            "message": str(exc),
        })
    except (ProviderTimeout, ProviderError) as exc:
        conn.close()
        yield _sse("error", {
            "code": "provider_timeout" if isinstance(exc, ProviderTimeout) else "provider_error",
            "message": exc.user_message,
        })
    except Exception as exc:  # noqa: BLE001 — 流式下兜底：任何意外不抛给用户，落 SSE error
        logger.warning("chat stream: unexpected error", exc_info=True)
        conn.close()
        yield _sse("error", {"code": "provider_error", "message": "stream interrupted"})


@router.post("/chat", response_model=None)
def post_chat(body: ChatRequest) -> dict | StreamingResponse:
    query = body.query.strip()
    if not query:
        return _err(400, "empty_query", "query 不能为空")
    note_ids = body.note_ids or []
    if len(note_ids) > 2:
        return _err(400, "too_many_notes", "note_ids 最多 2 篇")

    if body.stream:
        # 流式：生成器自持连接（连接生命周期随响应消费结束），router 不得在此闭 conn
        return StreamingResponse(
            _chat_stream(body, query, list(dict.fromkeys(note_ids))),
            media_type="text/event-stream",
        )

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
        assistant_msg_id = append_message(conn, conv_id, role="assistant",
                                          content=answer, context=context)

        # 5. B3 extractor：回合后抽取（闲聊也提取偏好/事实——无 concept 门控）
        # R6：concepts_json 记概念标题（DDL 注释语义 ["特征值", ...]，B8 按此过滤）
        concept_titles_for_notes = (
            [context["concept"]["title"]] if context.get("concept") else [])
        _apply_turn_extractor(
            conn, query=query, answer=answer, assistant_msg_id=assistant_msg_id,
            concept_id=body.concept_id,
            concept_titles_for_notes=concept_titles_for_notes,
        )

        conn.commit()  # 事务收口（update_mastery/消息统一持久化）
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
