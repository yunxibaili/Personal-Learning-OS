"""Vault Rebuild Test（GPT 评审建议 · 2026-09-01）。

验证核心架构不变量：Markdown = 唯一事实源。

流程：
  1. 创建 vault（多个笔记 + parent 关系 + wikilink + tags）
  2. reindex → 写入 SQLite
  3. 快照逻辑状态（notes / links / hierarchy / FTS）
  4. 删除 SQLite
  5. 从 vault 重建 SQLite（reindex）
  6. 断言逻辑状态一致

如果这条测试稳定通过：
  Markdown-is-truth 原则就不只是文档里的口号，而是被自动验证的架构不变量。
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import pytest

from app.core import knowledge as K
from app.core.hierarchy import resolve_hierarchy
from app.core.reindex import reindex_vault
from app.db import connect, db_path, init_db, migrate


# ── 辅助函数 ───────────────────────────────────────────────

def _write_note(vault: Path, name: str, body: str, meta: dict | None = None) -> None:
    """写一个 .md 文件到 vault。"""
    content = K.compose_file(meta or {}, body)
    (vault / f"{name}.md").write_text(content, encoding="utf-8")


def _snapshot_state(conn) -> dict:
    """快照当前 SQLite 的逻辑状态（用于断言重建后一致）。"""
    # 1. notes
    notes = {}
    for r in conn.execute("SELECT id, path, title, tags_json FROM notes ORDER BY id"):
        notes[r["title"]] = {
            "path": r["path"],
            "tags": json.loads(r["tags_json"]),
        }

    # 2. links（排除 parent 派生边，只看 wikilink 原始边）
    links = []
    for r in conn.execute(
        "SELECT source_type, source_id, target_type, target_id, relation "
        "FROM links WHERE relation != 'parent' ORDER BY source_id, target_id"
    ):
        links.append({
            "source_type": r["source_type"],
            "source_id": r["source_id"],
            "target_type": r["target_type"],
            "target_id": r["target_id"],
            "relation": r["relation"],
        })

    # 3. parent 边（派生索引）
    parent_edges = []
    for r in conn.execute(
        "SELECT source_id, target_id FROM links WHERE relation='parent' "
        "ORDER BY source_id"
    ):
        parent_edges.append({"child": r["source_id"], "parent": r["target_id"]})

    # 4. hierarchy（权威解析）
    h = resolve_hierarchy(conn)
    hierarchy = {
        "parent_of": {k: v for k, v in sorted(h["parent_of"].items())},
        "roots": h["roots"],
        "invalid_count": len(h["invalid"]),
    }

    # 5. FTS 计数
    fts_count = conn.execute("SELECT count(*) FROM notes_fts").fetchone()[0]

    return {
        "notes": notes,
        "links": links,
        "parent_edges": parent_edges,
        "hierarchy": hierarchy,
        "fts_count": fts_count,
    }


def _count_tables(conn) -> set[str]:
    """返回所有表名。"""
    return {
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }


# ── 测试用例 ───────────────────────────────────────────────

class TestVaultRebuild:
    """Vault Rebuild：删 SQLite → rebuild → 断言逻辑状态一致。"""

    def test_rebuild_preserves_notes_and_links(self, tmp_workspace: Path) -> None:
        """基础：笔记 + wikilink 在重建后保持一致。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "机器学习", "包含 [[梯度下降]] 和 [[反向传播]] 的笔记")
        _write_note(vault, "梯度下降", "优化算法基础")
        _write_note(vault, "反向传播", "神经网络训练核心")

        # 第一次 reindex
        conn = connect()
        try:
            migrate(conn)
            stats1 = reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        assert stats1["notes_scanned"] == 3
        assert stats1["notes_upserted"] == 3
        assert state1["fts_count"] == 3

        # 删除 SQLite
        db_file = db_path()
        assert db_file.exists()
        os.remove(db_file)
        assert not db_file.exists()

        # 重建
        conn = connect()
        try:
            migrate(conn)
            stats2 = reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        # 断言逻辑状态一致
        assert state1["notes"] == state2["notes"], "笔记元数据不一致"
        assert state1["links"] == state2["links"], "links 不一致"
        assert state1["fts_count"] == state2["fts_count"], "FTS 计数不一致"

    def test_rebuild_preserves_parent_hierarchy(self, tmp_workspace: Path) -> None:
        """层级：parent 关系在重建后保持一致。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "机器学习", "主笔记")
        _write_note(vault, "Adam 优化器", "", meta={"parent": "[[机器学习]]"})
        _write_note(vault, "反向传播", "", meta={"parent": "[[机器学习]]"})
        _write_note(vault, "注意力机制", "独立笔记，无 parent")

        # 第一次 reindex
        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        # 断言初始状态正确
        assert len(state1["notes"]) == 4
        assert len(state1["parent_edges"]) == 2
        assert state1["hierarchy"]["invalid_count"] == 0

        # 删除 SQLite
        os.remove(db_path())

        # 重建
        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        # 断言层级一致
        assert state1["hierarchy"] == state2["hierarchy"], "hierarchy 不一致"
        assert state1["parent_edges"] == state2["parent_edges"], "parent 边不一致"

    def test_rebuild_preserves_tags(self, tmp_workspace: Path) -> None:
        """tags 在重建后保持一致。"""
        vault = tmp_path = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "带标签笔记", "内容", meta={"tags": "python, machine-learning"})
        _write_note(vault, "无标签笔记", "内容")

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["notes"] == state2["notes"], "tags 不一致"

    def test_rebuild_preserves_invalid_parent(self, tmp_workspace: Path) -> None:
        """orphan parent 在重建后仍被标记为 invalid。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "孤儿笔记", "", meta={"parent": "[[不存在的笔记]]"})

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["hierarchy"]["invalid_count"] == 1
        assert len(state1["parent_edges"]) == 0  # orphan 不建边

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["hierarchy"] == state2["hierarchy"], "orphan 状态不一致"

    def test_rebuild_preserves_self_parent(self, tmp_workspace: Path) -> None:
        """自指 parent 在重建后仍被标记为 invalid。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "自指笔记", "", meta={"parent": "[[自指笔记]]"})

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["hierarchy"]["invalid_count"] == 1

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["hierarchy"] == state2["hierarchy"], "self-parent 状态不一致"

    def test_rebuild_preserves_cycle_detection(self, tmp_workspace: Path) -> None:
        """成环 parent 在重建后仍被检测并标记为 invalid。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "A", "", meta={"parent": "[[B]]"})
        _write_note(vault, "B", "", meta={"parent": "[[A]]"})

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["hierarchy"]["invalid_count"] == 2  # A 和 B 都 invalid
        assert len(state1["parent_edges"]) == 0  # 环上节点不建边

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["hierarchy"] == state2["hierarchy"], "cycle 状态不一致"

    def test_rebuild_preserves_multilevel_hierarchy(self, tmp_workspace: Path) -> None:
        """多级嵌套（A→B→C）在重建后保持一致。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "课程", "根笔记")
        _write_note(vault, "章节一", "", meta={"parent": "[[课程]]"})
        _write_note(vault, "知识点", "", meta={"parent": "[[章节一]]"})

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        assert len(state1["parent_edges"]) == 2
        # A→B→C：课程→章节一→知识点
        # notes dict is {title: {path, tags}}, need title→id mapping
        title_to_id = {}
        for nid in range(1, 100):
            for t, n in state1["notes"].items():
                # reindex assigns IDs sequentially; find by path
                pass
        # Better approach: use parent_edges which store IDs
        parent_of = state1["hierarchy"]["parent_of"]
        # Find IDs by checking parent_edges
        child_ids = {e["child"] for e in state1["parent_edges"]}
        parent_ids = {e["parent"] for e in state1["parent_edges"]}
        # The leaf (知识点) is a child but not a parent
        leaf_id = (child_ids - parent_ids).pop()
        # The root (课程) is a parent but not a child
        root_id = (parent_ids - child_ids).pop()
        # The middle (章节一) is both
        mid_id = (child_ids & parent_ids).pop()
        assert parent_of[leaf_id] == mid_id
        assert parent_of[mid_id] == root_id

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["hierarchy"] == state2["hierarchy"], "多级 hierarchy 不一致"

    def test_rebuild_preserves_wikilinks_and_parent_combined(
        self, tmp_workspace: Path
    ) -> None:
        """wikilink + parent 混合场景在重建后保持一致。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "机器学习", "包含 [[梯度下降]]")
        _write_note(vault, "梯度下降", "优化算法", meta={"parent": "[[机器学习]]"})
        _write_note(vault, "反向传播", "训练核心，参考 [[梯度下降]]")

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        # 有 parent 边 + wikilink 边
        assert len(state1["parent_edges"]) == 1
        assert len(state1["links"]) >= 1  # wikilink 边

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["notes"] == state2["notes"]
        assert state1["links"] == state2["links"]
        assert state1["parent_edges"] == state2["parent_edges"]
        assert state1["hierarchy"] == state2["hierarchy"]

    def test_empty_vault_rebuild(self, tmp_workspace: Path) -> None:
        """空 vault 重建后仍是空状态。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1["notes"] == {}
        assert state1["fts_count"] == 0

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1 == state2

    def test_rebuild_idempotent(self, tmp_workspace: Path) -> None:
        """连续两次 reindex（不删 SQLite）结果一致（幂等性）。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "笔记A", "内容", meta={"parent": "[[笔记B]]"})
        _write_note(vault, "笔记B", "内容")

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)

            # 再次 reindex（不删 SQLite）
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        assert state1 == state2, "reindex 非幂等"

    def test_rebuild_after_file_change(self, tmp_workspace: Path) -> None:
        """修改 vault 文件后重建，反映最新状态。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "笔记A", "原始内容")
        _write_note(vault, "笔记B", "原始内容", meta={"parent": "[[笔记A]]"})

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state1 = _snapshot_state(conn)
        finally:
            conn.close()

        # 修改文件：删除 parent 关系
        _write_note(vault, "笔记B", "新内容")

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            state2 = _snapshot_state(conn)
        finally:
            conn.close()

        # parent 关系应该消失
        assert len(state2["parent_edges"]) == 0
        # FTS 应该反映新内容
        assert state2["fts_count"] == 2

    def test_tables_recreated_after_rebuild(self, tmp_workspace: Path) -> None:
        """重建后所有表都被重新创建。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(parents=True)

        _write_note(vault, "测试笔记", "内容")

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            tables1 = _count_tables(conn)
        finally:
            conn.close()

        os.remove(db_path())

        conn = connect()
        try:
            migrate(conn)
            reindex_vault(conn, vault)
            conn.commit()
            tables2 = _count_tables(conn)
        finally:
            conn.close()

        assert tables1 == tables2
