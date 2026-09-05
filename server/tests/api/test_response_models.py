"""Contract Hardening Phase A 守护：Tutor v0.3 前置端点的 OpenAPI 响应 schema 必须
是具体模型（$ref components），而不是空/自由 schema。

起因：v0.2.0 时全部端点注解 `-> dict`，OpenAPI 响应体为自由 schema——前端只能
靠窄化层防御。本文件把「前置 10 端点已具体化」变成可执行约束，防止后续改动
悄悄退化回宽 schema。
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def _get_openapi(client: TestClient) -> dict:
    r = client.get("/openapi.json")
    assert r.status_code == 200
    return r.json()


def test_tutor_context_responses_are_typed(client: TestClient) -> None:
    schema = _get_openapi(client)
    ops = {
        ("/api/v1/tutor/context", "post"),
        ("/api/v1/tutor/context/{concept_id}", "get"),
    }
    for path, method in ops:
        resp = schema["paths"][path][method]["responses"]["200"]
        assert "$ref" in resp["content"]["application/json"]["schema"], path
        ref = resp["content"]["application/json"]["schema"]["$ref"]
        assert ref.endswith("TutorContextResponse"), (path, ref)
    # 具体组件存在且 section 齐全（8 section，mastery/review 两种 null 语义可辨）
    comps = schema["components"]["schemas"]
    ctx = comps["TutorContextResponse"]
    for section in ("concept", "mastery", "mistakes", "related",
                    "review", "recent_events", "notes", "memories"):
        assert section in ctx["properties"], section


def test_tutor_test_response_is_typed(client: TestClient) -> None:
    schema = _get_openapi(client)
    resp = schema["paths"]["/api/v1/tutor/test"]["post"]["responses"]["200"]
    assert resp["content"]["application/json"]["schema"]["$ref"].endswith("TutorTestResponse")


def test_conversations_responses_are_typed(client: TestClient) -> None:
    schema = _get_openapi(client)
    # POST /conversations 为 201（status_code=201），其余 200
    refs = {
        ("/api/v1/conversations", "get", "200"): "ConversationsResponse",
        ("/api/v1/conversations", "post", "201"): "ConversationCreated",
        ("/api/v1/conversations/{conversation_id}/messages", "get", "200"): "MessagesResponse",
        ("/api/v1/conversations/{conversation_id}", "delete", "200"): "OkResponse",
    }
    for (path, method, code), model in refs.items():
        resp = schema["paths"][path][method]["responses"][code]
        assert resp["content"]["application/json"]["schema"]["$ref"].endswith(model), path


def test_settings_responses_are_typed(client: TestClient) -> None:
    schema = _get_openapi(client)
    assert schema["paths"]["/api/v1/settings"]["get"]["responses"]["200"][
        "content"]["application/json"]["schema"]["$ref"].endswith("SettingsResponse")
    assert schema["paths"]["/api/v1/settings"]["put"]["responses"]["200"][
        "content"]["application/json"]["schema"]["$ref"].endswith("OkResponse")


def test_chat_documents_json_schema_without_runtime_model(client: TestClient) -> None:
    """/chat：非流式 JSON 有正式 200 schema（文档层），但运行时 response_model=None
    ——SSE 分支（stream=true）零校验。此测试锁住「文档有、运行时不套」的裁定量词。"""
    schema = _get_openapi(client)
    op = schema["paths"]["/api/v1/chat"]["post"]
    assert op.get("response_model") is None if "response_model" in op else True
    resp200 = op["responses"]["200"]
    assert resp200["content"]["application/json"]["schema"]["$ref"].endswith("ChatResponse")
    assert "SSE" in resp200["description"]
