"""Learning Graph API：掌握度 + 事件 + 复习队列（M3）。"""
from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core import mastery as M
from ..core.mastery import get_effective_now
from ..core.review_scheduler import sm2_schedule
from ..db import connect

router = APIRouter(prefix="/api/v1", tags=["mastery"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


class EventCreate(BaseModel):
    concept_id: int
    event_type: str
    dimension: str | None = None
    weight: float = 1.0
    source: str = "manual"


class AnswerSubmit(BaseModel):
    quality: int  # 0-5


# ── 掌握度 ──────────────────────────────────────────────────────────

@router.get("/mastery")
def list_mastery() -> dict:
    conn = connect()
    try:
        rows = M.get_all_mastery(conn)
        return {"mastery": [_format_mastery(r, conn=conn) for r in rows]}
    finally:
        conn.close()


@router.get("/mastery/{concept_id}")
def get_mastery_detail(concept_id: int) -> dict:
    conn = connect()
    try:
        if conn.execute("SELECT 1 FROM concepts WHERE id=?", (concept_id,)).fetchone() is None:
            return _err(404, "http_404", "概念不存在")
        m = M.get_or_create_mastery(conn, concept_id)
        conn.commit()
        return {"mastery": _format_mastery(m, conn=conn)}
    finally:
        conn.close()


# ── 学习事件 ─────────────────────────────────────────────────────────

@router.post("/events", status_code=201)
def create_event(body: EventCreate) -> dict:
    conn = connect()
    try:
        # 验证概念存在
        if conn.execute("SELECT 1 FROM concepts WHERE id=?", (body.concept_id,)).fetchone() is None:
            return _err(404, "http_404", "概念不存在")
        m = M.update_mastery(
            conn, body.concept_id, body.event_type,
            body.dimension, body.weight, body.source,
        )
        conn.commit()
        return {"mastery": _format_mastery(m, conn=conn)}
    finally:
        conn.close()


# ── 复习队列 ─────────────────────────────────────────────────────────

@router.get("/review/today")
def review_today() -> dict:
    """今日复习队列：优先级 = 错答优先 + effective_now 低优先 + 到期早优先。"""
    conn = connect()
    try:
        now = M._now_iso()
        rows = conn.execute(
            "SELECT rq.*, c.title, cm.effective "
            "FROM review_queue rq "
            "JOIN concepts c ON c.id = rq.concept_id "
            "LEFT JOIN concept_mastery cm ON cm.concept_id = rq.concept_id "
            "WHERE rq.due_at <= ? AND rq.status = 'pending' "
            "ORDER BY rq.due_at ASC",
            (now,),
        ).fetchall()
        # Python 侧用 effective_now 重排（衰减后掌握度）
        results = []
        for r in rows:
            d = dict(r)
            d["effective_now"] = get_effective_now(conn, d["concept_id"])
            results.append(d)
        results.sort(key=lambda r: (
            0 if r["last_result"] == "wrong" else 1,
            r["effective_now"],
            r["due_at"],
        ))
        return {"reviews": results}
    finally:
        conn.close()


@router.post("/review/{concept_id}/answer")
def submit_answer(concept_id: int, body: AnswerSubmit) -> dict:
    conn = connect()
    try:
        if conn.execute("SELECT 1 FROM concepts WHERE id=?", (concept_id,)).fetchone() is None:
            return _err(404, "http_404", "概念不存在")

        m = M.get_or_create_mastery(conn, concept_id)

        # SM-2 排期
        schedule = sm2_schedule(
            quality=body.quality,
            ease_factor=m["ease_factor"],
            interval=m["interval"],
            review_count=m["review_count"],
        )

        # 更新掌握度（回答事件）
        event_type = "answer_correct" if body.quality >= 3 else "answer_wrong"
        detail = json.dumps({"quality": body.quality})
        updated = M.update_mastery(conn, concept_id, event_type, source="review", detail=detail)

        # 更新排期
        now = M._now_iso()
        conn.execute(
            "UPDATE concept_mastery SET "
            "ease_factor=?, interval=?, next_review=?, review_count=?, updated_at=? "
            "WHERE concept_id=?",
            (schedule["ease_factor"], schedule["interval"],
             schedule["next_review"], schedule["review_count"], now, concept_id),
        )

        # 更新 review_queue
        result = "correct" if body.quality >= 3 else "wrong"
        # 错答时提升优先级（0.8），正答保持默认（0.5）
        new_priority = 0.8 if result == "wrong" else 0.5
        conn.execute(
            "INSERT INTO review_queue (concept_id, due_at, priority, status, last_result) "
            "VALUES (?, ?, ?, 'pending', ?) "
            "ON CONFLICT(concept_id) DO UPDATE SET "
            "due_at=excluded.due_at, priority=excluded.priority, "
            "status='pending', last_result=excluded.last_result, "
            "updated_at=?",
            (concept_id, schedule["next_review"], new_priority, result, now),
        )

        conn.commit()
        return {
            "mastery": _format_mastery(updated, conn=conn),
            "next_review": schedule["next_review"],
            "ease_factor": schedule["ease_factor"],
            "interval": schedule["interval"],
        }
    finally:
        conn.close()


# ── 薄弱概念 ─────────────────────────────────────────────────────────

@router.get("/mastery/weak/list")
def weak_concepts() -> dict:
    conn = connect()
    try:
        rows = M.get_weak_concepts(conn, limit=10)
        return {"weak": [_format_mastery(r, conn=conn) for r in rows]}
    finally:
        conn.close()


# ── 复习历史 ─────────────────────────────────────────────────────────

@router.get("/review/history")
def review_history(limit: int = 20) -> dict:
    """最近复习事件（按时间倒序）。"""
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT le.*, c.title FROM learning_events le "
            "JOIN concepts c ON c.id = le.concept_id "
            "WHERE le.event_type IN ('answer_correct', 'answer_wrong') "
            "ORDER BY le.created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return {"history": [dict(r) for r in rows]}
    finally:
        conn.close()


def _format_mastery(row, *, conn=None) -> dict:
    d = dict(row)
    dims = d.get("dimensions", "{}")
    if isinstance(dims, str):
        dims = json.loads(dims)
    result = {
        "concept_id": d["concept_id"],
        "title": d.get("title"),
        "dimensions": dims,
        "effective": d["effective"],
        "next_review": d.get("next_review"),
        "ease_factor": d.get("ease_factor"),
        "interval": d.get("interval"),
        "review_count": d.get("review_count"),
    }
    if conn is not None:
        result["effective_now"] = get_effective_now(conn, d["concept_id"])
    return result
