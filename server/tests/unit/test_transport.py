"""M7-003 Sync Transport 测试。

覆盖：
  - messages: 4种消息类型 roundtrip + parse_packet
  - transfer: is_syncable + 原子写入 + 哈希验证
  - transport: execute_plan 本地模式 + 黑名单拒绝 + 冲突跳过
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest


# ── Messages 测试 ────────────────────────────────────────────

class TestMessages:
    def test_file_request_roundtrip(self):
        from app.core.sync.messages import FileRequest
        p = FileRequest(path="vault/ml.md", expected_hash="abc123")
        raw = p.to_bytes()
        p2 = FileRequest.from_bytes(raw)
        assert p2 is not None
        assert p2.path == "vault/ml.md"
        assert p2.expected_hash == "abc123"

    def test_file_data_roundtrip(self):
        from app.core.sync.messages import FileData
        p = FileData(path="vault/test.md", content="aGVsbG8=", sha256="xyz", size=5)
        raw = p.to_bytes()
        p2 = FileData.from_bytes(raw)
        assert p2 is not None
        assert p2.content == "aGVsbG8="
        assert p2.size == 5

    def test_file_ack_roundtrip(self):
        from app.core.sync.messages import FileAck
        p = FileAck(path="vault/test.md", status="ok", message="written")
        raw = p.to_bytes()
        p2 = FileAck.from_bytes(raw)
        assert p2 is not None
        assert p2.status == "ok"

    def test_sync_error_roundtrip(self):
        from app.core.sync.messages import SyncError
        p = SyncError(path="vault/test.md", code="hash_mismatch", message="bad hash")
        raw = p.to_bytes()
        p2 = SyncError.from_bytes(raw)
        assert p2 is not None
        assert p2.code == "hash_mismatch"

    def test_parse_message_types(self):
        from app.core.sync.messages import (
            parse_message, FileRequest, FileData, FileAck, SyncError,
        )
        assert isinstance(parse_message(FileRequest(path="a").to_bytes()), FileRequest)
        assert isinstance(parse_message(FileData(path="b").to_bytes()), FileData)
        assert isinstance(parse_message(FileAck(path="c", status="ok").to_bytes()), FileAck)
        assert isinstance(parse_message(SyncError(path="d", code="x").to_bytes()), SyncError)

    def test_parse_message_invalid(self):
        from app.core.sync.messages import parse_message
        assert parse_message(b"not json") is None
        assert parse_message(json.dumps({"type": "UNKNOWN"}).encode()) is None


# ── Transfer 测试 ────────────────────────────────────────────

class TestTransfer:
    def test_is_syncable_vault(self):
        from app.core.sync.transfer import is_syncable
        assert is_syncable("vault/ml.md")
        assert is_syncable("vault/sub/note.md")

    def test_is_syncable_eventlogs(self):
        from app.core.sync.transfer import is_syncable
        assert is_syncable("metadata/eventlogs/2026-08-27.jsonl")

    def test_is_syncable_mindmaps(self):
        from app.core.sync.transfer import is_syncable
        assert is_syncable("mind_maps/test.mindmap.json")

    def test_is_syncable_blacklist_db(self):
        from app.core.sync.transfer import is_syncable
        assert not is_syncable("db/learning-os.db")
        assert not is_syncable("db/sub/file.db")

    def test_is_syncable_blacklist_devices(self):
        from app.core.sync.transfer import is_syncable
        assert not is_syncable("metadata/devices.json")

    def test_is_syncable_unknown_path(self):
        from app.core.sync.transfer import is_syncable
        assert not is_syncable("random/file.txt")
        assert not is_syncable("settings/config.json")

    def test_write_file_atomic(self, tmp_path):
        from app.core.sync.transfer import write_file_atomic, read_file_bytes
        ws = tmp_path / "workspace"
        ws.mkdir()

        data = b"hello world"
        h = write_file_atomic(ws, "vault/test.md", data)

        assert h is not None
        assert h == hashlib.sha256(data).hexdigest()

        content = read_file_bytes(ws, "vault/test.md")
        assert content == data

        # 无临时文件残留
        assert not list(ws.glob(".sync_tmp_*"))

    def test_write_file_atomic_chinese(self, tmp_path):
        from app.core.sync.transfer import write_file_atomic, read_file_bytes
        ws = tmp_path / "workspace"
        ws.mkdir()

        data = "机器学习笔记".encode("utf-8")
        h = write_file_atomic(ws, "vault/机器学习.md", data)

        assert h is not None
        content = read_file_bytes(ws, "vault/机器学习.md")
        assert content == data

    def test_write_file_atomic_large(self, tmp_path):
        from app.core.sync.transfer import write_file_atomic, read_file_bytes
        ws = tmp_path / "workspace"
        ws.mkdir()

        data = b"x" * (5 * 1024 * 1024)  # 5MB
        h = write_file_atomic(ws, "vault/large.md", data)

        assert h is not None
        content = read_file_bytes(ws, "vault/large.md")
        assert len(content) == 5 * 1024 * 1024

    def test_read_file_not_found(self, tmp_path):
        from app.core.sync.transfer import read_file_bytes
        ws = tmp_path / "workspace"
        ws.mkdir()
        assert read_file_bytes(ws, "vault/nope.md") is None

    def test_validate_hash(self):
        from app.core.sync.transfer import validate_hash
        data = b"test data"
        h = hashlib.sha256(data).hexdigest()
        assert validate_hash(data, h)
        assert not validate_hash(data, "wrong_hash")
        assert validate_hash(data, "")  # empty = skip

    def test_encode_decode(self):
        from app.core.sync.transfer import encode_content, decode_content
        data = b"hello \xe4\xb8\xad\xe6\x96\x87"
        encoded = encode_content(data)
        decoded = decode_content(encoded)
        assert decoded == data


# ── Transport 测试（本地模式，无网络）────────────────────────

class TestTransport:
    def _make_ws(self, tmp_path, files: dict[str, str]) -> Path:
        """创建带文件的 workspace。"""
        ws = tmp_path / "workspace"
        ws.mkdir()
        for rel, content in files.items():
            p = ws / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
        return ws

    def test_execute_plan_upload_local(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.diff import SyncPlan, SyncItem, Action

        ws = self._make_ws(tmp_path, {"vault/note.md": "# Hello"})
        plan = SyncPlan(
            local_device="A",
            remote_device="B",
            items=[SyncItem(path="vault/note.md", action=Action.UPLOAD)],
        )

        transport = SyncTransport()
        result = transport.execute_plan(plan, ws, peer_url=None)

        assert result.total == 1
        assert result.results[0].success
        assert result.results[0].action == "upload"

    def test_execute_plan_download_local(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.diff import SyncPlan, SyncItem, Action

        ws = self._make_ws(tmp_path, {})
        plan = SyncPlan(
            local_device="A",
            remote_device="B",
            items=[SyncItem(path="vault/new.md", action=Action.DOWNLOAD, remote_hash="abc")],
        )

        transport = SyncTransport()
        result = transport.execute_plan(plan, ws, peer_url=None)

        assert result.total == 1
        assert result.results[0].success
        assert result.results[0].action == "download"

    def test_execute_plan_skip(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.diff import SyncPlan, SyncItem, Action

        ws = self._make_ws(tmp_path, {})
        plan = SyncPlan(
            local_device="A",
            remote_device="B",
            items=[SyncItem(path="vault/same.md", action=Action.SKIP)],
        )

        transport = SyncTransport()
        result = transport.execute_plan(plan, ws)

        assert result.total == 1
        assert result.skipped == 1

    def test_execute_plan_conflict_deferred(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.diff import SyncPlan, SyncItem, Action

        ws = self._make_ws(tmp_path, {})
        plan = SyncPlan(
            local_device="A",
            remote_device="B",
            items=[SyncItem(path="vault/conflict.md", action=Action.CONFLICT)],
        )

        transport = SyncTransport()
        result = transport.execute_plan(plan, ws)

        assert result.total == 1
        assert result.conflicts == 1
        assert "M7-005" in result.results[0].message

    def test_upload_blacklist_rejected(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.diff import SyncPlan, SyncItem, Action

        ws = self._make_ws(tmp_path, {"db/test.db": "data"})
        plan = SyncPlan(
            local_device="A",
            remote_device="B",
            items=[SyncItem(path="db/test.db", action=Action.UPLOAD)],
        )

        transport = SyncTransport()
        result = transport.execute_plan(plan, ws)

        assert result.total == 1
        assert not result.results[0].success
        assert "not syncable" in result.results[0].message

    def test_download_blacklist_rejected(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.diff import SyncPlan, SyncItem, Action

        ws = self._make_ws(tmp_path, {})
        plan = SyncPlan(
            local_device="A",
            remote_device="B",
            items=[SyncItem(path="metadata/devices.json", action=Action.DOWNLOAD)],
        )

        transport = SyncTransport()
        result = transport.execute_plan(plan, ws, peer_url=None)

        assert result.total == 1
        assert not result.results[0].success
        assert "not syncable" in result.results[0].message

    def test_serve_file_ok(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.messages import FileData

        ws = self._make_ws(tmp_path, {"vault/note.md": "# Test"})
        transport = SyncTransport()
        result = transport.serve_file(ws, "vault/note.md")

        assert isinstance(result, FileData)
        assert result.path == "vault/note.md"
        assert result.content  # base64 encoded

    def test_serve_file_blacklisted(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.messages import SyncError

        ws = self._make_ws(tmp_path, {})
        transport = SyncTransport()
        result = transport.serve_file(ws, "db/learning-os.db")

        assert isinstance(result, SyncError)
        assert result.code == "path_not_syncable"

    def test_serve_file_not_found(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.messages import SyncError

        ws = self._make_ws(tmp_path, {})
        transport = SyncTransport()
        result = transport.serve_file(ws, "vault/nope.md")

        assert isinstance(result, SyncError)
        assert result.code == "file_not_found"

    def test_receive_incoming_ok(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.messages import FileData
        from app.core.sync.transfer import read_file_bytes

        ws = self._make_ws(tmp_path, {})
        transport = SyncTransport()

        data = b"# Received"
        import hashlib
        h = hashlib.sha256(data).hexdigest()
        from app.core.sync.transfer import encode_content
        file_data = FileData(
            path="vault/received.md",
            content=encode_content(data),
            sha256=h,
            size=len(data),
        )

        ack = transport.receive_incoming(ws, file_data)
        assert ack.status == "ok"

        content = read_file_bytes(ws, "vault/received.md")
        assert content == data

    def test_receive_incoming_blacklisted(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.messages import FileData, FileAck

        ws = self._make_ws(tmp_path, {})
        transport = SyncTransport()
        file_data = FileData(path="db/test.db", content="aGVsbG8=", sha256="x", size=5)

        ack = transport.receive_incoming(ws, file_data)
        assert isinstance(ack, FileAck)
        assert ack.status == "rejected"

    def test_receive_incoming_hash_mismatch(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.messages import FileData, FileAck

        ws = self._make_ws(tmp_path, {})
        transport = SyncTransport()
        file_data = FileData(
            path="vault/bad.md",
            content="aGVsbG8=",
            sha256="wrong_hash",
            size=5,
        )

        ack = transport.receive_incoming(ws, file_data)
        assert isinstance(ack, FileAck)
        assert ack.status == "rejected"  # M7-006: fail-closed 语义统一为 rejected
        assert "hash mismatch" in ack.message

    def test_serve_chinese_filename(self, tmp_path):
        from app.core.sync.transport import SyncTransport
        from app.core.sync.messages import FileData

        ws = self._make_ws(tmp_path, {"vault/机器学习.md": "# ML"})
        transport = SyncTransport()
        result = transport.serve_file(ws, "vault/机器学习.md")

        assert isinstance(result, FileData)
        assert result.path == "vault/机器学习.md"
