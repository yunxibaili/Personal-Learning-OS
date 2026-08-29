"""M7-002 LAN Discovery 单元测试。"""
from __future__ import annotations

import json
import socket
import threading
import time
from pathlib import Path

import pytest


# ── DeviceInfo 测试 ──────────────────────────────────────────

class TestDeviceInfo:
    def test_create_device(self):
        from app.core.sync.device import DeviceInfo
        d = DeviceInfo(device_id="abc-123", name="MacBook")
        assert d.device_id == "abc-123"
        assert d.name == "MacBook"
        assert d.version == "1.0.0"
        assert d.created_at  # auto-generated

    def test_to_dict(self):
        from app.core.sync.device import DeviceInfo
        d = DeviceInfo(device_id="x", name="Dev", version="2.0.0")
        data = d.to_dict()
        assert data["device_id"] == "x"
        assert data["name"] == "Dev"
        assert data["version"] == "2.0.0"
        assert "created_at" in data

    def test_from_dict(self):
        from app.core.sync.device import DeviceInfo
        d = DeviceInfo.from_dict({
            "device_id": "y",
            "name": "Laptop",
            "version": "1.5.0",
            "created_at": "2026-01-01T00:00:00Z",
        })
        assert d.device_id == "y"
        assert d.version == "1.5.0"

    def test_json_roundtrip(self):
        from app.core.sync.device import DeviceInfo
        d = DeviceInfo(device_id="z", name="Test")
        d2 = DeviceInfo.from_json(d.to_json())
        assert d == d2

    def test_generate_device_id_unique(self):
        from app.core.sync.device import generate_device_id
        id1 = generate_device_id()
        id2 = generate_device_id()
        assert id1 != id2
        assert len(id1) == 36  # UUID4 format

    def test_load_or_create_device_creates_new(self, tmp_path):
        from app.core.sync.device import load_or_create_device
        ws = tmp_path / "workspace"
        ws.mkdir()
        (ws / "metadata").mkdir()

        device = load_or_create_device(ws)
        assert device.device_id
        assert device.name
        assert (ws / "metadata" / "devices.json").exists()

    def test_load_or_create_device_loads_existing(self, tmp_path):
        from app.core.sync.device import load_or_create_device, DeviceInfo
        ws = tmp_path / "workspace"
        ws.mkdir()
        (ws / "metadata").mkdir()

        # 先创建
        d1 = load_or_create_device(ws)
        # 再加载
        d2 = load_or_create_device(ws)
        assert d1.device_id == d2.device_id
        assert d1.name == d2.name

    def test_load_or_create_device_corrupt_file(self, tmp_path):
        from app.core.sync.device import load_or_create_device
        ws = tmp_path / "workspace"
        ws.mkdir()
        (ws / "metadata").mkdir()
        (ws / "metadata" / "devices.json").write_text("corrupt!")

        device = load_or_create_device(ws)
        assert device.device_id  # 新建了一个

    def test_corrupt_file_backed_up_not_overwritten(self, tmp_path):
        """B24：损坏的 devices.json 应备份为 .corrupt，而非被静默覆盖。"""
        from app.core.sync.device import load_or_create_device
        ws = tmp_path / "workspace"
        ws.mkdir()
        (ws / "metadata").mkdir()
        (ws / "metadata" / "devices.json").write_text("corrupt!")

        device = load_or_create_device(ws)
        backups = list((ws / "metadata").glob("devices.json.corrupt-*"))
        assert len(backups) == 1
        assert backups[0].read_text(encoding="utf-8") == "corrupt!"
        assert (ws / "metadata" / "devices.json").exists()
        assert device.device_id

    def test_memory_cache_stable_within_process(self, tmp_path, monkeypatch):
        """B24：进程内缓存——同一 workspace 二次加载不再重读/重生成。"""
        from app.core.sync import device as dev
        ws = tmp_path / "workspace"
        ws.mkdir()
        (ws / "metadata").mkdir()

        dev._CACHE.clear()
        d1 = dev.load_or_create_device(ws)
        # 删除磁盘文件，仍应返回缓存中的同一身份（不会重新生成）
        (ws / "metadata" / "devices.json").unlink()
        d2 = dev.load_or_create_device(ws)
        assert d1.device_id == d2.device_id


# ── Protocol 测试 ────────────────────────────────────────────

class TestProtocol:
    def test_discover_packet_roundtrip(self):
        from app.core.sync.protocol import DiscoverPacket
        from app.core.sync.device import DeviceInfo
        sender = DeviceInfo(device_id="a", name="Dev")
        p = DiscoverPacket(sender=sender)
        raw = p.to_bytes()
        p2 = DiscoverPacket.from_bytes(raw)
        assert p2 is not None
        assert p2.sender.device_id == "a"
        assert p2.protocol_version == 1

    def test_discover_packet_no_sender(self):
        from app.core.sync.protocol import DiscoverPacket
        p = DiscoverPacket()
        raw = p.to_bytes()
        p2 = DiscoverPacket.from_bytes(raw)
        assert p2 is not None
        assert p2.sender is None

    def test_ack_packet_roundtrip(self):
        from app.core.sync.protocol import AckPacket
        from app.core.sync.device import DeviceInfo
        sender = DeviceInfo(device_id="b", name="Laptop")
        p = AckPacket(sender=sender)
        raw = p.to_bytes()
        p2 = AckPacket.from_bytes(raw)
        assert p2 is not None
        assert p2.sender.device_id == "b"

    def test_ping_packet_roundtrip(self):
        from app.core.sync.protocol import PingPacket
        p = PingPacket()
        raw = p.to_bytes()
        p2 = PingPacket.from_bytes(raw)
        assert p2 is not None

    def test_pong_packet_roundtrip(self):
        from app.core.sync.protocol import PongPacket
        from app.core.sync.device import DeviceInfo
        sender = DeviceInfo(device_id="c", name="Server")
        p = PongPacket(sender=sender)
        raw = p.to_bytes()
        p2 = PongPacket.from_bytes(raw)
        assert p2 is not None
        assert p2.sender.device_id == "c"

    def test_parse_packet_discover(self):
        from app.core.sync.protocol import parse_packet, DiscoverPacket
        from app.core.sync.device import DeviceInfo
        p = DiscoverPacket(sender=DeviceInfo(device_id="x", name="A"))
        result = parse_packet(p.to_bytes())
        assert isinstance(result, DiscoverPacket)

    def test_parse_packet_ack(self):
        from app.core.sync.protocol import parse_packet, AckPacket
        result = parse_packet(AckPacket().to_bytes())
        assert isinstance(result, AckPacket)

    def test_parse_packet_ping(self):
        from app.core.sync.protocol import parse_packet, PingPacket
        result = parse_packet(PingPacket().to_bytes())
        assert isinstance(result, PingPacket)

    def test_parse_packet_pong(self):
        from app.core.sync.protocol import parse_packet, PongPacket
        from app.core.sync.device import DeviceInfo
        result = parse_packet(PongPacket(sender=DeviceInfo(device_id="d", name="D")).to_bytes())
        assert isinstance(result, PongPacket)

    def test_parse_packet_invalid_json(self):
        from app.core.sync.protocol import parse_packet
        assert parse_packet(b"not json") is None

    def test_parse_packet_unknown_type(self):
        from app.core.sync.protocol import parse_packet
        raw = json.dumps({"type": "UNKNOWN"}).encode()
        assert parse_packet(raw) is None

    def test_parse_packet_missing_type(self):
        from app.core.sync.protocol import parse_packet
        raw = json.dumps({"foo": "bar"}).encode()
        assert parse_packet(raw) is None


# ── Discovery Listener 测试 ─────────────────────────────────

class TestDiscoveryListener:
    def test_listener_responds_to_discover(self):
        from app.core.sync.discovery import start_discovery_listener
        from app.core.sync.protocol import DiscoverPacket, parse_packet, AckPacket
        from app.core.sync.device import DeviceInfo

        device = DeviceInfo(device_id="listener-1", name="Listener")
        port = 18765  # test port

        stop = start_discovery_listener(device, port=port)
        try:
            time.sleep(0.1)

            # 发送 DISCOVER
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(2.0)
            try:
                discover = DiscoverPacket(sender=DeviceInfo(device_id="sender-1", name="Sender"))
                sock.sendto(discover.to_bytes(), ("127.0.0.1", port))

                # 接收 ACK
                data, _ = sock.recvfrom(4096)
                ack = parse_packet(data)
                assert isinstance(ack, AckPacket)
                assert ack.sender.device_id == "listener-1"
            finally:
                sock.close()
        finally:
            stop()

    def test_listener_stops_cleanly(self):
        from app.core.sync.discovery import start_discovery_listener
        from app.core.sync.device import DeviceInfo

        device = DeviceInfo(device_id="stop-test", name="Stop")
        stop = start_discovery_listener(device, port=18766)
        time.sleep(0.1)
        stop()  # should not hang

    def test_listener_ignores_non_discover(self):
        from app.core.sync.discovery import start_discovery_listener
        from app.core.sync.protocol import AckPacket
        from app.core.sync.device import DeviceInfo

        device = DeviceInfo(device_id="ignore-test", name="Ignore")
        port = 18767

        callback_called = threading.Event()
        def on_found(d):
            callback_called.set()

        stop = start_discovery_listener(device, port=port, on_device_found=on_found)
        try:
            time.sleep(0.1)

            # 发送 ACK（不是 DISCOVER）
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(1.0)
            try:
                ack = AckPacket(sender=DeviceInfo(device_id="other", name="Other"))
                sock.sendto(ack.to_bytes(), ("127.0.0.1", port))
                # 不应触发回调
                assert not callback_called.wait(timeout=0.5)
            finally:
                sock.close()
        finally:
            stop()


# ── Discovery Integration 测试 ──────────────────────────────

class TestDiscoveryIntegration:
    def test_discover_with_local_listener(self):
        from app.core.sync.discovery import start_discovery_listener, discover_peers
        from app.core.sync.device import DeviceInfo

        listener_device = DeviceInfo(device_id="peer-1", name="Peer1")
        sender_device = DeviceInfo(device_id="self-1", name="Self")
        port = 18770

        stop = start_discovery_listener(listener_device, port=port)
        try:
            time.sleep(0.1)
            peers = discover_peers(sender_device, port=port, timeout=1.0, max_retries=1)
            assert len(peers) == 1
            assert peers[0].device_id == "peer-1"
        finally:
            stop()

    def test_discover_ignores_self(self):
        from app.core.sync.discovery import start_discovery_listener, discover_peers
        from app.core.sync.device import DeviceInfo

        device = DeviceInfo(device_id="same-id", name="Same")
        port = 18771

        stop = start_discovery_listener(device, port=port)
        try:
            time.sleep(0.1)
            peers = discover_peers(device, port=port, timeout=1.0, max_retries=1)
            assert len(peers) == 0  # 自身被过滤
        finally:
            stop()

    def test_discover_no_peers(self):
        from app.core.sync.discovery import discover_peers
        from app.core.sync.device import DeviceInfo

        device = DeviceInfo(device_id="lonely", name="Lonely")
        # 使用没有监听器的端口
        peers = discover_peers(device, port=18799, timeout=0.5, max_retries=1)
        assert peers == []  # 超时返回空列表，不是异常

    def test_discover_multiple_peers(self):
        from app.core.sync.discovery import start_discovery_listener, discover_peers
        from app.core.sync.device import DeviceInfo

        d1 = DeviceInfo(device_id="multi-1", name="Peer1")
        d2 = DeviceInfo(device_id="multi-2", name="Peer2")
        sender = DeviceInfo(device_id="multi-sender", name="Sender")
        port = 18772

        stop1 = start_discovery_listener(d1, port=port)
        stop2 = start_discovery_listener(d2, port=port)
        try:
            time.sleep(0.2)
            peers = discover_peers(sender, port=port, timeout=1.5, max_retries=2)
            peer_ids = {p.device_id for p in peers}
            assert "multi-1" in peer_ids
            assert "multi-2" in peer_ids
        finally:
            stop1()
            stop2()
