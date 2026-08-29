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

    def test_stream_requests_stream_true_and_yields_deltas(self, monkeypatch):
        """B2-B：stream() 发 stream:true，解析 data 帧，取 delta.content 增量。"""
        body = (
            'data: {"id":"1","choices":[{"delta":{"role":"assistant"}}]}\n\n'
            'data: {"id":"1","choices":[{"delta":{"content":"特征"}}]}\n\n'
            'data: {"id":"1","choices":[{"delta":{"content":"值"}}]}\n\n'
            'data: [DONE]\n\n'
        ).encode("utf-8")
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["stream"] = json.loads(req.data.decode("utf-8"))["stream"]
            return _FakeResponse(body)

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        provider = OpenAICompatProvider(base_url="http://127.0.0.1:11434",
                                        api_key="sk-test", model="m")
        chunks = list(provider.stream(_prompt()))
        assert captured["stream"] is True
        assert chunks == ["特征", "值"]
        assert "".join(chunks) == "特征值"

    def test_stream_skips_metadata_and_bad_frames(self, monkeypatch):
        """role delta、非 JSON 帧、缺 delta 帧都应被跳过，流不中断。"""
        body = (
            b'data: {"id":"1","choices":[{"delta":{"role":"assistant"}}]}\n\n'
            b'data: this-is-not-json\n\n'
            b'data: {"id":"1","choices":[]}\n\n'
            b'data: {"id":"1","choices":[{"delta":{}}]}\n\n'
            b'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}\n\n'
            b'data: [DONE]\n\n'
        )

        def fake_urlopen(req, timeout=None):
            return _FakeResponse(body)

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        provider = OpenAICompatProvider(base_url="http://x", api_key="", model="m")
        assert list(provider.stream(_prompt())) == ["hi"]

    def test_stream_without_done_ends_at_eof(self, monkeypatch):
        """无 [DONE] 帧也应照常产出，直到响应结束（稳）。"""
        body = (
            b'data: {"id":"1","choices":[{"delta":{"content":"a"}}]}\n\n'
            b'data: {"id":"1","choices":[{"delta":{"content":"b"}}]}\n\n'
        )

        def fake_urlopen(req, timeout=None):
            return _FakeResponse(body)

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        provider = OpenAICompatProvider(base_url="http://x", api_key="", model="m")
        assert list(provider.stream(_prompt())) == ["a", "b"]

    def test_stream_http_error_maps_provider_error(self, monkeypatch):
        def fake_urlopen(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests",
                                         io.BytesIO(b"{}"), io.BytesIO(b""))
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        with pytest.raises(ProviderError):
            list(OpenAICompatProvider(base_url="http://x", api_key="k",
                                      model="m").stream(_prompt()))

    def test_stream_network_error_maps_timeout(self, monkeypatch):
        def fake_urlopen(req, timeout=None):
            raise urllib.error.URLError("connection refused")
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        with pytest.raises(ProviderTimeout):
            list(OpenAICompatProvider(base_url="http://x", api_key="sk-real-shape",
                                      model="m").stream(_prompt()))


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

# ── B1 加固：重试 / max_tokens / JSON 模式 / 错误分类（全 mock，零真实 token）──

class TestHardening:
    def _fail_then_succeed(self, monkeypatch, fail_times, status=None):
        import app.core.ai.providers.openai_compat as oc
        calls = []

        def fake_urlopen(req, timeout=None):
            calls.append(req)
            if len(calls) <= fail_times:
                if status:
                    raise urllib.error.HTTPError(req.full_url, status, "transient",
                                                 io.BytesIO(b""), io.BytesIO(b""))
                raise urllib.error.URLError("connection refused")
            return _FakeResponse(json.dumps({
                "choices": [{"message": {"content": "ok"}}]
            }).encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        monkeypatch.setattr(oc.time, "sleep", lambda s: None)  # 退避置 0，测试不睡
        return calls

    def test_retries_transient_connection_then_succeeds(self, monkeypatch):
        calls = self._fail_then_succeed(monkeypatch, fail_times=2)
        provider = OpenAICompatProvider(base_url="http://x", api_key="", model="m")
        assert provider.complete(_prompt()) == "ok"
        assert len(calls) == 3  # 2 次失败（退避重试）+ 1 次成功

    def test_retries_transient_http_503(self, monkeypatch):
        calls = self._fail_then_succeed(monkeypatch, fail_times=1, status=503)
        assert OpenAICompatProvider(
            base_url="http://x", api_key="", model="m").complete(_prompt()) == "ok"
        assert len(calls) == 2

    def test_retry_exhausted_raises(self, monkeypatch):
        def fake_urlopen(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 503, "down",
                                         io.BytesIO(b""), io.BytesIO(b""))
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        import app.core.ai.providers.openai_compat as oc
        monkeypatch.setattr(oc.time, "sleep", lambda s: None)
        with pytest.raises(ProviderError):
            OpenAICompatProvider(base_url="http://x", api_key="", model="m").complete(_prompt())

    def test_auth_error_401_maps_provider_error(self, monkeypatch):
        def fake_urlopen(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 401, "unauthorized",
                                         io.BytesIO(b"{}"), io.BytesIO(b"denied"))
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        with pytest.raises(ProviderError) as exc_info:
            OpenAICompatProvider(base_url="http://x", api_key="bad-key",
                                 model="m").complete(_prompt())
        assert "sk-bad" not in str(exc_info.value)
        assert "api key" in str(exc_info.value).lower() or "认证" in str(exc_info.value)

    def test_max_tokens_in_payload(self, monkeypatch):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return _FakeResponse(json.dumps({
                "choices": [{"message": {"content": "ok"}}]
            }).encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        OpenAICompatProvider(base_url="http://x", api_key="", model="m",
                             max_tokens=512).complete(_prompt())
        assert captured["body"]["max_tokens"] == 512
        assert captured["body"]["stream"] is False

    def test_extractor_mode_uses_json_response_format(self, monkeypatch):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return _FakeResponse(json.dumps({
                "choices": [{"message": {"content": "{}"}}]
            }).encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        ep = _prompt()
        ep["metadata"]["mode"] = "extractor"
        OpenAICompatProvider(base_url="http://x", api_key="", model="m").complete(ep)
        assert captured["body"]["response_format"] == {"type": "json_object"}

    def test_non_extractor_omits_json_format(self, monkeypatch):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return _FakeResponse(json.dumps({
                "choices": [{"message": {"content": "ok"}}]
            }).encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        OpenAICompatProvider(base_url="http://x", api_key="", model="m").complete(_prompt())
        assert "response_format" not in captured["body"]

    def test_config_loads_max_tokens(self, core_conn):
        from app.db import put_settings
        put_settings({"llm.provider": "openai_compat",
                      "llm.base_url": "http://127.0.0.1:11434",
                      "llm.max_tokens": "1024"})
        cfg = load_llm_config(core_conn)
        assert cfg.max_tokens == 1024
        provider = create_provider(cfg)
        assert isinstance(provider, OpenAICompatProvider)
        assert provider._max_tokens == 1024

    def test_unknown_max_tokens_falls_back_default(self, core_conn):
        from app.db import put_settings
        put_settings({"llm.max_tokens": "not-a-number"})
        cfg = load_llm_config(core_conn)
        assert cfg.max_tokens == 2048

    def test_stream_also_uses_retry_connection(self, monkeypatch):
        """流式同样在连接建立阶段重试（且不因 sleep 卡住）。"""
        import app.core.ai.providers.openai_compat as oc
        calls = []

        def fake_urlopen(req, timeout=None):
            calls.append(req)
            if len(calls) < 2:
                raise urllib.error.URLError("refused")
            return _FakeResponse(
                'data: {"id":"1","choices":[{"delta":{"content":"hi"}}]}\n\n'
                'data: [DONE]\n\n'.encode("utf-8"))

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        monkeypatch.setattr(oc.time, "sleep", lambda s: None)
        assert list(OpenAICompatProvider(
            base_url="http://x", api_key="", model="m").stream(_prompt())) == ["hi"]
        assert len(calls) == 2
