"""Sync API（M7-005/006）：同步冲突状态、用户裁决与传输端点。

规则：
- Router 只调用 core（core/sync/status.py · transport.py），不直接读写 workspace / SQLite
- 只读 status + 唯一写动作 resolve；不做自动解决、不做通知
- M7-006：serve/receive 补齐 Transport 协议的 server 侧；
  receive 强制经 SyncApply 落盘（Rule 1 唯一写入口）
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from ..core.sync.messages import FileData, SyncError
from ..core.sync.status import find_conflicts, resolve_conflict
from ..core.sync.transport import SyncTransport
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


# ── Transport server 侧（M7-006，协议语义沿用 messages.py，未改动）──────

@router.get("/files/{file_path:path}")
def get_sync_file(file_path: str):
    """响应对端的 FileRequest：返回 FileData JSON 或 SyncError JSON。"""
    result = SyncTransport().serve_file(workspace_root(), file_path)
    payload = json.loads(result.to_bytes().decode("utf-8"))
    if isinstance(result, SyncError):
        return JSONResponse(status_code=404, content=payload)
    return payload


@router.post("/receive")
async def post_receive(request: Request):
    """接收对端 upload 的 FileData；落盘强制经 SyncApply（Rule 1）。"""
    raw = await request.body()
    file_data = FileData.from_bytes(raw)
    if file_data is None:
        return JSONResponse(status_code=400, content={
            "type": "sync_error", "path": "",
            "code": "bad_message", "message": "unparseable FileData"})
    ack = SyncTransport().receive_incoming(workspace_root(), file_data)
    return Response(content=ack.to_bytes(), media_type="application/json")
