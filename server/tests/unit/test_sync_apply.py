"""M7-004 Apply 层测试：markdown LWW / eventlog merge / mindmap conflict / 安全闸门 / 确定性。

冻结规则来源：docs/ai/ACTIVE_TASK.md（Rule 1-4）+ 用户补充的 Deterministic Apply。
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from app.core.sync.apply import (
    ApplyAction,
    SyncApply,
    validate_rel_path,
)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@pytest.fixture()
def ws(tmp_path: Path) -> Path:
    (tmp_path / "vault").mkdir()
    (tmp_path / "metadata" / "eventlogs").mkdir(parents=True)
    (tmp_path / "mind_maps").mkdir()
    return tmp_path


@pytest.fixture()
def applyer() -> SyncApply:
    return SyncApply()


# ── TestApplyMarkdown ─────────────────────────────────────────

class TestApplyMarkdown:
    def test_overwrite(self, ws, applyer):
        data = b"# feature value\n"
        r = applyer.apply_file(ws, "vault/eigen.md", data, expected_hash=sha(data))
        assert r.action is ApplyAction.WRITTEN and r.success
        assert (ws / "vault" / "eigen.md").read_bytes() == data

    def test_identical_skipped(self, ws, applyer):
        data = b"same"
        applyer.apply_file(ws, "vault/a.md", data, expected_hash=sha(data))
        r = applyer.apply_file(ws, "vault/a.md", data, expected_hash=sha(data))
        assert r.action is ApplyAction.SKIPPED

    def test_hash_mismatch_rejected(self, ws, applyer):
        """Rule 2 加强版：字节重算哈希，伪造 expected 必须被拒。"""
        data = b"payload"
        r = applyer.apply_file(ws, "vault/a.md", data,
                               expected_hash=sha(b"other-bytes"))
        assert r.action is ApplyAction.REJECTED
        assert not (ws / "vault" / "a.md").exists()

    def test_remote_claimed_hash_ignored(self, ws, applyer):
        """即使 remote 没有给 expected_hash，也能安全写入（空串=不校验）。"""
        data = b"x"
        r = applyer.apply_file(ws, "vault/b.md", data)
        assert r.success

    def test_utf8_chinese(self, ws, applyer):
        data = "# 特征值\n矩阵 A 的特征值 λ".encode("utf-8")
        r = applyer.apply_file(ws, "vault/数学.md", data, expected_hash=sha(data))
        assert r.success
        assert (ws / "vault" / "数学.md").read_bytes() == data


# ── TestApplyEvents ───────────────────────────────────────────

def _ev(eid: str) -> str:
    return json.dumps({"event_id": eid, "type": "answer_correct"}) + "\n"


class TestApplyEvents:
    def test_merge_appends_new_only(self, ws, applyer):
        log = ws / "metadata" / "eventlogs" / "2026-08.jsonl"
        log.write_text(_ev("a") + _ev("b"), encoding="utf-8")

        remote = (_ev("b") + _ev("c")).encode("utf-8")
        r = applyer.apply_file(ws, "metadata/eventlogs/2026-08.jsonl", remote,
                               expected_hash=sha(remote))
        assert r.action is ApplyAction.MERGED and r.success
        merged = log.read_text(encoding="utf-8")
        ids = [json.loads(l)["event_id"] for l in merged.splitlines()]
        # local 全保留 + 仅新增 c；顺序确定：local 先、remote 新增按其原序在后
        assert ids == ["a", "b", "c"]

    def test_merge_dedup_is_idempotent(self, ws, applyer):
        """同一份 remote 重复 apply，结果一致（幂等）。"""
        path = "metadata/eventlogs/2026-08.jsonl"
        (ws / "metadata" / "eventlogs").mkdir(parents=True, exist_ok=True)
        (ws / path).write_text(_ev("a"), encoding="utf-8")
        remote = (_ev("a") + _ev("x")).encode("utf-8")
        applyer.apply_file(ws, path, remote, expected_hash=sha(remote))
        once = (ws / path).read_text(encoding="utf-8")
        # 注意：merged 后本地文件内容已变，第二次 apply 需用当前本地做 baseline
        r2 = applyer.apply_file(ws, path, remote, expected_hash=sha(remote))
        twice = (ws / path).read_text(encoding="utf-8")
        assert r2.message == "no new events" or once == twice

    def test_empty_remote_no_op(self, ws, applyer):
        path = "metadata/eventlogs/2026-08.jsonl"
        (ws / path).write_text(_ev("a"), encoding="utf-8")
        before = (ws / path).read_text(encoding="utf-8")
        r = applyer.apply_file(ws, path, b"")
        assert r.action is ApplyAction.MERGED and r.message == "no new events"
        assert (ws / path).read_text(encoding="utf-8") == before

    def test_local_never_truncated(self, ws, applyer):
        """Rule 3 红线：local 行数永不因 merge 减少。"""
        path = "metadata/eventlogs/2026-08.jsonl"
        local = "".join(_ev(f"L{i}") for i in range(10))
        (ws / path).write_text(local, encoding="utf-8")
        remote = _ev("R1").encode("utf-8")
        applyer.apply_file(ws, path, remote, expected_hash=sha(remote))
        lines = (ws / path).read_text(encoding="utf-8").splitlines()
        assert len(lines) == 11

    def test_line_without_event_id_not_merged(self, ws, applyer):
        path = "metadata/eventlogs/2026-08.jsonl"
        bad = json.dumps({"type": "unknown"}).encode("utf-8")
        r = applyer.apply_file(ws, path, bad)
        assert r.message == "no new events"


# ── TestApplyMindMap ──────────────────────────────────────────

class TestApplyMindMap:
    def test_lww_new_file(self, ws, applyer):
        data = json.dumps({"v": 1, "root": {}}).encode("utf-8")
        r = applyer.apply_file(ws, "mind_maps/math.mindmap.json", data,
                               expected_hash=sha(data))
        assert r.action is ApplyAction.WRITTEN

    def test_conflict_backup_created_once(self, ws, applyer):
        mm = ws / "mind_maps" / "math.mindmap.json"
        local_v1 = json.dumps({"v": 1, "layout": {"n1": [0, 0]}}).encode("utf-8")
        mm.write_bytes(local_v1)

        remote_v2 = json.dumps({"v": 1, "root": {}, "src": "remote"}).encode("utf-8")
        r = applyer.apply_file(ws, "mind_maps/math.mindmap.json", remote_v2,
                               expected_hash=sha(remote_v2))
        assert r.action is ApplyAction.CONFLICT_BACKUP and r.success
        # 主文件 = 远端胜者；本地布局保存在 .local.json
        assert mm.read_bytes() == remote_v2
        backup = ws / "mind_maps" / "math.local.json"
        assert backup.exists() and backup.read_bytes() == local_v1

        # 第二次冲突不得覆盖首次备份（更早分叉点）
        remote_v3 = json.dumps({"v": 1, "rev": 3}).encode("utf-8")
        applyer.apply_file(ws, "mind_maps/math.mindmap.json", remote_v3,
                           expected_hash=sha(remote_v3))
        assert backup.read_bytes() == local_v1

    def test_backup_names_do_not_sync(self):
        """.local.json 备份不在同步白名单内——设备本地私有。"""
        from app.core.sync.transfer import is_syncable
        assert not is_syncable("mind_maps/math.local.json")


# ── TestSecurity ──────────────────────────────────────────────

class TestSecurity:
    @pytest.mark.parametrize("path,payload", [
        ("db/learning-os.db", b"sqlite"),
        ("settings.json", b"{}"),
        ("metadata/devices.json", b"{}"),
        ("../../../etc/passwd", b"x"),
        ("vault/../../db/x.db", b"x"),
        ("C:/windows/system32.cfg", b"x"),
        ("vault\\win.md", b"x"),
        ("/abs/path.md", b"x"),
    ])
    def test_forbidden_paths_rejected(self, ws, applyer, path, payload):
        r = applyer.apply_file(ws, path, payload)
        assert r.action is ApplyAction.REJECTED
        assert not r.success

    def test_non_whitelisted_ext_rejected(self, ws, applyer):
        r = applyer.apply_file(ws, "vault/script.exe", b"MZ...")
        assert r.action is ApplyAction.REJECTED

    def test_validate_rel_path_unit(self):
        assert validate_rel_path("vault/a.md") == "vault/a.md"
        assert validate_rel_path("./vault//a.md") == "vault/a.md"
        for bad in ["../a", "a\\b", "/abs", "", "vault/../..", "C:x"]:
            assert validate_rel_path(bad) is None


# ── Deterministic Apply ───────────────────────────────────────

class TestDeterministicApply:
    def test_same_input_same_result(self, ws, applyer, tmp_path_factory):
        """apply(plan) → snapshot → reset → apply(plan) → snapshot 一致。"""
        def build_files():
            files = [
                ("vault/det.md", b"# deterministic"),
                ("metadata/eventlogs/2026-08.jsonl",
                 (_ev("d1") + _ev("d2")).encode("utf-8")),
                ("mind_maps/p.mindmap.json", b'{"v":1,"det":true}'),
            ]
            hashes = {p: sha(d) for p, d in files}
            return files, hashes

        files, hashes = build_files()

        applyer.apply_many(ws, files, expected_hashes=hashes)

        # 第二轮：完全重置后再次 apply 相同输入
        ws2 = tmp_path_factory.mktemp("det_ws")
        (ws2 / "vault").mkdir()
        (ws2 / "metadata" / "eventlogs").mkdir(parents=True)
        (ws2 / "mind_maps").mkdir()

        applyer.apply_many(ws2, files, expected_hashes=hashes)

        s1 = sorted((str(p.relative_to(ws)), p.read_bytes())
                    for p in ws.rglob("*") if p.is_file())
        s2 = sorted((str(p.relative_to(ws2)), p.read_bytes())
                    for p in ws2.rglob("*") if p.is_file())
        assert s1 == s2

    def test_apply_has_no_side_channel_paths(self, ws, applyer):
        """落盘仅出现在目标路径，无临时残留。"""
        data = b"content"
        applyer.apply_file(ws, "vault/t.md", data, expected_hash=sha(data))
        leftovers = [p.name for p in (ws / "vault").iterdir()]
        assert leftovers == ["t.md"]


# ── TestBoundaryAudit（M7-003.5 基线回归）─────────────────────

class TestSyncCoreBoundaryAudit:
    """core/sync 必须保持 stdlib-only：无 fastapi / sqlite3 / router 依赖。"""

    FORBIDDEN = ("fastapi", "sqlite3", "app.routers", "from ..routers",
                 "pydantic", "sqlmodel", "sqlalchemy")

    def _sync_modules(self):
        import pathlib
        sync_dir = pathlib.Path(__file__).resolve().parents[2] / "app" / "core" / "sync"
        return sorted(sync_dir.glob("*.py"))

    def test_all_modules_stdlib_only(self):
        assert len(self._sync_modules()) >= 9  # 含本任务新增的 apply.py
        for mod in self._sync_modules():
            src = mod.read_text(encoding="utf-8")
            for token in self.FORBIDDEN:
                assert token not in src, f"{mod.name} imports forbidden {token!r}"

    def test_apply_module_exported_surface(self):
        import app.core.sync.apply as A
        for name in ("SyncApply", "SyncApplyResult", "ApplyItemResult",
                     "ApplyAction", "validate_rel_path"):
            assert hasattr(A, name)
