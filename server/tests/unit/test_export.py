"""T-EXPORT（B11）全量导出守护测试（先于实现编写）。

EXPORT_MANIFEST.md 冻结的范围契约：
  必含：vault/**（md+mindmap json）· attachments/** · metadata/eventlogs/*.jsonl ·
        settings（脱敏后）
  必排：db/ · metadata/devices.json · 一切 API key 明文
红线：AGENTS §3「用户数据永不锁死」——一键全量导出必须真实可用。
"""
from __future__ import annotations

import io
import json
import zipfile

import pytest
from fastapi.testclient import TestClient


def _mk_note(client: TestClient, title: str, body: str) -> None:
    r = client.post("/api/v1/notes", json={"title": title, "content_md": body})
    assert r.status_code == 201, r.text


def _export(client: TestClient) -> zipfile.ZipFile:
    r = client.get("/api/v1/export")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/zip")
    return zipfile.ZipFile(io.BytesIO(r.content))


class TestExportScope:
    def test_vault_and_eventlogs_included(self, client: TestClient, tmp_workspace: Path):
        _mk_note(client, "导出笔记A", "# export me")
        # eventlog 由 note 创建间接产生（wikilink stub → 若无事件则手动放一个）
        z = _export(client)
        names = z.namelist()
        assert any(n.startswith("vault/") and n.endswith(".md") for n in names), (
            "vault 笔记未进入导出包"
        )
        assert not any(n.startswith("db/") for n in names), "db/ 混入导出包"
        assert not any("devices.json" in n for n in names), "devices.json 混入导出包"

    def test_eventlogs_included(self, client: TestClient, core_conn, tmp_workspace: Path):
        """学习事件日志（Layer 1 真相）必须进入导出包。"""
        cid_resp = client.post("/api/v1/concepts", json={"title": "导出概念"})
        cid = cid_resp.json()["id"]
        r = client.post("/api/v1/events", json={
            "concept_id": cid, "event_type": "answer_wrong",
            "dimension": "knowledge"})
        assert r.status_code == 201
        z = _export(client)
        jsonl = [n for n in z.namelist() if "eventlogs" in n and n.endswith(".jsonl")]
        assert jsonl, "eventlogs 未进入导出包"
        content = z.read(jsonl[0]).decode("utf-8")
        assert "answer_wrong" in content

    def test_mindmaps_included(self, client: TestClient, tmp_workspace: Path):
        """mind_maps/*.mindmap.json 属 Layer 1，必须进入导出包。"""
        mm = tmp_workspace / "mind_maps"
        mm.mkdir(parents=True, exist_ok=True)
        (mm / "demo.mindmap.json").write_text('{"v":1,"root":{}}', encoding="utf-8")
        z = _export(client)
        assert "mind_maps/demo.mindmap.json" in z.namelist()

    def test_attachments_included(self, client: TestClient, tmp_workspace: Path):
        at = tmp_workspace / "attachments"
        at.mkdir(parents=True, exist_ok=True)
        (at / "abc123def456.png").write_bytes(b"\x89PNG fake")
        z = _export(client)
        assert "attachments/abc123def456.png" in z.namelist()


class TestSettingsSanitization:
    def test_api_key_never_in_export(self, client: TestClient, tmp_workspace: Path):
        """settings 进包但 API key 明文永不出现（红线）。"""
        r = client.put("/api/v1/settings", json={
            "settings": {"llm.api_key": "sk-super-secret-123", "theme": "light"}})
        assert r.status_code == 200
        z = _export(client)
        settings_files = [n for n in z.namelist() if "settings" in n]
        assert settings_files, "settings 未进入导出包"
        blob = b"".join(z.read(n) for n in settings_files).decode("utf-8")
        assert "sk-super-secret-123" not in blob, "API key 明文泄漏进导出包"
        assert "light" in blob, "非敏感 settings 应保留"


class TestZipIntegrity:
    def test_empty_workspace_valid_zip(self, client: TestClient):
        """空 workspace：合法 zip 且只含真实数据（空 settings 不产出空文件）。"""
        z = _export(client)
        assert z.namelist() == []
        assert z.testzip() is None

    def test_wider_sensitive_keys_excluded(self, client: TestClient):
        """P1 并集规则：token/password 等精确命中键不得明文进包。"""
        client.put("/api/v1/settings", json={
            "settings": {"llm.token": "xoxb-abc", "db.password": "hunter2",
                         "llm.model": "deepseek-chat"}})
        z = _export(client)
        blob = b"".join(
            z.read(n) for n in z.namelist() if "settings" in n
        ).decode("utf-8")
        assert "xoxb-abc" not in blob and "hunter2" not in blob
        assert "deepseek-chat" in blob  # 非敏感条目保留

    def test_zip_readable_roundtrip(self, client: TestClient):
        _mk_note(client, "往返笔记", "round trip")
        z = _export(client)
        md = [n for n in z.namelist() if n.endswith(".md")]
        assert md
        content = z.read(md[0]).decode("utf-8")
        assert "round trip" in content


class TestConceptsSnapshotExport:
    """BUG-1 守护：概念/掌握度进导出包（concepts.json 快照）。"""

    def test_concepts_json_included(self, client: TestClient, tmp_workspace: Path):
        client.post("/api/v1/concepts", json={"title": "快照概念A", "domain": "测试"})
        z = _export(client)
        assert "concepts.json" in z.namelist(), "概念快照未进入导出包"
        snap = json.loads(z.read("concepts.json").decode("utf-8"))
        titles = [c["title"] for c in snap["concepts"]]
        assert "快照概念A" in titles
        assert snap["version"] == 1

    def test_mastery_and_sm2_in_snapshot(self, client: TestClient, tmp_workspace: Path):
        """SM-2 排期字段（ease_factor 等）随快照走——复习节奏不归零。"""
        cid = client.post("/api/v1/concepts", json={"title": "快照概念B"}).json()["id"]
        r = client.post(f"/api/v1/review/{cid}/answer", json={"quality": 3})
        assert r.status_code == 200
        z = _export(client)
        snap = json.loads(z.read("concepts.json").decode("utf-8"))
        mrows = [m for m in snap["mastery"] if m["effective"] > 0 or m["review_count"] > 0]
        assert mrows, "答题后的掌握度/复习状态未进快照"
        assert any(m["ease_factor"] != 2.5 or m["review_count"] > 0 for m in mrows), \
            "SM-2 字段未随快照导出"


class TestExportRebuildClosedLoop:
    """BUG-1 守护（场景 C 内核）：导出 → 全新库重建 → 概念/掌握度一致。

    红线：AGENTS §3「用户数据永不锁死」——删 SQLite 后仅凭导出包必须能
    恢复核心学习数据（概念、掌握度、SM-2 排期）。
    """

    def test_rebuild_restores_concepts_and_mastery(
        self, client: TestClient, tmp_workspace: Path, monkeypatch
    ):
        import io as _io
        import zipfile as _zipfile
        from app.db import connect, init_db

        # ── 原库：概念 + 笔记（wikilink 解析到已有概念）+ 答题 ──
        # （顺序不可反：[[重建概念X]] 会先建 stub，同名 POST 概念会 409）
        cid = client.post("/api/v1/concepts",
                          json={"title": "重建概念X", "domain": "物理"}).json()["id"]
        _mk_note(client, "重建笔记甲", "讲讲 [[重建概念X]]。")
        client.post("/api/v1/events", json={
            "concept_id": cid, "event_type": "explain",
            "dimension": "knowledge", "weight": 1.0, "source": "manual"})
        client.post(f"/api/v1/review/{cid}/answer", json={"quality": 3})
        before_m = client.get("/api/v1/mastery").json()
        before_m = before_m["mastery"] if isinstance(before_m, dict) else before_m
        before_x = [m for m in before_m if m.get("title") == "重建概念X"]
        assert before_x, "前置失败：原库无掌握度行"

        # ── 导出 → 解包到暂存目录 ──
        r = client.get("/api/v1/export")
        stage = tmp_workspace / "stage"
        stage.mkdir()
        with _zipfile.ZipFile(_io.BytesIO(r.content)) as zf:
            zf.extractall(stage)

        # ── 全新库（同进程新 workspace）──
        ws2 = tmp_workspace / "workspace2"
        ws2.mkdir()
        monkeypatch.setenv("WORKSPACE_DIR", str(ws2))
        init_db()
        im = client.post("/api/v1/notes/import",
                         json={"source": str(stage / "vault"), "prefix": ""})
        assert im.status_code == 200, im.text
        assert im.json().get("concepts_snapshot_staged") is True, \
            "concepts.json 未被导入流程暂存"
        client.post("/api/v1/admin/reindex", json={})

        # ── 核对：概念 + 掌握度 + SM-2 恢复 ──
        concepts = client.get("/api/v1/concepts").json().get("concepts", [])
        titles = [c["title"] for c in concepts]
        assert "重建概念X" in titles, "概念未随重建恢复（BUG-1 复现）"
        after_m = client.get("/api/v1/mastery").json()
        after_m = after_m["mastery"] if isinstance(after_m, dict) else after_m
        after_x = [m for m in after_m if m.get("title") == "重建概念X"]
        assert after_x, "掌握度行未随重建恢复（BUG-1 复现）"
        b, a = before_x[0], after_x[0]
        assert abs(a["effective"] - b["effective"]) < 1e-6, \
            f"effective 不一致: before={b['effective']} after={a['effective']}"
        assert a["review_count"] == b["review_count"], "SM-2 review_count 不一致"
        assert a["next_review"] == b["next_review"], "SM-2 next_review 不一致"

    def test_reindex_replays_eventlogs_idempotent(
        self, client: TestClient, tmp_workspace: Path, monkeypatch
    ):
        """连续两次 reindex 幂等：事件不重复计数，掌握度不翻倍。"""
        from app.db import connect

        cid = client.post("/api/v1/concepts", json={"title": "幂等概念"}).json()["id"]
        _mk_note(client, "幂等笔记", "引用 [[幂等概念]]。")
        client.post("/api/v1/events", json={
            "concept_id": cid, "event_type": "explain",
            "dimension": "knowledge", "weight": 1.0, "source": "manual"})

        import json as _json
        import os as _os
        from pathlib import Path as _P
        ws = _P(_os.environ["WORKSPACE_DIR"])
        meta = ws / "metadata"
        meta.mkdir(exist_ok=True)
        (meta / "concepts.json").write_text(_json.dumps({
            "version": 1, "concepts": [{"id": cid, "title": "幂等概念",
                                        "origin": "manual", "status": "active"}],
            "mastery": [], "review_queue": []}), encoding="utf-8")

        conn = connect()
        try:
            from app.core.reindex import reindex_vault
            vault = ws / "vault"
            s1 = reindex_vault(conn, vault)
            s2 = reindex_vault(conn, vault)
            assert s2["events_replayed"] == 0, "二次 reindex 重复回放事件"
            assert s2["concepts_restored"] == 0, "二次 reindex 重复建概念"
        finally:
            conn.close()
