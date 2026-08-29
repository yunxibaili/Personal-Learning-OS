"""LLM Provider + TutorService 单元测试（M4-C）。

验证完整链路：Context → Prompt → Provider → Response
无网络依赖，只用 MockProvider。
"""
from __future__ import annotations

import json

import pytest

from app.core.ai.providers.mock import MockProvider, DEFAULT_CHUNK_SIZE
from app.core.ai.service import TutorService
from app.core.ai.errors import TutorError, ProviderTimeout, ProviderError
from app.core.tutor_types import TutorContext


# ── Fixtures ───────────────────────────────────────────────────────

def _ctx() -> TutorContext:
    return TutorContext(
        concept={"id": 1, "title": "Gradient Descent"},
        mastery={"knowledge": 0.6, "practice": 0.3, "recall": 0.2, "transfer": 0.1, "effective": 0.35},
        mistakes=[{"id": 1, "description": "learning rate too high", "occurred_at": "2026-08-27"}],
        related=[{"id": 2, "title": "Backpropagation", "relation": "related"}],
        review={"next_review": "2026-08-28", "priority": 0.8, "last_result": "wrong"},
        recent_events=[{"event_type": "answer_wrong", "source": "review", "created_at": "2026-08-27"}],
    )


# ── MockProvider Tests ─────────────────────────────────────────────

class TestMockProvider:

    def test_returns_response(self) -> None:
        p = MockProvider(response="Hello")
        assert p.complete({"system": "s", "messages": [], "metadata": {}}) == "Hello"

    def test_default_response(self) -> None:
        p = MockProvider()
        resp = p.complete({"system": "s", "messages": [], "metadata": {}})
        assert "mock tutor response" in resp.lower()

    def test_call_count(self) -> None:
        p = MockProvider()
        assert p.call_count == 0
        p.complete({"system": "s", "messages": [], "metadata": {}})
        p.complete({"system": "s", "messages": [], "metadata": {}})
        assert p.call_count == 2

    def test_last_prompt_recorded(self) -> None:
        p = MockProvider()
        prompt = {"system": "sys", "messages": [{"role": "user", "content": "q"}], "metadata": {}}
        p.complete(prompt)
        assert p.last_prompt == prompt

    def test_extractor_mode_returns_valid_json(self) -> None:
        """B7.1-R：extractor 调用返回合法 JSON（含 concept_suggestions）。"""
        p = MockProvider()
        prompt = {"system": "s", "messages": [], "metadata": {"mode": "extractor"}}
        resp = p.complete(prompt)
        parsed = json.loads(resp)
        assert "concept_suggestions" in parsed
        assert len(parsed["concept_suggestions"]) >= 1
        assert parsed["concept_suggestions"][0]["title"] == "Mock Concept from Extractor"

    def test_tutor_mode_returns_human_text(self) -> None:
        """B7.1-R：Tutor 调用返回人类可读文本（非 JSON）。"""
        p = MockProvider()
        prompt = {"system": "s", "messages": [], "metadata": {"mode": "explain"}}
        resp = p.complete(prompt)
        assert "mock tutor response" in resp.lower()
        # 反向断言：确保不是 JSON（防止 MockProvider 被改坏成所有模式都返回 JSON）
        with pytest.raises(json.JSONDecodeError):
            json.loads(resp)


# ── B2 流式：MockProvider.stream + TutorService.ask_stream ─────────────

class TestMockProviderStream:

    def test_stream_concatenates_to_complete(self) -> None:
        """``"".join(stream(prompt)) == complete(prompt)``（增量拼装恒等于整段回答）。"""
        p = MockProvider()
        prompt = {"system": "s", "messages": [], "metadata": {"mode": "explain"}}
        chunks = list(p.stream(prompt))
        assert chunks, "流式不得为空"
        assert "".join(chunks) == p.complete(prompt)

    def test_stream_is_deterministic_chunks(self) -> None:
        """同一种子可分块；无随机、无 sleep，重复调用产出完全一致。"""
        p = MockProvider()
        prompt = {"system": "s", "messages": [], "metadata": {}}
        a = list(p.stream(prompt, chunk_size=8))
        b = list(p.stream(prompt, chunk_size=8))
        assert a == b
        assert all(len(c) <= 8 for c in a)

    def test_stream_respects_chunk_size(self) -> None:
        p = MockProvider()
        prompt = {"system": "s", "messages": [], "metadata": {}}
        chunks = list(p.stream(prompt, chunk_size=4))
        assert all(len(c) <= 4 for c in chunks)
        # 默认步长常量存在
        assert isinstance(DEFAULT_CHUNK_SIZE, int)

    def test_stream_increments_call_count_via_complete(self) -> None:
        """stream 复用 complete：call_count 仍被计入（语义=一次完整生成）。"""
        p = MockProvider()
        prompt = {"system": "s", "messages": [], "metadata": {}}
        list(p.stream(prompt))
        assert p.call_count == 1

    def test_stream_extractor_mode_returns_json(self) -> None:
        """stream 的 extractor 模式仍返回合法 JSON（复用 complete 分派）。"""
        p = MockProvider()
        prompt = {"system": "s", "messages": [], "metadata": {"mode": "extractor"}}
        joined = "".join(p.stream(prompt))
        parsed = json.loads(joined)
        assert "concept_suggestions" in parsed


# ── TutorService Tests ─────────────────────────────────────────────

class TestTutorService:

    def test_full_pipeline(self) -> None:
        """Context → Prompt → Provider → Response 完整链路。"""
        provider = MockProvider(response="Gradient descent optimizes parameters.")
        svc = TutorService(provider)
        resp = svc.ask(_ctx(), "What is gradient descent?")
        assert resp == "Gradient descent optimizes parameters."
        assert provider.call_count == 1

    def test_prompt_recorded(self) -> None:
        """Provider 收到正确的 prompt 结构。"""
        provider = MockProvider()
        svc = TutorService(provider)
        svc.ask(_ctx(), "Explain backprop", mode="hint")
        prompt = provider.last_prompt
        assert prompt is not None
        assert prompt["metadata"]["mode"] == "hint"
        assert "Gradient Descent" in prompt["messages"][0]["content"]

    def test_build_prompt_only(self) -> None:
        """build_prompt_only 不调用 Provider。"""
        provider = MockProvider()
        svc = TutorService(provider)
        prompt = svc.build_prompt_only(_ctx(), "test")
        assert provider.call_count == 0
        assert "system" in prompt
        assert "messages" in prompt

    def test_mode_passthrough(self) -> None:
        """mode 正确传递到 prompt。"""
        provider = MockProvider()
        svc = TutorService(provider)
        for mode in ("explain", "hint", "review"):
            svc.ask(_ctx(), "test", mode=mode)
        assert provider.last_prompt is not None
        # 最后一次调用的 mode
        assert provider.last_prompt["metadata"]["mode"] == mode  # type: ignore[possibly-undefined]

    def test_ask_stream_concatenates_to_ask(self) -> None:
        """B2：``"".join(ask_stream) == ask``（流式拼装恒等于整段回答）。"""
        provider = MockProvider()
        svc = TutorService(provider)
        joined = "".join(svc.ask_stream(_ctx(), "What is gradient descent?"))
        assert joined == svc.ask(_ctx(), "What is gradient descent?")

    def test_ask_stream_yields_multiple_chunks(self) -> None:
        """默认回答足够长时产出多个增量块（真正流式而非单帧整段）。"""
        provider = MockProvider()
        svc = TutorService(provider)
        chunks = list(svc.ask_stream(_ctx(), "q"))
        assert len(chunks) > 1

    def test_ask_stream_prompt_recorded(self) -> None:
        """流式路径照常记录 prompt（供调试/审计）。"""
        provider = MockProvider()
        svc = TutorService(provider)
        list(svc.ask_stream(_ctx(), "Explain backprop", mode="hint"))
        assert provider.last_prompt is not None
        assert provider.last_prompt["metadata"]["mode"] == "hint"


# ── Error Handling Tests ───────────────────────────────────────────

class TestErrorHandling:

    def test_timeout_error(self) -> None:
        """Provider 超时 → ProviderTimeout。"""
        class TimeoutProvider:
            def complete(self, prompt: dict) -> str:
                raise TimeoutError("timed out")

        svc = TutorService(TimeoutProvider())  # type: ignore[arg-type]
        with pytest.raises(ProviderTimeout):
            svc.ask(_ctx(), "test")

    def test_generic_error(self) -> None:
        """Provider 其他错误 → ProviderError。"""
        class BadProvider:
            def complete(self, prompt: dict) -> str:
                raise RuntimeError("connection failed")

        svc = TutorService(BadProvider())  # type: ignore[arg-type]
        with pytest.raises(ProviderError):
            svc.ask(_ctx(), "test")

    def test_tutor_error_passthrough(self) -> None:
        """TutorError 直接传递，不包装。"""
        class CustomTutorError(TutorError):
            pass

        class FailProvider:
            def complete(self, prompt: dict) -> str:
                raise CustomTutorError()

        svc = TutorService(FailProvider())  # type: ignore[arg-type]
        with pytest.raises(CustomTutorError):
            svc.ask(_ctx(), "test")

    def test_ask_stream_timeout_maps_provider_timeout(self) -> None:
        """B2：流式中途 Provider 超时 → ProviderTimeout（与 ask 一致的错误映射）。"""
        class TimeoutStreamProvider:
            def stream(self, prompt: dict):
                raise TimeoutError("timed out")
                yield  # make it a generator

        svc = TutorService(TimeoutStreamProvider())  # type: ignore[arg-type]
        with pytest.raises(ProviderTimeout):
            list(svc.ask_stream(_ctx(), "test"))

    def test_ask_stream_generic_error_maps_provider_error(self) -> None:
        """B2：流式 Provider 其他错误 → ProviderError。"""
        class BadStreamProvider:
            def stream(self, prompt: dict):
                raise RuntimeError("boom")
                yield  # make it a generator

        svc = TutorService(BadStreamProvider())  # type: ignore[arg-type]
        with pytest.raises(ProviderError):
            list(svc.ask_stream(_ctx(), "test"))

    def test_error_does_not_leak_details(self) -> None:
        """错误消息不泄露 API key / 内部路径。"""
        provider = MockProvider()
        svc = TutorService(provider)
        try:
            svc.ask(_ctx(), "test")
        except TutorError as e:
            assert "sk-" not in e.user_message
            assert "api.openai.com" not in e.user_message
            assert "sqlite" not in e.user_message.lower()


# ── Provider Isolation Tests ───────────────────────────────────────

class TestProviderIsolation:

    def test_service_has_no_db_access(self) -> None:
        """service.py 不访问 SQLite。"""
        import inspect
        from app.core.ai import service
        source = inspect.getsource(service)
        assert "sqlite" not in source.lower()
        assert "connect(" not in source
        assert "execute(" not in source

    def test_service_has_no_network(self) -> None:
        """service.py 不直接调网络。"""
        import inspect
        from app.core.ai import service
        source = inspect.getsource(service)
        assert "requests" not in source
        assert "urllib" not in source
        assert "httpx" not in source
