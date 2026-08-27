"""Prompt Builder 单元测试（M4-B）。

纯函数测试：不依赖 TestClient，不访问 SQLite。
直接构造 TutorContext dict 验证 build_prompt() 输出。
"""
from __future__ import annotations

from app.core.ai.tutor import build_prompt, _sanitize_dict, _truncate
from app.core.tutor_types import TutorContext


# ── Fixtures ───────────────────────────────────────────────────────

def _minimal_context() -> TutorContext:
    """最小可用 context（空数据）。"""
    return TutorContext(
        mistakes=[],
        related=[],
        recent_events=[],
    )


def _full_context() -> TutorContext:
    """完整 context。"""
    return TutorContext(
        concept={"id": 1, "title": "冒泡排序"},
        mastery={
            "knowledge": 0.6, "practice": 0.35,
            "recall": 0.2, "transfer": 0.1,
            "effective": 0.37,
        },
        mistakes=[
            {"id": 1, "description": "时间复杂度算错", "occurred_at": "2026-08-27"},
        ],
        related=[
            {"id": 2, "title": "快速排序", "relation": "related"},
        ],
        review={"next_review": "2026-08-28", "priority": 0.8, "last_result": "wrong"},
        recent_events=[
            {"event_type": "answer_wrong", "source": "review", "created_at": "2026-08-27"},
        ],
    )


# ── Structure Tests ────────────────────────────────────────────────

def test_basic_prompt_structure() -> None:
    """返回 system / messages / metadata 三键。"""
    prompt = build_prompt(_minimal_context(), "什么是排序？")
    assert "system" in prompt
    assert "messages" in prompt
    assert "metadata" in prompt
    assert isinstance(prompt["messages"], list)
    assert len(prompt["messages"]) == 1
    assert prompt["messages"][0]["role"] == "user"


def test_metadata_fields() -> None:
    """metadata 包含 context_version / mode / truncated。"""
    prompt = build_prompt(_minimal_context(), "test")
    m = prompt["metadata"]
    assert m["context_version"] == "1"
    assert m["mode"] == "explain"
    assert m["truncated"] is False


# ── Mode Tests ─────────────────────────────────────────────────────

def test_mode_explain() -> None:
    """explain 模式 system prompt 含解释指令。"""
    prompt = build_prompt(_minimal_context(), "test", mode="explain")
    assert "explain" in prompt["system"].lower() or "Explain" in prompt["system"]


def test_mode_hint() -> None:
    """hint 模式 system prompt 含提示指令。"""
    prompt = build_prompt(_minimal_context(), "test", mode="hint")
    assert "hint" in prompt["system"].lower() or "hints" in prompt["system"].lower()


def test_mode_review() -> None:
    """review 模式 system prompt 含复习指令。"""
    prompt = build_prompt(_minimal_context(), "test", mode="review")
    assert "review" in prompt["system"].lower()


def test_mode_debug_fallback() -> None:
    """debug 自动 fallback 到 explain + metadata 记录。"""
    prompt = build_prompt(_minimal_context(), "test", mode="debug")
    assert prompt["metadata"]["mode"] == "explain"
    assert prompt["metadata"]["requested_mode"] == "debug"


# ── Context Injection Tests ────────────────────────────────────────

def test_context_injected_in_messages() -> None:
    """完整 context 内容注入到 messages 中。"""
    ctx = _full_context()
    prompt = build_prompt(ctx, "为什么时间复杂度是 O(n²)?")
    user_content = prompt["messages"][0]["content"]
    assert "冒泡排序" in user_content
    assert "0.60" in user_content  # mastery knowledge
    assert "时间复杂度算错" in user_content  # mistakes
    assert "快速排序" in user_content  # related


def test_empty_context_no_crash() -> None:
    """空 context 不报错。"""
    prompt = build_prompt(_minimal_context(), "test")
    assert len(prompt["messages"]) == 1
    assert "Question:" in prompt["messages"][0]["content"]


# ── Token Truncation Tests ─────────────────────────────────────────

def test_token_truncation() -> None:
    """超长 context 被截断。"""
    ctx = _minimal_context()
    long_query = "x" * 5000  # 超过 QUERY_CHAR_LIMIT (2000)
    prompt = build_prompt(ctx, long_query)
    assert prompt["metadata"]["truncated"] is True
    content = prompt["messages"][0]["content"]
    assert "[truncated]" in content


def test_no_truncation_when_short() -> None:
    """短 context 不截断。"""
    prompt = build_prompt(_minimal_context(), "short query")
    assert prompt["metadata"]["truncated"] is False


# ── Security Tests ─────────────────────────────────────────────────

def test_sensitive_field_removed() -> None:
    """敏感字段名被删除。"""
    tainted = _minimal_context()
    tainted["api_key"] = "sk-secret123"  # type: ignore[extra-allowed]
    prompt = build_prompt(tainted, "test")
    user_content = prompt["messages"][0]["content"]
    assert "sk-secret123" not in user_content
    assert "api_key" not in user_content


def test_sensitive_content_redacted() -> None:
    """敏感内容前缀被替换为 [REDACTED]。"""
    ctx = _minimal_context()
    ctx["concept"] = {"id": 1, "title": "sk-xxxxx-api-key"}  # type: ignore[assignment]
    prompt = build_prompt(ctx, "test")
    user_content = prompt["messages"][0]["content"]
    assert "sk-xxxxx" not in user_content
    assert "[REDACTED]" in user_content


def test_normal_content_preserved() -> None:
    """正常知识内容不被误删。"""
    ctx = _minimal_context()
    ctx["concept"] = {"id": 1, "title": "token bucket algorithm"}  # type: ignore[assignment]
    prompt = build_prompt(ctx, "test")
    user_content = prompt["messages"][0]["content"]
    assert "token bucket algorithm" in user_content


# ── Sanitize Dict Tests ────────────────────────────────────────────

def test_sanitize_nested_dict() -> None:
    """递归过滤嵌套 dict。"""
    data = {
        "user": {"name": "test", "api_key": "sk-abc"},
        "token": "should-be-deleted",
        "safe": "keep",
    }
    result = _sanitize_dict(data)
    assert "api_key" not in result["user"]
    assert result["user"]["name"] == "test"
    assert "token" not in result
    assert result["safe"] == "keep"


def test_truncate_function() -> None:
    """_truncate 函数正确截断。"""
    text = "a" * 100
    result, truncated = _truncate(text, 50)
    assert len(result) == 50 + len("\n...[truncated]")
    assert truncated is True

    result2, truncated2 = _truncate(text, 200)
    assert result2 == text
    assert truncated2 is False
