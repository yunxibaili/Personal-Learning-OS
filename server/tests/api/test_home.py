"""GET /api/v1/home 聚合端点（P8-003 D1）。"""
from __future__ import annotations


def _create_note(client, title: str):
    resp = client.post("/api/v1/notes", json={"title": title, "content": f"# {title}"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["note"]["id"]


def _create_concept(client, title: str) -> int:
    resp = client.post("/api/v1/concepts", json={"title": title, "origin": "manual"})
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def test_home_empty_workspace(client):
    data = client.get("/api/v1/home").json()
    assert data["recent_notes"] == []
    assert data["weak_concepts"] == []
    assert data["review_due"] == 0


def test_home_aggregates_recent_notes(client):
    for i in range(7):
        _create_note(client, f"笔记{i}")
    data = client.get("/api/v1/home").json()
    assert len(data["recent_notes"]) == 5  # 默认上限 5
    assert {n["title"] for n in data["recent_notes"]} <= {f"笔记{i}" for i in range(7)}


def test_home_weak_concepts_exclude_zero_mastery(client):
    cid = _create_concept(client, "特征值")
    resp = client.post("/api/v1/review/{}/answer".format(cid), json={"quality": 3})
    assert resp.status_code == 200, resp.text
    data = client.get("/api/v1/home").json()
    weak = {w["concept_id"] for w in data["weak_concepts"]}
    assert cid in weak
    # 零掌握度概念不入薄弱列表（get_weak_concepts WHERE effective > 0）
    _create_concept(client, "零掌握概念")
    data2 = client.get("/api/v1/home").json()
    titles = {w["title"] for w in data2["weak_concepts"]}
    assert "零掌握概念" not in titles


def test_home_review_due_counts_pending(client):
    # 经笔记 wikilink 建桩（触发 ensure_concept_learning_state，due_at=now 首日可复习）
    resp = client.post("/api/v1/notes", json={
        "title": "学习记录", "content_md": "# 学习\n\n今天学了 [[待复习概念]]。",
    })
    assert resp.status_code in (200, 201), resp.text
    # wikilink 桩 status=unconfirmed，列表需显式过滤
    concepts = client.get("/api/v1/concepts?status=unconfirmed").json()["concepts"]
    cid = next(c["id"] for c in concepts if c["title"] == "待复习概念")
    data = client.get("/api/v1/home").json()
    assert data["review_due"] >= 1
