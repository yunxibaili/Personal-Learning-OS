"""B28：memories 管理面守护（列出 / 读取 / 改写 / 删除）。

守护重点：
1. **两通道语义差**（B28 冻结）：管理面全量可见，消费面过滤敏感前缀。
   管理面若跟着过滤，`sk-` 记忆会变成用户看不见、删不掉的暗账。
2. **改写路径不静默**：upsert 去重是无人值守的 AI 提取，跳过即可；
   update 是用户显式操作，必须抛 DuplicateMemoryError 而非静默无变化。
3. **校验同源**：update 与 upsert 共用同一套校验，不允许各自实现一遍。
"""
from __future__ import annotations

import pytest

from app.core.memories import (
    DuplicateMemoryError,
    InvalidMemoryError,
    MemoryValidationError,
    delete_memory,
    get_memories,
    get_memory,
    list_memories,
    update_memory,
    upsert_memory,
)


def _count(conn) -> int:
    return conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]


class TestListMemories:
    def test_empty(self, core_conn):
        got = list_memories(core_conn)
        assert got["memories"] == []
        assert got["total"] == 0

    def test_concepts_parsed(self, core_conn):
        upsert_memory(core_conn, kind="fact", content="特征值相关记忆",
                      concepts_json=["特征值"])
        got = list_memories(core_conn)
        assert got["memories"][0]["concepts"] == ["特征值"]

    def test_kind_filter(self, core_conn):
        upsert_memory(core_conn, kind="fact", content="事实类记忆")
        upsert_memory(core_conn, kind="goal", content="目标类记忆")
        got = list_memories(core_conn, kind="goal")
        assert got["total"] == 1
        assert got["memories"][0]["content"] == "目标类记忆"

    def test_invalid_kind_rejected(self, core_conn):
        with pytest.raises(MemoryValidationError):
            list_memories(core_conn, kind="rumor")

    def test_pagination_total_is_pre_slice(self, core_conn):
        """total 必须是过滤后总数，不是当页条数（否则前端分页算不出页数）。"""
        for i in range(5):
            upsert_memory(core_conn, kind="fact", content=f"记忆条目{i}")
        page1 = list_memories(core_conn, limit=2, offset=0)
        assert len(page1["memories"]) == 2
        assert page1["total"] == 5
        page_last = list_memories(core_conn, limit=2, offset=4)
        assert len(page_last["memories"]) == 1

    def test_ordered_by_created_desc(self, core_conn):
        """管理面按「最近提取的在前」——与消费面的 importance 排序有意不同。"""
        upsert_memory(core_conn, kind="fact", content="先写入的记忆")
        upsert_memory(core_conn, kind="fact", content="后写入的记忆")
        # 同秒写入时 created_at 相同，退化为 id DESC，仍应是后写入在前
        got = list_memories(core_conn)
        assert got["memories"][0]["content"] == "后写入的记忆"


class TestTwoChannels:
    """B28 冻结：管理面与消费面对敏感前缀的处理必须相反。"""

    def test_admin_sees_sensitive_but_consumer_does_not(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="sk-abc123 是我的密钥")
        assert mid is not None

        # 消费面（进 prompt）：过滤
        assert get_memories(core_conn, limit=10) == []
        # 管理面（给用户看/删）：全量可见
        got = list_memories(core_conn)
        assert got["total"] == 1
        assert got["memories"][0]["content"] == "sk-abc123 是我的密钥"

    def test_sensitive_memory_is_deletable(self, core_conn):
        """可见性的目的就是可删除：这条路径不通，暗账就成立。"""
        mid = upsert_memory(core_conn, kind="fact", content="Bearer tok-xxx 泄漏了")
        assert get_memory(core_conn, mid) is not None
        assert delete_memory(core_conn, mid) is True
        assert get_memory(core_conn, mid) is None


class TestGetMemory:
    def test_found(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="单条读取测试")
        got = get_memory(core_conn, mid)
        assert got is not None
        assert got["id"] == mid
        assert got["content"] == "单条读取测试"

    def test_missing_returns_none(self, core_conn):
        assert get_memory(core_conn, 999999) is None


class TestUpdateMemory:
    def test_update_content(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="改写前内容")
        got = update_memory(core_conn, mid, content="改写后内容")
        assert got["content"] == "改写后内容"

    def test_partial_update_leaves_other_fields(self, core_conn):
        mid = upsert_memory(core_conn, kind="goal", content="部分更新测试",
                            importance=0.3, confidence=0.8)
        got = update_memory(core_conn, mid, importance=0.9)
        assert got["importance"] == 0.9
        assert got["confidence"] == 0.8  # 未传不得被重置
        assert got["kind"] == "goal"
        assert got["content"] == "部分更新测试"

    def test_update_kind(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="改类型测试")
        assert update_memory(core_conn, mid, kind="preference")["kind"] == "preference"

    def test_update_concepts(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="改概念测试",
                            concepts_json=["旧概念"])
        got = update_memory(core_conn, mid, concepts_json=["新概念A", "新概念B"])
        assert got["concepts"] == ["新概念A", "新概念B"]

    def test_updated_at_refreshed(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="时间戳测试")
        before = get_memory(core_conn, mid)["updated_at"]
        core_conn.execute(
            "UPDATE memories SET updated_at='2020-01-01 00:00:00' WHERE id=?", (mid,)
        )
        core_conn.commit()
        got = update_memory(core_conn, mid, importance=0.7)
        assert before is not None
        assert got["updated_at"] != "2020-01-01 00:00:00"

    def test_missing_returns_none(self, core_conn):
        assert update_memory(core_conn, 999999, content="x") is None

    def test_row_count_unchanged(self, core_conn):
        """改写不是新增——误写成 INSERT 会让每次编辑都多一条记忆。"""
        mid = upsert_memory(core_conn, kind="fact", content="计数测试")
        update_memory(core_conn, mid, content="计数测试改写后")
        assert _count(core_conn) == 1


class TestUpdateValidation:
    """校验同源：与 upsert 抛同一批异常类型。"""

    def test_invalid_kind_rejected(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="非法类型测试")
        with pytest.raises(MemoryValidationError):
            update_memory(core_conn, mid, kind="rumor")

    def test_importance_out_of_range_rejected(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="越界重要性测试")
        with pytest.raises(MemoryValidationError):
            update_memory(core_conn, mid, importance=1.5)

    def test_negative_confidence_rejected(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="负置信度测试")
        with pytest.raises(MemoryValidationError):
            update_memory(core_conn, mid, confidence=-0.1)

    def test_empty_content_rejected(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="空内容测试")
        with pytest.raises(InvalidMemoryError):
            update_memory(core_conn, mid, content="   ")

    def test_failed_update_persists_nothing(self, core_conn):
        """校验失败必须不落库——不能有半写的中间态。"""
        mid = upsert_memory(core_conn, kind="fact", content="原子性测试",
                            importance=0.4)
        with pytest.raises(MemoryValidationError):
            update_memory(core_conn, mid, content="已改成的内容", importance=9.9)
        got = get_memory(core_conn, mid)
        assert got["content"] == "原子性测试"
        assert got["importance"] == 0.4


class TestUpdateDuplicate:
    def test_duplicate_content_raises(self, core_conn):
        """用户显式改写撞车必须报错，不能静默无变化。"""
        upsert_memory(core_conn, kind="fact", content="重复前缀内容A")

        # 绕过 upsert 的去重，直接插入第二条（模拟已存在的历史数据）
        core_conn.execute(
            "INSERT INTO memories (kind, content, importance, confidence, concepts_json)"
            " VALUES ('fact', '重复前缀内容B', 0.5, 0.5, '[]')"
        )
        core_conn.commit()
        mid_b = core_conn.execute(
            "SELECT id FROM memories WHERE content='重复前缀内容B'"
        ).fetchone()["id"]

        with pytest.raises(DuplicateMemoryError):
            update_memory(core_conn, mid_b, content="重复前缀内容A")

    def test_updating_to_itself_is_not_duplicate(self, core_conn):
        """改自己必须是幂等的——排除自身，否则用户改 importance 都改不动。"""
        mid = upsert_memory(core_conn, kind="fact", content="自我更新测试")
        got = update_memory(core_conn, mid, content="自我更新测试", importance=0.9)
        assert got["importance"] == 0.9

    def test_duplicate_raises_before_write(self, core_conn):
        upsert_memory(core_conn, kind="fact", content="冲突落库测试A")
        core_conn.execute(
            "INSERT INTO memories (kind, content, importance, confidence, concepts_json)"
            " VALUES ('fact', '冲突落库测试B', 0.5, 0.5, '[]')"
        )
        core_conn.commit()
        mid_b = core_conn.execute(
            "SELECT id FROM memories WHERE content='冲突落库测试B'"
        ).fetchone()["id"]

        with pytest.raises(DuplicateMemoryError):
            update_memory(core_conn, mid_b, content="冲突落库测试A")
        assert get_memory(core_conn, mid_b)["content"] == "冲突落库测试B"


class TestDeleteMemory:
    def test_delete_existing(self, core_conn):
        mid = upsert_memory(core_conn, kind="fact", content="待删除记忆")
        assert delete_memory(core_conn, mid) is True
        assert get_memory(core_conn, mid) is None
        assert _count(core_conn) == 0

    def test_delete_missing_returns_false(self, core_conn):
        assert delete_memory(core_conn, 999999) is False

    def test_delete_only_target(self, core_conn):
        keep = upsert_memory(core_conn, kind="fact", content="保留的记忆")
        drop = upsert_memory(core_conn, kind="fact", content="删除的记忆")
        delete_memory(core_conn, drop)
        assert get_memory(core_conn, keep) is not None
        assert _count(core_conn) == 1
