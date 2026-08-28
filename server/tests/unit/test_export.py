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
        z = _export(client)
        assert z.namelist() is not None  # 合法 zip

    def test_zip_readable_roundtrip(self, client: TestClient):
        _mk_note(client, "往返笔记", "round trip")
        z = _export(client)
        md = [n for n in z.namelist() if n.endswith(".md")]
        assert md
        content = z.read(md[0]).decode("utf-8")
        assert "round trip" in content
