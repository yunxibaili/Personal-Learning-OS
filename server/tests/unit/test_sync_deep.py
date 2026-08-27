"""M7 Sync Engine — 深度测试：边界条件、中文文件名、特殊字符、大文件。"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest


# ── Manifest 深度测试 ─────────────────────────────────────────

class TestManifestDeep:
    def test_empty_workspace_scan(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 0
        assert manifest.device_id == "test"

    def test_deep_directory_scan(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        deep = tmp_path / "vault" / "a" / "b" / "c" / "d"
        deep.mkdir(parents=True)
        (deep / "deep.md").write_text("deep content", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert "vault/a/b/c/d/deep.md" in manifest.files

    def test_chinese_filename_scan(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "机器学习.md").write_text("# 机器学习", encoding="utf-8")
        (vault / "深度学习入门.md").write_text("# 深度学习", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 2
        assert "vault/机器学习.md" in manifest.files
        assert "vault/深度学习入门.md" in manifest.files

    def test_chinese_directory_scan(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault" / "人工智能"
        vault.mkdir(parents=True)
        (vault / "神经网络.md").write_text("# NN", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert "vault/人工智能/神经网络.md" in manifest.files

    def test_special_characters_in_path(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "note (1).md").write_text("content", encoding="utf-8")
        (vault / "note-v2.md").write_text("content", encoding="utf-8")
        (vault / "note_final.md").write_text("content", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 3

    def test_large_file_scan(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        from app.core.sync.manifest import file_sha256
        vault = tmp_path / "vault"
        vault.mkdir()
        # 100KB file
        large_content = "x" * 100_000
        (vault / "large.md").write_text(large_content, encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        entry = manifest.files["vault/large.md"]
        assert entry.size == len(large_content.encode("utf-8"))
        assert entry.sha256 == file_sha256(tmp_path / "vault" / "large.md")

    def test_binary_file_skipped(self, tmp_path):
        """二进制文件不在白名单中，应被跳过。"""
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "image.png").write_bytes(b"\x89PNG\r\n\x1a\n")
        (vault / "note.md").write_text("text", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert "vault/note.md" in manifest.files

    def test_eventlog_nested_dirs(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        logs = tmp_path / "metadata" / "eventlogs" / "2026"
        logs.mkdir(parents=True)
        (logs / "08.jsonl").write_text('{"e":1}\n', encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1

    def test_mindmap_in_subdir(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        mm = tmp_path / "mind_maps" / "project"
        mm.mkdir(parents=True)
        (mm / "main.mindmap.json").write_text('{}', encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1

    def test_file_entry_hash_correctness(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        from app.core.sync.manifest import file_sha256
        vault = tmp_path / "vault"
        vault.mkdir()
        content = "Hello, 世界! 🌍"
        (vault / "unicode.md").write_text(content, encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        entry = manifest.files["vault/unicode.md"]
        expected_hash = file_sha256(tmp_path / "vault" / "unicode.md")
        assert entry.sha256 == expected_hash

    def test_manifest_json_roundtrip_chinese(self):
        from app.core.sync.manifest import FileEntry, Manifest
        m = Manifest(device_id="设备A")
        m.files["vault/笔记.md"] = FileEntry(
            path="vault/笔记.md", sha256="abc", size=100, mtime=1.0
        )
        text = m.to_json()
        m2 = Manifest.from_json(text)
        assert m2.device_id == "设备A"
        assert "vault/笔记.md" in m2.files


# ── Diff 深度测试 ─────────────────────────────────────────────

class TestDiffDeep:
    def _make_manifest(self, device_id: str, files: dict[str, str], mtimes: dict[str, float] | None = None):
        from app.core.sync.manifest import FileEntry, Manifest
        m = Manifest(device_id=device_id)
        for path, content in files.items():
            mtime = (mtimes or {}).get(path, 1.0)
            m.files[path] = FileEntry(
                path=path,
                sha256=hashlib.sha256(content.encode()).hexdigest()[:16],
                size=len(content),
                mtime=mtime,
            )
        return m

    def test_upload_only_file(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "content"})
        remote = self._make_manifest("B", {})
        plan = diff_manifests(local, remote)
        assert len(plan.items) == 1
        assert plan.items[0].action == Action.UPLOAD
        assert plan.items[0].reason == "local only"

    def test_download_only_file(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {})
        remote = self._make_manifest("B", {"vault/b.md": "content"})
        plan = diff_manifests(local, remote)
        assert len(plan.items) == 1
        assert plan.items[0].action == Action.DOWNLOAD
        assert plan.items[0].reason == "remote only"

    def test_conflict_both_modified(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "local"})
        remote = self._make_manifest("B", {"vault/a.md": "remote"})
        plan = diff_manifests(local, remote)
        assert plan.items[0].action == Action.CONFLICT
        assert plan.items[0].reason == "both modified"

    def test_skip_identical(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {"vault/a.md": "same"})
        remote = self._make_manifest("B", {"vault/a.md": "same"})
        plan = diff_manifests(local, remote)
        assert plan.items[0].action == Action.SKIP
        assert plan.items[0].reason == "identical"

    def test_lww_mindmap_newer_wins(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest(
            "A", {"mind_maps/p.mindmap.json": "v1"},
            mtimes={"mind_maps/p.mindmap.json": 100.0}
        )
        remote = self._make_manifest(
            "B", {"mind_maps/p.mindmap.json": "v2"},
            mtimes={"mind_maps/p.mindmap.json": 200.0}
        )
        plan = diff_manifests(local, remote, conflict_on_both_modified=False)
        assert plan.items[0].action == Action.DOWNLOAD  # remote newer

    def test_lww_local_newer_wins(self):
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest(
            "A", {"mind_maps/p.mindmap.json": "v2"},
            mtimes={"mind_maps/p.mindmap.json": 300.0}
        )
        remote = self._make_manifest(
            "B", {"mind_maps/p.mindmap.json": "v1"},
            mtimes={"mind_maps/p.mindmap.json": 200.0}
        )
        plan = diff_manifests(local, remote, conflict_on_both_modified=False)
        assert plan.items[0].action == Action.UPLOAD  # local newer

    def test_complex_mixed_scenario(self):
        """复杂场景：多个文件混合操作。"""
        from app.core.sync.diff import diff_manifests, Action
        local = self._make_manifest("A", {
            "vault/only-local.md": "a",
            "vault/same.md": "s",
            "vault/conflict.md": "lc",
        })
        remote = self._make_manifest("B", {
            "vault/only-remote.md": "b",
            "vault/same.md": "s",
            "vault/conflict.md": "rc",
        })
        plan = diff_manifests(local, remote)
        actions = {i.path: i.action for i in plan.items}
        assert actions["vault/only-local.md"] == Action.UPLOAD
        assert actions["vault/only-remote.md"] == Action.DOWNLOAD
        assert actions["vault/same.md"] == Action.SKIP
        assert actions["vault/conflict.md"] == Action.CONFLICT
        assert plan.summary == {"upload": 1, "download": 1, "skip": 1, "conflict": 1}

    def test_sync_item_to_dict_complete(self):
        from app.core.sync.diff import SyncItem, Action
        item = SyncItem(
            path="vault/test.md",
            action=Action.CONFLICT,
            local_hash="hash_a",
            remote_hash="hash_b",
            reason="both modified",
        )
        d = item.to_dict()
        assert d == {
            "path": "vault/test.md",
            "action": "conflict",
            "local_hash": "hash_a",
            "remote_hash": "hash_b",
            "reason": "both modified",
        }

    def test_sync_plan_to_dict_complete(self):
        from app.core.sync.diff import diff_manifests
        local = self._make_manifest("A", {"a.md": "a"})
        remote = self._make_manifest("B", {"b.md": "b"})
        plan = diff_manifests(local, remote)
        d = plan.to_dict()
        assert d["local_device"] == "A"
        assert d["remote_device"] == "B"
        assert len(d["items"]) == 2
        assert "upload" in d["summary"]
        assert "download" in d["summary"]
        assert "skip" in d["summary"]
        assert "conflict" in d["summary"]


# ── PathMatches 深度测试 ──────────────────────────────────────

class TestPathMatchesDeep:
    def test_chinese_path_vault(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("vault/笔记.md", "vault/**/*.md")

    def test_chinese_path_nested(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("vault/人工智能/神经网络.md", "vault/**/*.md")

    def test_path_with_spaces(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("vault/my note.md", "vault/**/*.md")

    def test_path_with_dots(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches("vault/note.v2.md", "vault/**/*.md")

    def test_eventlog_chinese_dir(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches(
            "metadata/eventlogs/2026/08.jsonl",
            "metadata/eventlogs/**/*.jsonl",
        )

    def test_mindmap_subdir(self):
        from app.core.sync.scanner import _path_matches
        assert _path_matches(
            "mind_maps/project/main.mindmap.json",
            "mind_maps/**/*.mindmap.json",
        )

    def test_no_match_wrong_extension(self):
        from app.core.sync.scanner import _path_matches
        assert not _path_matches("vault/note.py", "vault/**/*.md")
        assert not _path_matches("vault/note.txt", "vault/**/*.md")

    def test_no_match_wrong_prefix(self):
        from app.core.sync.scanner import _path_matches
        assert not _path_matches("other/note.md", "vault/**/*.md")
        assert not _path_matches("db/data.md", "vault/**/*.md")
