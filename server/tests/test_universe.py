"""M3b-001 Universe Projection 测试：验证 Graph Data → Universe 格式。

测试：
  - 空数据库 → 空 projection
  - 有 concept → node 包含 mastery
  - 有 link → edge 正确
  - concept ↔ note link → 不出现在 edges（Universe 只展示 concept 节点）
  - mastery event → node.mastery 更新
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


def test_empty_universe(client: TestClient) -> None:
    """空数据库 → 空 projection。"""
    r = client.get("/api/v1/universe")
    assert r.status_code == 200
    data = r.json()
    assert "nodes" in data
    assert "edges" in data
    assert isinstance(data["nodes"], list)
    assert isinstance(data["edges"], list)


def test_single_concept_node(client: TestClient) -> None:
    """单个 concept → node 包含 mastery。"""
    cid = _create_concept(client, "UniverseTestConcept")

    r = client.get("/api/v1/universe")
    data = r.json()

    nodes = data["nodes"]
    assert len(nodes) >= 1

    node = next((n for n in nodes if n["id"] == cid), None)
    assert node is not None
    assert node["label"] == "UniverseTestConcept"
    assert node["type"] == "concept"
    assert node["mastery"] is not None
    assert "effective" in node["mastery"]


def test_concept_link_as_edge(client: TestClient) -> None:
    """concept ↔ concept link → edge 出现在 projection。"""
    c1 = _create_concept(client, "UniverseConceptA")
    c2 = _create_concept(client, "UniverseConceptB")

    # 直接插入 link（测试用，不依赖 API）
    from app.core.knowledge import connect as _connect
    conn = _connect()
    conn.execute(
        "INSERT INTO links (source_type, source_id, target_type, target_id, relation, origin) "
        "VALUES ('concept', ?, 'concept', ?, 'related', 'test')",
        (c1, c2),
    )
    conn.commit()
    conn.close()

    r = client.get("/api/v1/universe")
    data = r.json()

    edges = data["edges"]
    edge = next(
        (e for e in edges if e["source"] == c1 and e["target"] == c2),
        None,
    )
    assert edge is not None
    assert edge["relation"] == "related"


def test_note_concept_link_excluded(client: TestClient) -> None:
    """concept ↔ note link → 不出现在 edges（Universe 只展示 concept 节点）。"""
    c1 = _create_concept(client, "UniverseNoteLinkConcept")

    # 获取对应 note id
    from app.core.knowledge import connect as _connect
    conn = _connect()
    row = conn.execute(
        "SELECT id FROM notes WHERE title=?", ("UniverseNoteLinkConceptNote",)
    ).fetchone()
    conn.close()
    assert row is not None
    nid = row["id"]

    # 创建 concept → note link（直接插入测试用）
    from app.core.knowledge import connect as _connect
    conn = _connect()
    conn.execute(
        "INSERT INTO links (source_type, source_id, target_type, target_id, relation, origin) "
        "VALUES ('concept', ?, 'note', ?, 'references', 'test')",
        (c1, nid),
    )
    conn.commit()
    conn.close()

    r = client.get("/api/v1/universe")
    data = r.json()

    # 不应包含 note 类型的边
    for e in data["edges"]:
        assert not (e["source"] == c1), "concept→note edge should be excluded"


def test_mastery_reflects_in_node(client: TestClient) -> None:
    """mastery event → node.mastery.effective 更新。"""
    cid = _create_concept(client, "UniverseMasteryTest")

    # 产生学习事件
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "answer_correct", "source": "review"})
    client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "explain", "source": "tutor"})

    r = client.get("/api/v1/universe")
    data = r.json()

    node = next((n for n in data["nodes"] if n["id"] == cid), None)
    assert node is not None
    assert node["mastery"] is not None
    assert node["mastery"]["effective"] > 0


def test_multiple_concepts(client: TestClient) -> None:
    """多个 concept → nodes 数量正确。"""
    c1 = _create_concept(client, "UniverseMultiA")
    c2 = _create_concept(client, "UniverseMultiB")
    c3 = _create_concept(client, "UniverseMultiC")

    r = client.get("/api/v1/universe")
    data = r.json()

    ids = {n["id"] for n in data["nodes"]}
    assert c1 in ids
    assert c2 in ids
    assert c3 in ids
