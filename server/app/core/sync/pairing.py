"""M7-008 Sync Pairing — 已配对设备登记簿。

ADR-020/022 冻结：
  - 配对关系属 **Layer 3 Local Cache**（同 devices.json / settings / API keys），
    **永不同步**——对端设备列表是「我这台机器认识谁」，不是事实源的一部分
  - 不触碰 vault / eventlogs / mind_maps，不涉及用户账号 / 云端 ID
  - 只登记 {device_id, name, host, port}，不存任何内容数据

文件：`workspace/metadata/paired_devices.json`（已在 manifest.SYNC_BLACKLIST 登记）

设计取舍：
  - 与 device.py 一致：损坏文件先备份 `.corrupt-<ts>` 再重建，不静默覆盖
  - 写入走先写临时文件再 replace（原子替换），避免半截 JSON
  - 入参做 fail-closed 校验：非法 host/port/device_id 直接拒绝，不落盘
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PAIRING_FILENAME = "paired_devices.json"

# 主机名/IP 允许形态：IPv4 点分十进制、或 RFC1123 主机名标签
_HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$"
)
_IPV4_RE = re.compile(
    r"^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)"
    r"(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$"
)
# device_id 由 uuid4 生成；此处只做形态守卫，防止把任意字符串写进登记簿
_DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

MAX_PEERS = 64  # 局域网场景上限，防御性：避免登记簿被撑爆


@dataclass
class PeerDevice:
    """一台已配对的对端设备。"""
    device_id: str
    name: str = ""
    host: str = ""
    port: int = 8000
    paired_at: str = ""

    def __post_init__(self):
        if not self.paired_at:
            self.paired_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> PeerDevice:
        return cls(
            device_id=d["device_id"],
            name=d.get("name", ""),
            host=d.get("host", ""),
            port=d.get("port", 8000),
            paired_at=d.get("paired_at", ""),
        )


def pairing_path(workspace: Path) -> Path:
    return workspace / "metadata" / PAIRING_FILENAME


def _is_valid_host(host: str) -> bool:
    """host 合法性：IPv4 或 RFC1123 主机名。

    ⚠️ 实测陷阱：形如 `999.999.999.999` / `1.2.3` 的纯数字点分串会被主机名
    正则（标签允许数字）判定为合法——它既不是能连的 IP，也不是能解析的主机名，
    配对后只会在同步时才失败。此处显式收紧：凡由数字和点构成的一律按 IPv4 严检。
    """
    if _IPV4_RE.match(host):
        return True
    if host.replace(".", "").isdigit():
        return False
    return bool(_HOSTNAME_RE.match(host))


def validate_peer(peer: PeerDevice) -> str | None:
    """校验对端设备字段；合法返回 None，非法返回可读原因（fail-closed）。"""
    if not isinstance(peer.device_id, str) or not _DEVICE_ID_RE.match(peer.device_id):
        return "device_id 形态非法"
    if not isinstance(peer.host, str) or not peer.host.strip():
        return "host 不能为空"
    host = peer.host.strip()
    if not _is_valid_host(host):
        return "host 必须是 IPv4 地址或合法主机名"
    if not isinstance(peer.port, int) or isinstance(peer.port, bool):
        return "port 必须是整数"
    if not (1 <= peer.port <= 65535):
        return "port 超出 1-65535"
    if not isinstance(peer.name, str):
        return "name 必须是字符串"
    return None


def _read_peers(path: Path) -> list[PeerDevice]:
    """读取登记簿；文件不存在 → 空列表。"""
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        _backup_corrupt(path)
        return []
    if not isinstance(raw, list):
        _backup_corrupt(path)
        return []
    peers: list[PeerDevice] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            peers.append(PeerDevice.from_dict(item))
        except KeyError:
            continue  # 缺 device_id 的脏条目直接跳过，不拖垮整个登记簿
    return peers


def _backup_corrupt(path: Path) -> None:
    """损坏登记簿先备份再放弃（与 device.py 同策略，不静默覆盖）。"""
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = path.with_name(f"{PAIRING_FILENAME}.corrupt-{suffix}")
    try:
        path.replace(backup)
        logger.warning("paired_devices.json 损坏，已备份为 %s", backup.name)
    except OSError as exc:
        logger.warning("paired_devices.json 损坏且备份失败：%s", exc)


def _write_peers(path: Path, peers: list[PeerDevice]) -> None:
    """原子写入：临时文件 → replace。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{PAIRING_FILENAME}.tmp")
    payload = json.dumps([p.to_dict() for p in peers], ensure_ascii=False, indent=2)
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def list_peers(workspace: Path) -> list[PeerDevice]:
    """返回已配对设备列表（按配对时间升序，稳定序）。"""
    peers = _read_peers(pairing_path(workspace))
    return sorted(peers, key=lambda p: (p.paired_at, p.device_id))


def get_peer(workspace: Path, device_id: str) -> PeerDevice | None:
    for p in _read_peers(pairing_path(workspace)):
        if p.device_id == device_id:
            return p
    return None


def add_peer(workspace: Path, peer: PeerDevice) -> tuple[bool, str]:
    """登记/更新一台对端设备。

    幂等：同一 device_id 再次配对则更新 host/port/name，不产生重复条目。
    返回 (ok, message)；非法入参或超出上限时 ok=False 且不落盘。
    """
    reason = validate_peer(peer)
    if reason:
        return False, reason

    path = pairing_path(workspace)
    peers = _read_peers(path)
    existing = next((p for p in peers if p.device_id == peer.device_id), None)
    if existing is None:
        if len(peers) >= MAX_PEERS:
            return False, f"配对设备数已达上限 {MAX_PEERS}"
        peers.append(peer)
        _write_peers(path, peers)
        return True, "paired"
    # 更新：保留首次配对时间，刷新连接信息
    existing.name = peer.name or existing.name
    existing.host = peer.host
    existing.port = peer.port
    _write_peers(path, peers)
    return True, "updated"


def remove_peer(workspace: Path, device_id: str) -> bool:
    """解除配对；不存在返回 False。"""
    path = pairing_path(workspace)
    peers = _read_peers(path)
    remaining = [p for p in peers if p.device_id != device_id]
    if len(remaining) == len(peers):
        return False
    _write_peers(path, remaining)
    return True
