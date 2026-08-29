"""Extractor（B3）：回合后第二次 LLM 调用，提取 memories + concept_suggestions。

设计约束（ADR-014 §2.3.1）：
  - LLM 输出 = Action Suggestion，落库由确定式代码执行
  - Extractor 失败静默跳过，不影响主对话
  - 超时 30s，超时静默跳过
  - 不直接写数据库，只返回结构化 dict

禁止：
  - import FastAPI
  - 直接访问 SQLite（落库由调用方负责）
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from .constants import SENSITIVE_CONTENT_PREFIXES
from .providers.base import LLMProvider
from .providers.mock import MockProvider
from ..knowledge import ensure_entity_by_title
from ..memories import upsert_memory, MemoryValidationError
from ..mastery import update_mastery

if TYPE_CHECKING:
    from .config import LLMConfig

logger = logging.getLogger(__name__)

EXTRACTOR_TIMEOUT = 30  # 秒

EXTRACTOR_PROMPT = """You are a learning assistant extractor. Analyze the conversation and extract structured data.

Output ONLY valid JSON with this exact structure:
{{
  "memories": [
    {{
      "kind": "fact|preference|goal|mistake_pattern",
      "content": "string describing the memory",
      "importance": 0.0-1.0,
      "confidence": 0.0-1.0
    }}
  ],
  "concept_suggestions": [
    {{
      "title": "concept name",
      "summary": "brief description",
      "connects": [{{"from": "related concept", "relation": "requires|related"}}]
    }}
  ],
  "learning_events": [
    {{
      "concept": "concept title",
      "type": "explain|answer_correct|answer_wrong",
      "dimension": "knowledge|practice|recall|transfer"
    }}
  ]
}}

Rules:
- Extract ONLY clear, explicit information from the conversation
- Do not invent or assume information
- importance: 0.3 for facts, 0.6 for preferences, 0.8 for goals, 0.7 for mistake patterns
- confidence: how sure you are about the extracted information (0.0-1.0)
- concept_suggestions: only suggest concepts that were explicitly discussed but not yet in the knowledge base
- learning_events: only record events that clearly happened in the conversation
- If nothing to extract, return {{"memories": [], "concept_suggestions": [], "learning_events": []}}

User message: {query}

Assistant response: {answer}

{context_section}"""


def _build_extractor_prompt(query: str, answer: str, context: dict) -> str:
    """构建 extractor prompt。"""
    # 构建 context_section（简洁版）
    context_lines = []
    concept = context.get("concept")
    if concept:
        context_lines.append(f"Current concept: {concept.get('title', 'unknown')}")

    mastery = context.get("mastery")
    if mastery:
        effective = mastery.get("effective", 0)
        context_lines.append(f"Mastery level: {effective:.2f}")

    memories = context.get("memories", [])
    if memories:
        mem_summaries = [m.get("content", "")[:50] for m in memories[:3]]
        context_lines.append(f"Known memories: {', '.join(mem_summaries)}")

    context_section = "\n".join(context_lines) if context_lines else "No additional context."

    return EXTRACTOR_PROMPT.format(
        query=query,
        answer=answer,
        context_section=context_section,
    )


def _sanitize_extractor_output(data: dict) -> dict:
    """过滤 extractor 输出中的敏感内容（api_key 等）。"""
    result = {"memories": [], "concept_suggestions": [], "learning_events": []}

    # 处理 memories
    for mem in data.get("memories", []):
        if not isinstance(mem, dict):
            continue
        content = mem.get("content", "")
        if any(content.startswith(p) for p in SENSITIVE_CONTENT_PREFIXES):
            continue  # 跳过包含敏感前缀的记忆
        result["memories"].append({
            "kind": mem.get("kind", "fact"),
            "content": content,
            "importance": float(mem.get("importance", 0.5)),
            "confidence": float(mem.get("confidence", 0.5)),
        })

    # 处理 concept_suggestions
    for sug in data.get("concept_suggestions", []):
        if not isinstance(sug, dict):
            continue
        title = sug.get("title", "").strip()
        if not title:
            continue
        result["concept_suggestions"].append({
            "title": title,
            "summary": sug.get("summary", ""),
            "connects": sug.get("connects", []),
        })

    # 处理 learning_events
    for evt in data.get("learning_events", []):
        if not isinstance(evt, dict):
            continue
        concept = evt.get("concept", "").strip()
        if not concept:
            continue
        result["learning_events"].append({
            "concept": concept,
            "type": evt.get("type", "explain"),
            "dimension": evt.get("dimension", "knowledge"),
        })

    return result


def new_extractor_provider(config: LLMConfig) -> LLMProvider:
    """从 LLMConfig 创建 extractor 专用 provider（当前直接复用 create_provider）。"""
    from .config import create_provider
    return create_provider(config)


def _apply_memories(conn, memories: list[dict], concepts_json: str) -> int:
    """将 memories 写入数据库。返回写入数量。"""
    count = 0
    for mem in memories:
        kind = mem.get("kind", "fact")
        content = mem.get("content", "")
        importance = mem.get("importance", 0.5)
        confidence = mem.get("confidence", 0.5)

        if not content:
            continue

        try:
            mem_id = upsert_memory(
                conn,
                kind=kind,
                content=content,
                importance=importance,
                confidence=confidence,
                concepts_json=concepts_json,
            )
            if mem_id is not None:
                count += 1
        except MemoryValidationError:
            continue  # 校验失败静默跳过
    return count


def _apply_concept_suggestions(conn, suggestions: list[dict]) -> int:
    """将 concept_suggestions 写入数据库（status=unconfirmed）。返回写入数量。"""
    count = 0
    for sug in suggestions:
        title = sug.get("title", "").strip()
        summary = sug.get("summary", "")

        if not title:
            continue

        try:
            # ensure_entity_by_title: 已存在返回 (type, id, False)，不存在创建桩返回 (type, id, True)
            entity_type, entity_id, created = ensure_entity_by_title(
                conn, title, origin="ai_suggested"
            )
            if created:
                count += 1
        except Exception:
            continue  # 创建失败静默跳过
    return count


def _apply_learning_events(conn, events: list[dict], concepts_json: str) -> int:
    """将 learning_events 写入数据库（经 update_mastery）。返回写入数量。"""
    count = 0
    for evt in events:
        concept_title = evt.get("concept", "").strip()
        event_type = evt.get("type", "explain")
        dimension = evt.get("dimension", "knowledge")

        if not concept_title:
            continue

        # 查找 concept_id
        row = conn.execute(
            "SELECT id FROM concepts WHERE title = ?", (concept_title,)
        ).fetchone()
        if row is None:
            continue  # concept 不存在，跳过

        concept_id = row["id"]

        # 校验 event_type
        valid_event_types = {"explain", "answer_correct", "answer_wrong"}
        if event_type not in valid_event_types:
            event_type = "explain"  # 默认

        # 校验 dimension
        valid_dimensions = {"knowledge", "practice", "recall", "transfer"}
        if dimension not in valid_dimensions:
            dimension = "knowledge"  # 默认

        try:
            update_mastery(
                conn,
                concept_id=concept_id,
                event_type=event_type,
                dimension=dimension,
                weight=0.5,  # extractor 产生的事件权重较低
                source="ai_extractor",
            )
            count += 1
        except Exception:
            continue  # 更新失败静默跳过
    return count


def run_extractor(
    conn,
    *,
    provider: LLMProvider,
    query: str,
    answer: str,
    message_id: int,
    concept_id: int | None = None,
    concepts_json: str = "[]",
) -> dict | None:
    """调用 LLM 提取 memories + concept_suggestions + learning_events。

    Args:
        conn: SQLite 连接（用于写入）
        provider: LLM 提供者
        query: 用户问题
        answer: Tutor 回答
        message_id: assistant 消息 ID（用于写入 context_json）
        concept_id: 当前 concept ID（可选）
        concepts_json: 关联概念标题列表 JSON

    Returns:
        dict 结构（memories/concept_suggestions/learning_events）或 None（失败）
    """
    try:
        # 构建 context（简化版，用于 prompt）
        context = {}
        if concept_id:
            row = conn.execute(
                "SELECT title FROM concepts WHERE id = ?", (concept_id,)
            ).fetchone()
            if row:
                context["concept"] = {"title": row["title"]}

        prompt = _build_extractor_prompt(query, answer, context)
        TutorPrompt = {
            "system": "You are a learning data extractor. Output only valid JSON.",
            "messages": [{"role": "user", "content": prompt}],
            "metadata": {"context_version": "1", "mode": "extractor", "truncated": False},
        }
        response = provider.complete(TutorPrompt)

        # 解析 JSON
        text = response.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text

        data = json.loads(text)

        if not isinstance(data, dict):
            return None

        # 校验并过滤输出
        result = _sanitize_extractor_output(data)

        # 落库（确定式代码执行，LLM 输出 = Action Suggestion）
        memories_count = _apply_memories(conn, result["memories"], concepts_json)
        suggestions_count = _apply_concept_suggestions(conn, result["concept_suggestions"])
        events_count = _apply_learning_events(conn, result["learning_events"], concepts_json)

        # 更新消息 context_json（extractor 快照）
        from ..conversations import update_message_context
        update_message_context(conn, message_id, result)

        logger.debug(
            "Extractor applied: %d memories, %d suggestions, %d events",
            memories_count, suggestions_count, events_count,
        )

        return result

    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
        logger.debug("Extractor parse failed: %s", exc)
        return None
    except Exception as exc:
        logger.debug("Extractor failed: %s", exc)
        return None


__all__ = [
    "EXTRACTOR_TIMEOUT",
    "EXTRACTOR_PROMPT",
    "new_extractor_provider",
    "run_extractor",
]
