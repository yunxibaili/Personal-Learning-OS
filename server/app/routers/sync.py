"""Sync API（M7-005）：同步冲突的只读状态与用户裁决。

规则：
- Router 只调用 core（core/sync/status.py），不直接读写 workspace / SQLite
- 只读 status + 唯一写动作 resolve；不做自动解决、不做通知
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core.sync.status import find_conflicts, resolve_conflict
from ..db import workspace_root

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


@router.get("/status")
def get_status() -> dict:
    conflicts = find_conflicts(workspace_root())
    return {"conflicts": [c.to_dict() for c in conflicts]}


class ResolveBody(BaseModel):
    path: str
    resolution: str  # keep_local | keep_remote


@router.post("/resolve")
def post_resolve(body: ResolveBody) -> dict:
    ok, message = resolve_conflict(workspace_root(), body.path, body.resolution)
    if not ok:
        return _err(400, "resolve_failed", message)
    return {"ok": True, "message": message}
