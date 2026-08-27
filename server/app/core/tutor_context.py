"""Tutor Context Builder（M4-A）：为 AI Tutor 组装结构化学习上下文。

纯逻辑层：不 import FastAPI，可被 pytest 直接测试。
职责：给定 concept_id，查询 concept/mastery/mistakes/related/review，返回 context dict。
不负责：prompt 组装、LLM 调用、HTTP 响应格式。

可见性白名单（ADR-014 + tutor-context.md）：
  允许：concept, mastery, mistakes, related, review, recent_events
  禁止：vault 全文, settings, api_key, 历史聊天, raw markdown
"""
from __future__ import annotations

import json

from ..db import connect

# 上下文条目限制（防止 token 爆炸）
MAX_MISTAKES = 5
MAX_RELATED = 10
MAX_RECENT_EVENTS = 5


class ConceptNotFoundError(Exception):
    """concept_id 不存在。"""
    def __init__(self, concept_id: int) -> None:
        self.concept_id = concept_id
        super().__init__(f"concept {concept_id} not found")


def _get_concept(conn, concept_id: int) -> dict:
    """获取 concept 摘要。"""
    row = conn.execute(
        "SELECT id, title FROM concepts WHERE id=?", (concept_id,)
    ).fetchone()
    if row is None:
        raise ConceptNotFoundError(concept_id)
    return {"id": row["id"], "title": row["title"]}


def _get_mastery(conn, concept_id: int) -> dict:
    """获取掌握度快照。"""
    row = conn.execute(
        "SELECT dimensions, effective FROM concept_mastery WHERE concept_id=?",
        (concept_id,),
    ).fetchone()
    if row is None:
        return {
            "knowledge": 0.0, "practice": 0.0,
            "recall": 0.0, "transfer": 0.0,
            "effective": 0.0,
        }
    dims = json.loads(row["dimensions"])
    dims["effective"] = row["effective"]
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


def _get_related(conn, concept_id: int) -> list[dict]:
    """图谱 1-hop 邻居概念。"""
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
        (concept_id, concept_id, concept_id, MAX_RELATED),
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


def _get_recent_events(conn, concept_id: int) -> list[dict]:
    """最近 N 条学习事件摘要。"""
    rows = conn.execute(
        "SELECT event_type, source, created_at FROM learning_events "
        "WHERE concept_id=? ORDER BY created_at DESC LIMIT ?",
        (concept_id, MAX_RECENT_EVENTS),
    ).fetchall()
    return [
        {"event_type": r["event_type"], "source": r["source"], "created_at": r["created_at"]}
        for r in rows
    ]


def build_tutor_context(conn, concept_id: int) -> dict:
    """组装 AI Tutor 上下文（ADR-014）。

    返回纯 dict，不含 sensitive 数据。
    concept 不存在时抛出 ConceptNotFoundError。
    """
    concept = _get_concept(conn, concept_id)

    return {
        "concept": concept,
        "mastery": _get_mastery(conn, concept_id),
        "mistakes": _get_mistakes(conn, concept_id),
        "related": _get_related(conn, concept_id),
        "review": _get_review(conn, concept_id),
        "recent_events": _get_recent_events(conn, concept_id),
    }
