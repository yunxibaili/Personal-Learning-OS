"""B12 错题本 API 测试：core 函数 + API 端点、解决标记、删除、统计、404。

统一走 tmp_workspace 隔离，绝不触碰真实用户数据。
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.core import mistakes as M
from app.core.mastery import update_mastery


def _make_concept_with_mistake(client: TestClient, title: str) -> int:
    """创建概念并产生一条错题（经真实 answer_wrong 路径）。"""
    r = client.post("/api/v1/concepts", json={"title": title})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    r = client.post("/api/v1/events", json={"concept_id": cid,
                                            "event_type": "answer_wrong"})
    assert r.status_code == 201, r.text
    return cid


# ── Core ─────────────────────────────────────────────────────────────

class TestMistakesCore:
    def test_list_and_get(self, core_conn):
        cid = 1
        # 直接经 core 造错误
        conn = core_conn
        conn.execute("INSERT INTO concepts (title, origin) VALUES ('核心概念', 'manual')")
        conn.commit()
        cid = conn.execute(
            "SELECT id FROM concepts WHERE title='核心概念'").fetchone()["id"]
        update_mastery(conn, cid, "answer_wrong", source="review")

        lst = M.list_mistakes(conn)
        assert len(lst) == 1
        m = lst[0]
        assert m["concept_id"] == cid
        assert m["concept_title"] == "核心概念"
        assert m["resolved"] is False

        detail = M.get_mistake(conn, m["id"])
        assert detail["id"] == m["id"]

    def test_list_filter_by_resolved(self, core_conn):
        conn = core_conn
        conn.execute("INSERT INTO concepts (title, origin) VALUES ('过滤概念', 'manual')")
        conn.commit()
        cid = conn.execute(
            "SELECT id FROM concepts WHERE title='过滤概念'").fetchone()["id"]
        update_mastery(conn, cid, "answer_wrong")
        update_mastery(conn, cid, "answer_wrong")
        rows = conn.execute("SELECT id FROM mistakes").fetchall()
        M.set_mistake_resolved(conn, rows[0]["id"], True)

        unresolved = M.list_mistakes(conn, resolved=False)
        resolved = M.list_mistakes(conn, resolved=True)
        assert len(unresolved) == 1
        assert len(resolved) == 1
        assert resolved[0]["resolved"] is True

    def test_set_resolved_and_delete(self, core_conn):
        conn = core_conn
        conn.execute("INSERT INTO concepts (title, origin) VALUES ('改删概念', 'manual')")
        conn.commit()
        cid = conn.execute(
            "SELECT id FROM concepts WHERE title='改删概念'").fetchone()["id"]
        update_mastery(conn, cid, "answer_wrong")
        mid = conn.execute("SELECT id FROM mistakes").fetchone()["id"]

        updated = M.set_mistake_resolved(conn, mid, True)
        assert updated["resolved"] is True

        M.delete_mistake(conn, mid)
        assert M.list_mistakes(conn) == []

    def test_stats(self, core_conn):
        conn = core_conn
        conn.execute("INSERT INTO concepts (title, origin) VALUES ('统计概念', 'manual')")
        conn.commit()
        cid = conn.execute(
            "SELECT id FROM concepts WHERE title='统计概念'").fetchone()["id"]
        update_mastery(conn, cid, "answer_wrong")
        update_mastery(conn, cid, "answer_wrong")
        mid = conn.execute("SELECT id FROM mistakes")
        M.set_mistake_resolved(conn, mid.fetchone()["id"], True)

        stats = M.mistake_stats(conn)
        assert stats["total"] == 2
        assert stats["unresolved"] == 1
        assert stats["resolved"] == 1
        assert any(bc["concept_id"] == cid and bc["count"] == 2 for bc in stats["by_concept"])

    def test_get_unknown_raises(self, core_conn):
        try:
            M.get_mistake(core_conn, 9999)
            assert False, "should raise"
        except M.MistakeNotFoundError:
            pass


# ── API ──────────────────────────────────────────────────────────────

class TestMistakesAPI:
    def test_list_endpoint(self, client: TestClient):
        _make_concept_with_mistake(client, "错题列表")
        r = client.get("/api/v1/mistakes")
        assert r.status_code == 200
        body = r.json()["mistakes"]
        assert len(body) >= 1
        assert "concept_title" in body[0]

    def test_stats_endpoint(self, client: TestClient):
        cid = _make_concept_with_mistake(client, "错题统计")
        r = client.get("/api/v1/mistakes/stats")
        assert r.status_code == 200
        stats = r.json()["stats"]
        assert stats["total"] >= 1
        assert stats["unresolved"] >= 1
        assert any(bc["concept_id"] == cid for bc in stats["by_concept"])

    def test_patch_resolved(self, client: TestClient):
        _make_concept_with_mistake(client, "错题解决")
        mid = client.get("/api/v1/mistakes").json()["mistakes"][0]["id"]
        r = client.patch(f"/api/v1/mistakes/{mid}", json={"resolved": True})
        assert r.status_code == 200
        assert r.json()["mistake"]["resolved"] is True

    def test_delete(self, client: TestClient):
        _make_concept_with_mistake(client, "错题删除")
        mid = client.get("/api/v1/mistakes").json()["mistakes"][0]["id"]
        r = client.delete(f"/api/v1/mistakes/{mid}")
        assert r.status_code == 200
        r2 = client.get(f"/api/v1/mistakes/{mid}")
        assert r2.status_code == 404

    def test_stats_route_before_id_route(self, client: TestClient):
        """/mistakes/stats 不被 /mistakes/{id} 拦截（路由顺序守护）。"""
        _make_concept_with_mistake(client, "路由顺序")
        r = client.get("/api/v1/mistakes/stats")
        assert r.status_code == 200
        assert "stats" in r.json()

    def test_unknown_404(self, client: TestClient):
        assert client.get("/api/v1/mistakes/999999").status_code == 404
        assert client.patch("/api/v1/mistakes/999999",
                            json={"resolved": True}).status_code == 404
