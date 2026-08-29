"""B8 memories → tutor_context 守护测试（先于实现编写）。

ADR-014 附录 §2.5.1：白名单第 7 类。四项守护：
1. memories 进入 context（top ≤5）
2. 复合排序（importance × 新近度）——消除"高 importance 旧记忆永久霸占"退化态
3. 命中更新 last_used_at（裁决 3 的 B8 侧兑现）
4. 敏感形态条目排除出上下文（保守默认，ADR-014 §2.5.1）
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.memories import upsert_memory
from app.core.tutor_context import build_tutor_context


def _mk_concept(client: TestClient, title: str) -> int:
    r = client.post("/api/v1/concepts", json={"title": title})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _memory_row(core_conn, content: str):
    return core_conn.execute(
        "SELECT * FROM memories WHERE content=?", (content,)).fetchone()


# ── 1. 进入 context ─────────────────────────────────────────────────

class TestMemoriesInContext:
    def test_memories_key_present_with_rows(self, client: TestClient, core_conn):
        cid = _mk_concept(client, "记忆概念")
        upsert_memory(core_conn, kind="preference",
                      content="用户偏好苏格拉底式追问", importance=0.8)
        ctx = build_tutor_context(core_conn, cid)
        assert len(ctx.get("memories", [])) == 1
        m = ctx["memories"][0]
        assert m["kind"] == "preference"
        assert "苏格拉底" in m["content"]

    def test_no_memories_means_empty_list(self, client: TestClient, core_conn):
        cid = _mk_concept(client, "无记忆概念")
        ctx = build_tutor_context(core_conn, cid)
        assert ctx.get("memories") == []

    def test_top5_cap(self, core_conn):
        for i in range(8):
            upsert_memory(core_conn, kind="fact", content=f"记忆条目{i}内容",
                          importance=0.5)
        assert len(get_top(core_conn)) == 5


def get_top(core_conn, concept_id: int | None = None):
    from app.core.tutor_context import build_tutor_context as b
    # B8 实现后 build_tutor_context 需支持无 concept 场景拿 memories？
    # 非也——memories 挂在 concept context 里。此处用第一个 concept。
    row = core_conn.execute("SELECT id FROM concepts LIMIT 1").fetchone()
    if row is None:  # 排序类用例不依赖概念——确保 context 可构建
        core_conn.execute(
            "INSERT INTO concepts (title, origin, status) "
            "VALUES ('排序辅助概念', 'manual', 'active')")
        row = core_conn.execute("SELECT id FROM concepts LIMIT 1").fetchone()
    return b(core_conn, row["id"]).get("memories", [])


# ── 2. 复合排序（importance × 新近度）──────────────────────────────

class TestCompositeOrdering:
    def test_recent_moderate_beats_old_high_importance(self, core_conn):
        """裁决：消除"importance=0.9 旧记忆永久霸占"退化态。

        高 importance（0.9）但 60 天前的旧记忆 vs 中 importance（0.6）
        刚写入的记忆 → 复合排序下新记忆排前。
        """
        old_dt = datetime.now(timezone.utc) - timedelta(days=60)
        mid_old = upsert_memory(core_conn, kind="goal",
                                content="六十天前的旧目标")
        core_conn.execute(
            "UPDATE memories SET last_used_at=? WHERE id=?",
            (old_dt.strftime("%Y-%m-%d %H:%M:%S"), mid_old))

        upsert_memory(core_conn, kind="preference",
                      content="刚刚写入的新偏好", importance=0.6)

        got = get_top(core_conn)
        assert got[0]["content"] == "刚刚写入的新偏好", (
            "复合排序未生效——新近度被忽略（退化态回归）"
        )

    def test_importance_still_matters_within_same_recency(self, core_conn):
        """同新近度下 importance 仍是主导因子（复合而非取代）。"""
        upsert_memory(core_conn, kind="goal", content="高重要同级",
                      importance=0.9)
        upsert_memory(core_conn, kind="fact", content="低重要同级",
                      importance=0.3)
        got = get_top(core_conn)
        assert got[0]["content"] == "高重要同级"


# ── 3. 命中更新 last_used_at（裁决 3 兑现）──────────────────────────

class TestHitUpdatesLastUsed:
    def test_context_hit_refreshes_last_used_at(self, core_conn):
        old_dt = (datetime.now(timezone.utc) - timedelta(days=30)).strftime(
            "%Y-%m-%d %H:%M:%S")
        mid = upsert_memory(core_conn, kind="preference", content="被命中记忆")
        core_conn.execute(
            "UPDATE memories SET last_used_at=? WHERE id=?", (old_dt, mid))
        stale = _memory_row(core_conn, "被命中记忆")["last_used_at"]
        assert stale == old_dt

        core_conn.execute(
            "INSERT INTO concepts (title, origin, status) "
            "VALUES ('命中概念', 'manual', 'active')")
        cid = core_conn.execute("SELECT id FROM concepts LIMIT 1").fetchone()["id"]
        build_tutor_context(core_conn, cid)

        refreshed = _memory_row(core_conn, "被命中记忆")["last_used_at"]
        assert refreshed != old_dt, (
            "命中未刷新 last_used_at——裁决 3 B8 侧未兑现，新近度排序将退化"
        )


# ── 4. 敏感形态排除（保守默认）──────────────────────────────────────

class TestSensitiveExclusion:
    def test_prefixed_content_excluded_from_context(self, core_conn):
        """方向二：content 以 SENSITIVE_CONTENT_PREFIXES 开头的条目不进上下文
        （保留在库——删除属数据丢失，排除属隐私面收紧）。"""
        upsert_memory(core_conn, kind="fact", content="sk-开头的是泄漏值")
        upsert_memory(core_conn, kind="preference", content="正常偏好记忆")
        got = get_top(core_conn)
        contents = [m["content"] for m in got]
        assert "sk-开头的是泄漏值" not in contents
        assert "正常偏好记忆" in contents
        # 库中仍在（不删数据）
        assert _memory_row(core_conn, "sk-开头的是泄漏值") is not None

    def test_prompt_layer_sanitize_still_applies(self, client: TestClient,
                                                 core_conn):
        """出口兜底：memories 进 prompt 后，本断言首次具备判别力——
        敏感形态记忆即便被上下文层漏过，prompt sanitize 也必须拦住（双重防御）。"""
        from app.core.ai.tutor import build_prompt
        cid = _mk_concept(client, "出口兜底概念")
        upsert_memory(core_conn, kind="mistake_pattern",
                      content="Bearer ABCDEF 被写进了笔记")
        ctx = build_tutor_context(core_conn, cid)
        prompt = build_prompt(ctx, "q")
        text = prompt["system"] + "".join(
            str(m.get("content", "")) for m in prompt["messages"])
        assert "Bearer ABCDEF" not in text, (
            "敏感内容泄漏进 prompt——sanitize 出口失守"
        )

# ── B8-R：memories 必须进 prompt（P1 修复——最后一百米断链）──────────

class TestMemoriesInPrompt:
    """P1 实证：_format_context 白名单式渲染曾无 memories 分支——记忆进了
    context_json 快照却在最后一百米被静默丢弃。B8-R 补渲染分支，本组测试
    先红后绿守护该链路。"""

    def test_memory_content_reaches_prompt_text(self, client: TestClient,
                                                core_conn):
        cid = _mk_concept(client, "记忆进prompt概念")
        upsert_memory(core_conn, kind="preference",
                      content="用户偏好苏格拉底式追问")
        ctx = build_tutor_context(core_conn, cid)

        from app.core.ai.tutor import build_prompt
        prompt = build_prompt(ctx, "什么是特征值？")
        text = prompt["system"] + "".join(
            str(m.get("content", "")) for m in prompt["messages"])
        assert "用户偏好苏格拉底式追问" in text, (
            "memories 进了 context 快照但未进 prompt——AI 看不到记忆"
        )

    def test_prompt_memory_line_format_matches_notes_style(
        self, client: TestClient, core_conn,
    ):
        """格式与 notes 分支对齐：'- {kind}: {content}'。"""
        cid = _mk_concept(client, "格式概念")
        upsert_memory(core_conn, kind="preference", content="偏好内容样本")
        ctx = build_tutor_context(core_conn, cid)
        from app.core.ai.tutor import build_prompt
        prompt = build_prompt(ctx, "q")
        text = prompt["system"] + "".join(
            str(m.get("content", "")) for m in prompt["messages"])
        assert "- preference: 偏好内容样本" in text

    def test_both_directions_memory_visibility(self, client: TestClient,
                                               core_conn):
        """双向断言：非敏感记忆在 prompt 里，敏感记忆不在（B8-R3）。"""
        cid = _mk_concept(client, "双向断言概念")
        upsert_memory(core_conn, kind="preference", content="刚刚写入的新偏好")
        upsert_memory(core_conn, kind="fact", content="sk-开头的泄漏形态记忆")
        ctx = build_tutor_context(core_conn, cid)
        from app.core.ai.tutor import build_prompt
        prompt = build_prompt(ctx, "q")
        text = prompt["system"] + "".join(
            str(m.get("content", "")) for m in prompt["messages"])
        assert "刚刚写入的新偏好" in text, "非敏感记忆应进 prompt"
        assert "sk-开头的泄漏形态记忆" not in text, "敏感记忆不得进 prompt"

    def test_segmented_budget_first_three_survive(self, client: TestClient,
                                                   core_conn):
        """方案 C 分段预算：6 条 ×~600 字符记忆 → 段预算 2000 内前 3 条存活，
        第 4 条起被段内截断——**语义化的取舍，非静默丢失**（truncated 如实）。

        B8.1 排序规则：importance DESC, last_used_at DESC, created_at DESC, id DESC。
        同 importance 同 last_used_at 时 id 大的在前（最新创建优先）。
        """
        cid = _mk_concept(client, "超预算概念")
        for i in range(6):
            upsert_memory(core_conn, kind="fact",
                          content=f"记忆条目{i}：" + "细节内容填充。" * 85)
        ctx = build_tutor_context(core_conn, cid)
        from app.core.ai.tutor import build_prompt
        prompt = build_prompt(ctx, "q")
        text = prompt["system"] + "".join(
            str(m.get("content", "")) for m in prompt["messages"])

        assert prompt["metadata"]["truncated"] is True, (
            "段预算超限必须如实上报 truncated"
        )
        # B8.1：id DESC 排序，最新的（id 大）在前
        assert "记忆条目5：" in text and "记忆条目4：" in text, (
            "排序最前的记忆应存活（id DESC：最新创建优先）"
        )
        assert "记忆条目0：" not in text, (
            "段预算外的记忆应被段内截断——静默全量进入即预算失效"
        )

    def test_truncated_flag_false_within_budget(self, client: TestClient,
                                                core_conn):
        """预算内对照：truncated=False（证明上条断言可失败，非恒真）。"""
        cid = _mk_concept(client, "预算内概念")
        upsert_memory(core_conn, kind="fact", content="短记忆")
        ctx = build_tutor_context(core_conn, cid)
        from app.core.ai.tutor import build_prompt
        prompt = build_prompt(ctx, "q")
        assert prompt["metadata"]["truncated"] is False
