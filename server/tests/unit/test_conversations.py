"""B7 对话持久化 + 最小非流式对话端点守护测试（先于实现编写）。

联动目标：
1. conversations / messages 两张零生产者表获得生产者（TABLE_AUDIT (b)→(a)）
2. B1a 的真实 provider 获得可兑现出口（/chat 非流式，factory 接线）
3. 上下文快照落库（context_json）——上下文透视与审计的数据基础
"""
from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient


def _mk_concept(client: TestClient, title: str) -> int:
    r = client.post("/api/v1/concepts", json={"title": title})
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ── 连通性：/chat 全链落库 ──────────────────────────────────────────

class TestChatPersistence:
    def test_chat_creates_conversation_and_two_messages(
        self, client: TestClient, core_conn,
    ):
        """一轮对话：自动建 conversation + user/assistant 双消息落库。"""
        cid = _mk_concept(client, "对话概念")
        r = client.post("/api/v1/chat", json={
            "concept_id": cid, "query": "什么是特征值？",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["conversation_id"] > 0
        assert body["answer"], "answer 为空"

        rows = core_conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id=? "
            "ORDER BY id", (body["conversation_id"],),
        ).fetchall()
        assert [m["role"] for m in rows] == ["user", "assistant"]
        assert rows[0]["content"] == "什么是特征值？"
        assert rows[1]["content"]  # assistant 有内容（mock 默认响应）

    def test_context_snapshot_lands_in_messages(
        self, client: TestClient, core_conn,
    ):
        """assistant 消息的 context_json 快照与实际 context 一致（标识符相等）。"""
        cid = _mk_concept(client, "快照概念")
        r = client.post("/api/v1/chat", json={
            "concept_id": cid, "query": "q"})
        conv_id = r.json()["conversation_id"]
        row = core_conn.execute(
            "SELECT context_json FROM messages WHERE conversation_id=? "
            "AND role='assistant'", (conv_id,),
        ).fetchone()
        snapshot = json.loads(row["context_json"])
        assert snapshot["concept"]["id"] == cid, (
            "快照与实际 context 不一致——管道两端未连通"
        )

    def test_same_conversation_id_appends(self, client: TestClient, core_conn):
        """带 conversation_id 再问 → 同对话追加（不新建）。"""
        cid = _mk_concept(client, "追加概念")
        r1 = client.post("/api/v1/chat", json={"concept_id": cid, "query": "q1"})
        conv_id = r1.json()["conversation_id"]
        r2 = client.post("/api/v1/chat", json={
            "concept_id": cid, "query": "q2", "conversation_id": conv_id})
        assert r2.json()["conversation_id"] == conv_id
        n = core_conn.execute(
            "SELECT COUNT(*) FROM messages WHERE conversation_id=?",
            (conv_id,)).fetchone()[0]
        assert n == 4  # 两轮 user+assistant


# ── CRUD ────────────────────────────────────────────────────────────

class TestConversationCRUD:
    def test_list_create_messages_delete(self, client: TestClient, core_conn):
        r = client.post("/api/v1/conversations", json={"title": "复习讨论"})
        assert r.status_code == 201
        conv_id = r.json()["id"]

        lst = client.get("/api/v1/conversations").json()["conversations"]
        assert any(c["id"] == conv_id and c["title"] == "复习讨论" for c in lst)

        # 手动造一轮消息（经 chat 端点）
        cid = _mk_concept(client, "CRUD概念")
        client.post("/api/v1/chat", json={
            "concept_id": cid, "query": "hi",
            "conversation_id": conv_id})

        msgs = client.get(f"/api/v1/conversations/{conv_id}/messages").json()
        assert [m["role"] for m in msgs["messages"]] == ["user", "assistant"]

        d = client.delete(f"/api/v1/conversations/{conv_id}")
        assert d.status_code == 200
        # 级联：messages 一并消失（FK CASCADE）
        n = core_conn.execute(
            "SELECT COUNT(*) FROM messages WHERE conversation_id=?",
            (conv_id,)).fetchone()[0]
        assert n == 0

    def test_messages_of_unknown_conversation_404(self, client: TestClient):
        assert client.get("/api/v1/conversations/999999/messages").status_code == 404


# ── 边界与安全 ──────────────────────────────────────────────────────

class TestChatBounds:
    def test_empty_query_400(self, client: TestClient):
        cid = _mk_concept(client, "空查询概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid, "query": "  "})
        assert r.status_code == 400

    def test_unknown_concept_404(self, client: TestClient):
        r = client.post("/api/v1/chat", json={"concept_id": 999999, "query": "q"})
        assert r.status_code == 404

    def test_chat_with_note_reference(self, client: TestClient, core_conn):
        """note_ids 透传（P8-003D 甲路线在对话入口可用）。"""
        cid = _mk_concept(client, "引用概念")
        n = _mk_note = client.post("/api/v1/notes", json={
            "title": "引用笔记", "content_md": "引用内容标记REF123"}).json()["note"]["id"]
        r = client.post("/api/v1/chat", json={
            "concept_id": cid, "query": "q", "note_ids": [n]})
        conv_id = r.json()["conversation_id"]
        row = core_conn.execute(
            "SELECT context_json FROM messages WHERE conversation_id=? "
            "AND role='assistant'", (conv_id,)).fetchone()
        snapshot = json.loads(row["context_json"])
        assert any(x["note_id"] == n for x in snapshot.get("notes", []))

    def test_messages_never_contain_api_key(self, client: TestClient, core_conn):
        """盲区转正（第四次）：真实形态 key 放进真实存放处（settings 表），
        走完整 /chat 流程，断言落库内容不携带——实现安全必须由测试证明。"""
        client.put("/api/v1/settings", json={
            "settings": {"llm.api_key": "sk-real-shape-key-999"}})
        cid = _mk_concept(client, "安全概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid, "query": "q"})
        conv_id = r.json()["conversation_id"]
        blob = core_conn.execute(
            "SELECT group_concat(content || context_json) AS b FROM messages "
            "WHERE conversation_id=?", (conv_id,)).fetchone()["b"]
        assert "sk-real-shape-key-999" not in blob
        assert "api_key" not in blob

    def test_provider_timeout_maps_504(self, client: TestClient, monkeypatch):
        """P1 守护：provider 超时 → 504（非未处理 500）。"""
        import urllib.error
        import urllib.request
        cid = _mk_concept(client, "超时概念")
        client.put("/api/v1/settings", json={
            "settings": {"llm.provider": "openai_compat",
                         "llm.base_url": "http://127.0.0.1:9",
                         "llm.api_key": "sk-timeout-check"}})

        def fake_urlopen(req, timeout=None):
            raise urllib.error.URLError("connection refused")
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

        r = client.post("/api/v1/chat", json={
            "concept_id": cid, "query": "q"})
        assert r.status_code == 504
        assert r.json()["error"]["code"] == "provider_timeout"
        assert "sk-timeout-check" not in r.text  # 错误响应也不带 key

    def test_provider_error_maps_502(self, client: TestClient, monkeypatch):
        """P1 守护：provider HTTP 错误 → 502。"""
        import urllib.error
        import urllib.request
        cid = _mk_concept(client, "错误概念")
        client.put("/api/v1/settings", json={
            "settings": {"llm.provider": "openai_compat",
                         "llm.base_url": "http://127.0.0.1:9"}})

        def fake_urlopen(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 500, "boom",
                                         io.BytesIO(b"{}"), io.BytesIO(b"boom"))
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

        r = client.post("/api/v1/chat", json={
            "concept_id": cid, "query": "q"})
        assert r.status_code == 502
        assert r.json()["error"]["code"] == "provider_error"

    def test_no_orphan_conversation_on_provider_failure(
        self, client: TestClient, core_conn, monkeypatch):
        """P1 守护：ask 失败不得残留孤儿空对话（B3 双 LLM 调用前必修）。"""
        import urllib.error
        import urllib.request
        cid = _mk_concept(client, "孤儿概念")
        client.put("/api/v1/settings", json={
            "settings": {"llm.provider": "openai_compat",
                         "llm.base_url": "http://127.0.0.1:9"}})
        monkeypatch.setattr(urllib.request, "urlopen",
                            lambda req, timeout=None: (_ for _ in ()).throw(
                                urllib.error.URLError("boom")))
        before = core_conn.execute(
            "SELECT COUNT(*) FROM conversations").fetchone()[0]
        r = client.post("/api/v1/chat", json={"concept_id": cid, "query": "q"})
        assert r.status_code == 504
        after = core_conn.execute(
            "SELECT COUNT(*) FROM conversations").fetchone()[0]
        assert after == before, "provider 失败残留孤儿对话"
