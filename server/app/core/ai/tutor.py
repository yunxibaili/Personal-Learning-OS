"""Prompt Assembly（M4-B）：Context + Query → 结构化 Prompt。

纯逻辑层：不 import FastAPI，不访问 SQLite，不调用网络。
职责：将 Context Builder 产出的 TutorContext 组装为可送入 LLM 的结构化 prompt。

安全边界（双重防御）：
  Layer 1: Context Builder 过滤敏感数据（tutor_context.py）
  Layer 2: 本模块二次过滤，防止异常 context 逃逸

禁止：
  - 查询 SQLite
  - 读取文件
  - 调用网络
  - 修改 event / mastery
"""
from __future__ import annotations

from ..tutor_types import TutorContext, TutorMode, TutorPrompt

from .constants import (
    CHARS_PER_TOKEN,
    CONTEXT_CHAR_LIMIT,
    CONTEXT_VERSION,
    MEMORIES_CHAR_BUDGET,
    QUERY_CHAR_LIMIT,
    SENSITIVE_CONTENT_PREFIXES,
    SENSITIVE_FIELD_NAMES,
    SYSTEM_CHAR_LIMIT,
)


# ── System Prompts ─────────────────────────────────────────────────

_SYSTEM_PROMPTS: dict[str, str] = {
    "explain": (
        "You are Learning OS Tutor, a focused learning assistant.\n\n"
        "Rules:\n"
        "- Explain the concept clearly using the learner's context.\n"
        "- Use simple language the learner can understand.\n"
        "- Reference their mastery level to calibrate depth.\n"
        "- If context is insufficient, say 'I don't have enough information'.\n"
        "- Do not invent knowledge beyond the provided context.\n"
    ),
    "hint": (
        "You are Learning OS Tutor, a Socratic learning assistant.\n\n"
        "Rules:\n"
        "- Give hints, do NOT provide the full answer directly.\n"
        "- Guide the learner toward the answer with questions.\n"
        "- Reference their past mistakes to avoid repeating errors.\n"
        "- If context is insufficient, say 'I need more context'.\n"
    ),
    "review": (
        "You are Learning OS Tutor, a spaced repetition assistant.\n\n"
        "Rules:\n"
        "- Help the learner review this concept.\n"
        "- Ask questions to test recall.\n"
        "- Focus on areas with low mastery scores.\n"
        "- If the learner struggles, provide targeted hints.\n"
    ),
}


def _fallback_mode(mode: TutorMode) -> TutorMode:
    """debug 暂不可用，fallback 到 explain。"""
    if mode == "debug":
        return "explain"
    return mode


# ── 安全过滤 ──────────────────────────────────────────────────────

def _sanitize_value(value: str) -> str:
    """过滤字符串值中的敏感内容前缀。"""
    for prefix in SENSITIVE_CONTENT_PREFIXES:
        if value.startswith(prefix):
            return "[REDACTED]"
    return value


def _sanitize_dict(d: dict) -> dict:
    """递归过滤 dict 中的敏感字段和值。"""
    result = {}
    for k, v in d.items():
        key_lower = k.lower().replace("-", "_").replace(" ", "_")
        if key_lower in SENSITIVE_FIELD_NAMES:
            continue  # 删除敏感字段
        if isinstance(v, str):
            result[k] = _sanitize_value(v)
        elif isinstance(v, dict):
            result[k] = _sanitize_dict(v)
        elif isinstance(v, list):
            result[k] = [
                _sanitize_dict(item) if isinstance(item, dict)
                else _sanitize_value(item) if isinstance(item, str)
                else item
                for item in v
            ]
        else:
            result[k] = v
    return result


# ── Token 截断 ────────────────────────────────────────────────────

def _truncate(text: str, char_limit: int) -> tuple[str, bool]:
    """截断文本到字符上限，返回 (截断后文本, 是否被截断)。"""
    if len(text) <= char_limit:
        return text, False
    return text[:char_limit] + "\n...[truncated]", True


# ── Context 格式化 ────────────────────────────────────────────────

def _format_mastery(mastery: dict) -> str:
    """掌握度 → 紧凑文本。"""
    parts = []
    for dim in ("knowledge", "practice", "recall", "transfer"):
        val = mastery.get(dim, 0.0)
        parts.append(f"{dim}:{val:.2f}")
    effective = mastery.get("effective", 0.0)
    parts.append(f"effective:{effective:.2f}")
    return " | ".join(parts)


def _format_context(context: TutorContext) -> tuple[str, bool]:
    """TutorContext → 可读文本，注入 prompt。"""
    sections = []

    # Concept
    concept = context.get("concept")
    if concept:
        sections.append(f"Concept:\n{concept['title']}")

    # Mastery
    mastery = context.get("mastery")
    if mastery:
        sections.append(f"Mastery:\n{_format_mastery(mastery)}")

    # Mistakes
    mistakes = context.get("mistakes", [])
    if mistakes:
        lines = [f"- {m['description']}" for m in mistakes]
        sections.append("Past Mistakes:\n" + "\n".join(lines))

    # Related
    related = context.get("related", [])
    if related:
        lines = [f"- {r['title']} ({r['relation']})" for r in related]
        sections.append("Related Concepts:\n" + "\n".join(lines))

    # Review
    review = context.get("review")
    if review:
        sections.append(
            f"Review:\nnext={review['next_review']} | "
            f"last={review.get('last_result', 'none')}"
        )

    # Recent Events
    events = context.get("recent_events", [])
    if events:
        lines = [f"- {e['event_type']} ({e['source']})" for e in events]
        sections.append("Recent Learning Events:\n" + "\n".join(lines))

    # Referenced Notes（P8-003D：用户显式引用，≤2 篇确定性片段）
    notes = context.get("notes") or []
    if notes:
        lines = [f"- {n['title']}: {n['excerpt']}" for n in notes]
        sections.append("Referenced Notes:\n" + "\n".join(lines))

    # Memories（B8：用户长期记忆 top ≤5，importance×新近度）
    # 方案 C 分段预算（B8-R2 裁决，替代被实证否决的方案 B"前置"）：memories
    # 段独立 2000 字符预算（≈500 tokens），段内截断——既保证 memories 存活，
    # 又不挤占其他段落额度；单头保留的全局截断仅作最终防线。
    memories = context.get("memories") or []
    mem_truncated = False
    if memories:
        lines = [f"- {m['kind']}: {m['content']}" for m in memories]
        block, mem_truncated = _truncate("User Memories:\n" + "\n".join(lines),
                                         MEMORIES_CHAR_BUDGET)
        sections.append(block)

    return "\n\n".join(sections), mem_truncated


# ── 主入口 ────────────────────────────────────────────────────────

def build_prompt(
    context: TutorContext,
    query: str,
    mode: TutorMode = "explain",
) -> TutorPrompt:
    """Context + Query → 结构化 Prompt。

    纯函数：相同输入 → 相同输出。不含 LLM 调用。

    Args:
        context: 由 build_tutor_context() 产出的学习上下文
        query: 用户问题
        mode: tutor 模式（explain/hint/review/debug）

    Returns:
        TutorPrompt: {system, messages, metadata}
    """
    # 1. Mode fallback
    requested_mode = mode
    effective_mode = _fallback_mode(mode)

    # 2. Sanitize context（双重防御 Layer 2）
    safe_context = _sanitize_dict(dict(context))

    # 3. Format context text（memories 段内截断并入 truncated 上报）
    context_text, mem_truncated = _format_context(safe_context)

    # 4. Truncate
    system_text = _SYSTEM_PROMPTS[effective_mode]
    system_text, sys_truncated = _truncate(system_text, SYSTEM_CHAR_LIMIT)
    context_text, ctx_truncated = _truncate(context_text, CONTEXT_CHAR_LIMIT)
    query_text, q_truncated = _truncate(query, QUERY_CHAR_LIMIT)
    truncated = sys_truncated or ctx_truncated or q_truncated or mem_truncated

    # 5. Assemble messages
    user_content = f"Learner context:\n\n{context_text}\n\nQuestion:\n{query_text}"

    # 6. Build metadata
    metadata: dict = {
        "context_version": CONTEXT_VERSION,
        "mode": effective_mode,
        "truncated": truncated,
    }
    if requested_mode != effective_mode:
        metadata["requested_mode"] = requested_mode

    return TutorPrompt(
        system=system_text,
        messages=[{"role": "user", "content": user_content}],
        metadata=metadata,
    )
