"""Graph Read Model：只读。图计算/布局不在此层之外发生（separation.md §四）。"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..core.knowledge import local_graph, connect
from ..core import hierarchy as H

router = APIRouter(prefix="/api/v1/graph", tags=["graph"])

_ALLOWED_TYPES = {"note", "concept"}


def _merge_parent_edges(graph: dict, conn) -> dict:
    """把权威 parent 关系并入 graph 响应（红线 2：视图经由唯一 resolver）。

    `local_graph` 读的是 links 派生索引（可能含已物化的 parent 边，也可能滞后），
    这里以 `resolve_hierarchy()` 为准**补齐**——显式父优先、推断兜底，且不产生重复边。
    """
    present = {
        (e["source"], e["target"])
        for e in graph.get("edges", [])
        if e.get("relation") == H.PARENT_RELATION
    }
    for child, parent in H.resolve_hierarchy(conn)["parent_of"].items():
        src, tgt = f"note-{child}", f"note-{parent}"
        if (src, tgt) in present:
            continue
        graph["edges"].append({
            "source": src, "target": tgt, "relation": H.PARENT_RELATION,
        })
        present.add((src, tgt))
    return graph


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
        return _merge_parent_edges(local_graph(conn, root_type, root_id, depth), conn)
    finally:
        conn.close()
