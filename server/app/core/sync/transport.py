"""M7 Sync Engine: Transport — 同步传输协调器。

ADR-020 冻结：
  - Transport 只负责执行 SyncPlan 的文件交换
  - 不修改 mastery / review_queue / SQLite
  - CONFLICT 项留给 M7-005 Conflict UI 处理
  - 只传输 Layer 1 Truth Source 文件

职责：
  - execute_plan(): 执行 SyncPlan，返回执行结果
  - serve_file(): 响应对端的文件请求
  - receive_file(): 接收对端发送的文件

Transport 层不负责：
  - 冲突解决（CONFLICT 项跳过）
  - Manifest 生成
  - Diff 计算
"""
from __future__ import annotations

import hashlib
import json
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .diff import Action, SyncItem, SyncPlan
from .transfer import (
    is_syncable,
    read_file_bytes,
    write_file_atomic,
    validate_hash,
    encode_content,
    decode_content,
)
from .messages import (
    FileRequest,
    FileData,
    FileAck,
    SyncError,
    ErrorCode,
)


@dataclass
class TransferResult:
    """单个文件传输结果。"""
    path: str
    action: str        # "upload" | "download" | "skip" | "conflict" | "error"
    success: bool
    message: str = ""
    hash_matched: bool = True


@dataclass
class SyncResult:
    """SyncPlan 执行结果。"""
    plan: SyncPlan
    results: list[TransferResult] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.results)

    @property
    def succeeded(self) -> int:
        return sum(1 for r in self.results if r.success)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.success)

    @property
    def skipped(self) -> int:
        return sum(1 for r in self.results if r.action == "skip")

    @property
    def conflicts(self) -> int:
        return sum(1 for r in self.results if r.action == "conflict")

    def to_dict(self) -> dict[str, Any]:
        return {
            "total": self.total,
            "succeeded": self.succeeded,
            "failed": self.failed,
            "skipped": self.skipped,
            "conflicts": self.conflicts,
            "results": [
                {
                    "path": r.path,
                    "action": r.action,
                    "success": r.success,
                    "message": r.message,
                }
                for r in self.results
            ],
        }


class SyncTransport:
    """同步传输协调器。

    用法：
        transport = SyncTransport()
        result = transport.execute_plan(plan, local_ws, remote_url)
    """

    def execute_plan(
        self,
        plan: SyncPlan,
        local_workspace: Path,
        peer_url: str | None = None,
    ) -> SyncResult:
        """执行 SyncPlan，逐项处理。

        Args:
            plan: diff_manifests 生成的同步计划
            local_workspace: 本设备 workspace 根目录
            peer_url: 对端 HTTP 地址（如 http://192.168.1.2:8000）

        Returns:
            SyncResult 执行结果
        """
        result = SyncResult(plan=plan)

        for item in plan.items:
            if item.action == Action.SKIP:
                result.results.append(TransferResult(
                    path=item.path, action="skip", success=True, message="identical"
                ))

            elif item.action == Action.CONFLICT:
                # M7-003 不处理冲突，留给 M7-005
                result.results.append(TransferResult(
                    path=item.path, action="conflict", success=True,
                    message="conflict deferred to M7-005",
                ))

            elif item.action == Action.UPLOAD:
                tr = self._upload_file(item, local_workspace, peer_url)
                result.results.append(tr)

            elif item.action == Action.DOWNLOAD:
                tr = self._download_file(item, local_workspace, peer_url)
                result.results.append(tr)

        return result

    def _upload_file(
        self,
        item: SyncItem,
        local_workspace: Path,
        peer_url: str | None,
    ) -> TransferResult:
        """上传本地文件到对端。"""
        # 白名单检查
        if not is_syncable(item.path):
            return TransferResult(
                path=item.path, action="upload", success=False,
                message=f"path not syncable: {item.path}",
            )

        # 读取本地文件
        data = read_file_bytes(local_workspace, item.path)
        if data is None:
            return TransferResult(
                path=item.path, action="upload", success=False,
                message=f"file not found: {item.path}",
            )

        # 哈希验证
        if not validate_hash(data, item.local_hash or ""):
            return TransferResult(
                path=item.path, action="upload", success=False,
                message="hash mismatch on read",
            )

        # 无 peer_url = 本地模式（返回数据供调用方使用）
        if not peer_url:
            return TransferResult(
                path=item.path, action="upload", success=True,
                message=f"ready to send {len(data)} bytes",
            )

        # HTTP 传输
        return self._http_send(item.path, data, peer_url)

    def _download_file(
        self,
        item: SyncItem,
        local_workspace: Path,
        peer_url: str | None,
    ) -> TransferResult:
        """从对端下载文件到本地。"""
        # 白名单检查
        if not is_syncable(item.path):
            return TransferResult(
                path=item.path, action="download", success=False,
                message=f"path not syncable: {item.path}",
            )

        # 无 peer_url = 本地模式（返回占位结果）
        if not peer_url:
            return TransferResult(
                path=item.path, action="download", success=True,
                message="pending download (no peer URL)",
            )

        # HTTP 请求文件
        try:
            url = f"{peer_url}/api/v1/sync/files/{item.path}"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
                file_data = json.loads(raw)
                content = decode_content(file_data["content"])
                received_hash = file_data.get("sha256", "")
        except (urllib.error.URLError, json.JSONDecodeError, KeyError, OSError) as e:
            return TransferResult(
                path=item.path, action="download", success=False,
                message=f"transfer failed: {e}",
            )

        # 哈希验证
        expected = item.remote_hash or received_hash
        if not validate_hash(content, expected):
            return TransferResult(
                path=item.path, action="download", success=False,
                message="hash mismatch after download",
            )

        # 原子写入
        written_hash = write_file_atomic(local_workspace, item.path, content)
        if written_hash is None:
            return TransferResult(
                path=item.path, action="download", success=False,
                message="write failed",
            )

        return TransferResult(
            path=item.path, action="download", success=True,
            message=f"written {len(content)} bytes",
            hash_matched=(written_hash == expected),
        )

    def _http_send(
        self,
        path: str,
        data: bytes,
        peer_url: str,
    ) -> TransferResult:
        """通过 HTTP 发送文件到对端。"""
        try:
            # M7-006 修正：补齐协议必需的 type 字段（此前 payload 不符
            # FileData.from_bytes 契约，会被对端拒收）
            payload = json.dumps({
                "type": "file_data",
                "path": path,
                "content": encode_content(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "size": len(data),
            }).encode("utf-8")

            url = f"{peer_url}/api/v1/sync/receive"
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                ack_raw = resp.read()
                ack = FileAck.from_bytes(ack_raw)
                if ack and ack.status == "ok":
                    return TransferResult(
                        path=path, action="upload", success=True,
                        message=f"sent {len(data)} bytes",
                    )
                else:
                    msg = ack.message if ack else "unknown error"
                    return TransferResult(
                        path=path, action="upload", success=False,
                        message=f"peer rejected: {msg}",
                    )
        except (urllib.error.URLError, OSError) as e:
            return TransferResult(
                path=path, action="upload", success=False,
                message=f"network error: {e}",
            )

    def serve_file(self, workspace: Path, path: str) -> FileData | SyncError:
        """响应对端的文件请求。

        Args:
            workspace: 本设备 workspace
            path: 请求的文件路径

        Returns:
            FileData（成功）或 SyncError（失败）
        """
        if not is_syncable(path):
            return SyncError(
                path=path,
                code=ErrorCode.PATH_NOT_SYNCABLE,
                message=f"path not in sync whitelist: {path}",
            )

        data = read_file_bytes(workspace, path)
        if data is None:
            return SyncError(
                path=path,
                code=ErrorCode.FILE_NOT_FOUND,
                message=f"file not found: {path}",
            )

        import hashlib
        h = hashlib.sha256(data).hexdigest()

        return FileData(
            path=path,
            content=encode_content(data),
            sha256=h,
            size=len(data),
        )

    def receive_incoming(
        self,
        workspace: Path,
        file_data: FileData,
    ) -> FileAck:
        """接收对端发送的文件并落盘。

        M7-006 修正：落盘统一经 SyncApply（Rule 1 唯一写入口）——
        Apply 内部完成白名单复检 + 字节级 hash 重算 + fail-closed，
        本方法不再自行写盘。
        """
        from .apply import SyncApply

        content = decode_content(file_data.content)
        r = SyncApply().apply_file(
            workspace, file_data.path, content,
            expected_hash=file_data.sha256,
        )
        if not r.success:
            return FileAck(path=file_data.path, status="rejected",
                           message=r.message)
        return FileAck(
            path=file_data.path, status="ok",
            message=f"{r.action.value}: {r.message}",
        )
