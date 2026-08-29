"""P8-003C Vault Reindex 单元测试。"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.core.reindex import reindex_vault


@pytest.fixture()
def conn(core_conn: sqlite3.Connection):
    yield core_conn


def _write_note(vault: Path, name: str, body: str) -> None:
    vault.mkdir(parents=True, exist_ok=True)
    (vault / name).write_text(body, encoding="utf-8")


class TestReindexBasic:
    def test_empty_vault(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        stats = reindex_vault(conn, vault)
        assert stats["notes_scanned"] == 0
        assert stats["notes_upserted"] == 0

    def test_single_note(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Transformer.md", "# Transformer\n\n注意力机制")
        stats = reindex_vault(conn, vault)
        assert stats["notes_scanned"] == 1
        assert stats["notes_upserted"] == 1
        row = conn.execute("SELECT title FROM notes WHERE path='Transformer.md'").fetchone()
        assert row is not None
        assert row["title"] == "Transformer"

    def test_nested_note(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        sub = vault / "AI"
        sub.mkdir(parents=True, exist_ok=True)
        _write_note(sub, "BERT.md", "# BERT")
        stats = reindex_vault(conn, vault)
        assert stats["notes_scanned"] == 1
        row = conn.execute("SELECT path FROM notes").fetchone()
        assert row["path"] == "AI/BERT.md"

    def test_fts_searchable_after_reindex(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Attention.md", "# Attention\n\nSelf-attention is key")
        reindex_vault(conn, vault)
        rows = conn.execute(
            "SELECT n.title FROM notes_fts f JOIN notes n ON n.id=f.note_id "
            "WHERE notes_fts MATCH ?",
            ("attention",),
        ).fetchall()
        assert len(rows) == 1
        assert rows[0]["title"] == "Attention"


class TestReindexIdempotent:
    def test_double_reindex_same_result(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Test.md", "# Test\n\n[[Link]]")
        reindex_vault(conn, vault)
        count_before = conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
        reindex_vault(conn, vault)
        count_after = conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
        assert count_before == count_after

    def test_content_update(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Test.md", "# Test\n\nOld content")
        reindex_vault(conn, vault)
        _write_note(vault, "Test.md", "# Test\n\nNew content with [[Link]]")
        reindex_vault(conn, vault)
        fts = conn.execute(
            "SELECT body FROM notes_fts WHERE note_id=?",
            (conn.execute("SELECT id FROM notes WHERE path='Test.md'").fetchone()["id"],),
        ).fetchone()
        assert "New content" in fts["body"]


class TestReindexPrune:
    def test_prune_false_keeps_orphans(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Keep.md", "# Keep")
        reindex_vault(conn, vault)
        assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 1
        (vault / "Keep.md").unlink()
        reindex_vault(conn, vault, prune_missing=False)
        assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 1

    def test_prune_true_removes_orphans(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Gone.md", "# Gone")
        reindex_vault(conn, vault)
        assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 1
        (vault / "Gone.md").unlink()
        stats = reindex_vault(conn, vault, prune_missing=True)
        assert stats["notes_dropped"] == 1
        assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 0

    def test_prune_false_preserves_concepts(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Link.md", "# Link\n\n[[ConceptA]]")
        reindex_vault(conn, vault)
        concept_count = conn.execute("SELECT COUNT(*) FROM concepts").fetchone()[0]
        (vault / "Link.md").unlink()
        reindex_vault(conn, vault, prune_missing=False)
        assert conn.execute("SELECT COUNT(*) FROM concepts").fetchone()[0] == concept_count


class TestReindexLinks:
    def test_wikilink_creates_concept_stub(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Note.md", "# Note\n\nUses [[BERT]] here")
        reindex_vault(conn, vault)
        concepts = conn.execute("SELECT title FROM concepts").fetchall()
        titles = [c["title"] for c in concepts]
        assert "BERT" in titles

    def test_wikilink_creates_link(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "A.md", "# A\n\nSee [[B]]")
        reindex_vault(conn, vault)
        links = conn.execute("SELECT target_type, relation FROM links").fetchall()
        assert len(links) >= 1
        assert links[0]["relation"] == "wikilink"

    def test_self_link_skipped(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Self.md", "# Self\n\n[[Self]] reference")
        stats = reindex_vault(conn, vault)
        links = conn.execute(
            "SELECT * FROM links WHERE source_type='note' AND target_type='note'"
        ).fetchall()
        assert len(links) == 0


class TestReindexSyncHook:
    def test_admin_reindex_endpoint(self, client):
        """POST /api/v1/admin/reindex 端点可用。"""
        resp = client.post("/api/v1/admin/reindex")
        assert resp.status_code == 200
        data = resp.json()
        assert "stats" in data


# ── B17 增量 reindex（changed_paths）────────────────────────────────

class TestReindexIncremental:
    def test_incremental_only_processes_given_paths(self, conn, tmp_workspace):
        """changed_paths 只处理列出的路径，其余不动。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "A.md", "# A")
        _write_note(vault, "B.md", "# B")
        reindex_vault(conn, vault)
        assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 2

        _write_note(vault, "C.md", "# C")
        stats = reindex_vault(conn, vault, changed_paths=["C.md"])
        assert stats["notes_scanned"] == 1
        assert stats["notes_upserted"] == 1
        n = conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
        assert n == 3  # A/B 未重复处理，C 新增

    def test_incremental_update_changed_note(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "X.md", "# X\n\nold")
        reindex_vault(conn, vault)
        _write_note(vault, "X.md", "# X\n\nnew content [[Link]]")
        stats = reindex_vault(conn, vault, changed_paths=["X.md"])
        assert stats["notes_upserted"] == 1
        fts = conn.execute(
            "SELECT body FROM notes_fts WHERE note_id=?",
            (conn.execute("SELECT id FROM notes WHERE path='X.md'").fetchone()["id"],),
        ).fetchone()
        assert "new content" in fts["body"]
        # 链接也同步（stub 创建）
        assert stats["stubs_created"] >= 1

    def test_incremental_deletion_drops_note_and_cascades(self, conn, tmp_workspace):
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        _write_note(vault, "Del.md", "# Del\n\n[[ConceptKeep]]")
        reindex_vault(conn, vault)
        assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM links").fetchone()[0] >= 1

        (vault / "Del.md").unlink()
        stats = reindex_vault(conn, vault, changed_paths=["Del.md"])
        assert stats["notes_dropped"] == 1
        assert conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] == 0
        # 级联清理该 note 的全部 links
        assert conn.execute(
            "SELECT COUNT(*) FROM links WHERE source_type='note'").fetchone()[0] == 0

    def test_incremental_ignores_unknown_paths(self, conn, tmp_workspace):
        """不存在的路径且 DB 无该记录 → 不增不删，安全。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        stats = reindex_vault(conn, vault, changed_paths=["Ghost.md"])
        assert stats["notes_scanned"] == 0
        assert stats["notes_dropped"] == 0

    def test_incremental_rejects_path_traversal(self, conn, tmp_workspace):
        """越界路径（绝对 / 穿越）被拒绝，不触碰 vault 外文件。"""
        vault = tmp_workspace / "vault"
        vault.mkdir(exist_ok=True)
        outside = tmp_workspace / "secrets.md"
        outside.write_text("# secret", encoding="utf-8")
        stats = reindex_vault(conn, vault, changed_paths=["../secrets.md"])
        assert stats["notes_scanned"] == 0
        assert stats["notes_upserted"] == 0

    def test_admin_endpoint_accepts_changed_paths_body(self, client):
        """POST /admin/reindex body={"changed_paths":[...]} 走增量。"""
        resp = client.post("/api/v1/admin/reindex",
                           json={"changed_paths": ["DoesNotExist.md"]})
        assert resp.status_code == 200
        stats = resp.json()["stats"]
        assert stats["notes_scanned"] == 0
