"""ADR-028 文档变更抽象层 — Core 层测试。

覆盖：路径安全 · 快照去重 · 去抖 · 时间序 · frontmatter 无损 ·
重命名迁移 · 淘汰/清理 · diff 正确性（含 autojunk 回归）。
"""
from __future__ import annotations

import os
import time
from pathlib import Path

from app.core import revisions as R
from app.core.knowledge import compose_file, parse_frontmatter


def _vault_file(tmp_workspace: Path, rel: str, content: str) -> Path:
    p = tmp_workspace / "vault" / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p


# ── 路径安全 ──────────────────────────────────────────────────────

class TestPathSafety:
    def test_escape_rejected(self):
        """目录穿越：../ 越出 revisions 根 → None。"""
        assert R.revision_dir("../escape.md") is None
        assert R.revision_dir("a/../../escape.md") is None

    def test_empty_and_absolute_rejected(self):
        assert R.revision_dir("") is None
        assert R.revision_dir("/abs.md") is None

    def test_backslash_rejected(self):
        """Windows 分隔符不参与 vault 相对路径语义。"""
        assert R.revision_dir("sub\\note.md") is None

    def test_nested_path_mirrors_vault(self, tmp_workspace: Path):
        """importer 产生的嵌套路径应照原样镜像为目录。"""
        d = R.revision_dir("imported/sub/note.md")
        assert d is not None
        assert d.parts[-3:] == ("imported", "sub", "note.md")


# ── 快照写入与去重 ────────────────────────────────────────────────

class TestCreateSnapshot:
    def test_first_snapshot_created(self, tmp_workspace: Path):
        snap = R.create_snapshot("N.md", {"tags": "t1"}, "body v1")
        assert snap is not None
        assert snap.origin == "auto"
        assert snap.note_path == "N.md"
        assert snap.prev_hash == ""
        assert snap.content_hash == R._body_hash("body v1")

    def test_identical_content_deduped(self, tmp_workspace: Path):
        """哈希去重：内容未变不产生新快照（零新增 schema 的去重键）。"""
        assert R.create_snapshot("N.md", {}, "same") is not None
        assert R.create_snapshot("N.md", {}, "same") is None
        assert len(R._snapshot_files("N.md")) == 1

    def test_changed_content_creates_and_links_prev(self, tmp_workspace: Path):
        first = R.create_snapshot("N.md", {}, "v1")
        second = R.create_snapshot("N.md", {}, "v2")
        assert second is not None
        assert second.prev_hash == first.content_hash
        assert len(R._snapshot_files("N.md")) == 2

    def test_snapshot_is_plain_markdown(self, tmp_workspace: Path):
        """快照即合法 Markdown：可被 parse_frontmatter 正常读回。"""
        R.create_snapshot("N.md", {"tags": "a, b", "parent": "[[P]]"}, "正文")
        f = R._snapshot_files("N.md")[0]
        meta, tags, body = parse_frontmatter(f.read_text(encoding="utf-8"))
        assert body == "正文"
        assert tags == ["a", "b"]
        assert meta["parent"] == "[[P]]"
        assert meta["rev_origin"] == "auto"

    def test_note_frontmatter_survives_roundtrip(self, tmp_workspace: Path):
        """rev_* 命名空间不污染笔记原 frontmatter，可无损还原原文件。"""
        original_meta = {"tags": "x", "parent": "[[P]]"}
        R.create_snapshot("N.md", original_meta, "正文")
        meta, note_meta, body = R.read_snapshot(
            "N.md", R._snapshot_files("N.md")[0].stem)
        assert {k: v for k, v in note_meta.items() if k in original_meta} == original_meta
        assert not any(k.startswith("rev_") for k in note_meta)
        # 去掉 rev_* 后即可原样还原笔记文件
        assert compose_file(note_meta, body) == compose_file(original_meta, "正文")


# ── 写前去抖 ──────────────────────────────────────────────────────

class TestDebounce:
    def test_first_write_always_snapshots(self, tmp_workspace: Path):
        assert R.maybe_snapshot("N.md", {}, "v1") is not None

    def test_within_window_skipped(self, tmp_workspace: Path):
        """防 autosave 风暴：窗口内连续写入不重复打点。"""
        R.maybe_snapshot("N.md", {}, "v1")
        assert R.maybe_snapshot("N.md", {}, "v2", min_interval=300.0) is None
        assert len(R._snapshot_files("N.md")) == 1

    def test_unchanged_content_skipped(self, tmp_workspace: Path):
        R.maybe_snapshot("N.md", {}, "v1")
        assert R.maybe_snapshot("N.md", {}, "v1", min_interval=0) is None

    def test_after_window_creates(self, tmp_workspace: Path):
        """窗口过后（文件 mtime 回拨）应重新打点。"""
        R.maybe_snapshot("N.md", {}, "v1")
        f = R._snapshot_files("N.md")[-1]
        past = time.time() - 3600
        os.utime(f, (past, past))
        assert R.maybe_snapshot("N.md", {}, "v2", min_interval=300.0) is not None
        assert len(R._snapshot_files("N.md")) == 2


# ── 读取与时间序 ──────────────────────────────────────────────────

class TestRead:
    def test_list_is_newest_first(self, tmp_workspace: Path):
        R.create_snapshot("N.md", {}, "v1")
        time.sleep(1.05)  # 时间戳秒级定宽，需跨秒才能区分
        R.create_snapshot("N.md", {}, "v2")
        metas = R.list_snapshots("N.md")
        assert [m.content_hash for m in metas] == [
            R._body_hash("v2"), R._body_hash("v1")]

    def test_list_limit(self, tmp_workspace: Path):
        for i in range(5):
            R.create_snapshot("N.md", {}, f"v{i}")
            time.sleep(1.05)
        assert len(R.list_snapshots("N.md", limit=2)) == 2

    def test_latest_snapshot(self, tmp_workspace: Path):
        R.create_snapshot("N.md", {}, "v1")
        time.sleep(1.05)
        R.create_snapshot("N.md", {}, "v2")
        assert R.latest_snapshot("N.md").content_hash == R._body_hash("v2")

    def test_latest_snapshot_empty(self, tmp_workspace: Path):
        assert R.latest_snapshot("N.md") is None

    def test_read_snapshot_rejects_traversal(self, tmp_workspace: Path):
        assert R.read_snapshot("N.md", "../other") is None
        assert R.read_snapshot("N.md", "sub/x") is None

    def test_read_current_reads_vault(self, tmp_workspace: Path):
        _vault_file(tmp_workspace, "N.md",
                    compose_file({"tags": "t"}, "当前正文"))
        cur = R.read_current("N.md")
        assert cur is not None
        assert cur.source == "current"
        assert cur.ref == R.CURRENT_REF
        assert cur.content_md == "当前正文"
        assert cur.content_hash == R._body_hash("当前正文")
        assert cur.note_meta == {"tags": "t"}

    def test_read_current_missing_file(self, tmp_workspace: Path):
        assert R.read_current("不存在.md") is None

    def test_resolve_revision_dispatch(self, tmp_workspace: Path):
        _vault_file(tmp_workspace, "N.md", compose_file({}, "当前"))
        R.create_snapshot("N.md", {}, "历史")

        cur = R.resolve_revision("N.md", "current")
        assert cur.content_md == "当前"

        snap = R.resolve_revision("N.md", "snapshot")          # 隐式 latest
        assert snap.content_md == "历史"
        assert R.resolve_revision("N.md", "snapshot", "latest").content_md == "历史"
        assert R.resolve_revision("N.md", "snapshot", snap.ref).content_md == "历史"

    def test_resolve_revision_unknown_source(self, tmp_workspace: Path):
        """未实现的 source（如未来的 git）返回 None，不抛异常。"""
        assert R.resolve_revision("N.md", "git") is None

    def test_resolve_revision_missing_ref(self, tmp_workspace: Path):
        assert R.resolve_revision("N.md", "snapshot", "nope") is None


# ── 重命名迁移 ────────────────────────────────────────────────────

class TestRename:
    def test_migrate_moves_snapshots(self, tmp_workspace: Path):
        R.create_snapshot("Old.md", {}, "v1")
        assert R.rename_revision_dir("Old.md", "New.md") is True
        assert not (tmp_workspace / "metadata/revisions/Old.md").exists()
        assert len(R._snapshot_files("New.md")) == 1

    def test_rev_note_path_keeps_history(self, tmp_workspace: Path):
        """重命名不回改 rev_note_path —— 修订记录应记录历史而非当前状态。"""
        R.create_snapshot("Old.md", {}, "v1")
        R.rename_revision_dir("Old.md", "New.md")
        meta, _, _ = R.read_snapshot("New.md", R._snapshot_files("New.md")[0].stem)
        assert meta.note_path == "Old.md"

    def test_no_snapshot_dir_is_noop(self, tmp_workspace: Path):
        assert R.rename_revision_dir("Ghost.md", "New.md") is False

    def test_existing_target_not_overwritten(self, tmp_workspace: Path):
        R.create_snapshot("A.md", {}, "va")
        R.create_snapshot("B.md", {}, "vb")
        assert R.rename_revision_dir("A.md", "B.md") is False
        assert len(R._snapshot_files("B.md")) == 1  # B 的快照未被覆盖


# ── 淘汰与清理 ────────────────────────────────────────────────────

class TestPrune:
    def test_prune_keeps_newest(self, tmp_workspace: Path):
        for i in range(5):
            R.create_snapshot("N.md", {}, f"v{i}")
            time.sleep(1.05)
        removed = R.prune_revisions("N.md", keep=2)
        assert removed == 3
        assert [m.content_hash for m in R.list_snapshots("N.md")] == [
            R._body_hash("v4"), R._body_hash("v3")]

    def test_prune_noop_when_under_limit(self, tmp_workspace: Path):
        R.create_snapshot("N.md", {}, "v1")
        assert R.prune_revisions("N.md", keep=10) == 0

    def test_prune_guard_against_zero(self, tmp_workspace: Path):
        """keep<=0 是无效语义，必须 no-op 而非删光。"""
        R.create_snapshot("N.md", {}, "v1")
        assert R.prune_revisions("N.md", keep=0) == 0
        assert len(R._snapshot_files("N.md")) == 1

    def test_purge_removes_all(self, tmp_workspace: Path):
        R.create_snapshot("N.md", {}, "v1")
        time.sleep(1.05)
        R.create_snapshot("N.md", {}, "v2")
        assert R.purge_revisions("N.md") == 2
        assert R._snapshot_files("N.md") == []

    def test_purge_missing_dir(self, tmp_workspace: Path):
        assert R.purge_revisions("Ghost.md") == 0


# ── Diff ──────────────────────────────────────────────────────────

class TestDiff:
    def test_identical_is_empty(self):
        d = R.diff_texts("a\nb\nc\n", "a\nb\nc\n")
        assert d["hunks"] == []
        assert d["stats"] == {"added": 0, "removed": 0, "changed": 0}

    def test_pure_insert(self):
        d = R.diff_texts("a\nb\n", "a\nb\nc\n")
        assert d["stats"] == {"added": 1, "removed": 0, "changed": 0}
        assert d["hunks"][0]["op"] == "insert"

    def test_pure_delete(self):
        d = R.diff_texts("a\nb\nc\n", "a\nc\n")
        assert d["stats"] == {"added": 0, "removed": 1, "changed": 0}
        assert d["hunks"][0]["op"] == "delete"

    def test_replace_splits_into_changed_plus_delta(self):
        """replace 段：共同部分计 changed，多出部分计入 added/removed。"""
        d = R.diff_texts("a\nb\nc\nd\n", "a\nX\nY\nZ\nd\n")
        # b,c → X,Y,Z：2 changed + 1 added
        assert d["stats"]["changed"] == 2
        assert d["stats"]["added"] == 1
        assert d["stats"]["removed"] == 0

    def test_hunks_exclude_equal_segments(self):
        d = R.diff_texts("same\nold\n", "same\nnew\n")
        assert len(d["hunks"]) == 1
        assert d["hunks"][0]["op"] == "replace"

    def test_hunk_offsets_are_zero_based_half_open(self):
        d = R.diff_texts("keep\nold\n", "keep\nnew\n")
        h = d["hunks"][0]
        assert (h["old_start"], h["old_end"]) == (1, 2)
        assert (h["new_start"], h["new_end"]) == (1, 2)

    def test_unified_diff_output(self):
        d = R.diff_texts("a\n", "b\n", from_label="old", to_label="new")
        assert "--- old" in d["unified"]
        assert "+++ new" in d["unified"]
        assert "-a" in d["unified"] and "+b" in d["unified"]

    def test_empty_inputs(self):
        d = R.diff_texts("", "")
        assert d["hunks"] == [] and d["unified"] == ""

    def test_autojunk_disabled(self):
        """回归：SequenceMatcher 默认 autojunk 会把高频行判为 junk。

        本用例构造 300 行、仅 5 种取值（每种 60 次 > 1%×300=3）的文本，
        只改其中一行。autojunk=True 时全部行被判 junk → 匹配不到任何公共块
        → 整段 replace（300 行）；autojunk=False 时应只有 1 行 replace。
        """
        lines = [f"row {i % 5}" for i in range(300)]
        old = "\n".join(lines) + "\n"
        new_lines = lines[:]
        new_lines[150] = "row CHANGED"
        new = "\n".join(new_lines) + "\n"

        d = R.diff_texts(old, new)
        assert d["stats"]["changed"] == 1, (
            f"autojunk 疑似被启用：changed={d['stats']['changed']}，"
            f"hunks={len(d['hunks'])}"
        )
        assert d["stats"]["added"] == 0 and d["stats"]["removed"] == 0
        assert len(d["hunks"]) == 1
