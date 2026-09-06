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


def _parse_sse(body: str) -> list[dict]:
    """SSE 响应体 → [{event, data}]。``data:`` 为 JSON 对象。"""
    frames: list[dict] = []
    for block in body.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        event = "data"
        data: dict = {}
        for line in block.split("\n"):
            if line.startswith("event: "):
                event = line[len("event: "):]
            elif line.startswith("data: "):
                data = json.loads(line[len("data: "):])
        frames.append({"event": event, "data": data})
    return frames


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


# ── B2 流式输出（SSE）───────────────────────────────────────────────

class TestChatStreaming:
    """B2-A 后端骨架：stream=true 走 SSE，增量拼装=整段回答，结尾 event:done。"""

    def test_stream_content_type(self, client: TestClient):
        cid = _mk_concept(client, "流式概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid,
                                              "query": "q", "stream": True})
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")

    def test_stream_chunks_reassemble_to_nonstream(self, client: TestClient):
        """流式增量拼装 == 非流式整段回答（一致性契约）。"""
        cid = _mk_concept(client, "一致概念")
        s = client.post("/api/v1/chat", json={"concept_id": cid,
                                              "query": "q", "stream": True})
        ns = client.post("/api/v1/chat", json={"concept_id": cid, "query": "q"})
        frames = _parse_sse(s.text)
        chunks = [f["data"]["text"] for f in frames if f["event"] == "data"]
        assert len(chunks) > 1, "默认 Mock 回答足够长，应有多个增量块"
        assert "".join(chunks) == ns.json()["answer"]

    def test_stream_done_event_carries_conversation_id(
        self, client: TestClient, core_conn):
        cid = _mk_concept(client, "收尾概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid,
                                              "query": "q", "stream": True})
        frames = _parse_sse(r.text)
        done = [f for f in frames if f["event"] == "done"]
        assert len(done) == 1, "正常收尾应恰好一个 event:done"
        conv_id = done[0]["data"]["conversation_id"]
        assert conv_id > 0
        n = core_conn.execute("SELECT COUNT(*) FROM messages WHERE conversation_id=?",
                              (conv_id,)).fetchone()[0]
        assert n == 2  # user + assistant

    def test_stream_persists_assistant_message(self, client: TestClient, core_conn):
        """流式落库：assistant 消息内容 == 增量拼装结果（非空，且已双消息）。"""
        cid = _mk_concept(client, "落库概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid,
                                              "query": "q", "stream": True})
        frames = _parse_sse(r.text)
        done = [f for f in frames if f["event"] == "done"][0]["data"]
        conv_id = done["conversation_id"]
        joined = "".join(f["data"]["text"] for f in frames if f["event"] == "data")
        rows = core_conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id=? "
            "ORDER BY id", (conv_id,)).fetchall()
        assert [m["role"] for m in rows] == ["user", "assistant"]
        assert rows[1]["content"] == joined
        assert rows[1]["content"]

    def test_stream_extractor_runs_into_context_json(
        self, client: TestClient, core_conn):
        """B3 extractor 在流式 finally 亦运行：assistant context_json 含 extractor 键。"""
        cid = _mk_concept(client, "抽取概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid,
                                              "query": "q", "stream": True})
        done = [f for f in _parse_sse(r.text) if f["event"] == "done"][0]["data"]
        row = core_conn.execute(
            "SELECT context_json FROM messages WHERE conversation_id=? AND role='assistant'",
            (done["conversation_id"],)).fetchone()
        ctx = json.loads(row["context_json"])
        assert "extractor" in ctx

    def test_stream_unknown_concept_emits_error_event(
        self, client: TestClient):
        """SSE 契约：concept 不存在 → event:error（HTTP 200 流，非 404 JSON）。"""
        r = client.post("/api/v1/chat", json={"concept_id": 999999,
                                              "query": "q", "stream": True})
        assert r.status_code == 200
        frames = _parse_sse(r.text)
        errs = [f for f in frames if f["event"] == "error"]
        assert len(errs) == 1
        assert errs[0]["data"]["code"] == "concept_not_found"

    def test_stream_unknown_conversation_emits_error_event(
        self, client: TestClient):
        r = client.post("/api/v1/chat", json={"conversation_id": 999999,
                                              "query": "q", "stream": True})
        assert r.status_code == 200
        frames = _parse_sse(r.text)
        errs = [f for f in frames if f["event"] == "error"]
        assert errs and errs[0]["data"]["code"] == "conversation_not_found"

    def test_stream_same_conversation_appends(self, client: TestClient, core_conn):
        """带 conversation_id 的流式 → 追加到既有对话（不新建）。"""
        cid = _mk_concept(client, "追加流式概念")
        r1 = client.post("/api/v1/chat", json={"concept_id": cid, "query": "q1"})
        conv_id = r1.json()["conversation_id"]
        r2 = client.post("/api/v1/chat", json={"concept_id": cid, "query": "q2",
                                               "conversation_id": conv_id, "stream": True})
        done = [f for f in _parse_sse(r2.text) if f["event"] == "done"][0]["data"]
        assert done["conversation_id"] == conv_id
        n = core_conn.execute("SELECT COUNT(*) FROM messages WHERE conversation_id=?",
                              (conv_id,)).fetchone()[0]
        assert n == 4  # 两轮 user+assistant


# ── UX-004/008 消息生命周期状态（messages.status）────────────────────

def _latest_conversation_id(core_conn) -> int:
    return core_conn.execute(
        "SELECT id FROM conversations ORDER BY id DESC LIMIT 1").fetchone()["id"]


def _assistant_row(core_conn, conv_id: int):
    return core_conn.execute(
        "SELECT status, content FROM messages WHERE conversation_id=? "
        "AND role='assistant'", (conv_id,)).fetchone()


class TestMessageLifecycleStatus:
    """messages.status 三态：complete / failed / stopped。

    契约要点：status 只由后端控制流产生——不从 content 推断、不从 extractor 推断。
    真实浏览器 Stop / 网络断连的 E2E 仍为 Blocked（UX-009 同因），
    本组 stopped 用例是 L0-Stub：直接关闭生成器（等价 GeneratorExit）。
    """

    def test_legacy_insert_defaults_to_complete(self, core_conn):
        """向后兼容：老形态 INSERT（不含 status 列）→ complete。"""
        from app.core.conversations import create_conversation

        conv_id = create_conversation(core_conn, "legacy")
        core_conn.execute(
            "INSERT INTO messages (conversation_id, role, content, context_json) "
            "VALUES (?, 'assistant', 'legacy answer', '{}')", (conv_id,))
        core_conn.commit()
        assert _assistant_row(core_conn, conv_id)["status"] == "complete"

    def test_append_message_persists_and_replays_status(self, core_conn):
        from app.core.conversations import append_message, create_conversation, get_messages

        conv_id = create_conversation(core_conn, "lifecycle")
        append_message(core_conn, conv_id, role="user", content="q")
        append_message(core_conn, conv_id, role="assistant", content="部分",
                       status="stopped")
        assert [m["status"] for m in get_messages(core_conn, conv_id)] == [
            "complete", "stopped"]

    def test_invalid_status_rejected(self, core_conn):
        from app.core.conversations import append_message, create_conversation

        conv_id = create_conversation(core_conn, "bad status")
        with pytest.raises(ValueError):
            append_message(core_conn, conv_id, role="assistant", content="a",
                           status="bogus")

    def test_messages_api_exposes_status(self, client: TestClient):
        cid = _mk_concept(client, "状态概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid, "query": "q"})
        conv_id = r.json()["conversation_id"]
        msgs = client.get(
            f"/api/v1/conversations/{conv_id}/messages").json()["messages"]
        assert [m["status"] for m in msgs] == ["complete", "complete"]

    def test_stream_complete_status(self, client: TestClient, core_conn):
        cid = _mk_concept(client, "完成概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid,
                                              "query": "q", "stream": True})
        done = [f for f in _parse_sse(r.text) if f["event"] == "done"][0]["data"]
        assert _assistant_row(core_conn, done["conversation_id"])["status"] == "complete"

    def test_stream_provider_error_marks_failed_not_stopped(
        self, client: TestClient, core_conn, monkeypatch):
        """控制流边界：provider 错误 → failed（不得因异常落库而误标 stopped）。"""
        from app.core.ai.errors import ProviderError
        from app.core.ai.service import TutorService

        def boom(self, context, query, mode="explain"):
            raise ProviderError("HTTP 500")
            yield  # generator function：调用时不抛，迭代时才抛

        monkeypatch.setattr(TutorService, "ask_stream", boom)
        cid = _mk_concept(client, "失败概念")
        r = client.post("/api/v1/chat", json={"concept_id": cid,
                                              "query": "q", "stream": True})
        frames = _parse_sse(r.text)
        assert [f for f in frames if f["event"] == "error"], "应有 event:error"
        row = _assistant_row(core_conn, _latest_conversation_id(core_conn))
        assert row["status"] == "failed"

    def test_stream_unexpected_exception_marks_failed(
        self, client: TestClient, core_conn, monkeypatch):
        """非 TutorError 的生成期异常也属于 failed（外层兜底发 error 帧）。"""
        from app.core.ai.service import TutorService

        def boom(self, context, query, mode="explain"):
            raise RuntimeError("unexpected")
            yield

        monkeypatch.setattr(TutorService, "ask_stream", boom)
        r = client.post("/api/v1/chat", json={"query": "q", "stream": True})
        frames = _parse_sse(r.text)
        assert frames and frames[-1]["event"] == "error"
        row = _assistant_row(core_conn, _latest_conversation_id(core_conn))
        assert row["status"] == "failed"

    def test_stream_stopped_status_when_generator_closed(
        self, core_conn, monkeypatch):
        """L0-Stub：生成器被关闭（GeneratorExit）→ stopped，已生成部分照常落库。

        对应真实场景：用户 Stop / 浏览器中止 / 网络断开。后端只能证明
        「连接没有正常走完」，因此语义是 stopped（= 中断），不是「用户点了停止」。
        """
        from app.core.ai.service import TutorService
        from app.routers.conversations import ChatRequest, _chat_stream

        def chunks(self, context, query, mode="explain"):
            for t in ("部", "分", "内", "容"):
                yield t

        monkeypatch.setattr(TutorService, "ask_stream", chunks)
        from app.core.conversations import create_conversation

        conv_id = create_conversation(core_conn, "中断会话")
        gen = _chat_stream(
            ChatRequest(query="q", stream=True, conversation_id=conv_id), "q", [])
        first = next(gen)
        assert b'"text"' in first, "首帧应为 data 帧"
        gen.close()  # 客户端断开 → GeneratorExit 抛入生成器 → finally 落库

        row = _assistant_row(core_conn, conv_id)
        assert row["status"] == "stopped"
        assert row["content"] == "部", "中断前已生成的部分应保留"
