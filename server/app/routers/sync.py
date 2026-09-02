"""Sync API（M7-005/006/008）：同步冲突状态、用户裁决、配对与传输端点。

规则：
- Router 只调用 core（core/sync/*），不直接读写 workspace / SQLite
- 只读 status + 唯一写动作 resolve；不做自动解决、不做通知
- M7-006：serve/receive 补齐 Transport 协议的 server 侧；
  receive 强制经 SyncApply 落盘（Rule 1 唯一写入口）
- M7-008：manifest exchange + pairing 补齐 HTTP 层，闭合
  「发现 → 配对 → 交换清单 → 对比 → 传输 → 落盘」全链路
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from ..core.sync.device import load_or_create_device
from ..core.sync.diff import diff_manifests
from ..core.sync.manifest import Manifest
from ..core.sync.pairing import (
    PeerDevice,
    add_peer,
    list_peers,
    remove_peer,
)
from ..core.sync.scanner import scan_workspace
from ..core.sync.messages import FileData, SyncError
from ..core.sync.status import find_conflicts, resolve_conflict
from ..core.sync.transport import SyncTransport
from ..core.reindex import reindex_vault
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


# ── M7-008：Manifest Exchange（发现 → 配对 → 交换清单 → 对比）──────
#
# 缺失的正是这一环：core 侧 scan/diff/transport/apply 早已齐备，
# 但没有 HTTP 出口，两台设备无法在 API 层面完成
# 「谁有什么」的协商，只能靠脚本直接调 core。此处补齐，协议语义
# 完全沿用 manifest.py / diff.py，未改动任何冻结结构。

@router.get("/manifest")
def get_manifest() -> dict:
    """本设备 Layer 1 清单（vault/eventlogs/mind_maps），供对端 diff。

    只读扫描，不落任何状态。device_id 取自唯一身份路径 load_or_create_device。
    """
    ws = workspace_root()
    device = load_or_create_device(ws)
    manifest = scan_workspace(ws, device.device_id)
    return manifest.to_dict()


class PlanBody(BaseModel):
    """对端清单（Manifest.to_dict() 的输出形态）。"""
    manifest: dict


@router.post("/plan")
def post_plan(body: PlanBody) -> dict:
    """用对端清单与本地清单对比，返回 SyncPlan（不执行任何传输）。

    只算差异、不落盘——真正的写入仍由 /sync/receive 经 SyncApply 完成
    （Rule 1 唯一写入口不得绕过）。冲突项按 ADR-020 保留双份，由用户裁决。
    """
    # 网络边界必须 fail-closed：Manifest.from_dict 对「结构对但类型错」的输入
    # 会抛出不同类型的异常（实测 files=[] 时 .items() 抛 AttributeError）。
    # 漏掉任何一种都会让非法输入逃逸成 500，而不是可读的 400。
    try:
        remote = Manifest.from_dict(body.manifest)
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        return _err(400, "bad_manifest", f"manifest 解析失败：{exc}")

    ws = workspace_root()
    local = scan_workspace(ws, load_or_create_device(ws).device_id)
    return diff_manifests(local, remote).to_dict()


class PairBody(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(default="", max_length=100)
    host: str = Field(..., min_length=1, max_length=253)
    port: int = Field(default=8000, ge=1, le=65535)


@router.post("/pair", status_code=201)
def post_pair(body: PairBody) -> dict:
    """登记一台已发现的对端设备（幂等：同 device_id 更新而非重复）。

    配对关系属 Layer 3 本地缓存，永不同步（已在 SYNC_BLACKLIST 登记）。
    """
    ws = workspace_root()
    peer = PeerDevice(
        device_id=body.device_id,
        name=body.name,
        host=body.host.strip(),
        port=body.port,
    )
    ok, message = add_peer(ws, peer)
    if not ok:
        return _err(400, "pair_rejected", message)
    return {"ok": True, "message": message,
            "peer": peer.to_dict()}


@router.get("/peers")
def get_peers() -> dict:
    """已配对设备列表。"""
    ws = workspace_root()
    return {"peers": [p.to_dict() for p in list_peers(ws)]}


@router.delete("/peers/{device_id}")
def delete_peer(device_id: str) -> dict:
    """解除配对。"""
    ws = workspace_root()
    if not remove_peer(ws, device_id):
        return _err(404, "peer_not_found", f"未配对的设备：{device_id}")
    return {"ok": True}


@router.get("/discover")
def get_discover(
    timeout: float = Query(default=1.5, ge=0.2, le=5.0),
) -> dict:
    """UDP 广播发现局域网内的对端设备（不含自身）。

    默认超时压到 1.5s：本端点是同步请求路径上的一步，
    不能让一次发现拖住整条链路（discovery 内部 max_retries=1）。
    """
    ws = workspace_root()
    device = load_or_create_device(ws)
    try:
        from ..core.sync.discovery import discover_peers

        peers = discover_peers(device, timeout=timeout, max_retries=1)
    except OSError as exc:  # 网卡不可广播等环境限制，降级为空列表而非 500
        return {"peers": [], "degraded": True, "reason": repr(exc)}
    return {"peers": [p.to_dict() for p in peers], "degraded": False}


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

    # Post-sync consistency hook（P8-003C）：
    # SyncApply 只写文件不更新 SQLite，此处触发 reindex 保持索引一致。
    # P1-MINDMAP-TRUTH：mindmap 侧同理——sidecar 落盘后重建 SQLite 三表缓存。
    from ..db import connect
    from ..core.mindmap import rebuild_mindmaps
    conn = connect()
    try:
        reindex_vault(conn, workspace_root() / "vault")
        rebuild_mindmaps(conn, workspace_root())
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        conn.close()

    return Response(content=ack.to_bytes(), media_type="application/json")
