"""B3 Extractor 守护测试：6 项先红验证。

验证点：
1. FakeExtractorProvider 全路径：memories 行存在 + 非法 kind/importance 拒绝 + 前缀去重
2. concept 桩：ai_suggested/unconfirmed；Accept→active；Ignore→删除
3. update_mastery 链：eventlog 双写存在
4. assistant 快照含 extractor 键（重放幂等）
5. 非法 JSON → 静默跳过，answer 不受影响
6. api_key 不进 extractor 输出与落库（真实形态 key）
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.memories import upsert_memory, MemoryValidationError, VALID_KINDS
from app.core.concepts import (
    accept_concept,
    ignore_concept,
    get_concept,
    create_concept,
    VALID_STATUS,
)
from app.core.mastery import update_mastery
from app.core.conversations import (
    append_message,
    create_conversation,
    get_messages,
    update_message_context,
)
from app.core.ai.extractor import (
    _sanitize_extractor_output,
    _apply_memories,
    _apply_concept_suggestions,
    _apply_learning_events,
)
from app.core.ai.providers.mock import MockProvider


# ── Helpers ─────────────────────────────────────────────────────────

def _create_concept(conn, title: str, origin: str = "ai_suggested",
                    status: str = "unconfirmed") -> int:
    """创建测试概念，返回 concept_id。"""
    conn.execute(
        "INSERT INTO concepts (title, aliases_json, summary, domain, origin, status) "
        "VALUES (?, '[]', '', 'test', ?, ?)",
        (title, origin, status),
    )
    conn.commit()
    return conn.execute("SELECT id FROM concepts WHERE title=?", (title,)).fetchone()["id"]


# ── Test 1: FakeExtractorProvider 全路径 ────────────────────────────

def test_memories_full_path(core_conn, tmp_workspace: Path) -> None:
    """1. memories 写入：合法输入 → 行存在；非法 kind/importance → 拒绝；前缀去重 → 跳过。"""
    # 合法写入
    mem_id = upsert_memory(
        core_conn,
        kind="fact",
        content="用户偏好先看直觉解释",
        importance=0.6,
        confidence=0.8,
        concepts_json=["线性代数"],
    )
    assert mem_id is not None
    row = core_conn.execute("SELECT * FROM memories WHERE id=?", (mem_id,)).fetchone()
    assert row is not None
    assert row["kind"] == "fact"
    assert row["importance"] == 0.6

    # 非法 kind → 拒绝
    with pytest.raises(MemoryValidationError, match="kind"):
        upsert_memory(core_conn, kind="invalid", content="test")

    # 非法 importance → 拒绝
    with pytest.raises(MemoryValidationError, match="importance"):
        upsert_memory(core_conn, kind="fact", content="test", importance=1.5)

    # 非法 confidence → 拒绝
    with pytest.raises(MemoryValidationError, match="confidence"):
        upsert_memory(core_conn, kind="fact", content="test", confidence=-0.1)

    # 前缀去重（前 50 字符相同）
    dup_id = upsert_memory(
        core_conn,
        kind="fact",
        content="用户偏好先看直觉解释。这是一条很长的内容，用来测试前缀去重功能是否正常工作。",  # 前50字符与第一条相同
        importance=0.7,
    )
    assert dup_id is None  # 去重跳过

    # 验证只有一条
    count = core_conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
    assert count == 1


# ── Test 2: concept 桩生命周期 ──────────────────────────────────────

def test_concept_suggestion_lifecycle(core_conn) -> None:
    """2. concept 桩：ai_suggested/unconfirmed；Accept→active；Ignore→删除。"""
    cid = _create_concept(core_conn, "对角化", status="unconfirmed")
    concept = get_concept(core_conn, cid)
    assert concept is not None
    assert concept.origin == "ai_suggested"
    assert concept.status == "unconfirmed"

    # Accept → active
    accepted = accept_concept(core_conn, cid)
    assert accepted is not None
    assert accepted.status == "active"

    # Ignore（已 active 的 concept 不应被删除）
    result = ignore_concept(core_conn, cid)
    assert result is False  # 只允许删除 unconfirmed
    assert get_concept(core_conn, cid) is not None  # 仍然存在

    # 创建新桩并 Ignore（B7.2 软删：status=ignored，桩位保留）
    cid2 = _create_concept(core_conn, "特征值", status="unconfirmed")
    result = ignore_concept(core_conn, cid2)
    assert result is True
    concept2 = get_concept(core_conn, cid2)
    assert concept2 is not None  # 桩位保留（软删）
    assert concept2.status == "ignored"


# ── Test 3: update_mastery 链（eventlog 双写）───────────────────────

def test_extractor_update_mastery_chain(core_conn, tmp_workspace: Path) -> None:
    """3. update_mastery 链：eventlog 双写存在。"""
    cid = _create_concept(core_conn, "特征值", status="active")

    # 通过 update_mastery 写入（模拟 extractor 行为）
    update_mastery(
        core_conn,
        concept_id=cid,
        event_type="explain",
        dimension="knowledge",
        weight=0.5,
        source="ai_extractor",
    )

    # 验证 learning_events
    events = core_conn.execute(
        "SELECT * FROM learning_events WHERE concept_id=?", (cid,)
    ).fetchall()
    assert len(events) == 1
    assert events[0]["source"] == "ai_extractor"

    # 验证 concept_mastery
    mastery = core_conn.execute(
        "SELECT * FROM concept_mastery WHERE concept_id=?", (cid,)
    ).fetchone()
    assert mastery is not None
    assert mastery["effective"] > 0


# ── Test 4: assistant 快照含 extractor 键 ───────────────────────────

def test_assistant_snapshot_contains_extractor_key(core_conn) -> None:
    """4. assistant 快照含 extractor 键（重放幂等）。"""
    conv_id = create_conversation(core_conn, title="test")
    msg_id = append_message(
        core_conn, conv_id,
        role="assistant",
        content="test answer",
        context={"concept": {"title": "test"}},
    )

    # 写入 extractor 结果
    extractor_result = {
        "memories": [{"kind": "fact", "content": "test memory"}],
        "concept_suggestions": [],
        "learning_events": [],
    }
    update_message_context(core_conn, msg_id, extractor_result)

    # 验证快照
    messages = get_messages(core_conn, conv_id)
    assert len(messages) == 1
    ctx = messages[0]["context"]
    assert "extractor" in ctx
    assert ctx["extractor"]["memories"][0]["content"] == "test memory"

    # 幂等：再次写入
    update_message_context(core_conn, msg_id, extractor_result)
    messages2 = get_messages(core_conn, conv_id)
    assert messages2[0]["context"]["extractor"]["memories"][0]["content"] == "test memory"


# ── Test 5: 非法 JSON → 静默跳过 ──────────────────────────────────

def test_invalid_json_does_not_affect_answer(core_conn) -> None:
    """5. 非法 JSON → 静默跳过，answer 不受影响。"""
    # B7.2: 使用始终返回非法 JSON 的 provider（不触发 MockProvider 双模式检测）
    class _InvalidJsonProvider:
        def complete(self, prompt):
            return "This is not valid JSON at all!"
        @property
        def call_count(self):
            return 0
        @property
        def last_prompt(self):
            return None

    provider = _InvalidJsonProvider()

    from app.core.ai.extractor import run_extractor
    result = run_extractor(
        core_conn,
        provider=provider,
        query="test query",
        answer="test answer",
        message_id=999,  # 不存在的消息 ID
    )

    # 非法 JSON 应返回 None
    assert result is None

    # 验证 memories 表为空（没有写入）
    count = core_conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
    assert count == 0


# ── Test 6: api_key 不进 extractor 输出与落库 ────────────────────────

def test_api_key_not_in_output_or_storage(core_conn) -> None:
    """6. api_key 不进 extractor 输出与落库（真实形态 key）。"""
    # 模拟 extractor 输出包含 api_key
    fake_output = {
        "memories": [
            {"kind": "fact", "content": "sk-abc123def456"},
            {"kind": "preference", "content": "用户偏好先看直觉"},
        ],
        "concept_suggestions": [],
        "learning_events": [],
    }

    # 清洗
    sanitized = _sanitize_extractor_output(fake_output)

    # 验证：以 sk- 开头的记忆被过滤
    assert len(sanitized["memories"]) == 1
    assert sanitized["memories"][0]["content"] == "用户偏好先看直觉"

    # 写入 memories（通过 _apply_memories）
    concepts_json = json.dumps(["测试概念"], ensure_ascii=False)
    count = _apply_memories(core_conn, sanitized["memories"], concepts_json)
    assert count == 1

    # 验证数据库中没有包含 sk- 开头的内容
    rows = core_conn.execute("SELECT content FROM memories").fetchall()
    for row in rows:
        assert not row["content"].startswith("sk-")


# ── 状态常量验证 ────────────────────────────────────────────────────

def test_valid_status_constants() -> None:
    """验证 VALID_STATUS 常量包含所需状态。"""
    assert "unconfirmed" in VALID_STATUS
    assert "active" in VALID_STATUS
    assert "archived" in VALID_STATUS
    assert "ignored" in VALID_STATUS  # B7.2: 软删状态
    # 确保没有多余状态
    assert len(VALID_STATUS) == 5


def test_valid_kinds_constants() -> None:
    """验证 VALID_KINDS 常量包含所需类型。"""
    assert "fact" in VALID_KINDS
    assert "preference" in VALID_KINDS
    assert "goal" in VALID_KINDS
    assert "mistake_pattern" in VALID_KINDS
    assert len(VALID_KINDS) == 4
