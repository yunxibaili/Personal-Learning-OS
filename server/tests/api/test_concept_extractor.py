"""B5 AI 概念提取：从文本抽取概念 → 建议落库（ai_suggested/unconfirmed）。

mock 测零 token；真实接入走 settings 配置的 openai_compat。
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.ai.providers.mock import MockProvider
from app.core.ai.extractor import extract_note_concepts


def test_extract_note_concepts_creates_suggestion(core_conn):
    conn = core_conn
    provider = MockProvider()
    out = extract_note_concepts(conn, provider=provider, text="关于梯度下降与学习率")
    assert any(s["title"] == "Mock Concept from Extractor" for s in out)
    row = conn.execute(
        "SELECT id, origin, status FROM concepts WHERE title='Mock Concept from Extractor'"
    ).fetchone()
    assert row is not None
    assert row["origin"] == "ai_suggested"
    assert row["status"] == "unconfirmed"


def test_extract_note_concepts_invalid_json_returns_empty(core_conn):
    class BadProvider:
        def complete(self, prompt):
            return "not json"

    out = extract_note_concepts(core_conn, provider=BadProvider(), text="x")
    assert out == []


def test_extract_note_concepts_already_exists_idempotent(core_conn):
    conn = core_conn
    provider = MockProvider()
    extract_note_concepts(conn, provider=provider, text="a")
    n1 = conn.execute(
        "SELECT COUNT(*) FROM concepts WHERE title='Mock Concept from Extractor'"
    ).fetchone()[0]
    extract_note_concepts(conn, provider=provider, text="a")
    n2 = conn.execute(
        "SELECT COUNT(*) FROM concepts WHERE title='Mock Concept from Extractor'"
    ).fetchone()[0]
    assert n1 == 1
    assert n2 == 1  # 幂等，不重复创建


def test_extract_concepts_endpoint(client: TestClient):
    r = client.post("/api/v1/concepts/extract", json={"text": "解释注意力机制"})
    assert r.status_code == 200
    body = r.json()
    assert "suggestions" in body
    titles = [s["title"] for s in body["suggestions"]]
    assert "Mock Concept from Extractor" in titles
    # 落库为 unconfirmed
    assert client.get("/api/v1/concepts?status=unconfirmed").status_code == 200
