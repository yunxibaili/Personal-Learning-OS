"""Study Session 核心（B14）：聚焦复习会话。

会话 = 用户圈定的一组概念 + 复习进度容器。本身不改 mastery / review_queue
（复习仍走 /review/{id}/answer），只提供「会话聚合 + 结束统计」。

纯逻辑层，不 import FastAPI。生产者：routers/study.py → 本模块。
"""
from __future__ import annotations

import json

from .timeutil import now_iso


class StudySessionNotFoundError(Exception):
    def __init__(self, session_id: int) -> None:
        self.session_id = session_id
        super().__init__(f"study session {session_id} not found")


def _row_to_dict(row) -> dict:
    d = dict(row)
    try:
        d["concept_ids"] = json.loads(d.get("concept_ids") or "[]")
    except (json.JSONDecodeError, TypeError):
        d["concept_ids"] = []
    return d


def create_session(conn, name: str, concept_ids: list[int]) -> dict:
    cur = conn.execute(
        "INSERT INTO study_sessions (name, concept_ids, status) VALUES (?, ?, 'active')",
        (name or "学习会话", json.dumps(list(concept_ids), ensure_ascii=False)),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM study_sessions WHERE id=?", (cur.lastrowid,)).fetchone()
    return _row_to_dict(row)


def list_sessions(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM study_sessions ORDER BY created_at DESC, id DESC").fetchall()
    return [_row_to_dict(r) for r in rows]


def get_session(conn, session_id: int) -> dict:
    row = conn.execute(
        "SELECT * FROM study_sessions WHERE id=?", (session_id,)).fetchone()
    if row is None:
        raise StudySessionNotFoundError(session_id)
    return _row_to_dict(row)


def finish_session(conn, session_id: int) -> dict:
    row = conn.execute(
        "SELECT * FROM study_sessions WHERE id=?", (session_id,)).fetchone()
    if row is None:
        raise StudySessionNotFoundError(session_id)
    conn.execute(
        "UPDATE study_sessions SET status='done', completed_at=? WHERE id=?",
        (now_iso(), session_id))
    conn.commit()
    return get_session(conn, session_id)


def delete_session(conn, session_id: int) -> None:
    if conn.execute("SELECT 1 FROM study_sessions WHERE id=?", (session_id,)).fetchone() is None:
        raise StudySessionNotFoundError(session_id)
    conn.execute("DELETE FROM study_sessions WHERE id=?", (session_id,))
    conn.commit()


def session_queue(conn, session_id: int) -> dict:
    """会话复习队列：解析概念 + 当前掌握度/复习状态（含衰减后值）。

    Returns: {session_id, name, items: [{concept_id, title, effective, effective_now, next_review}]}
    """
    s = get_session(conn, session_id)
    items = []
    from .mastery import get_effective_now

    for cid in s["concept_ids"]:
        c = conn.execute("SELECT id, title FROM concepts WHERE id=?", (cid,)).fetchone()
        if c is None:
            continue
        m = conn.execute(
            "SELECT effective, next_review FROM concept_mastery WHERE concept_id=?",
            (cid,)).fetchone()
        items.append({
            "concept_id": cid,
            "title": c["title"],
            "effective": (m["effective"] if m else 0.0),
            "effective_now": get_effective_now(conn, cid),
            "next_review": (m["next_review"] if m else None),
        })
    return {"session_id": session_id, "name": s["name"], "items": items}


__all__ = [
    "StudySessionNotFoundError", "create_session", "list_sessions",
    "get_session", "finish_session", "delete_session", "session_queue",
]
