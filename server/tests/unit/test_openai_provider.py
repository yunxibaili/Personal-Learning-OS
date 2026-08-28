"""B1a OpenAICompatProvider 守护测试（无凭据，monkeypatch urllib 层）。

覆盖：请求构造（URL/headers/body）· 响应解析 · 错误映射 · settings 驱动的
provider factory · api_key 只存在于 provider 实例（不进 context/export 已有守护）。
ADR-003：唯一协议 POST {base_url}/v1/chat/completions。
"""
from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from app.core.ai.config import LLMConfig, create_provider, load_llm_config
from app.core.ai.errors import ProviderError, ProviderTimeout
from app.core.ai.providers.mock import MockProvider
from app.core.ai.providers.openai_compat import OpenAICompatProvider


def _prompt() -> dict:
    return {
        "system": "You are Learning OS Tutor.",
        "messages": [{"role": "user", "content": "Learner context:\n\n...\n\nQuestion:\n什么是特征值？"}],
        "metadata": {"mode": "explain", "context_version": "1"},
    }


class _FakeResponse(io.BytesIO):
    def __enter__(self):  # urlopen 返回 context manager
        return self

    def __exit__(self, *a):
        return False


# ── 请求构造 ────────────────────────────────────────────────────────

class TestRequestConstruction:
    def test_url_headers_body(self, monkeypatch):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            captured["headers"] = dict(req.header_items())
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return _FakeResponse(json.dumps({
                "choices": [{"message": {"content": "答：特征值是…"}}]
            }).encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        provider = OpenAICompatProvider(
            base_url="http://127.0.0.1:11434", api_key="sk-test",
            model="deepseek-chat",
        )
        answer = provider.complete(_prompt())

        assert answer == "答：特征值是…"
        # ADR-003：{base_url}/v1/chat/completions
        assert captured["url"] == "http://127.0.0.1:11434/v1/chat/completions"
        headers = {k.lower(): v for k, v in captured["headers"].items()}
        assert headers["authorization"] == "Bearer sk-test"
        body = captured["body"]
        assert body["model"] == "deepseek-chat"
        assert body["stream"] is False
        roles = [m["role"] for m in body["messages"]]
        assert roles == ["system", "user"]
        assert "什么是特征值" in body["messages"][1]["content"]

    def test_base_url_with_trailing_v1_not_duplicated(self, monkeypatch):
        """base_url 已含 /v1 时不得出现 /v1/v1。"""
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            return _FakeResponse(json.dumps({
                "choices": [{"message": {"content": "ok"}}]
            }).encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        OpenAICompatProvider(base_url="http://x:8000/v1", api_key="",
                             model="m").complete(_prompt())
        assert captured["url"] == "http://x:8000/v1/chat/completions"

    def test_empty_api_key_omits_auth_header(self, monkeypatch):
        """本地 Ollama 无 key：不应发送空 Authorization。"""
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["headers"] = {k.lower(): v for k, v in req.header_items()}
            return _FakeResponse(json.dumps({
                "choices": [{"message": {"content": "ok"}}]
            }).encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        OpenAICompatProvider(base_url="http://x", api_key="", model="m").complete(_prompt())
        assert "authorization" not in captured["headers"]


# ── 错误映射 ────────────────────────────────────────────────────────

class TestErrorMapping:
    def test_http_error_maps_to_provider_error(self, monkeypatch):
        def fake_urlopen(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized",
                                         io.BytesIO(b"{}"), io.BytesIO(b"denied"))
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        with pytest.raises(ProviderError):
            OpenAICompatProvider(base_url="http://x", api_key="bad",
                                 model="m").complete(_prompt())

    def test_network_error_maps_to_timeout(self, monkeypatch):
        """真实形态 api_key：映射为 Timeout 且错误消息不得携带 key。"""
        def fake_urlopen(req, timeout=None):
            raise urllib.error.URLError("connection refused")
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        provider = OpenAICompatProvider(base_url="http://x",
                                        api_key="sk-real-shape-key",
                                        model="m")
        with pytest.raises(ProviderTimeout) as exc_info:
            provider.complete(_prompt())
        assert "sk-real-shape-key" not in str(exc_info.value)
        assert "sk-real-shape-key" not in repr(exc_info.value)


# ── settings 驱动的 factory ─────────────────────────────────────────

class TestProviderFactory:
    def test_default_is_mock(self, core_conn):
        cfg = load_llm_config(core_conn)
        assert isinstance(create_provider(cfg), MockProvider)

    def test_settings_drive_openai_compat(self, core_conn):
        from app.db import put_settings
        put_settings({
            "llm.provider": "openai_compat",
            "llm.base_url": "http://127.0.0.1:11434",
            "llm.api_key": "sk-xyz",
            "llm.model": "qwen2.5",
        })
        cfg = load_llm_config(core_conn)
        provider = create_provider(cfg)
        assert isinstance(provider, OpenAICompatProvider)
        assert provider.model == "qwen2.5"
        assert provider._api_key == "sk-xyz"  # key 只在实例内

    def test_unknown_provider_falls_back_to_mock(self, core_conn):
        from app.db import put_settings
        put_settings({"llm.provider": "anthropic"})
        cfg = load_llm_config(core_conn)
        assert isinstance(create_provider(cfg), MockProvider)

    def test_config_repr_never_contains_api_key(self, core_conn):
        from app.db import put_settings
        put_settings({"llm.provider": "openai_compat",
                      "llm.api_key": "sk-leak-check"})
        cfg = load_llm_config(core_conn)
        assert "sk-leak-check" not in repr(cfg) and "sk-leak-check" not in str(cfg)
