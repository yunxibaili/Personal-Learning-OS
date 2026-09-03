"""Tutor Core Types（M4-B）：Python 侧类型定义。

本文件是 Core 内部 contract（纯后端化后 shared/types 已移除），
与 routers 层的 API contract 由 pytest 契约测试守护。
"""
from __future__ import annotations

from typing import Literal, NotRequired, TypedDict


# ── Context 子类型 ─────────────────────────────────────────────────

class ConceptContext(TypedDict):
    id: int
    title: str


class MasteryContext(TypedDict):
    knowledge: float
    practice: float
    recall: float
    transfer: float
    effective: float


class MistakeContext(TypedDict):
    id: int
    description: str
    occurred_at: str


class RelatedContext(TypedDict):
    id: int
    title: str
    relation: str


class ReviewContext(TypedDict):
    next_review: str
    priority: float
    last_result: str | None


class EventContext(TypedDict):
    event_type: str
    source: str
    created_at: str


class MemoryContext(TypedDict):
    """用户长期记忆条目（B8，ADR-014 附录 §2.5.1）。"""
    kind: str
    content: str
    importance: float
    last_used_at: str


class NoteContext(TypedDict):
    """用户显式引用的笔记片段（P8-003D，ADR-014:114 既有条款）。"""
    note_id: int
    title: str
    excerpt: str


# ── TutorContext（核心输入）────────────────────────────────────────

class TutorContext(TypedDict):
    """AI Tutor 上下文快照。由 build_tutor_context() 产出。"""
    concept: NotRequired[ConceptContext]
    mastery: NotRequired[MasteryContext]
    mistakes: list[MistakeContext]
    related: list[RelatedContext]
    review: NotRequired[ReviewContext | None]
    recent_events: list[EventContext]
    notes: NotRequired[list[NoteContext]]
    memories: NotRequired[list[MemoryContext]]


# ── TutorMode ──────────────────────────────────────────────────────

TutorMode = Literal["explain", "hint", "review", "debug"]


# ── Prompt 输出类型 ────────────────────────────────────────────────

class PromptMetadata(TypedDict):
    context_version: str
    mode: str
    requested_mode: NotRequired[str]
    truncated: bool


class TutorPrompt(TypedDict):
    """build_prompt() 输出：可直接送入 LLM Provider 的结构化 prompt。"""
    system: str
    messages: list[dict[str, str]]
    metadata: PromptMetadata
