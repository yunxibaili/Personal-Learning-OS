"""Knowledge Radar API：上下文感知知识建议（M3.5-A，ADR-012）。"""
from __future__ import annotations

from fastapi import APIRouter

from ..core.knowledge import suggest_for_context, connect

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])


@router.get("/suggest")
def get_suggest(
    q: str = "",
    note_id: int | None = None,
    limit: int = 5,
) -> dict:
    if not q.strip():
        return {"matches": [], "related": [],
                "memory": {"mastery": None, "review_due": None, "last_mistake": None}}
    if limit < 1 or limit > 20:
        limit = 5
    conn = connect()
    try:
        return suggest_for_context(conn, q, note_id, limit)
    finally:
        conn.close()
