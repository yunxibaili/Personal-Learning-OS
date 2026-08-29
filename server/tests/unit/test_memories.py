"""B3-R1：memories core 守护（排序/去重反向/api_key 边界）。

补充 B3 首轮遗漏——原文件 0 字节入库，get_memories 曾零测试。
"""
from __future__ import annotations

import pytest

from app.core.memories import (
    InvalidMemoryError,
    get_memories,
    upsert_memory,
)


class TestGetMemories:
    def test_sorted_by_importance_desc(self, core_conn):
        upsert_memory(core_conn, kind="fact", content="低重要性",
                      importance=0.2, confidence=0.5)
        upsert_memory(core_conn, kind="goal", content="高重要性目标",
                      importance=0.9, confidence=0.5)
        got = get_memories(core_conn, limit=5)
        assert [m["content"] for m in got][0] == "高重要性目标"

    def test_recency_tie_breaker(self, core_conn):
        """B8.1：同 importance 时按 last_used_at DESC 排序。"""
        upsert_memory(core_conn, kind="fact", content="旧记忆",
                      importance=0.5, confidence=0.5)
        upsert_memory(core_conn, kind="fact", content="新记忆",
                      importance=0.5, confidence=0.5)
        # 手动设置 last_used_at 差异
        core_conn.execute(
            "UPDATE memories SET last_used_at='2025-01-01T00:00:00' "
            "WHERE content='旧记忆'"
        )
        core_conn.execute(
            "UPDATE memories SET last_used_at='2025-06-01T00:00:00' "
            "WHERE content='新记忆'"
        )
        core_conn.commit()
        got = get_memories(core_conn, limit=5)
        assert got[0]["content"] == "新记忆"
        assert got[1]["content"] == "旧记忆"

    def test_deterministic_tie_breaker(self, core_conn):
        """B8.1：同 importance + 同 last_used_at 时按 created_at DESC。"""
        upsert_memory(core_conn, kind="fact", content="先创建",
                      importance=0.5, confidence=0.5)
        upsert_memory(core_conn, kind="fact", content="后创建",
                      importance=0.5, confidence=0.5)
        # 统一 last_used_at
        core_conn.execute(
            "UPDATE memories SET last_used_at='2025-01-01T00:00:00'"
        )
        core_conn.commit()
        got = get_memories(core_conn, limit=5)
        # 后创建的 id 更大，应排在前面
        assert got[0]["content"] == "后创建"
        assert got[1]["content"] == "先创建"

    def test_touch_on_hit_updates_last_used_at(self, core_conn):
        """B8.1：touch_on_hit=True 时刷新 last_used_at。"""
        upsert_memory(core_conn, kind="fact", content="可刷新记忆",
                      importance=0.5, confidence=0.5)
        # 固定原始时间
        core_conn.execute(
            "UPDATE memories SET last_used_at='2025-01-01T00:00:00'"
        )
        core_conn.commit()

        got = get_memories(core_conn, limit=1, touch_on_hit=True)
        assert len(got) == 1

        # 验证 last_used_at 已更新
        row = core_conn.execute(
            "SELECT last_used_at FROM memories WHERE content='可刷新记忆'"
        ).fetchone()
        assert row["last_used_at"] != "2025-01-01T00:00:00"

    def test_limit(self, core_conn):
        for i in range(7):
            upsert_memory(core_conn, kind="fact", content=f"记忆条目{i}内容",
                          importance=0.4 + i * 0.01)
        assert len(get_memories(core_conn, limit=3)) == 3

    def test_concepts_json_parsed(self, core_conn):
        upsert_memory(core_conn, kind="fact", content="带概念关联的记忆",
                      concepts_json='["特征值"]')
        m = get_memories(core_conn, limit=1)[0]
        assert m["concepts"] == ["特征值"]

    def test_last_used_at_set_on_write(self, core_conn):
        """裁决 3：写入时即置 last_used_at；命中更新路径归 B8（当前不存在）。"""
        upsert_memory(core_conn, kind="fact", content="近期写入")
        m = get_memories(core_conn, limit=1)[0]
        assert m["last_used_at"] is not None


class TestDedupReverse:
    def test_different_content_not_deduped(self, core_conn):
        """反向：不同内容不得被误杀（去重只针对真实前缀重叠）。"""
        upsert_memory(core_conn, kind="fact", content="偏好先看直觉类比再看证明步骤")
        r2 = upsert_memory(core_conn, kind="fact",
                           content="偏好从定义出发的严格推导路径")
        assert r2 is not None  # 前缀不同 → 两条都保留
        n = core_conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
        assert n == 2

    def test_empty_content_rejected(self, core_conn):
        with pytest.raises(InvalidMemoryError):
            upsert_memory(core_conn, kind="fact", content="   ")


class TestSensitiveContent:
    def test_sensitive_shaped_content_is_stored_as_data(self, core_conn):
        """记忆内容即用户数据：upsert 不做内容脱敏（脱敏归导出/上下文层守护）。
        注意：此类内容 B8 接入后会进 LLM prompt——接入时需复评。"""
        mid = upsert_memory(core_conn, kind="mistake_pattern",
                            content="曾把 Bearer token 当普通字符串泄漏在笔记里")
        assert mid > 0
