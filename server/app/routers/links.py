"""反链查询：谁链接了这篇笔记（wikilink/mentions）。"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..core.knowledge import backlinks_of_note, connect

router = APIRouter(prefix="/api/v1/notes", tags=["links"])


@router.get("/{note_id}/backlinks")
def get_backlinks(note_id: int) -> dict:
    conn = connect()
    try:
        if conn.execute("SELECT 1 FROM notes WHERE id=?", (note_id,)).fetchone() is None:
            return JSONResponse(status_code=404, content={
                "error": {"code": "http_404", "message": "笔记不存在"}
            })
        return {"backlinks": backlinks_of_note(conn, note_id)}
    finally:
        conn.close()
