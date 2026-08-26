"""M3.5-A Knowledge Radar 测试：suggest API + 前端构建。"""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_suggest_empty_db(client: TestClient) -> None:
    """空库返回空 matches/related + memory null。"""
    r = client.get("/api/v1/knowledge/suggest?q=test")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["matches"] == []
    assert data["related"] == []
    assert data["memory"]["mastery"] is None
    assert data["memory"]["review_due"] is None
    assert data["memory"]["last_mistake"] is None


def test_suggest_empty_query(client: TestClient) -> None:
    """空查询返回空。"""
    r = client.get("/api/v1/knowledge/suggest?q=")
    assert r.status_code == 200
    assert r.json()["matches"] == []


def test_suggest_matches_notes(client: TestClient) -> None:
    """创建笔记后搜索命中标题。"""
    client.post("/api/v1/notes", json={
        "title": "BubbleSort", "content_md": "O(n²) 稳定排序"})
    client.post("/api/v1/notes", json={
        "title": "QuickSort", "content_md": "分治 O(n log n)"})

    r = client.get("/api/v1/knowledge/suggest?q=Bubble")
    assert r.status_code == 200
    data = r.json()
    titles = {m["title"] for m in data["matches"]}
    assert "BubbleSort" in titles
    # 所有 match 都有 type 字段
    assert all(m["type"] in ("note", "concept") for m in data["matches"])


def test_suggest_matches_concepts(client: TestClient) -> None:
    """搜索命中 concept 标题。"""
    client.post("/api/v1/notes", json={
        "title": "SortAlgo", "content_md": "引用[[排序算法]]"})
    # 创建后 [[排序算法]] 应以 concept 桩存在
    r = client.get("/api/v1/knowledge/suggest?q=排序")
    assert r.status_code == 200
    data = r.json()
    types = {m["type"] for m in data["matches"]}
    assert "concept" in types or "note" in types


def test_suggest_related_from_graph(client: TestClient) -> None:
    """图谱邻居应出现在 related 中。"""
    r1 = client.post("/api/v1/notes", json={
        "title": "SortRoot", "content_md": "引用[[AlphaSort]]和[[BetaSort]]"})
    note_id = r1.json()["note"]["id"]
    r = client.get(f"/api/v1/knowledge/suggest?q=Alpha&note_id={note_id}")
    assert r.status_code == 200
    data = r.json()
    related_titles = {x["title"] for x in data["related"]}
    assert "AlphaSort" in related_titles


def test_suggest_limit(client: TestClient) -> None:
    """limit 参数限制返回数量。"""
    for i in range(8):
        client.post("/api/v1/notes", json={
            "title": f"Item{i}", "content_md": f"内容 Item{i}"})
    r = client.get("/api/v1/knowledge/suggest?q=Item&limit=3")
    assert r.status_code == 200
    assert len(r.json()["matches"]) <= 3


def test_suggest_memory_placeholder(client: TestClient) -> None:
    """M3.5-A 阶段 memory 全部返回 null。"""
    r = client.get("/api/v1/knowledge/suggest?q=anything")
    assert r.status_code == 200
    mem = r.json()["memory"]
    assert mem["mastery"] is None
    assert mem["review_due"] is None
    assert mem["last_mistake"] is None
