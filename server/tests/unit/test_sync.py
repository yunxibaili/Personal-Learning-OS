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

    def test_file_entry_to_dict_fields(self):
        from app.core.sync.manifest import FileEntry
        e = FileEntry(path="vault/test.md", sha256="hash", size=200, mtime=99.5)
        d = e.to_dict()
        assert d["path"] == "vault/test.md"
        assert d["sha256"] == "hash"
        assert d["size"] == 200
        assert d["mtime"] == 99.5

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

    def test_manifest_to_dict_fields(self):
        from app.core.sync.manifest import FileEntry, Manifest
        m = Manifest(device_id="dev1", version=2)
        m.files["a.md"] = FileEntry(path="a.md", sha256="h", size=10, mtime=1.0)
        d = m.to_dict()
        assert d["device_id"] == "dev1"
        assert d["version"] == 2
        assert "generated_at" in d
        assert "a.md" in d["files"]

    def test_manifest_default_generated_at(self):
        from app.core.sync.manifest import Manifest
        m = Manifest(device_id="x")
        assert m.generated_at  # non-empty

    def test_manifest_empty_files_roundtrip(self):
        from app.core.sync.manifest import Manifest
        m = Manifest(device_id="empty")
        m2 = Manifest.from_json(m.to_json())
        assert m2.files == {}

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

    def test_file_sha256_deterministic(self):
        from app.core.sync.manifest import file_sha256
        import tempfile, os
        fd, path = tempfile.mkstemp()
        try:
            os.write(fd, b"same content")
            os.close(fd)
            h1 = file_sha256(Path(path))
            h2 = file_sha256(Path(path))
            assert h1 == h2
        finally:
            os.unlink(path)


# ── Scanner / _path_matches 测试 ──────────────────────────────

class TestPathMatches:
    """测试 _path_matches 函数的 ** 通配符匹配。"""

    def test_vault_direct_md(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("vault/ml.md", "vault/**/*.md")

    def test_vault_nested_md(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("vault/sub/ml.md", "vault/**/*.md")

    def test_vault_deeply_nested_md(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("vault/a/b/c.md", "vault/**/*.md")

    def test_eventlog_match(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("metadata/eventlogs/2026-08.jsonl", "metadata/eventlogs/**/*.jsonl")

    def test_mindmap_match(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("mind_maps/project.mindmap.json", "mind_maps/**/*.mindmap.json")

    def test_no_match_wrong_ext(self):
        from app.core.sync.scanner import _path_matches
        assert not _path_matches("vault/ml.py", "vault/**/*.md")

    def test_no_match_wrong_dir(self):
        from app.core.sync.scanner import _path_matches
        assert not _path_matches("db/ml.md", "vault/**/*.md")

    def test_no_match_no_prefix(self):
        from app.core.sync.scanner import _path_matches
        assert not _path_matches("other/file.md", "vault/**/*.md")


# ── Scanner 测试 ──────────────────────────────────────────────

class TestScanner:
    def test_scan_finds_vault_files(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
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

    def test_scan_nested_vault_files(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault" / "ml" / "topics"
        vault.mkdir(parents=True)
        (vault / "nn.md").write_text("# NN", encoding="utf-8")
        (tmp_path / "vault" / "index.md").write_text("# Index", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 2
        assert "vault/ml/topics/nn.md" in manifest.files
        assert "vault/index.md" in manifest.files

    def test_scan_preserves_forward_slashes(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault" / "sub"
        vault.mkdir(parents=True)
        (vault / "a.md").write_text("a", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        for p in manifest.files:
            assert "\\" not in p

    def test_scan_empty_workspace(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 0

    def test_scan_unreadable_file_skipped(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "ok.md").write_text("ok", encoding="utf-8")
        bad = vault / "bad.md"
        bad.write_text("x", encoding="utf-8")
        bad.chmod(0o000)

        manifest = scan_workspace(tmp_path, device_id="test")
        # At least ok.md should be found; bad.md may or may not be skipped depending on OS perms
        assert "vault/ok.md" in manifest.files

    def test_scan_manifest_has_device_id(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        manifest = scan_workspace(tmp_path, device_id="my-device")
        assert manifest.device_id == "my-device"

    def test_scan_file_entry_has_correct_hash(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        from app.core.sync.manifest import file_sha256
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "a.md").write_text("hello", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        entry = manifest.files["vault/a.md"]
        assert entry.sha256 == file_sha256(tmp_path / "vault" / "a.md")
        assert entry.size == 5
        assert entry.path == "vault/a.md"


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

    def test_lww_local_newer(self):
        from app.core.sync.diff import diff_manifests, Action
        from app.core.sync.manifest import FileEntry, Manifest

        local = Manifest(device_id="A")
        local.files["vault/a.md"] = FileEntry(
            path="vault/a.md", sha256="local", size=10, mtime=300.0
        )
        remote = Manifest(device_id="B")
        remote.files["vault/a.md"] = FileEntry(
            path="vault/a.md", sha256="remote", size=10, mtime=200.0
        )

        plan = diff_manifests(local, remote, conflict_on_both_modified=False)
        assert plan.items[0].action == Action.UPLOAD  # local is newer

    def test_lww_same_mtime_prefers_local(self):
        from app.core.sync.diff import diff_manifests, Action
        from app.core.sync.manifest import FileEntry, Manifest

        local = Manifest(device_id="A")
        local.files["a.md"] = FileEntry(path="a.md", sha256="l", size=1, mtime=100.0)
        remote = Manifest(device_id="B")
        remote.files["a.md"] = FileEntry(path="a.md", sha256="r", size=1, mtime=100.0)

        plan = diff_manifests(local, remote, conflict_on_both_modified=False)
        assert plan.items[0].action == Action.UPLOAD  # local mtime >= remote

    def test_summary_counts(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "a", "vault/b.md": "b"})
        remote = self._make_manifest("B", {"vault/b.md": "b", "vault/c.md": "c"})

        plan = diff_manifests(local, remote)
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

    def test_no_conflicts_when_clean(self):
        from app.core.sync.diff import diff_manifests
        local = self._make_manifest("A", {"vault/a.md": "same"})
        remote = self._make_manifest("B", {"vault/a.md": "same"})

        plan = diff_manifests(local, remote)
        assert not plan.has_conflicts

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

    def test_sync_item_to_dict(self):
        from app.core.sync.diff import SyncItem, Action
        item = SyncItem(path="a.md", action=Action.UPLOAD, local_hash="h1", reason="local only")
        d = item.to_dict()
        assert d["path"] == "a.md"
        assert d["action"] == "upload"
        assert d["local_hash"] == "h1"
        assert d["remote_hash"] is None
        assert d["reason"] == "local only"

    def test_sync_plan_to_dict(self):
        from app.core.sync.diff import diff_manifests
        local = self._make_manifest("A", {"vault/a.md": "a"})
        remote = self._make_manifest("B", {})
        plan = diff_manifests(local, remote)

        d = plan.to_dict()
        assert d["local_device"] == "A"
        assert d["remote_device"] == "B"
        assert len(d["items"]) == 1
        assert d["summary"]["upload"] == 1

    def test_multi_file_complex(self):
        """复杂多文件场景：混合 upload/download/skip/conflict。"""
        from app.core.sync.diff import diff_manifests, Action
        from app.core.sync.manifest import FileEntry, Manifest

        local = Manifest(device_id="A")
        local.files["only_a.md"] = FileEntry(path="only_a.md", sha256="aa", size=1, mtime=1.0)
        local.files["same.md"] = FileEntry(path="same.md", sha256="ss", size=1, mtime=1.0)
        local.files["diff.md"] = FileEntry(path="diff.md", sha256="ll", size=1, mtime=1.0)

        remote = Manifest(device_id="B")
        remote.files["only_b.md"] = FileEntry(path="only_b.md", sha256="bb", size=1, mtime=1.0)
        remote.files["same.md"] = FileEntry(path="same.md", sha256="ss", size=1, mtime=1.0)
        remote.files["diff.md"] = FileEntry(path="diff.md", sha256="rr", size=1, mtime=1.0)

        plan = diff_manifests(local, remote)
        actions = {i.path: i.action for i in plan.items}
        assert actions["only_a.md"] == Action.UPLOAD
        assert actions["only_b.md"] == Action.DOWNLOAD
        assert actions["same.md"] == Action.SKIP
        assert actions["diff.md"] == Action.CONFLICT
