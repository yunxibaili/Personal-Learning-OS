"""M7-001 Sync Engine Core 测试。"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest


# ── Manifest 测试 ─────────────────────────────────────────────

class TestManifest:
    def test_file_entry_roundtrip(self):
        from app.core.sync.manifest import FileEntry
        e = FileEntry(path="vault/ml.md", sha256="abc123", size=1024, mtime=1234567890.0)
        d = e.to_dict()
        e2 = FileEntry.from_dict(d)
        assert e == e2

    def test_manifest_roundtrip(self):
        from app.core.sync.manifest import FileEntry, Manifest
        m = Manifest(device_id="device-a")
        m.files["vault/ml.md"] = FileEntry(
            path="vault/ml.md", sha256="abc", size=100, mtime=1.0
        )
        m.files["mind_maps/p.json"] = FileEntry(
            path="mind_maps/p.json", sha256="def", size=200, mtime=2.0
        )
        text = m.to_json()
        m2 = Manifest.from_json(text)
        assert m2.device_id == "device-a"
        assert len(m2.files) == 2
        assert m2.files["vault/ml.md"].sha256 == "abc"

    def test_file_sha256(self):
        from app.core.sync.manifest import file_sha256
        import tempfile, os
        fd, path = tempfile.mkstemp()
        try:
            os.write(fd, b"hello world")
            os.close(fd)
            h = file_sha256(Path(path))
            assert len(h) == 64  # SHA-256 hex digest
        finally:
            os.unlink(path)


# ── Scanner 测试 ──────────────────────────────────────────────

class TestScanner:
    def test_scan_finds_vault_files(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        # 创建测试文件
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "ml.md").write_text("# ML", encoding="utf-8")
        (vault / "python.md").write_text("# Python", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test-device")
        assert len(manifest.files) == 2
        assert "vault/ml.md" in manifest.files
        assert "vault/python.md" in manifest.files

    def test_scan_finds_eventlogs(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        logs = tmp_path / "metadata" / "eventlogs"
        logs.mkdir(parents=True)
        (logs / "2026-08.jsonl").write_text('{"event":"test"}\n', encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert "metadata/eventlogs/2026-08.jsonl" in manifest.files

    def test_scan_finds_mindmap_files(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        mm = tmp_path / "mind_maps"
        mm.mkdir()
        (mm / "project.mindmap.json").write_text('{"title":"test"}', encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert "mind_maps/project.mindmap.json" in manifest.files

    def test_scan_skips_blacklist(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        # 创建 vault 和 db
        (tmp_path / "vault").mkdir()
        (tmp_path / "vault" / "a.md").write_text("a", encoding="utf-8")
        (tmp_path / "db").mkdir()
        (tmp_path / "db" / "app.sqlite").write_bytes(b"sqlite data")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert "vault/a.md" in manifest.files

    def test_scan_skips_hidden_files(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "a.md").write_text("a", encoding="utf-8")
        (vault / ".hidden").write_text("secret", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1


# ── Diff 测试 ─────────────────────────────────────────────────

class TestDiff:
    def _make_manifest(self, device_id: str, files: dict[str, str]) -> "Manifest":
        from app.core.sync.manifest import FileEntry, Manifest
        import hashlib
        m = Manifest(device_id=device_id)
        for path, content in files.items():
            m.files[path] = FileEntry(
                path=path,
                sha256=hashlib.sha256(content.encode()).hexdigest()[:16],
                size=len(content),
                mtime=1.0,
            )
        return m

    def test_upload_when_local_only(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "a"})
        remote = self._make_manifest("B", {})

        plan = diff_manifests(local, remote)
        assert len(plan.items) == 1
        assert plan.items[0].action == Action.UPLOAD
        assert plan.items[0].path == "vault/a.md"

    def test_download_when_remote_only(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {})
        remote = self._make_manifest("B", {"vault/b.md": "b"})

        plan = diff_manifests(local, remote)
        assert len(plan.items) == 1
        assert plan.items[0].action == Action.DOWNLOAD
        assert plan.items[0].path == "vault/b.md"

    def test_skip_when_identical(self):
        from app.core.sync.diff import diff_manifests, Action
        # 相同内容但不同 hash 表示方式
        local = self._make_manifest("A", {"vault/a.md": "same"})
        remote = self._make_manifest("B", {"vault/a.md": "same"})

        plan = diff_manifests(local, remote)
        assert len(plan.items) == 1
        assert plan.items[0].action == Action.SKIP

    def test_conflict_when_both_modified(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "local version"})
        remote = self._make_manifest("B", {"vault/a.md": "remote version"})

        plan = diff_manifests(local, remote)
        assert len(plan.items) == 1
        assert plan.items[0].action == Action.CONFLICT

    def test_lww_when_conflict_disabled(self):
        from app.core.sync.diff import diff_manifests, Action
        from app.core.sync.manifest import FileEntry, Manifest

        local = Manifest(device_id="A")
        local.files["vault/a.md"] = FileEntry(
            path="vault/a.md", sha256="local", size=10, mtime=100.0
        )
        remote = Manifest(device_id="B")
        remote.files["vault/a.md"] = FileEntry(
            path="vault/a.md", sha256="remote", size=10, mtime=200.0
        )

        plan = diff_manifests(local, remote, conflict_on_both_modified=False)
        assert plan.items[0].action == Action.DOWNLOAD  # remote is newer

    def test_summary_counts(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {
            "vault/a.md": "a",
            "vault/b.md": "b",
        })
        remote = self._make_manifest("B", {
            "vault/b.md": "b",     # identical
            "vault/c.md": "c",     # remote only
            "vault/d.md": "diff",  # conflict (different from local absent)
        })
        # 重新构造：local 有 a(only), b(same); remote 有 b(same), c(only)
        local2 = self._make_manifest("A", {"vault/a.md": "a", "vault/b.md": "b"})
        remote2 = self._make_manifest("B", {"vault/b.md": "b", "vault/c.md": "c"})

        plan = diff_manifests(local2, remote2)
        summary = plan.summary
        assert summary["upload"] == 1    # a.md
        assert summary["download"] == 1  # c.md
        assert summary["skip"] == 1      # b.md
        assert summary["conflict"] == 0

    def test_has_conflicts(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "local"})
        remote = self._make_manifest("B", {"vault/a.md": "remote"})

        plan = diff_manifests(local, remote)
        assert plan.has_conflicts

    def test_get_items_by_action(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "a"})
        remote = self._make_manifest("B", {"vault/b.md": "b"})

        plan = diff_manifests(local, remote)
        uploads = plan.get_items_by_action(Action.UPLOAD)
        downloads = plan.get_items_by_action(Action.DOWNLOAD)
        assert len(uploads) == 1
        assert len(downloads) == 1

    def test_empty_manifests(self):
        from app.core.sync.diff import diff_manifests
        local = self._make_manifest("A", {})
        remote = self._make_manifest("B", {})

        plan = diff_manifests(local, remote)
        assert len(plan.items) == 0
        assert plan.summary == {"upload": 0, "download": 0, "conflict": 0, "skip": 0}
