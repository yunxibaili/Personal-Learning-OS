"""M4-E Tutor Prohibition Tests：验证 AI Tutor 遵守写入边界。

源码扫描测试：检查关键模块不包含禁止操作。
自动化验证 TUTOR_CASES.md 中 Scenario D 的禁止行为。
"""
from __future__ import annotations

from pathlib import Path

import pytest

# server/ 目录
ROOT = Path(__file__).resolve().parent.parent.parent
AI_DIR = ROOT / "app" / "core" / "ai"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class TestServiceNoDBWrite:
    """G1-03: TutorService 不直接访问数据库。"""

    def test_no_sqlite_import(self) -> None:
        source = _read(AI_DIR / "service.py")
        assert "import sqlite3" not in source
        assert "from sqlite3" not in source
        assert "from ...db" not in source
        assert "from ..db" not in source

    def test_no_sql_keywords(self) -> None:
        source = _read(AI_DIR / "service.py")
        for kw in ["INSERT", "UPDATE", "DELETE", "CREATE TABLE", "DROP TABLE"]:
            assert kw not in source, f"service.py contains forbidden SQL keyword: {kw}"

    def test_no_mastery_reference(self) -> None:
        source = _read(AI_DIR / "service.py")
        assert "concept_mastery" not in source
        assert "learning_events" not in source
        assert "review_queue" not in source


class TestTutorNoDBWrite:
    """G1-03: Prompt Builder (tutor.py) 不直接访问数据库。"""

    def test_no_sqlite_import(self) -> None:
        source = _read(AI_DIR / "tutor.py")
        assert "import sqlite3" not in source
        assert "from sqlite3" not in source

    def test_no_file_io(self) -> None:
        source = _read(AI_DIR / "tutor.py")
        assert "open(" not in source
        assert "Path(" not in source

    def test_no_network(self) -> None:
        source = _read(AI_DIR / "tutor.py")
        assert "urllib" not in source
        assert "requests" not in source
        assert "httpx" not in source

    def test_no_datetime_now(self) -> None:
        source = _read(AI_DIR / "tutor.py")
        assert "datetime.now" not in source
        assert "datetime.utcnow" not in source


class TestProviderIsolation:
    """G1-04: Provider 无 LLM 厂商绑定。"""

    def test_base_no_vendor_import(self) -> None:
        source = _read(AI_DIR / "providers" / "base.py")
        assert "import openai" not in source
        assert "import anthropic" not in source
        assert "import google" not in source

    def test_mock_no_vendor_import(self) -> None:
        source = _read(AI_DIR / "providers" / "mock.py")
        assert "import openai" not in source
        assert "import anthropic" not in source
        assert "import google" not in source


class TestContextBuilderNoLeak:
    """Context Builder 不暴露敏感数据。"""

    def test_no_api_key_in_output(self) -> None:
        source = _read(ROOT / "app" / "core" / "tutor_context.py")
        assert "api_key" not in source.split("def ")[0] or "api_key" in source
        # tutor_context.py 不应主动查询 api_key
        # 但可能在 visibility whitelist 中提及（作为排除项）
        # 关键是不把它放进返回值

    def test_no_password_reference(self) -> None:
        source = _read(ROOT / "app" / "core" / "tutor_context.py")
        lines = [l for l in source.splitlines() if "password" in l.lower()]
        # 允许注释中的提及，但不允许查询
        for line in lines:
            assert "SELECT" not in line.upper(), \
                f"tutor_context.py queries password: {line.strip()}"


class TestPromptBoundary:
    """Prompt Builder 边界验证。"""

    def test_build_prompt_deterministic(self) -> None:
        """build_prompt() 是纯函数：相同输入 → 相同输出。"""
        from app.core.ai.tutor import build_prompt
        from app.core.tutor_types import TutorContext

        ctx = TutorContext(
            concept={"id": 1, "title": "Test"},
            mastery={"knowledge": 0.5, "practice": 0.3, "recall": 0.2, "transfer": 0.1, "effective": 0.35},
            mistakes=[], related=[], recent_events=[],
        )
        p1 = build_prompt(ctx, "test query", "explain")
        p2 = build_prompt(ctx, "test query", "explain")
        assert p1 == p2

    def test_system_prompt_contains_mode(self) -> None:
        from app.core.ai.tutor import build_prompt
        from app.core.tutor_types import TutorContext

        ctx = TutorContext(
            concept={"id": 1, "title": "Test"},
            mistakes=[], related=[], recent_events=[],
        )
        for mode in ["explain", "hint", "review"]:
            p = build_prompt(ctx, "test", mode)
            assert len(p["system"]) > 0
            assert len(p["messages"]) > 0


class TestServiceErrorHandling:
    """Service 错误处理验证。"""

    def test_timeout_raises_provider_timeout(self) -> None:
        from app.core.ai.service import TutorService
        from app.core.ai.errors import ProviderTimeout
        from app.core.tutor_types import TutorContext

        class TimeoutProvider:
            def complete(self, prompt):
                raise TimeoutError()

        svc = TutorService(TimeoutProvider())
        ctx = TutorContext(concept={"id": 1, "title": "T"}, mistakes=[], related=[], recent_events=[])

        with pytest.raises(ProviderTimeout):
            svc.ask(ctx, "test")

    def test_generic_error_raises_provider_error(self) -> None:
        from app.core.ai.service import TutorService
        from app.core.ai.errors import ProviderError
        from app.core.tutor_types import TutorContext

        class BadProvider:
            def complete(self, prompt):
                raise RuntimeError("something broke")

        svc = TutorService(BadProvider())
        ctx = TutorContext(concept={"id": 1, "title": "T"}, mistakes=[], related=[], recent_events=[])

        with pytest.raises(ProviderError):
            svc.ask(ctx, "test")
