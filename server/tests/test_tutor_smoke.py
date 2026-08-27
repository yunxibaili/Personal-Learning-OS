"""M4-C Smoke Test：验证 Context → Prompt → Provider → Response 全链路。

临时端点 POST /api/v1/tutor/test 的测试。
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def _create_concept(client: TestClient, title: str) -> int:
    """创建笔记引用指定概念，返回 concept ID。"""
    client.post("/api/v1/notes", json={
        "title": f"{title}Note", "content_md": f"引用[[{title}]]"})
    from app.core.knowledge import connect as _connect
    conn = _connect()
    row = conn.execute("SELECT id FROM concepts WHERE title=?", (title,)).fetchone()
    conn.close()
    assert row is not None
    return row["id"]


def test_smoke_basic(client: TestClient) -> None:
    """基本链路：concept → context → prompt → mock response。"""
    cid = _create_concept(client, "SmokeTestConcept")
    r = client.post("/api/v1/tutor/test", json={
        "concept_id": cid,
        "query": "What is this concept?",
    })
    assert r.status_code == 200
    data = r.json()
    assert "answer" in data
    assert "metadata" in data
    assert data["metadata"]["provider"] == "mock"
    assert data["metadata"]["concept"] == "SmokeTestConcept"


def test_smoke_404(client: TestClient) -> None:
    """不存在的概念返回 404。"""
    r = client.post("/api/v1/tutor/test", json={
        "concept_id": 99999,
        "query": "test",
    })
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "concept_not_found"


def test_smoke_mode(client: TestClient) -> None:
    """mode 参数正确传递。"""
    cid = _create_concept(client, "ModeTestConcept")
    r = client.post("/api/v1/tutor/test", json={
        "concept_id": cid,
        "query": "Give me a hint",
        "mode": "hint",
    })
    assert r.status_code == 200
    assert r.json()["metadata"]["mode"] == "hint"


def test_smoke_with_mastery(client: TestClient) -> None:
    """有 mastery 数据的 concept → context 包含掌握度。"""
    cid = _create_concept(client, "MasterySmokeTest")

    # 产生学习事件提升 mastery
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_correct", "source": "review"})
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "explain", "source": "tutor"})

    r = client.post("/api/v1/tutor/test", json={
        "concept_id": cid,
        "query": "Explain this concept",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["metadata"]["mastery_effective"] is not None
    assert data["metadata"]["mastery_effective"] > 0


def test_smoke_full_context(client: TestClient) -> None:
    """完整流程：创建 → 事件 → 复习 → smoke test。"""
    cid = _create_concept(client, "FullSmokeTest")

    # 学习事件
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_wrong", "source": "review"})
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_correct", "source": "review"})

    # 复习
    client.post(f"/api/v1/review/{cid}/answer", json={"quality": 4})

    # Smoke test
    r = client.post("/api/v1/tutor/test", json={
        "concept_id": cid,
        "query": "Why is this important?",
        "mode": "review",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["metadata"]["mode"] == "review"
    assert data["metadata"]["concept"] == "FullSmokeTest"
    # Mock response contains default text
    assert len(data["answer"]) > 0
