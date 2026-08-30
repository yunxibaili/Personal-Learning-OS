"""Home API（P8-003 D1）：首页聚合读端点，一次请求驱动 HomeView。"""
from __future__ import annotations

from fastapi import APIRouter

from ..core.home import home_summary
from ..db import connect

router = APIRouter(prefix="/api/v1", tags=["home"])


@router.get("/home")
def get_home() -> dict:
    conn = connect()
    try:
        return home_summary(conn)
    finally:
        conn.close()
