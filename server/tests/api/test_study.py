"""B14 Study Session API 测试：CRUD + 队列 + 结束。"""
from __future__ import annotations

from fastapi.testclient import TestClient


def _mk_concepts(client: TestClient, titles: list[str]) -> list[int]:
    ids = []
    for t in titles:
        r = client.post("/api/v1/concepts", json={"title": t})
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    return ids


def test_session_lifecycle(client: TestClient) -> None:
    cids = _mk_concepts(client, ["会话概念A", "会话概念B"])
    r = client.post("/api/v1/study/sessions",
                    json={"name": "周末复习", "concept_ids": cids})
    assert r.status_code == 201
    s = r.json()
    assert s["name"] == "周末复习"
    assert s["status"] == "active"
    assert s["concept_ids"] == cids
    sid = s["id"]

    lst = client.get("/api/v1/study/sessions").json()["sessions"]
    assert any(x["id"] == sid for x in lst)

    detail = client.get(f"/api/v1/study/sessions/{sid}").json()["session"]
    assert detail["concept_ids"] == cids

    q = client.get(f"/api/v1/study/sessions/{sid}/queue").json()
    assert q["session_id"] == sid
    assert len(q["items"]) == 2
    assert "effective_now" in q["items"][0]

    f = client.post(f"/api/v1/study/sessions/{sid}/finish").json()
    assert f["session"]["status"] == "done"
    assert f["reviewed"] == 2


def test_session_404(client: TestClient) -> None:
    assert client.get("/api/v1/study/sessions/9999").status_code == 404
    assert client.post("/api/v1/study/sessions/9999/finish").status_code == 404
    assert client.delete("/api/v1/study/sessions/9999").status_code == 404


def test_session_delete(client: TestClient) -> None:
    r = client.post("/api/v1/study/sessions", json={"name": "待删", "concept_ids": []})
    sid = r.json()["id"]
    assert client.delete(f"/api/v1/study/sessions/{sid}").status_code == 200
    assert client.get(f"/api/v1/study/sessions/{sid}").status_code == 404
