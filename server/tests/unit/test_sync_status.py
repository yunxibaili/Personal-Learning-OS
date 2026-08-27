"""M7-005 Sync Conflict UI 测试：core/sync/status.py + /api/v1/sync 端点。

冻结范围：冲突源仅 mindmap conflict artifacts；无自动解决；Router 只调 core。
"""
from __future__ import annotations

import json

import pytest

from app.core.sync.status import ConflictItem, find_conflicts, resolve_conflict


@pytest.fixture()
def ws(tmp_path):
    (tmp_path / "mind_maps").mkdir()
    return tmp_path


def _mk_conflict(ws, name: str = "math", local: dict | None = None, remote: dict | None = None):
    """模拟 M7-004 Apply 的产物：主文件=远端胜者，.local.json=本地备份。"""
    remote_payload = remote or {"v": 1, "src": "remote"}
    local_payload = local or {"v": 1, "layout": {"n1": [0, 0]}, "src": "local"}
    (ws / "mind_maps" / f"{name}.mindmap.json").write_text(
        json.dumps(remote_payload), encoding="utf-8")
    (ws / "mind_maps" / f"{name}.local.json").write_text(
        json.dumps(local_payload), encoding="utf-8")
    return local_payload


# ── find_conflicts ────────────────────────────────────────────

class TestFindConflicts:
    def test_empty_dir_no_conflicts(self, ws):
        assert find_conflicts(ws) == []

    def test_detects_local_backup(self, ws):
        _mk_conflict(ws)
        items = find_conflicts(ws)
        assert len(items) == 1
        c = items[0]
        assert c.path == "mind_maps/math.mindmap.json"
        assert c.local_path == "mind_maps/math.local.json"
        assert c.kind == "mindmap"
        assert c.remote_preview and c.local_preview  # Compare 数据就绪
        assert '"src": "local"' in c.local_preview.replace(" ", "").replace('"', "") \
            or "local" in c.local_preview

    def test_backup_without_main_is_not_active(self, ws):
        """备份存在但主文件已不在 → 非活动冲突（残留 artifact）。"""
        (ws / "mind_maps" / "orphan.mindmap.json.local.json").write_text("{}", encoding="utf-8")
        # 注意：这种命名不是合法 artifact 形态（stem 不以 .mindmap.json 结尾），
        # 也应被跳过——两级防御
        (ws / "mind_maps" / "zombie.mindmap.json").unlink(missing_ok=True)
        assert find_conflicts(ws) == []

    def test_plain_file_ignored(self, ws):
        """同目录普通 mindmap（无备份）不构成冲突。"""
        (ws / "mind_maps" / "ok.mindmap.json").write_text("{}", encoding="utf-8")
        assert find_conflicts(ws) == []

    def test_remote_sidecar_listed_if_present(self, ws):
        _mk_conflict(ws)
        (ws / "mind_maps" / "math.remote.json").write_text("{}", encoding="utf-8")
        items = find_conflicts(ws)
        assert items[0].remote_path == "mind_maps/math.remote.json"


# ── resolve_conflict ──────────────────────────────────────────

class TestResolve:
    def test_keep_local_restores_own_version(self, ws):
        local = _mk_conflict(ws)
        ok, msg = resolve_conflict(ws, "mind_maps/math.mindmap.json", "keep_local")
        assert ok
        main = json.loads((ws / "mind_maps" / "math.mindmap.json").read_text(encoding="utf-8"))
        assert main == local                      # 本地版回到主位
        assert not (ws / "mind_maps" / "math.local.json").exists()  # 冲突关闭
        assert find_conflicts(ws) == []           # 二次查询为空 = 幂等收尾

    def test_keep_remote_keeps_winner_cleans_artifacts(self, ws):
        remote = {"v": 1, "src": "remote"}
        _mk_conflict(ws, remote=remote)
        ok, msg = resolve_conflict(ws, "mind_maps/math.mindmap.json", "keep_remote")
        assert ok
        main = json.loads((ws / "mind_maps" / "math.mindmap.json").read_text(encoding="utf-8"))
        assert main == remote                     # 主文件本就是远端胜者
        assert not (ws / "mind_maps" / "math.local.json").exists()

    def test_rejects_unknown_resolution(self, ws):
        _mk_conflict(ws)
        ok, _ = resolve_conflict(ws, "mind_maps/math.mindmap.json", "auto_merge")
        assert not ok                             # 没有自动解决这回事

    @pytest.mark.parametrize("path", [
        "../vault/a.md",
        "vault/b.md",                              # 非 mind_maps/
        "mind_maps/../../x",
        "/abs/mind_maps/a.mindmap.json",
        "mind_maps/not-a-map.json",
        "C:x",
    ])
    def test_rejects_illegal_paths(self, ws, path):
        _mk_conflict(ws)
        ok, _ = resolve_conflict(ws, path, "keep_local")
        assert not ok

    def test_keep_local_without_backup_fails_clean(self, ws):
        (ws / "mind_maps" / "solo.mindmap.json").write_text("{}", encoding="utf-8")
        ok, msg = resolve_conflict(ws, "mind_maps/solo.mindmap.json", "keep_local")
        assert not ok and "backup missing" in msg
        assert (ws / "mind_maps" / "solo.mindmap.json").exists()  # 主文件无损


# ── API 层 ────────────────────────────────────────────────────

class TestSyncApi:
    def test_status_and_resolve_roundtrip(self, tmp_path, monkeypatch):
        monkeypatch.setenv("WORKSPACE_DIR", str(tmp_path))
        from fastapi.testclient import TestClient
        from app.main import create_app
        mm = tmp_path / "mind_maps"
        mm.mkdir()
        (mm / "phys.mindmap.json").write_text('{"src":"remote"}', encoding="utf-8")
        (mm / "phys.local.json").write_text('{"src":"local"}', encoding="utf-8")

        with TestClient(create_app()) as client:
            r = client.get("/api/v1/sync/status")
            assert r.status_code == 200
            body = r.json()
            assert len(body["conflicts"]) == 1
            assert body["conflicts"][0]["path"] == "mind_maps/phys.mindmap.json"

            r2 = client.post("/api/v1/sync/resolve",
                             json={"path": "mind_maps/phys.mindmap.json",
                                   "resolution": "keep_local"})
            assert r2.status_code == 200 and r2.json()["ok"] is True

            r3 = client.get("/api/v1/sync/status")
            assert r3.json()["conflicts"] == []

    def test_resolve_error_contract(self, tmp_path, monkeypatch):
        monkeypatch.setenv("WORKSPACE_DIR", str(tmp_path))
        from fastapi.testclient import TestClient
        from app.main import create_app
        with TestClient(create_app()) as client:
            r = client.post("/api/v1/sync/resolve",
                            json={"path": "../evil", "resolution": "keep_local"})
            assert r.status_code == 400
            err = r.json()["error"]
            assert set(err.keys()) >= {"code", "message"}   # 全局错误契约
