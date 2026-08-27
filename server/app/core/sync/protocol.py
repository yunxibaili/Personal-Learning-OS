"""M7 Sync Engine: Protocol — Discovery 通信协议。

ADR-020 冻结：
  - 协议只用于设备发现，不传输文件内容
  - 所有消息为 JSON 格式
  - 不涉及 vault / eventlogs / mind_maps

消息类型：
  DISCOVER  → 设备广播发现请求
  ACK       → 设备响应自身信息
  PING      → 心跳检测
  PONG      → 心跳响应
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .device import DeviceInfo


# 协议常量
DISCOVERY_PORT = 8765
PROTOCOL_VERSION = 1
BUFFER_SIZE = 4096


@dataclass(frozen=True)
class DiscoverPacket:
    """DISCOVER 消息：发送方广播，请求其他设备响应。"""
    type: str = "DISCOVER"
    protocol_version: int = PROTOCOL_VERSION
    sender: DeviceInfo | None = None

    def to_bytes(self) -> bytes:
        data: dict[str, Any] = {
            "type": self.type,
            "protocol_version": self.protocol_version,
        }
        if self.sender:
            data["sender"] = self.sender.to_dict()
        return json.dumps(data, ensure_ascii=False).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> DiscoverPacket | None:
        try:
            data = json.loads(raw)
            if data.get("type") != "DISCOVER":
                return None
            sender = DeviceInfo.from_dict(data["sender"]) if "sender" in data else None
            return cls(
                protocol_version=data.get("protocol_version", 1),
                sender=sender,
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None


@dataclass(frozen=True)
class AckPacket:
    """ACK 消息：接收方响应自身信息。"""
    type: str = "ACK"
    protocol_version: int = PROTOCOL_VERSION
    sender: DeviceInfo | None = None

    def to_bytes(self) -> bytes:
        data: dict[str, Any] = {
            "type": self.type,
            "protocol_version": self.protocol_version,
        }
        if self.sender:
            data["sender"] = self.sender.to_dict()
        return json.dumps(data, ensure_ascii=False).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> AckPacket | None:
        try:
            data = json.loads(raw)
            if data.get("type") != "ACK":
                return None
            sender = DeviceInfo.from_dict(data["sender"]) if "sender" in data else None
            return cls(
                protocol_version=data.get("protocol_version", 1),
                sender=sender,
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None


@dataclass(frozen=True)
class PingPacket:
    """PING 消息：心跳检测。"""
    type: str = "PING"
    protocol_version: int = PROTOCOL_VERSION

    def to_bytes(self) -> bytes:
        return json.dumps({
            "type": self.type,
            "protocol_version": self.protocol_version,
        }).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> PingPacket | None:
        try:
            data = json.loads(raw)
            if data.get("type") != "PING":
                return None
            return cls(protocol_version=data.get("protocol_version", 1))
        except (json.JSONDecodeError, KeyError):
            return None


@dataclass(frozen=True)
class PongPacket:
    """PONG 消息：心跳响应。"""
    type: str = "PONG"
    protocol_version: int = PROTOCOL_VERSION
    sender: DeviceInfo | None = None

    def to_bytes(self) -> bytes:
        data: dict[str, Any] = {
            "type": self.type,
            "protocol_version": self.protocol_version,
        }
        if self.sender:
            data["sender"] = self.sender.to_dict()
        return json.dumps(data, ensure_ascii=False).encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> PongPacket | None:
        try:
            data = json.loads(raw)
            if data.get("type") != "PONG":
                return None
            sender = DeviceInfo.from_dict(data["sender"]) if "sender" in data else None
            return cls(
                protocol_version=data.get("protocol_version", 1),
                sender=sender,
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None


def parse_packet(raw: bytes) -> DiscoverPacket | AckPacket | PingPacket | PongPacket | None:
    """解析收到的数据包，返回对应的 Packet 对象。"""
    try:
        data = json.loads(raw)
        msg_type = data.get("type")
        if msg_type == "DISCOVER":
            return DiscoverPacket.from_bytes(raw)
        elif msg_type == "ACK":
            return AckPacket.from_bytes(raw)
        elif msg_type == "PING":
            return PingPacket.from_bytes(raw)
        elif msg_type == "PONG":
            return PongPacket.from_bytes(raw)
        return None
    except (json.JSONDecodeError, KeyError):
        return None
