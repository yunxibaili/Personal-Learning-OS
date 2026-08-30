"""M7-008 配对登记簿测试：core/sync/pairing.py。

冻结边界（ADR-020/022）：
  - 配对关系属 Layer 3 本地缓存，永不同步（SYNC_BLACKLIST 已登记）
  - 不触碰 vault / eventlogs / mind_maps
  - 非法入参 fail-closed，不落盘
"""
from __future__ import annotations

import json

import pytest

from app.core.sync.manifest import SYNC_BLACKLIST
from app.core.sync.pairing import (
    MAX_PEERS,
    PAIRING_FILENAME,
    PeerDevice,
    add_peer,
    get_peer,
    list_peers,
    pairing_path,
    remove_peer,
    validate_peer,
)


@pytest.fixture()
def ws(tmp_path):
    (tmp_path / "metadata").mkdir(parents=True, exist_ok=True)
    return tmp_path


def _peer(device_id: str = "dev-001", host: str = "192.168.1.10",
          port: int = 8000, name: str = "laptop") -> PeerDevice:
    return PeerDevice(device_id=device_id, name=name, host=host, port=port)


# ── 基础 CRUD ─────────────────────────────────────────────────

class TestPairingCrud:
    def test_empty_workspace_has_no_peers(self, ws):
        assert list_peers(ws) == []

    def test_add_and_list(self, ws):
        ok, msg = add_peer(ws, _peer())
        assert (ok, msg) == (True, "paired")
        peers = list_peers(ws)
        assert len(peers) == 1
        assert peers[0].device_id == "dev-001"
        assert peers[0].host == "192.168.1.10"
        assert peers[0].port == 8000
        assert peers[0].paired_at  # 自动生成

    def test_add_is_idempotent_not_duplicated(self, ws):
        """同一 device_id 重复配对 → 更新而非追加。"""
        add_peer(ws, _peer())
        ok, msg = add_peer(ws, _peer(host="192.168.1.99", port=8100))
        assert (ok, msg) == (True, "updated")
        peers = list_peers(ws)
        assert len(peers) == 1
        assert peers[0].host == "192.168.1.99"
        assert peers[0].port == 8100

    def test_update_preserves_first_paired_at(self, ws):
        add_peer(ws, _peer())
        first = list_peers(ws)[0].paired_at
        add_peer(ws, _peer(host="10.0.0.5"))
        assert list_peers(ws)[0].paired_at == first

    def test_multiple_peers_sorted_stably(self, ws):
        add_peer(ws, _peer("dev-b", "192.168.1.2"))
        add_peer(ws, _peer("dev-a", "192.168.1.1"))
        ids = [p.device_id for p in list_peers(ws)]
        assert len(ids) == 2
        assert set(ids) == {"dev-a", "dev-b"}
        # 同序重排两次结果一致（稳定序）
        assert ids == [p.device_id for p in list_peers(ws)]

    def test_get_peer(self, ws):
        add_peer(ws, _peer())
        assert get_peer(ws, "dev-001") is not None
        assert get_peer(ws, "nope") is None

    def test_remove_peer(self, ws):
        add_peer(ws, _peer())
        assert remove_peer(ws, "dev-001") is True
        assert list_peers(ws) == []

    def test_remove_missing_is_false(self, ws):
        assert remove_peer(ws, "ghost") is False
        # 关键：不存在的删除不得凭空创建文件
        assert not pairing_path(ws).exists()


# ── 入参校验（fail-closed）────────────────────────────────────

class TestValidation:
    @pytest.mark.parametrize("device_id", [
        "", "   ", "has space", "bad/id", "../../etc", "x" * 200,
    ])
    def test_rejects_illegal_device_id(self, device_id):
        assert validate_peer(_peer(device_id=device_id)) is not None

    @pytest.mark.parametrize("host", [
        "", "   ", "192.168.1.999", "256.1.1.1", "999.999.999.999",
        "http://evil.com", "-bad.host", "host..name", "1.2.3", "300.1.1.1",
    ])
    def test_rejects_illegal_host(self, host):
        assert validate_peer(_peer(host=host)) is not None

    def test_numeric_dotted_string_must_be_strict_ipv4(self):
        """纯数字点分串不得被主机名正则放过（标签允许数字是实测陷阱）。"""
        # 形态上像 IP、但越界 → 必须拒绝，否则配对后同步时才失败
        for host in ("1.2.3", "192.168.1.999", "256.256.256.256", "01.02.03.04"):
            assert validate_peer(_peer(host=host)) is not None, host
        # 合法 IPv4 仍要放行（含前导零以外的常见形态）
        for host in ("192.168.1.1", "10.0.0.255", "127.0.0.1", "8.8.8.8"):
            assert validate_peer(_peer(host=host)) is None, host

    @pytest.mark.parametrize("port", [0, -1, 65536, 70000])
    def test_rejects_out_of_range_port(self, port):
        assert validate_peer(_peer(port=port)) is not None

    @pytest.mark.parametrize("host", [
        "192.168.1.1", "10.0.0.255", "127.0.0.1", "laptop.local", "DESKTOP-A1",
    ])
    def test_accepts_ipv4_and_hostname(self, host):
        assert validate_peer(_peer(host=host)) is None

    def test_rejects_bool_port(self):
        """bool 是 int 子类，必须显式挡掉（True 会变成 port=1）。"""
        assert validate_peer(_peer(port=True)) is not None

    def test_invalid_peer_is_not_persisted(self, ws):
        ok, _ = add_peer(ws, _peer(host="999.999.999.999"))
        assert ok is False
        assert list_peers(ws) == []

    def test_peer_count_cap(self, ws):
        for i in range(MAX_PEERS):
            assert add_peer(ws, _peer(f"dev-{i:03d}", f"192.168.1.{i % 254 + 1}"))[0]
        ok, msg = add_peer(ws, _peer("dev-overflow", "192.168.2.1"))
        assert ok is False and "上限" in msg


# ── 文件健壮性 ────────────────────────────────────────────────

class TestDurability:
    def test_corrupt_file_is_backed_up_not_silently_overwritten(self, ws):
        """损坏登记簿：先备份 .corrupt-* 再重建，绝不静默覆盖原始身份数据。"""
        path = pairing_path(ws)
        path.write_text("{ not json", encoding="utf-8")
        assert list_peers(ws) == []
        backups = list(path.parent.glob(f"{PAIRING_FILENAME}.corrupt-*"))
        assert len(backups) == 1, "损坏文件必须先备份再重建"

    def test_corrupt_file_then_pair_recovers(self, ws):
        pairing_path(ws).write_text("garbage", encoding="utf-8")
        assert add_peer(ws, _peer())[0] is True
        assert len(list_peers(ws)) == 1

    def test_non_list_payload_is_rejected(self, ws):
        pairing_path(ws).write_text(json.dumps({"a": 1}), encoding="utf-8")
        assert list_peers(ws) == []

    def test_dirty_entries_skipped_not_fatal(self, ws):
        """缺 device_id 的脏条目跳过，不拖垮整个登记簿。"""
        pairing_path(ws).write_text(
            json.dumps([{"name": "no-id"}, _peer("dev-x", "10.0.0.1").to_dict(), "junk"]),
            encoding="utf-8",
        )
        peers = list_peers(ws)
        assert [p.device_id for p in peers] == ["dev-x"]

    def test_write_is_atomic_no_tmp_leftover(self, ws):
        add_peer(ws, _peer())
        leftovers = list(pairing_path(ws).parent.glob(f"{PAIRING_FILENAME}.tmp"))
        assert leftovers == [], "原子写入后不应残留 .tmp"


# ── 同步边界（ADR-020 冻结）──────────────────────────────────

class TestSyncBoundary:
    def test_pairing_file_never_syncs(self):
        """配对登记簿必须在同步黑名单内——Layer 3 永不同步。"""
        assert "metadata/paired_devices.json" in SYNC_BLACKLIST
        assert "metadata/paired_devices.json.tmp" in SYNC_BLACKLIST

    def test_pairing_file_not_scanned_into_manifest(self, ws, tmp_path):
        """端到端证明：登记簿不会进入 manifest（扫不进 Layer 1）。"""
        from app.core.sync.scanner import scan_workspace

        add_peer(ws, _peer())
        manifest = scan_workspace(ws, "self-device")
        assert not any(PAIRING_FILENAME in p for p in manifest.files), (
            "配对登记簿泄漏进 manifest —— 会被同步到对端，违反 ADR-020"
        )

    def test_pairing_module_is_stdlib_only(self, tmp_path):
        """core 边界：pairing 不得引入 fastapi / sqlite3 / requests。"""
        import ast

        src = (tmp_path / "x").parent  # 占位，真实路径见下
        from pathlib import Path

        mod = Path(__file__).resolve().parents[2] / "app" / "core" / "sync" / "pairing.py"
        tree = ast.parse(mod.read_text(encoding="utf-8"))
        banned = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                banned |= {a.name.split(".")[0] for a in node.names}
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                banned.add(node.module.split(".")[0])
        forbidden = {"fastapi", "sqlite3", "requests", "httpx", "starlette"}
        assert not (banned & forbidden), f"core 层禁止依赖：{banned & forbidden}"
        assert src is not None
