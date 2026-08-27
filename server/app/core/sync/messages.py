"""M7 Sync Engine: Messages — 同步传输消息类型。

ADR-020 冻结：
  - 消息只用于传输 Layer 1 Truth Source 文件
  - 消息不修改 mastery / review_queue / SQLite
  - metadata/devices.json 永不同步

消息流程（M7-003 Transport only）：
  1. FileRequest  → 请求对端发送指定文件
  2. FileData     → 响应：携带文件内容
  3. FileAck      → 确认：文件已接收/拒绝
  4. SyncError    → 错误：传输失败
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class MessageType(str, Enum):
    """消息类型枚举。"""
    FILE_REQUEST = "file_request"
    FILE_DATA = "file_data"
    FILE_ACK = "file_ack"
    SYNC_ERROR = "sync_error"


class ErrorCode(str, Enum):
    """错误码枚举。"""
    FILE_NOT_FOUND = "file_not_found"
    HASH_MISMATCH = "hash_mismatch"
    PATH_NOT_SYNCABLE = "path_not_syncable"
    PERMISSION_DENIED = "permission_denied"
    WRITE_FAILED = "write_failed"
    NETWORK_ERROR = "network_error"
    PLAN_CONFLICT = "plan_conflict"


@dataclass(frozen=True)
class FileRequest:
    """请求对端发送指定文件。"""
    type: str = MessageType.FILE_REQUEST
    path: str = ""
    expected_hash: str = ""

    def to_bytes(self) -> bytes:
        return json.dumps({
            "type": self.type,
            "path": self.path,
            "expected_hash": self.expected_hash,
        }, ensure_ascii=False).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> FileRequest | None:
        try:
            data = json.loads(raw)
            if data.get("type") != MessageType.FILE_REQUEST:
                return None
            return cls(path=data["path"], expected_hash=data.get("expected_hash", ""))
        except (json.JSONDecodeError, KeyError, TypeError):
            return None


@dataclass(frozen=True)
class FileData:
    """响应：携带文件内容。"""
    type: str = MessageType.FILE_DATA
    path: str = ""
    content: str = ""          # base64 编码的内容
    sha256: str = ""
    size: int = 0

    def to_bytes(self) -> bytes:
        return json.dumps({
            "type": self.type,
            "path": self.path,
            "content": self.content,
            "sha256": self.sha256,
            "size": self.size,
        }, ensure_ascii=False).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> FileData | None:
        try:
            data = json.loads(raw)
            if data.get("type") != MessageType.FILE_DATA:
                return None
            return cls(
                path=data["path"],
                content=data.get("content", ""),
                sha256=data.get("sha256", ""),
                size=data.get("size", 0),
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None


@dataclass(frozen=True)
class FileAck:
    """确认：文件已接收/拒绝。"""
    type: str = MessageType.FILE_ACK
    path: str = ""
    status: str = ""           # "ok" | "rejected" | "error"
    message: str = ""

    def to_bytes(self) -> bytes:
        return json.dumps({
            "type": self.type,
            "path": self.path,
            "status": self.status,
            "message": self.message,
        }, ensure_ascii=False).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> FileAck | None:
        try:
            data = json.loads(raw)
            if data.get("type") != MessageType.FILE_ACK:
                return None
            return cls(
                path=data["path"],
                status=data.get("status", ""),
                message=data.get("message", ""),
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None


@dataclass(frozen=True)
class SyncError:
    """错误：传输失败。"""
    type: str = MessageType.SYNC_ERROR
    path: str = ""
    code: str = ""
    message: str = ""

    def to_bytes(self) -> bytes:
        return json.dumps({
            "type": self.type,
            "path": self.path,
            "code": self.code,
            "message": self.message,
        }, ensure_ascii=False).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> SyncError | None:
        try:
            data = json.loads(raw)
            if data.get("type") != MessageType.SYNC_ERROR:
                return None
            return cls(
                path=data["path"],
                code=data.get("code", ""),
                message=data.get("message", ""),
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None


def parse_message(raw: bytes) -> FileRequest | FileData | FileAck | SyncError | None:
    """解析消息，返回对应的 Packet 对象。"""
    try:
        data = json.loads(raw)
        msg_type = data.get("type")
        if msg_type == MessageType.FILE_REQUEST:
            return FileRequest.from_bytes(raw)
        elif msg_type == MessageType.FILE_DATA:
            return FileData.from_bytes(raw)
        elif msg_type == MessageType.FILE_ACK:
            return FileAck.from_bytes(raw)
        elif msg_type == MessageType.SYNC_ERROR:
            return SyncError.from_bytes(raw)
        return None
    except (json.JSONDecodeError, KeyError):
        return None
