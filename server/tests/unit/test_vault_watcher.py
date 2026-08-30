"""B16 Vault Watcher 测试：snapshot/diff/poll + admin 端点（start/stop/status）。

不依赖第三方 watchguard；线程部分用真实短间隔跑几次后停止。
"""
from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.core.vault_watcher import snapshot, diff


def _write(path: Path, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


class TestSnapshotDiff:
    def test_snapshot_detects_files(self, tmp_path: Path):
        vault = tmp_path / "vault"
        _write(vault / "a.md", "# A")
        _write(vault / "sub" / "b.md", "# B")
        snap = snapshot(vault)
        assert "a.md" in snap
        assert "sub/b.md" in snap

    def test_diff_add_modified_deleted(self, tmp_path: Path):
        vault = tmp_path / "vault"
        _write(vault / "keep.md", "# keep")
        _write(vault / "gone.md", "# gone")
        prev = snapshot(vault)

        _write(vault / "new.md", "# new")          # 新增
        _write(vault / "keep.md", "# keep updated")  # 修改
        (vault / "gone.md").unlink()               # 删除

        cur = snapshot(vault)
        changed, deleted = diff(prev, cur)
        assert "new.md" in changed
        assert "keep.md" in changed
        assert deleted == ["gone.md"]


class TestWatcherEndpoints:
    def test_start_and_stop(self, client: TestClient):
        r = client.post("/api/v1/admin/watcher/start")
        assert r.status_code == 200
        assert r.json()["running"] is True
        st = client.get("/api/v1/admin/watcher/status").json()
        assert st["running"] is True
        sp = client.post("/api/v1/admin/watcher/stop")
        assert sp.status_code == 200
        st2 = client.get("/api/v1/admin/watcher/status").json()
        assert st2["running"] is False

    def test_status_when_not_started(self, client: TestClient):
        st = client.get("/api/v1/admin/watcher/status").json()
        assert st["running"] is False
