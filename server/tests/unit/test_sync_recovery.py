"""M7 Sync Engine — 恢复测试：幂等性、原子性、确定性。"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest


# ── 幂等性测试 ────────────────────────────────────────────────

class TestIdempotency:
    """同步操作重复执行结果一致。"""

    def _make_manifest(self, device_id: str, files: dict[str, str]):
        from app.core.sync.manifest import FileEntry, Manifest
        m = Manifest(device_id=device_id)
        for path, content in files.items():
            m.files[path] = FileEntry(
                path=path,
                sha256=hashlib.sha256(content.encode()).hexdigest()[:16],
                size=len(content),
                mtime=1.0,
            )
        return m

    def test_diff_idempotent(self):
        """两次 diff 相同的 manifest 产生相同结果。"""
        from app.core.sync.diff import diff_manifests
        local = self._make_manifest("A", {"vault/a.md": "a", "vault/b.md": "b"})
        remote = self._make_manifest("B", {"vault/b.md": "b", "vault/c.md": "c"})

        plan1 = diff_manifests(local, remote)
        plan2 = diff_manifests(local, remote)
        assert plan1.to_dict() == plan2.to_dict()

    def test_scan_idempotent(self):
        """两次扫描相同的 workspace 产生相同的 manifest（忽略 mtime）。"""
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path = Path(os.environ.get("TEMP", "/tmp")) / "sync_idem_test"
        vault.mkdir(parents=True, exist_ok=True)
        try:
            (vault / "vault").mkdir(exist_ok=True)
            (vault / "vault" / "a.md").write_text("content", encoding="utf-8")

            m1 = scan_workspace(vault, "test")
            m2 = scan_workspace(vault, "test")
            # 除了 mtime 可能微小差异，其他应相同
            assert len(m1.files) == len(m2.files)
            for path in m1.files:
                assert path in m2.files
                assert m1.files[path].sha256 == m2.files[path].sha256
                assert m1.files[path].size == m2.files[path].size
        finally:
            import shutil
            shutil.rmtree(vault, ignore_errors=True)

    def test_manifest_json_roundtrip_idempotent(self):
        """Manifest JSON 序列化往返幂等。"""
        from app.core.sync.manifest import FileEntry, Manifest
        m = Manifest(device_id="dev")
        m.files["a.md"] = FileEntry(path="a.md", sha256="h", size=10, mtime=1.0)
        d1 = m.to_dict()
        m2 = Manifest.from_json(m.to_json())
        d2 = m2.to_dict()
        assert d1 == d2


# ── 原子性测试 ────────────────────────────────────────────────

class TestAtomicity:
    """原子写入不留下临时文件。"""

    def test_atomic_write_no_temp_left(self, tmp_path):
        from app.core.knowledge import atomic_write_file
        target = tmp_path / "test.md"
        atomic_write_file(target, "hello world")
        assert target.read_text(encoding="utf-8") == "hello world"
        # 没有 .tmp / .partial / .corrupt 文件
        for f in tmp_path.iterdir():
            assert not f.suffix in (".tmp", ".partial", ".corrupt")

    def test_atomic_write_overwrite(self, tmp_path):
        from app.core.knowledge import atomic_write_file
        target = tmp_path / "test.md"
        atomic_write_file(target, "v1")
        atomic_write_file(target, "v2")
        assert target.read_text(encoding="utf-8") == "v2"

    def test_atomic_write_chinese_content(self, tmp_path):
        from app.core.knowledge import atomic_write_file
        target = tmp_path / "中文.md"
        content = "# 机器学习\n\n深度学习是机器学习的子集。"
        atomic_write_file(target, content)
        assert target.read_text(encoding="utf-8") == content


# ── 确定性测试 ────────────────────────────────────────────────

class TestDeterminism:
    """相同输入产生相同输出。"""

    def test_file_sha256_deterministic(self):
        from app.core.sync.manifest import file_sha256
        import tempfile
        fd, path = tempfile.mkstemp()
        try:
            os.write(fd, b"deterministic content")
            os.close(fd)
            h1 = file_sha256(Path(path))
            h2 = file_sha256(Path(path))
            assert h1 == h2
            assert len(h1) == 64
        finally:
            os.unlink(path)

    def test_file_sha256_different_content(self):
        from app.core.sync.manifest import file_sha256
        import tempfile
        fd1, path1 = tempfile.mkstemp()
        fd2, path2 = tempfile.mkstemp()
        try:
            os.write(fd1, b"content A")
            os.close(fd1)
            os.write(fd2, b"content B")
            os.close(fd2)
            h1 = file_sha256(Path(path1))
            h2 = file_sha256(Path(path2))
            assert h1 != h2
        finally:
            os.unlink(path1)
            os.unlink(path2)

    def test_diff_sorted_output(self):
        """diff 结果按路径排序，保证确定性。"""
        from app.core.sync.diff import diff_manifests
        from app.core.sync.manifest import FileEntry, Manifest

        local = Manifest(device_id="A")
        for name in ["z.md", "a.md", "m.md"]:
            local.files[name] = FileEntry(path=name, sha256="l", size=1, mtime=1.0)

        remote = Manifest(device_id="B")
        for name in ["z.md", "b.md", "a.md"]:
            remote.files[name] = FileEntry(path=name, sha256="r", size=1, mtime=1.0)

        plan = diff_manifests(local, remote)
        paths = [i.path for i in plan.items]
        assert paths == sorted(paths)


# ── 边界条件测试 ──────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_file_scan(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "empty.md").write_text("", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert manifest.files["vault/empty.md"].size == 0

    def test_same_name_different_dir(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        (tmp_path / "vault" / "a").mkdir(parents=True)
        (tmp_path / "vault" / "b").mkdir(parents=True)
        (tmp_path / "vault" / "a" / "note.md").write_text("a", encoding="utf-8")
        (tmp_path / "vault" / "b" / "note.md").write_text("b", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 2
        assert "vault/a/note.md" in manifest.files
        assert "vault/b/note.md" in manifest.files

    def test_only_blacklisted(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        (tmp_path / "db").mkdir()
        (tmp_path / "db" / "app.sqlite").write_bytes(b"data")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 0

    def test_only_hidden_dir(self, tmp_path):
        """隐藏目录被跳过（scanner 只跳目录，不跳文件）。"""
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / ".hidden_dir").mkdir()
        (vault / ".hidden_dir" / "file.md").write_text("secret", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 0

    def test_hidden_dir_with_visible_sibling(self, tmp_path):
        from app.core.sync.scanner import scan_workspace
        vault = tmp_path / "vault"
        vault.mkdir()
        (vault / "visible.md").write_text("public", encoding="utf-8")
        (vault / ".hidden_dir").mkdir()
        (vault / ".hidden_dir" / "secret.md").write_text("secret", encoding="utf-8")

        manifest = scan_workspace(tmp_path, device_id="test")
        assert len(manifest.files) == 1
        assert "vault/visible.md" in manifest.files
