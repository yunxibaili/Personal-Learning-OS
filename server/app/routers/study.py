"""Study Session API（B14）：聚焦复习会话 CRUD + 队列 + 结束统计。"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..core import study as S
from ..db import connect

router = APIRouter(prefix="/api/v1", tags=["study"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


class SessionCreate(BaseModel):
    name: str = Field(default="学习会话", max_length=200)
    concept_ids: list[int] = Field(default_factory=list)


@router.get("/study/sessions")
def list_sessions() -> dict:
    conn = connect()
    try:
        return {"sessions": S.list_sessions(conn)}
    finally:
        conn.close()


@router.post("/study/sessions", status_code=201)
def create_session(body: SessionCreate) -> dict:
    conn = connect()
    try:
        return S.create_session(conn, body.name, body.concept_ids)
    finally:
        conn.close()


@router.get("/study/sessions/{session_id}")
def get_session(session_id: int) -> dict:
    conn = connect()
    try:
        return {"session": S.get_session(conn, session_id)}
    except S.StudySessionNotFoundError:
        return _err(404, "study_session_not_found",
                    f"study session {session_id} not found")
    finally:
        conn.close()


@router.get("/study/sessions/{session_id}/queue")
def session_queue(session_id: int) -> dict:
    conn = connect()
    try:
        return S.session_queue(conn, session_id)
    except S.StudySessionNotFoundError:
        return _err(404, "study_session_not_found",
                    f"study session {session_id} not found")
    finally:
        conn.close()


@router.post("/study/sessions/{session_id}/finish")
def finish_session(session_id: int) -> dict:
    conn = connect()
    try:
        s = S.finish_session(conn, session_id)
        return {"session": s, "reviewed": len(s["concept_ids"])}
    except S.StudySessionNotFoundError:
        return _err(404, "study_session_not_found",
                    f"study session {session_id} not found")
    finally:
        conn.close()


@router.delete("/study/sessions/{session_id}")
def delete_session(session_id: int) -> dict:
    conn = connect()
    try:
        S.delete_session(conn, session_id)
    except S.StudySessionNotFoundError:
        return _err(404, "study_session_not_found",
                    f"study session {session_id} not found")
    finally:
        conn.close()
    return {"ok": True}
