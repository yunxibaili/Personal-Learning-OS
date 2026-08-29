"""B28：/api/v1/memories HTTP 层守护。

Router 只做协议转换与状态码映射，业务逻辑全部在 core——
本文件的断言同时充当「Router 不得自己实现业务」的反向约束。
"""
from __future__ import annotations

BASE = "/api/v1/memories"


def _seed(client, content="种子记忆", kind="fact", importance=0.5) -> int:
    """经 API 之外的最小路径直接落一条记忆，用于准备被测数据。"""
    from app.core.memories import upsert_memory
    from app.db import connect

    conn = connect()
    try:
        return upsert_memory(conn, kind=kind, content=content,
                             importance=importance, confidence=0.5)
    finally:
        conn.close()


class TestList:
    def test_empty(self, client):
        r = client.get(BASE)
        assert r.status_code == 200
        body = r.json()
        assert body == {"memories": [], "total": 0}

    def test_returns_memories(self, client):
        _seed(client, "列表用记忆")
        body = client.get(BASE).json()
        assert body["total"] == 1
        assert body["memories"][0]["content"] == "列表用记忆"

    def test_kind_filter(self, client):
        _seed(client, "事实记忆", kind="fact")
        _seed(client, "目标记忆", kind="goal")
        body = client.get(BASE, params={"kind": "goal"}).json()
        assert body["total"] == 1
        assert body["memories"][0]["content"] == "目标记忆"

    def test_invalid_kind_returns_400(self, client):
        r = client.get(BASE, params={"kind": "rumor"})
        assert r.status_code == 400

    def test_pagination(self, client):
        for i in range(5):
            _seed(client, f"分页记忆{i}")
        body = client.get(BASE, params={"limit": 2, "offset": 0}).json()
        assert len(body["memories"]) == 2
        assert body["total"] == 5

    def test_sensitive_memory_visible(self, client):
        """管理面全量可见（B28 冻结）：否则敏感记忆无法被用户删除。"""
        _seed(client, "sk-should-be-visible")
        body = client.get(BASE).json()
        assert body["total"] == 1
        assert body["memories"][0]["content"] == "sk-should-be-visible"


class TestGetOne:
    def test_found(self, client):
        mid = _seed(client, "单条记忆")
        r = client.get(f"{BASE}/{mid}")
        assert r.status_code == 200
        assert r.json()["content"] == "单条记忆"

    def test_missing_returns_404(self, client):
        assert client.get(f"{BASE}/999999").status_code == 404


class TestPatch:
    def test_update_content(self, client):
        mid = _seed(client, "改前")
        r = client.patch(f"{BASE}/{mid}", json={"content": "改后"})
        assert r.status_code == 200
        assert r.json()["content"] == "改后"

    def test_partial_update(self, client):
        mid = _seed(client, "部分更新", importance=0.3)
        body = client.patch(f"{BASE}/{mid}", json={"importance": 0.9}).json()
        assert body["importance"] == 0.9
        assert body["content"] == "部分更新"

    def test_missing_returns_404(self, client):
        r = client.patch(f"{BASE}/999999", json={"content": "x"})
        assert r.status_code == 404

    def test_empty_body_is_noop_not_error(self, client):
        """空 PATCH 不改任何字段，也不该 500。"""
        mid = _seed(client, "空改测试")
        r = client.patch(f"{BASE}/{mid}", json={})
        assert r.status_code == 200
        assert r.json()["content"] == "空改测试"

    def test_out_of_range_importance_returns_400(self, client):
        """请求体校验失败是 400，不是 FastAPI 默认的 422。

        main.py 注册了全局 RequestValidationError handler，统一返回 400 + 脱敏
        error body（顺带避免把原始输入值回显进响应）。因此本项目没有 422。
        """
        mid = _seed(client, "越界测试")
        r = client.patch(f"{BASE}/{mid}", json={"importance": 1.5})
        assert r.status_code == 400

    def test_invalid_kind_returns_400(self, client):
        """同上：kind 不合法是请求体校验失败 → 400（见前一用例的说明）。"""
        mid = _seed(client, "非法类型测试")
        r = client.patch(f"{BASE}/{mid}", json={"kind": "rumor"})
        assert r.status_code == 400

    def test_duplicate_returns_409(self, client):
        _seed(client, "重复内容AAA")
        from app.db import connect

        conn = connect()
        try:
            conn.execute(
                "INSERT INTO memories (kind, content, importance, confidence, concepts_json)"
                " VALUES ('fact', '重复内容BBB', 0.5, 0.5, '[]')"
            )
            conn.commit()
            mid_b = conn.execute(
                "SELECT id FROM memories WHERE content='重复内容BBB'"
            ).fetchone()["id"]
        finally:
            conn.close()

        r = client.patch(f"{BASE}/{mid_b}", json={"content": "重复内容AAA"})
        assert r.status_code == 409


class TestDelete:
    def test_delete_existing(self, client):
        mid = _seed(client, "待删除")
        r = client.delete(f"{BASE}/{mid}")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert client.get(f"{BASE}/{mid}").status_code == 404

    def test_delete_missing_returns_404(self, client):
        assert client.delete(f"{BASE}/999999").status_code == 404


class TestRouteBoundary:
    def test_router_has_no_direct_sql(self):
        """分层铁律：routers/ 不得直写 SQL，业务一律经 core。"""
        import inspect

        from app.routers import memories as mod

        src = inspect.getsource(mod)
        for forbidden in ("INSERT INTO", "UPDATE memories", "DELETE FROM", "SELECT "):
            assert forbidden not in src, f"router 出现裸 SQL：{forbidden}"
