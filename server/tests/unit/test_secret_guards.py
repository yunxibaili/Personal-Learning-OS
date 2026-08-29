"""敏感值泄漏防线 —— 跨端点的统一守护（2026-08-29 建立）。

本文件只守护**此前无任何测试覆盖**的两个面；其余三面各有归属，索引如下，
新增第四个面时请登记在此，避免防线出现无人看守的漏洞：

| # | 泄漏面 | 守护位置 |
|---|---|---|
| 1 | 导出包 settings.json | `test_export.py::TestSettingsSanitization` |
| 2 | 落库 messages.content / context_json | `test_conversations.py::test_messages_never_contain_api_key` |
| 3 | provider 异常响应体 | `test_conversations.py::test_provider_timeout_maps_504` |
| 4 | **GET /settings 响应体** | 本文件 `TestSettingsEndpointMasking` |
| 5 | **pydantic 校验错误响应体** | 本文件 `TestValidationErrorEcho` |

面 4/5 曾是敞开的：面 4 的判定规则与面 1 不同步（只有子串规则），
面 5 由 pydantic 默认 `include_input=True` 导致原始输入值原样回显。
**防线有洞比没防线更危险**——它会让人误以为已经安全。
"""
from __future__ import annotations

from fastapi.testclient import TestClient


class TestSettingsEndpointMasking:
    """面 4：GET /settings 的掩码必须与 export 的判定同源（三规则并集）。"""

    # 三规则各取一例 + 一个非敏感对照
    CASES = {
        "llm.api_key": ("sk-rule1-substring", True),      # 规则 1：键名子串
        "llm.token": ("xoxb-rule2-segment", True),        # 规则 2：命名段命中
        "db.password": ("hunter2-rule2-segment", True),   # 规则 2：命名段命中
        "llm.credential": ("sk-rule3-value-prefix", True),  # 规则 3：值前缀
        "llm.model": ("deepseek-chat", False),            # 对照：非敏感
        "theme": ("dark", False),                         # 对照：非敏感
    }

    def test_masking_matches_export_rules(self, client: TestClient):
        """键名子串 / 命名段 / 值前缀三类敏感值全部掩码；非敏感值原样返回。"""
        client.put("/api/v1/settings", json={
            "settings": {k: v for k, (v, _) in self.CASES.items()}})
        out = client.get("/api/v1/settings").json()["settings"]

        for key, (value, should_mask) in self.CASES.items():
            got = out[key]
            if should_mask:
                assert got == "******", (
                    f"{key} 未掩码：敏感值 {value!r} 明文出现在 GET /settings")
                assert value not in str(out), (
                    f"{key} 的原文回显在响应体中")
            else:
                assert got == value, (
                    f"{key} 被误掩码：非敏感配置不应脱敏（前端需读值）")

    def test_settings_and_export_agree(self, client: TestClient):
        """同源判定的交叉验证：export 排除的条目，GET /settings 必须掩码。

        两处消费语义不同（整体排除 vs 掩码），但**判定必须一致**——
        否则会出现「导出包里没有、页面上却明文显示」的自相矛盾。
        """
        client.put("/api/v1/settings", json={"settings": {
            "llm.api_key": "sk-agree-1", "llm.token": "xoxb-agree-2",
            "llm.credential": "sk-agree-3", "llm.model": "keep-me"}})

        out = client.get("/api/v1/settings").json()["settings"]
        for key in ("llm.api_key", "llm.token", "llm.credential"):
            assert out[key] == "******", f"{key} 两处判定不一致"
        assert out["llm.model"] == "keep-me"


class TestValidationErrorEcho:
    """面 5：pydantic 校验失败不得回显触发失败的原始输入值。"""

    def test_invalid_field_type_does_not_echo_value(self, client: TestClient):
        """note_ids 传字符串 → 400，但响应体不得回显该字符串。"""
        secret = "sk-ECHO-LEAK-CANARY"
        r = client.post("/api/v1/chat", json={
            "query": "q", "note_ids": [secret]})
        assert r.status_code == 400
        assert secret not in r.text, (
            "校验错误响应体回显了原始输入值 —— 敏感值泄漏面 5")
        assert r.json()["error"]["code"] == "invalid_body"

    def test_too_long_query_does_not_echo_body(self, client: TestClient):
        """超长 query → 400，响应体不得回显整段原文（同时避免响应放大）。"""
        r = client.post("/api/v1/chat", json={"query": "x" * 2001})
        assert r.status_code == 400
        assert "x" * 200 not in r.text, "校验错误响应体回显了超长原文"
        # 结构信息（哪个字段、什么错）仍需保留，否则前端无从提示
        assert "query" in r.text

    def test_error_structure_kept_after_scrubbing(self, client: TestClient):
        """剥离 input 后，错误的定位信息（loc/type）必须保留（可用性不回退）。"""
        r = client.post("/api/v1/chat", json={"query": "q", "mode": "nope"})
        assert r.status_code == 400
        msg = r.json()["error"]["message"]
        assert "mode" in msg, "错误定位信息丢失"
        assert "literal_error" in msg or "Input should be" in msg
