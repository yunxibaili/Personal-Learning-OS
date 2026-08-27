"""M7 Sync Engine — 纯 Core + Discovery。

ADR-005/020 冻结：
  - 同步只发生在 Layer 1（Truth Source）
  - vault/*.md + eventlogs/*.jsonl + mind_maps/*.mindmap.json
  - SQLite / settings / API keys 永不同步

模块：
  manifest: FileEntry + Manifest 数据结构
  scanner: 扫描 workspace 生成 Manifest
  diff: 对比两个 Manifest → SyncPlan
  device: 设备身份管理（metadata/devices.json）
  protocol: Discovery 通信协议（DISCOVER/ACK/PING/PONG）
  discovery: 局域网设备发现（UDP broadcast）
"""
from .manifest import FileEntry, Manifest, file_sha256
from .scanner import scan_workspace
from .diff import Action, SyncItem, SyncPlan, diff_manifests
from .device import DeviceInfo, load_or_create_device
from .protocol import DiscoverPacket, AckPacket, PingPacket, PongPacket

__all__ = [
    "FileEntry",
    "Manifest",
    "file_sha256",
    "scan_workspace",
    "Action",
    "SyncItem",
    "SyncPlan",
    "diff_manifests",
    "DeviceInfo",
    "load_or_create_device",
    "DiscoverPacket",
    "AckPacket",
    "PingPacket",
    "PongPacket",
]
