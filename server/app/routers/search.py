"""全文检索（FTS5）。M1 仅提供后端端点，搜索 UI 归 M2。"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..core.knowledge import search_notes, connect

router = APIRouter(prefix="/api/v1", tags=["search"])


@router.get("/search")
def search(q: str = "") -> dict:
    query = q.strip()
    if not query:
        return JSONResponse(status_code=400, content={
            "error": {"code": "missing_q", "message": "缺少查询词 q"}
        })
    conn = connect()
    try:
        return {"results": search_notes(conn, query)}
    finally:
        conn.close()
