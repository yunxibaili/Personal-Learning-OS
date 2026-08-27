"""Universe API（M3b-001）：Knowledge Universe 数据投影端点。

GET /api/v1/universe — 返回 { nodes, edges }
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..core.universe import get_universe_projection
from ..db import connect

router = APIRouter(prefix="/api/v1/universe", tags=["universe"])


@router.get("")
def universe_projection() -> dict:
    """返回 Universe 可视化所需的 nodes + edges 投影。"""
    conn = connect()
    try:
        data = get_universe_projection(conn)
    finally:
        conn.close()
    return data
