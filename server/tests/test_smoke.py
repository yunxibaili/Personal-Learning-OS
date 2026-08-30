"""M0 冒烟测试：health · migration 幂等 · settings GET/PUT 往返 + 脱敏 + 错误契约。"""
from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.db import db_path, ensure_workspace, migrate


def test_health_ok(client: TestClient) -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"] is True
    assert body["version"]


def test_migration_creates_all_tables_and_idempotent(client: TestClient) -> None:
    client.get("/api/v1/health")  # 触发 migrate
    import sqlite3

    conn = sqlite3.connect(db_path())
    tables = {
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    expected = {
        "schema_migrations", "settings", "concepts", "links", "concept_mastery",
        "learning_events", "mistakes", "memories", "notes",
        "conversations", "messages", "notes_fts",
        "mind_maps", "mind_map_nodes", "mind_map_edges",
        "review_queue", "study_sessions",
    }
    assert expected <= tables, f"缺表: {expected - tables}"
    # 幂等：重复执行不再新增版本记录（001~008；B14 新增 migration 008）
    before = conn.execute("SELECT count(*) FROM schema_migrations").fetchone()[0]
    newly = migrate()
    after = conn.execute("SELECT count(*) FROM schema_migrations").fetchone()[0]
    conn.close()
    assert newly == [] and before == after == 8


def test_workspace_layout_created(tmp_workspace: Path, client: TestClient) -> None:
    client.get("/api/v1/health")
    for sub in ("db", "vault", "attachments", "metadata", "metadata/eventlogs"):
        assert (tmp_workspace / sub).is_dir(), f"缺目录 {sub}"


def test_settings_roundtrip_and_mask(client: TestClient) -> None:
    payload = {"settings": {"llm.base_url": "https://api.test/v1",
                            "llm.api_key": "sk-secret"}}
    r = client.put("/api/v1/settings", json=payload)
    assert r.status_code == 200 and r.json() == {"ok": True}

    r = client.get("/api/v1/settings")
    data = r.json()["settings"]
    assert data["llm.base_url"] == "https://api.test/v1"
    assert data["llm.api_key"] == "******"          # 脱敏
    assert "sk-secret" not in r.text                 # 明文永不出现在响应中


def test_put_settings_rejects_non_string_values(client: TestClient) -> None:
    r = client.put("/api/v1/settings",
                   json={"settings": {"theme": 123}})
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "invalid_body"


def test_unknown_api_route_returns_json_error(client: TestClient) -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    body = r.json()
    assert body["error"]["code"] == "http_404"
