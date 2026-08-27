"""M7 Sync Engine: Device — 设备身份管理。

ADR-020 冻结：
  - 设备身份存储在 metadata/devices.json（Layer 3 Local Cache，永不同步）
  - device_id 生成一次，永久不变
  - 不涉及用户账号、云端 ID

DeviceInfo 结构：
  {
    "device_id": "abc123-def456",
    "name": "MacBook",
    "version": "1.0.0",
    "created_at": "2026-08-27T12:00:00Z"
  }
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class DeviceInfo:
    """设备身份信息。"""
    device_id: str
    name: str
    version: str = "1.0.0"
    created_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> DeviceInfo:
        return cls(
            device_id=d["device_id"],
            name=d["name"],
            version=d.get("version", "1.0.0"),
            created_at=d.get("created_at", ""),
        )

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @classmethod
    def from_json(cls, text: str) -> DeviceInfo:
        return cls.from_dict(json.loads(text))


def generate_device_id() -> str:
    """生成唯一设备 ID（UUID4，不可逆）。"""
    return str(uuid.uuid4())


def load_or_create_device(workspace: Path) -> DeviceInfo:
    """从 workspace/metadata/devices.json 加载设备身份，不存在则创建。

    这是设备身份的唯一读写路径。
    """
    devices_path = workspace / "metadata" / "devices.json"

    if devices_path.exists():
        try:
            data = json.loads(devices_path.read_text(encoding="utf-8"))
            return DeviceInfo.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            pass

    # 创建新设备身份
    import socket
    hostname = socket.gethostname()
    device = DeviceInfo(
        device_id=generate_device_id(),
        name=hostname,
    )

    devices_path.parent.mkdir(parents=True, exist_ok=True)
    devices_path.write_text(device.to_json(), encoding="utf-8")
    return device
