"""M3 Learning Graph 测试：mastery engine + review scheduler + API。"""
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.core.mastery import (
    compute_effective, update_mastery, get_mastery,
    DEFAULT_DIMENSIONS, DIMENSION_WEIGHTS,
)
from app.core.review_scheduler import sm2_schedule


# ── Unit Tests ──────────────────────────────────────────────────────

def test_compute_effective() -> None:
    dims = {"knowledge": 1.0, "practice": 0.0, "recall": 0.0, "transfer": 0.0}
    eff = compute_effective(dims)
    assert eff == round(0.35 * 1.0, 4)


def test_compute_effective_all_zero() -> None:
    assert compute_effective(DEFAULT_DIMENSIONS) == 0.0


def test_sm2_correct_answer() -> None:
    r = sm2_schedule(quality=5, ease_factor=2.5, interval=0, review_count=0)
    assert r["interval"] == 1
    assert r["review_count"] == 1
    assert r["ease_factor"] >= 2.5


def test_sm2_wrong_answer() -> None:
    r = sm2_schedule(quality=1, ease_factor=2.5, interval=10, review_count=5)
    assert r["interval"] == 1  # 重置
    assert r["ease_factor"] >= 1.3


def test_sm2_quality_bounds() -> None:
    r1 = sm2_schedule(quality=-1)
    r2 = sm2_schedule(quality=10)
    assert r1["interval"] >= 1
    assert r2["interval"] >= 1


# ── API Tests ───────────────────────────────────────────────────────

def _create_concept(client: TestClient, title: str) -> int:
    """创建笔记引用指定概念（概念以 stub 存在），返回 concept ID。"""
    r = client.post("/api/v1/notes", json={
        "title": f"{title}Note", "content_md": f"引用[[{title}]]"})
    assert r.status_code == 201
    from app.core.knowledge import connect
    conn = connect()
    row = conn.execute("SELECT id FROM concepts WHERE title=?", (title,)).fetchone()
    conn.close()
    assert row is not None, f"concept '{title}' not found after note creation"
    return row["id"]


def test_mastery_lifecycle(client: TestClient) -> None:
    """完整流程：创建概念 → 事件 → 掌握度变化 → 复习 → 排期。"""
    cid = _create_concept(client, "MatrixAlgo")

    # 初始掌握度
    r = client.get(f"/api/v1/mastery/{cid}")
    assert r.status_code == 200
    m = r.json()["mastery"]
    assert m["effective"] == 0.0
    assert m["dimensions"]["knowledge"] == 0.0

    # 学习事件：答对
    r = client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_correct", "source": "review"})
    assert r.status_code == 201
    m2 = r.json()["mastery"]
    assert m2["dimensions"]["knowledge"] > 0
    assert m2["effective"] > 0

    # 学习事件：答错
    r = client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_wrong"})
    assert r.status_code == 201
    m3 = r.json()["mastery"]
    assert m3["dimensions"]["knowledge"] < m2["dimensions"]["knowledge"]

    # 提交复习答案（quality=4 → interval=1天，不due today）
    r = client.post(f"/api/v1/review/{cid}/answer", json={"quality": 4})
    assert r.status_code == 200
    data = r.json()
    assert "next_review" in data
    assert data["ease_factor"] >= 1.3
    assert data["interval"] == 1  # first review → 1 day

    # 验证 review_queue 行已创建（通过 review/today 或直接查）
    r2 = client.get("/api/v1/review/today")
    assert r2.status_code == 200

    # quality=0 → interval 重置 → next_review=1天后（仍不due today）
    # 但 review_queue 行应存在
    from app.core.knowledge import connect as _connect
    _conn = _connect()
    rq = _conn.execute("SELECT * FROM review_queue WHERE concept_id=?", (cid,)).fetchone()
    _conn.close()
    assert rq is not None, "review_queue entry not created"


def test_mastery_list(client: TestClient) -> None:
    cid = _create_concept(client, "ListMastery")
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "explain"})
    r = client.get("/api/v1/mastery")
    assert r.status_code == 200
    assert len(r.json()["mastery"]) >= 1


def test_mastery_404(client: TestClient) -> None:
    r = client.get("/api/v1/mastery/99999")
    assert r.status_code == 404


def test_event_invalid_concept(client: TestClient) -> None:
    r = client.post("/api/v1/events", json={
        "concept_id": 99999, "event_type": "explain"})
    assert r.status_code == 404


def test_weak_concepts(client: TestClient) -> None:
    cid = _create_concept(client, "WeakTest")
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_wrong"})
    r = client.get("/api/v1/mastery/weak/list")
    assert r.status_code == 200
    # weak concepts have effective > 0 but low
    weak = r.json()["weak"]
    assert isinstance(weak, list)
