"""Gate 1 AI Boundary Audit 测试（M4-C 前置）。

验证 AI Tutor 架构边界：
  G1-01 Context Isolation — 敏感数据不进入 prompt
  G1-02 Prompt Purity — build_prompt() 是纯函数
  G1-03 LLM Write Boundary — LLM 无写权限
  G1-04 Provider Isolation — 无 LLM 厂商绑定
  G1-05 Multilingual Boundary — 语言契约不破坏
  G1-06 Test Coverage — 边界测试覆盖
"""
from __future__ import annotations

import ast
import inspect
import os
from pathlib import Path

from app.core.ai.tutor import build_prompt, _sanitize_dict, _sanitize_value
from app.core.tutor_types import TutorContext


# ── G1-01: Context Isolation ───────────────────────────────────────

class TestContextIsolation:
    """敏感数据不进入 prompt。"""

    def _prompt_text(self, ctx: TutorContext, query: str = "test") -> str:
        p = build_prompt(ctx, query)
        return p["system"] + " ".join(m["content"] for m in p["messages"])

    def test_api_key_filtered(self) -> None:
        ctx = TutorContext(mistakes=[], related=[], recent_events=[],
                           api_key="sk-super-secret-123")  # type: ignore[extra-allowed]
        text = self._prompt_text(ctx)
        assert "sk-super-secret" not in text
        assert "api_key" not in text

    def test_password_filtered(self) -> None:
        ctx = TutorContext(mistakes=[], related=[], recent_events=[],
                           password="hunter2")  # type: ignore[extra-allowed]
        text = self._prompt_text(ctx)
        assert "hunter2" not in text

    def test_sqlite_path_not_in_context(self) -> None:
        """SQLite 路径不会出现在 context 中（context builder 不暴露）。"""
        ctx = TutorContext(
            concept={"id": 1, "title": "test"},
            mistakes=[], related=[], recent_events=[],
        )
        text = self._prompt_text(ctx)
        assert ".db" not in text
        assert "sqlite" not in text.lower()
        assert "workspace" not in text.lower()

    def test_secret_content_prefix_redacted(self) -> None:
        ctx = TutorContext(
            concept={"id": 1, "title": "sk-xxxx-openai-key"},
            mistakes=[], related=[], recent_events=[],
        )
        text = self._prompt_text(ctx)
        assert "sk-xxxx" not in text
        assert "[REDACTED]" in text

    def test_bearer_token_filtered(self) -> None:
        ctx = TutorContext(
            concept={"id": 1, "title": "Bearer abc123"},
            mistakes=[], related=[], recent_events=[],
        )
        text = self._prompt_text(ctx)
        assert "Bearer abc123" not in text

    def test_normal_content_preserved(self) -> None:
        """正常知识内容不被误删。"""
        ctx = TutorContext(
            concept={"id": 1, "title": "token bucket algorithm"},
            mistakes=[], related=[], recent_events=[],
        )
        text = self._prompt_text(ctx)
        assert "token bucket algorithm" in text

    def test_ghp_token_filtered(self) -> None:
        ctx = TutorContext(
            concept={"id": 1, "title": "ghp_abcdef123456"},
            mistakes=[], related=[], recent_events=[],
        )
        text = self._prompt_text(ctx)
        assert "ghp_abcdef" not in text


# ── G1-02: Prompt Purity ──────────────────────────────────────────

class TestPromptPurity:
    """build_prompt() 是纯函数，无副作用。"""

    def _get_func_source(self) -> str:
        from app.core.ai.tutor import build_prompt
        return inspect.getsource(build_prompt)

    def test_no_file_io(self) -> None:
        src = self._get_func_source()
        assert "open(" not in src
        assert "Path(" not in src

    def test_no_sqlite(self) -> None:
        src = self._get_func_source()
        assert "sqlite" not in src.lower()
        assert "connect(" not in src

    def test_no_network(self) -> None:
        src = self._get_func_source()
        assert "requests" not in src
        assert "urllib" not in src
        assert "httpx" not in src

    def test_no_datetime(self) -> None:
        """纯函数不应依赖当前时间。"""
        src = self._get_func_source()
        assert "datetime.now" not in src

    def test_deterministic(self) -> None:
        """同输入 → 同输出。"""
        ctx = TutorContext(
            concept={"id": 1, "title": "test"},
            mastery={"knowledge": 0.5, "practice": 0.3, "recall": 0.2, "transfer": 0.1, "effective": 0.32},
            mistakes=[], related=[], recent_events=[],
        )
        p1 = build_prompt(ctx, "hello", mode="explain")
        p2 = build_prompt(ctx, "hello", mode="explain")
        assert p1 == p2

    def test_no_imports_forbidden_modules(self) -> None:
        """模块级别无禁止导入。"""
        from app.core.ai import tutor
        source = inspect.getsource(tutor)
        tree = ast.parse(source)
        forbidden = {"sqlite3", "requests", "httpx", "urllib", "aiohttp"}
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert alias.name.split(".")[0] not in forbidden, \
                        f"forbidden import: {alias.name}"
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    assert node.module.split(".")[0] not in forbidden, \
                        f"forbidden import: {node.module}"


# ── G1-03: LLM Write Boundary ─────────────────────────────────────

class TestLLMWriteBoundary:
    """确认 ai/tutor.py 无写操作。"""

    def test_no_execute(self) -> None:
        from app.core.ai import tutor
        source = inspect.getsource(tutor)
        assert ".execute(" not in source
        assert ".executescript(" not in source

    def test_no_insert(self) -> None:
        from app.core.ai import tutor
        source = inspect.getsource(tutor)
        assert "INSERT" not in source
        assert "UPDATE" not in source
        assert "DELETE" not in source

    def test_no_commit(self) -> None:
        from app.core.ai import tutor
        source = inspect.getsource(tutor)
        assert ".commit(" not in source


# ── G1-04: Provider Isolation ─────────────────────────────────────

class TestProviderIsolation:
    """无 LLM 厂商绑定。"""

    def test_no_openai_import(self) -> None:
        from app.core.ai import tutor
        source = inspect.getsource(tutor)
        assert "openai" not in source.lower()

    def test_no_ollama_import(self) -> None:
        from app.core.ai import tutor
        source = inspect.getsource(tutor)
        assert "ollama" not in source.lower()

    def test_no_model_name(self) -> None:
        """不硬编码模型名。"""
        from app.core.ai import tutor
        source = inspect.getsource(tutor)
        assert "gpt-" not in source.lower()
        assert "claude" not in source.lower()
        assert "llama" not in source.lower()


# ── G1-05: Multilingual Boundary ──────────────────────────────────

class TestMultilingualBoundary:
    """语言契约不破坏。"""

    def test_prompt_not_language_specific(self) -> None:
        """system prompt 不假设特定语言。"""
        ctx = TutorContext(
            concept={"id": 1, "title": "Backpropagation"},
            mistakes=[], related=[], recent_events=[],
        )
        p_en = build_prompt(ctx, "What is this?", mode="explain")
        p_zh = build_prompt(ctx, "这是什么？", mode="explain")
        # 同一 system prompt（不因 query 语言改变）
        assert p_en["system"] == p_zh["system"]

    def test_metadata_extensible(self) -> None:
        """metadata 是 dict，可扩展。"""
        p = build_prompt(TutorContext(mistakes=[], related=[], recent_events=[]), "test")
        assert isinstance(p["metadata"], dict)


# ── G1-06: Truncation & Edge Cases ────────────────────────────────

class TestEdgeCases:
    """边界情况。"""

    def test_massive_context_truncated(self) -> None:
        """100k+ 字符 context 被截断。"""
        huge_text = "x" * 100000
        ctx = TutorContext(
            concept={"id": 1, "title": huge_text},
            mistakes=[], related=[], recent_events=[],
        )
        p = build_prompt(ctx, "test")
        assert p["metadata"]["truncated"] is True

    def test_empty_concept(self) -> None:
        """concept 为空时不崩溃。"""
        ctx = TutorContext(mistakes=[], related=[], recent_events=[])
        p = build_prompt(ctx, "test")
        assert len(p["messages"]) == 1

    def test_debug_fallback(self) -> None:
        """debug → explain fallback。"""
        ctx = TutorContext(mistakes=[], related=[], recent_events=[])
        p = build_prompt(ctx, "test", mode="debug")
        assert p["metadata"]["mode"] == "explain"
        assert p["metadata"]["requested_mode"] == "debug"

    def test_all_modes_produce_valid_output(self) -> None:
        """所有 mode 都能正常输出。"""
        ctx = TutorContext(mistakes=[], related=[], recent_events=[])
        for mode in ("explain", "hint", "review", "debug"):
            p = build_prompt(ctx, "test", mode=mode)
            assert "system" in p
            assert "messages" in p
            assert len(p["messages"]) == 1
