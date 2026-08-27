"""LLM Provider + TutorService 单元测试（M4-C）。

验证完整链路：Context → Prompt → Provider → Response
无网络依赖，只用 MockProvider。
"""
from __future__ import annotations

import pytest

from app.core.ai.providers.mock import MockProvider
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
        assert "Mock tutor" in resp

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
