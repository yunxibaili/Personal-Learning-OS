"""ADR-028 文档变更抽象层 — HTTP 层测试。

覆盖：端点契约 · 错误码 · limit 校验 · 与 PATCH/DELETE 的集成
（写前快照 / 去抖 / 重命名迁移 / 删除保留）· 进导出包。
"""
from __future__ import annotations

import io
import os
import time
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.core import revisions as R


def _mk(client: TestClient, title: str, content: str) -> int:
    r = client.post("/api/v1/notes", json={"title": title, "content_md": content})
    assert r.status_code == 201, r.text
    return r.json()["note"]["id"]


def _snap_files(tmp_workspace: Path, rel: str) -> list[Path]:
    d = tmp_workspace / "metadata" / "revisions" / rel
    return sorted(d.glob("*.md")) if d.is_dir() else []


# ── 列表与读取 ────────────────────────────────────────────────────

class TestListAndRead:
    def test_list_contains_current_first(self, client: TestClient):
        nid = _mk(client, "N", "v1")
        r = client.get(f"/api/v1/notes/{nid}/revisions")
        assert r.status_code == 200
        revs = r.json()["revisions"]
        assert revs[0]["source"] == "current"
        assert revs[0]["ref"] == "current"

    def test_list_includes_snapshots_newest_first(self, client: TestClient):
        nid = _mk(client, "N", "v1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        # 回拨 mtime 绕过去抖窗口，产出第二份快照
        client.post(f"/api/v1/notes/{nid}/revisions")
        time.sleep(1.05)
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v3"})

        revs = client.get(f"/api/v1/notes/{nid}/revisions").json()["revisions"]
        snaps = [x for x in revs if x["source"] == "snapshot"]
        assert len(snaps) == 2
        hashes = [s["content_hash"] for s in snaps]
        # 最新一份是 v2 的快照（写完 v3 之前的旧内容）
        assert hashes[0] == R._body_hash("v2")

    def test_get_current_revision(self, client: TestClient):
        nid = _mk(client, "N", "当前内容")
        r = client.get(f"/api/v1/notes/{nid}/revisions/current")
        assert r.status_code == 200
        assert r.json()["revision"]["content_md"] == "当前内容"

    def test_get_snapshot_revision(self, client: TestClient):
        nid = _mk(client, "N", "v1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        rev_id = client.get(
            f"/api/v1/notes/{nid}/revisions").json()["revisions"][-1]["rev_id"]
        r = client.get(f"/api/v1/notes/{nid}/revisions/{rev_id}")
        assert r.status_code == 200
        assert r.json()["revision"]["content_md"] == "v1"

    def test_unknown_revision_404(self, client: TestClient):
        nid = _mk(client, "N", "v1")
        r = client.get(f"/api/v1/notes/{nid}/revisions/nope")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "revision_not_found"

    def test_missing_note_404(self, client: TestClient):
        r = client.get("/api/v1/notes/999999/revisions")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "http_404"

    def test_limit_validation(self, client: TestClient):
        """手工 422：全局 handler 会把 pydantic 422 转成 400，丢失错误码。"""
        nid = _mk(client, "N", "v1")
        for bad in (0, 201):
            r = client.get(f"/api/v1/notes/{nid}/revisions?limit={bad}")
            assert r.status_code == 422, f"limit={bad} 未被拒"
            assert r.json()["error"]["code"] == "invalid_limit"


# ── 手动打点 ──────────────────────────────────────────────────────

class TestManualSnapshot:
    def test_manual_creates(self, client: TestClient):
        nid = _mk(client, "N", "v1")
        r = client.post(f"/api/v1/notes/{nid}/revisions")
        assert r.status_code == 200
        assert r.json()["created"] is True
        # origin = 触发方式；source 恒为 snapshot（revision source 轴）
        assert r.json()["revision"]["origin"] == "manual"
        assert r.json()["revision"]["source"] == "snapshot"

    def test_manual_unchanged_is_deduped(self, client: TestClient):
        """内容未变时不新建，如实返回 created=false。"""
        nid = _mk(client, "N", "v1")
        client.post(f"/api/v1/notes/{nid}/revisions")
        r = client.post(f"/api/v1/notes/{nid}/revisions")
        assert r.json()["created"] is False
        assert r.json()["reason"] == "unchanged"


# ── Changes / Diff ────────────────────────────────────────────────

class TestChangesAndDiff:
    def test_changes_without_snapshot(self, client: TestClient):
        """无快照时不伪造「全部新增」——那会误报成整篇重写。"""
        nid = _mk(client, "N", "v1")
        r = client.get(f"/api/v1/notes/{nid}/changes")
        assert r.status_code == 200
        body = r.json()
        assert body["has_snapshot"] is False
        assert body["compared_against"] is None
        assert body["stats"] == {"added": 0, "removed": 0, "changed": 0}

    def test_changes_after_edit(self, client: TestClient):
        nid = _mk(client, "N", "line1\nline2\n")
        client.patch(f"/api/v1/notes/{nid}",
                     json={"content_md": "line1\nline2\nline3\n"})
        body = client.get(f"/api/v1/notes/{nid}/changes").json()
        assert body["has_snapshot"] is True
        assert body["compared_against"]["source"] == "snapshot"
        assert body["stats"]["added"] == 1
        assert body["stats"]["removed"] == 0

    def test_diff_snapshot_to_current(self, client: TestClient):
        nid = _mk(client, "N", "a\nb\n")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "a\nc\n"})
        r = client.post(f"/api/v1/notes/{nid}/diff", json={
            "from_ref": {"source": "snapshot"},
            "to_ref": {"source": "current"},
        })
        assert r.status_code == 200
        body = r.json()
        # difflib 对"同位替换一行"发的是 replace 而非 delete+insert，
        # 故是 changed=1，不是 added=1/removed=1 —— 这才是 diff UI 想要的语义。
        assert body["stats"] == {"added": 0, "removed": 0, "changed": 1}
        assert len(body["hunks"]) == 1
        assert body["hunks"][0]["op"] == "replace"
        assert "-b" in body["unified"] and "+c" in body["unified"]

    def test_diff_between_two_snapshots(self, client: TestClient):
        nid = _mk(client, "N", "v1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        first = client.get(
            f"/api/v1/notes/{nid}/revisions").json()["revisions"][-1]["rev_id"]
        client.post(f"/api/v1/notes/{nid}/revisions")   # v2 的手动点
        time.sleep(1.05)
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v3"})
        client.post(f"/api/v1/notes/{nid}/revisions")   # v3 的手动点
        revs = [x for x in client.get(
            f"/api/v1/notes/{nid}/revisions").json()["revisions"]
            if x["source"] == "snapshot"]
        assert len(revs) == 3
        r = client.post(f"/api/v1/notes/{nid}/diff", json={
            "from_ref": {"source": "snapshot", "ref": first},
            "to_ref": {"source": "snapshot"},
        })
        assert r.status_code == 200
        assert r.json()["stats"]["changed"] == 1

    def test_diff_unsupported_source_400(self, client: TestClient):
        """git source 尚未实现 → 400，不是 500 也不是静默降级。"""
        nid = _mk(client, "N", "v1")
        r = client.post(f"/api/v1/notes/{nid}/diff", json={
            "from_ref": {"source": "git", "ref": "abc"},
            "to_ref": {"source": "current"},
        })
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "invalid_source"

    def test_diff_unresolvable_ref_404(self, client: TestClient):
        nid = _mk(client, "N", "v1")
        r = client.post(f"/api/v1/notes/{nid}/diff", json={
            "from_ref": {"source": "snapshot", "ref": "nope"},
            "to_ref": {"source": "current"},
        })
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "revision_not_found"


# ── 与 PATCH / DELETE 的集成 ──────────────────────────────────────

class TestWritePathIntegration:
    def test_patch_creates_pre_write_snapshot(self, client: TestClient,
                                              tmp_workspace: Path):
        """写前快照保存的是**被覆盖前的旧内容**。"""
        nid = _mk(client, "N", "v1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        files = _snap_files(tmp_workspace, "N.md")
        assert len(files) == 1
        assert "v1" in files[0].read_text(encoding="utf-8")
        assert "v2" not in files[0].read_text(encoding="utf-8")

    def test_debounce_suppresses_rapid_edits(self, client: TestClient,
                                             tmp_workspace: Path):
        """连续 autosave 不产生快照风暴。"""
        nid = _mk(client, "N", "v1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        for i in range(5):
            client.patch(f"/api/v1/notes/{nid}", json={"content_md": f"v{i+3}"})
        assert len(_snap_files(tmp_workspace, "N.md")) == 1

    def test_snapshot_after_window(self, client: TestClient,
                                   tmp_workspace: Path):
        """窗口过后（mtime 回拨）重新打点。"""
        nid = _mk(client, "N", "v1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        past = time.time() - 3600
        os.utime(_snap_files(tmp_workspace, "N.md")[-1], (past, past))
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v3"})
        assert len(_snap_files(tmp_workspace, "N.md")) == 2

    def test_rename_migrates_snapshot_dir(self, client: TestClient,
                                          tmp_workspace: Path):
        nid = _mk(client, "Alpha", "v1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        assert _snap_files(tmp_workspace, "Alpha.md")

        client.patch(f"/api/v1/notes/{nid}", json={"title": "Beta"})
        assert not _snap_files(tmp_workspace, "Alpha.md"), "旧目录未迁移"
        assert _snap_files(tmp_workspace, "Beta.md"), "快照未迁到新目录"

    def test_delete_note_retains_snapshots(self, client: TestClient,
                                           tmp_workspace: Path):
        """决策 D：删除笔记保留快照，支持误删恢复。"""
        nid = _mk(client, "Gamma", "g1")
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "g2"})
        assert _snap_files(tmp_workspace, "Gamma.md")
        assert client.delete(f"/api/v1/notes/{nid}").json()["ok"] is True
        assert _snap_files(tmp_workspace, "Gamma.md"), "快照被误删"


# ── 清理端点 ──────────────────────────────────────────────────────

class TestPurge:
    def test_delete_revisions(self, client: TestClient, tmp_workspace: Path):
        nid = _mk(client, "N", "v1")
        client.post(f"/api/v1/notes/{nid}/revisions")
        time.sleep(1.05)
        client.patch(f"/api/v1/notes/{nid}", json={"content_md": "v2"})
        client.post(f"/api/v1/notes/{nid}/revisions")
        assert len(_snap_files(tmp_workspace, "N.md")) == 2

        r = client.delete(f"/api/v1/notes/{nid}/revisions")
        assert r.status_code == 200
        assert r.json()["deleted"] == 2
        assert _snap_files(tmp_workspace, "N.md") == []

    def test_delete_revisions_missing_note(self, client: TestClient):
        assert client.delete("/api/v1/notes/999999/revisions").status_code == 404


# ── 导出包 ────────────────────────────────────────────────────────

class TestExport:
    def test_snapshots_enter_export_zip(self, client: TestClient):
        """决策 C：快照进导出包（否则违反「用户数据永不锁死」）。"""
        nid = _mk(client, "N", "v1")
        client.post(f"/api/v1/notes/{nid}/revisions")
        z = zipfile.ZipFile(io.BytesIO(client.get("/api/v1/export").content))
        names = [n for n in z.namelist() if n.startswith("metadata/revisions/")]
        assert names, f"快照未进导出包：{z.namelist()}"
        assert names[0].endswith(".md")

    def test_empty_workspace_still_empty_zip(self, client: TestClient):
        """回归：新增白名单目录不得让空 workspace 产出非空包。"""
        z = zipfile.ZipFile(io.BytesIO(client.get("/api/v1/export").content))
        assert z.namelist() == []


# ── 同步白名单（决策 C 反向守护）──────────────────────────────────

class TestSyncBoundary:
    def test_snapshots_not_synced(self, tmp_workspace: Path):
        """快照不进 SYNC_PATTERNS：历史是本地便利能力，不是跨设备事实。"""
        from app.core.sync.scanner import _path_matches

        assert not _path_matches("metadata/revisions/N.md/20260904T000000Z-ab.md",
                                 "vault/**/*.md")
        assert not _path_matches("metadata/revisions/N.md/x.md",
                                 "metadata/eventlogs/**/*.jsonl")
