"""Tutor Context Builder（M4-A / P8-003D）：为 AI Tutor 组装结构化学习上下文。

纯逻辑层：不 import FastAPI，可被 pytest 直接测试。
职责：给定 concept_id（+可选 note_ids），查询 concept/mastery/mistakes/related/
review/recent_events/notes，返回 context dict。
不负责：prompt 组装、LLM 调用、HTTP 响应格式。

可见性白名单（ADR-014 + tutor-context.md + P8-003D 附录）：
  允许：concept, mastery, mistakes, related, review, recent_events,
       notes（仅用户显式引用的 ≤2 篇，确定性片段 ≤600 字符）
  禁止：未引用笔记全文, settings, api_key, 历史聊天
"""
from __future__ import annotations

import json

from ..db import connect
from .knowledge import (
    extract_snippet,
    get_note_row,
    read_note_file,
    search_notes,
)
from .mastery import get_effective_now
from .tutor_types import TutorContext

# 上下文条目限制（防止 token 爆炸）
MAX_MISTAKES = 5
MAX_RELATED = 10
MAX_RECENT_EVENTS = 5

# P8-003D 笔记引用（甲路线：仅用户显式引用；乙自动检索属 P8-003E）
MAX_NOTE_EXCERPTS = 2
MAX_NOTE_EXCERPT_CHARS = 600
# 注入笔记时的收缩预算（tutor-context.md §5 增记）：related/recent 让位
NOTE_RELATED_CAP = 6
NOTE_RECENT_CAP = 3


class ConceptNotFoundError(Exception):
    """concept_id 不存在。"""
    def __init__(self, concept_id: int) -> None:
        self.concept_id = concept_id
        super().__init__(f"concept {concept_id} not found")


class NoteNotFoundError(Exception):
    """note_id 不存在（P8-003D）。"""
    def __init__(self, note_id: int) -> None:
        self.note_id = note_id
        super().__init__(f"note {note_id} not found")


def _get_concept(conn, concept_id: int) -> dict:
    """获取 concept 摘要。"""
    row = conn.execute(
        "SELECT id, title FROM concepts WHERE id=?", (concept_id,)
    ).fetchone()
    if row is None:
        raise ConceptNotFoundError(concept_id)
    return {"id": row["id"], "title": row["title"]}


def _get_mastery(conn, concept_id: int) -> dict:
    """获取掌握度快照（含时间衰减）。"""
    row = conn.execute(
        "SELECT dimensions FROM concept_mastery WHERE concept_id=?",
        (concept_id,),
    ).fetchone()
    if row is None:
        return {
            "knowledge": 0.0, "practice": 0.0,
            "recall": 0.0, "transfer": 0.0,
            "effective": 0.0,
        }
    dims = json.loads(row["dimensions"])
    dims["effective"] = get_effective_now(conn, concept_id)
    return dims


def _get_mistakes(conn, concept_id: int) -> list[dict]:
    """最近 N 条错误记录。"""
    rows = conn.execute(
        "SELECT id, description, occurred_at FROM mistakes "
        "WHERE concept_id=? ORDER BY occurred_at DESC LIMIT ?",
        (concept_id, MAX_MISTAKES),
    ).fetchall()
    return [
        {"id": r["id"], "description": r["description"], "occurred_at": r["occurred_at"]}
        for r in rows
    ]


def _get_related(conn, concept_id: int, limit: int | None = None) -> list[dict]:
    """图谱 1-hop 邻居概念。注入笔记时用收缩上限（NOTE_RELATED_CAP）。"""
    rows = conn.execute(
        "SELECT DISTINCT c.id, c.title, l.relation "
        "FROM links l "
        "JOIN concepts c ON ( "
        "  (l.source_type='concept' AND l.source_id=? AND l.target_type='concept' AND c.id=l.target_id) "
        "  OR "
        "  (l.target_type='concept' AND l.target_id=? AND l.source_type='concept' AND c.id=l.source_id) "
        ") "
        "WHERE c.id != ? "
        "LIMIT ?",
        (concept_id, concept_id, concept_id, limit if limit is not None else MAX_RELATED),
    ).fetchall()
    return [
        {"id": r["id"], "title": r["title"], "relation": r["relation"]}
        for r in rows
    ]


def _get_review(conn, concept_id: int) -> dict | None:
    """复习状态。"""
    row = conn.execute(
        "SELECT due_at, priority, last_result "
        "FROM review_queue WHERE concept_id=?",
        (concept_id,),
    ).fetchone()
    if row is None:
        return None
    return {
        "next_review": row["due_at"],
        "priority": row["priority"],
        "last_result": row["last_result"],
    }


def _get_recent_events(conn, concept_id: int, limit: int | None = None) -> list[dict]:
    """最近 N 条学习事件摘要。注入笔记时用收缩上限（NOTE_RECENT_CAP）。"""
    rows = conn.execute(
        "SELECT event_type, source, created_at FROM learning_events "
        "WHERE concept_id=? ORDER BY created_at DESC LIMIT ?",
        (concept_id, limit if limit is not None else MAX_RECENT_EVENTS),
    ).fetchall()
    return [
        {"event_type": r["event_type"], "source": r["source"], "created_at": r["created_at"]}
        for r in rows
    ]


def _get_user_notes(conn, note_ids: list[int]) -> list[dict]:
    """读取用户显式引用的笔记（P8-003D 甲路线，ADR-014:114）。

    只取调用方传入的 id——绝不自动扩展读取面（反向断言的根基）。
    片段为确定性切片（extract_snippet），可复算。
    引用了但不存在的 id → NoteNotFoundError（由 router 转 404）。
    """
    if not note_ids:
        return []
    placeholders = ",".join("?" * len(note_ids))
    rows = conn.execute(
        f"SELECT id, title, path FROM notes WHERE id IN ({placeholders})",
        list(note_ids),
    ).fetchall()
    by_id = {r["id"]: r for r in rows}
    out: list[dict] = []
    for nid in note_ids:  # 保持调用方顺序
        r = by_id.get(nid)
        if r is None:
            raise NoteNotFoundError(nid)
        try:
            _, body = read_note_file(r["path"])
        except (OSError, ValueError):
            body = ""
        out.append({
            "note_id": r["id"],
            "title": r["title"],
            "excerpt": extract_snippet(body, max_chars=MAX_NOTE_EXCERPT_CHARS),
        })
    return out


def _get_auto_notes(conn, concept_id: int, exclude_ids: list[int],
                    limit: int) -> list[dict]:
    """乙路线自动检索（ADR-014 附录 §2.8.1.2 许可）：concept 标题+别名查 notes_fts。

    显式引用优先：exclude_ids（已引用）被跳过，只补剩余名额。
    检索词来自概念自身元数据，非用户查询——可审计、可复算。
    """
    row = conn.execute(
        "SELECT title, aliases_json FROM concepts WHERE id=?", (concept_id,)
    ).fetchone()
    if row is None:
        return []
    terms = [row["title"]] + json.loads(row["aliases_json"] or "[]")
    out: list[dict] = []
    for term in terms:
        if not term or len(out) >= limit:
            break
        for hit in search_notes(conn, term, limit=limit + len(exclude_ids)):
            if hit["note_id"] in exclude_ids:
                continue
            if any(n["note_id"] == hit["note_id"] for n in out):
                continue
            note_row = get_note_row(conn, hit["note_id"])
            if note_row is None:
                continue
            try:
                _, body = read_note_file(note_row["path"])
            except (OSError, ValueError):
                continue
            out.append({
                "note_id": hit["note_id"],
                "title": note_row["title"],
                "excerpt": extract_snippet(body, query=term,
                                           max_chars=MAX_NOTE_EXCERPT_CHARS),
            })
            if len(out) >= limit:
                break
    return out


def build_tutor_context(conn, concept_id: int,
                        note_ids: list[int] | None = None,
                        auto_notes: bool = False) -> TutorContext:
    """组装 AI Tutor 上下文（ADR-014 + P8-003D/003E 附录）。

    note_ids：用户显式引用（甲路线，≤2）。
    auto_notes=True：以 concept 标题+别名 FTS 检索，只补显式引用之外的
    剩余名额（乙路线；默认 False——隐私面扩大必须显式开启）。
    返回 TutorContext，不含 sensitive 数据。
    concept 不存在时抛出 ConceptNotFoundError；note 不存在抛出 NoteNotFoundError。
    """
    concept = _get_concept(conn, concept_id)
    notes = _get_user_notes(conn, list(note_ids)) if note_ids else []
    if auto_notes and len(notes) < MAX_NOTE_EXCERPTS:
        exclude = [n["note_id"] for n in notes]
        notes = notes + _get_auto_notes(
            conn, concept_id, exclude, MAX_NOTE_EXCERPTS - len(notes),
        )

    return TutorContext(
        concept=concept,
        mastery=_get_mastery(conn, concept_id),
        mistakes=_get_mistakes(conn, concept_id),
        related=_get_related(
            conn, concept_id,
            limit=NOTE_RELATED_CAP if notes else None,
        ),
        review=_get_review(conn, concept_id),
        recent_events=_get_recent_events(
            conn, concept_id,
            limit=NOTE_RECENT_CAP if notes else None,
        ),
        notes=notes,
    )
