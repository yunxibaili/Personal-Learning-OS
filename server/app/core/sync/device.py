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

B24（2026-08-30）：补进程内缓存（避免重复读盘/轮转），并在 devices.json
损坏时**不静默覆盖**——先把损坏文件备份为 `.corrupt` 再重建身份，并记日志（可观测）。
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 进程内缓存：同一 workspace 只读/生成一次，避免同一进程内身份飘移
_CACHE: dict[str, DeviceInfo] = {}


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


def _backup_corrupt(devices_path: Path) -> None:
    """把损坏的 devices.json 备份为 .corrupt（不覆盖，防止原始身份彻底丢失）。"""
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = devices_path.with_name(f"devices.json.corrupt-{suffix}")
    try:
        devices_path.replace(backup)
        logger.warning("devices.json 损坏，已备份为 %s，将重建设备身份", backup.name)
    except OSError as exc:
        logger.warning("devices.json 损坏且备份失败：%s", exc)


def load_or_create_device(workspace: Path) -> DeviceInfo:
    """从 workspace/metadata/devices.json 加载设备身份，不存在则创建。

    这是设备身份的唯一读写路径。带进程内缓存（B24）：
    同一 workspace 进程内只解析一次，避免重复读盘与身份飘移。
    """
    key = str(workspace)

    cached = _CACHE.get(key)
    if cached is not None:
        return cached

    devices_path = workspace / "metadata" / "devices.json"

    if devices_path.exists():
        try:
            data = json.loads(devices_path.read_text(encoding="utf-8"))
            device = DeviceInfo.from_dict(data)
            _CACHE[key] = device
            return device
        except (json.JSONDecodeError, KeyError):
            _backup_corrupt(devices_path)

    # 创建新设备身份
    import socket
    hostname = socket.gethostname()
    device = DeviceInfo(
        device_id=generate_device_id(),
        name=hostname,
    )

    devices_path.parent.mkdir(parents=True, exist_ok=True)
    devices_path.write_text(device.to_json(), encoding="utf-8")
    _CACHE[key] = device
    return device
