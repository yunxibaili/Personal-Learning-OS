"""M4-A Tutor Context API 测试：Context Builder + Router。"""
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.core.tutor_context import build_tutor_context, ConceptNotFoundError, MAX_MISTAKES, MAX_RELATED


def _create_concept(client: TestClient, title: str) -> int:
    """创建笔记引用指定概念（概念以 stub 存在），返回 concept ID。"""
    client.post("/api/v1/notes", json={
        "title": f"{title}Note", "content_md": f"引用[[{title}]]"})
    from app.core.knowledge import connect as _connect
    conn = _connect()
    row = conn.execute("SELECT id FROM concepts WHERE title=?", (title,)).fetchone()
    conn.close()
    assert row is not None, f"concept '{title}' not found"
    return row["id"]


# ── API Tests ───────────────────────────────────────────────────────

def test_api_context_404(client: TestClient) -> None:
    """不存在的概念返回 404。"""
    r = client.get("/api/v1/tutor/context/99999")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "concept_not_found"


def test_api_context_basic(client: TestClient) -> None:
    """空 concept 返回默认 mastery + 空列表。"""
    cid = _create_concept(client, "BasicCtxTest")
    r = client.get(f"/api/v1/tutor/context/{cid}")
    assert r.status_code == 200
    data = r.json()
    assert data["concept"]["title"] == "BasicCtxTest"
    assert data["mastery"]["effective"] == 0.0
    assert data["mistakes"] == []
    assert data["related"] == []
    assert data["review"] is not None  # ensure_concept_learning_state creates review_queue
    assert data["recent_events"] == []


def test_api_context_full(client: TestClient) -> None:
    """完整流程：创建概念 → 事件 → 复习 → 查询上下文。"""
    cid = _create_concept(client, "TutorCtxTest")

    # 初始上下文
    r = client.get(f"/api/v1/tutor/context/{cid}")
    assert r.status_code == 200
    data = r.json()
    assert data["concept"]["title"] == "TutorCtxTest"
    assert data["mastery"]["effective"] == 0.0

    # 产生学习事件
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_correct", "source": "review"})
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "explain", "source": "tutor"})

    # 提交复习
    client.post(f"/api/v1/review/{cid}/answer", json={"quality": 4})

    # 查询上下文
    r = client.get(f"/api/v1/tutor/context/{cid}")
    assert r.status_code == 200
    data = r.json()
    assert data["mastery"]["knowledge"] > 0
    assert len(data["recent_events"]) >= 1
    assert data["review"] is not None


def test_api_context_mistakes_limit(client: TestClient) -> None:
    """mistakes 最多返回 MAX_MISTAKES 条。"""
    cid = _create_concept(client, "MistakeLimitTest")

    # 插入超过限制的 mistakes
    from app.core.knowledge import connect as _connect
    conn = _connect()
    for i in range(MAX_MISTAKES + 3):
        conn.execute(
            "INSERT INTO mistakes (concept_id, description) VALUES (?, ?)",
            (cid, f"mistake {i}"),
        )
    conn.commit()
    conn.close()

    r = client.get(f"/api/v1/tutor/context/{cid}")
    assert r.status_code == 200
    data = r.json()
    assert len(data["mistakes"]) <= MAX_MISTAKES


def test_api_context_response_shape(client: TestClient) -> None:
    """验证 response 不包含 sensitive 数据。"""
    cid = _create_concept(client, "ShapeTest")
    r = client.get(f"/api/v1/tutor/context/{cid}")
    assert r.status_code == 200
    text = r.text
    assert "api_key" not in text.lower()
    assert "sk-" not in text
