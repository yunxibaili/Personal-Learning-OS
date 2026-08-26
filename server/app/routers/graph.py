"""Graph Read Model：只读。图计算/布局不在此层之外发生（separation.md §四）。"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..core.knowledge import local_graph, connect

router = APIRouter(prefix="/api/v1/graph", tags=["graph"])

_ALLOWED_TYPES = {"note", "concept"}


@router.get("")
def get_graph(
    root_type: str = "concept",
    root_id: int | None = None,
    depth: int = 2,
) -> dict:
    if root_type not in _ALLOWED_TYPES:
        return JSONResponse(status_code=400, content={
            "error": {"code": "bad_params",
                      "message": f"root_type 须为 {'/'.join(_ALLOWED_TYPES)}"}
        })
    if depth < 1 or depth > 3:
        return JSONResponse(status_code=400, content={
            "error": {"code": "bad_params", "message": "depth 取值 1~3"}
        })
    if root_id is None and root_type != "concept":
        # 无根的全量图仅有一种受支持形态；root_type 此时无意义
        root_type = "concept"

    conn = connect()
    try:
        return local_graph(conn, root_type, root_id, depth)
    finally:
        conn.close()
