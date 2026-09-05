"""Learning Graph API：掌握度 + 事件 + 复习队列（M3）。"""
from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from ..core import mastery as M
from ..core.mastery import get_effective_now
from ..core.review_stats import review_stats
from ..db import connect

router = APIRouter(prefix="/api/v1", tags=["mastery"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


class EventCreate(BaseModel):
    concept_id: int
    # E2（2026-09-05）：枚举校验——非法值 400 invalid_body，不再 201 + silent no-op。
    # 合法集合 = core.mastery.VALID_EVENT_TYPES（与 DATA_MODEL.md 冻结枚举同源）。
    event_type: str
    dimension: str | None = None
    weight: float = 1.0
    source: str = "manual"

    @field_validator("event_type")
    @classmethod
    def _event_type_allowed(cls, v: str) -> str:
        if v not in M.VALID_EVENT_TYPES:
            raise ValueError(
                f"unknown event_type {v!r}; "
                f"allowed: {sorted(M.VALID_EVENT_TYPES)}")
        return v


class AnswerSubmit(BaseModel):
    # E1（2026-09-05）：SM-2 quality 语义 0-5；越界 400 invalid_body，
    # 不再落入 sm2_schedule 的静默 clamp。
    quality: int = Field(ge=0, le=5)

    @field_validator("quality", mode="before")
    @classmethod
    def _reject_bool(cls, v: object) -> object:
        # pydantic lax 会把 True/False 强转为 1/0——quality 是布尔在语义上非法
        if isinstance(v, bool):
            raise ValueError("quality must be an integer, not a boolean")
        return v


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
        result = M.submit_review_answer(conn, concept_id, body.quality)
        return {
            "mastery": _format_mastery(result["mastery"], conn=conn),
            "next_review": result["next_review"],
            "ease_factor": result["ease_factor"],
            "interval": result["interval"],
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


@router.get("/review/stats")
def review_stats_endpoint() -> dict:
    """复习历史分析（B13）：准确率 / 当前连对 / 按概念归因。"""
    conn = connect()
    try:
        return {"stats": review_stats(conn)}
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
        if not result["title"]:  # detail 路径未 join concepts，此处补齐
            row = conn.execute(
                "SELECT title FROM concepts WHERE id=?", (d["concept_id"],)
            ).fetchone()
            result["title"] = row["title"] if row else None
    return result
