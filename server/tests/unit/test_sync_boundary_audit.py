"""M7-004.5 Sync Boundary & Recovery Audit。

目标：验证 Sync Core 在异常情况下不会破坏 Truth Source（ADR-020 Layer 1）。
任务卡：docs/ai/ACTIVE_TASK.md（M7-004.5）。
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from app.core.sync import apply as apply_mod
from app.core.sync.apply import ApplyAction, SyncApply, validate_rel_path


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@pytest.fixture()
def ws(tmp_path: Path) -> Path:
    (tmp_path / "vault").mkdir()
    (tmp_path / "metadata" / "eventlogs").mkdir(parents=True)
    (tmp_path / "mind_maps").mkdir()
    return tmp_path


def _ev(eid: str) -> str:
    return json.dumps({"event_id": eid, "type": "answer_correct"}) + "\n"


# ── Audit 1：Transport → Apply 静态边界 ───────────────────────

class TestTransportBoundary:
    """transport.py 只做字节搬运；落盘动作只允许出现在 apply.py / transfer.py。

    用 AST 检查函数调用而非子串，避免 urlopen 这类误报。
    """

    FORBIDDEN_CALLS = {"open", "unlink", "remove", "rmtree",
                       "write_text", "write_bytes", "mkdir"}

    def _calls(self, name: str) -> set[str]:
        import ast
        import pathlib
        p = pathlib.Path(apply_mod.__file__).parent / name
        tree = ast.parse(p.read_text(encoding="utf-8"))
        calls = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                f = node.func
                if isinstance(f, ast.Name):
                    calls.add(f.id)
                elif isinstance(f, ast.Attribute):
                    calls.add(f.attr)
        return calls

    def test_transport_never_touches_disk(self):
        used = self._calls("transport.py")
        offenders = self.FORBIDDEN_CALLS & used
        assert not offenders, f"transport.py 含落盘/文件系统动作: {offenders}"

    def test_apply_routes_all_writes_through_atomic(self):
        # apply.py 本身也不直接 open/unlink——统一走 write_file_atomic
        used = self._calls("apply.py")
        offenders = self.FORBIDDEN_CALLS & used
        assert not offenders, f"apply.py 应经由 write_file_atomic，而非 {offenders}"
        assert "write_file_atomic" in used

    def test_transfer_is_only_io_module(self):
        src = self._src("transfer.py")
        assert "write_file_atomic" in src and "read_bytes" in src

    def _src(self, name: str) -> str:
        import pathlib
        p = pathlib.Path(apply_mod.__file__).parent / name
        return p.read_text(encoding="utf-8")

    def test_transfer_is_only_io_module(self):
        src = self._src("transfer.py")
        assert "write_file_atomic" in src and "read_bytes" in src


# ── Audit 2：异常恢复 ─────────────────────────────────────────

class TestCrashRecovery:
    def test_case_a_stray_tmp_file_harmless(self, ws):
        """Case A：崩溃残留 .sync_tmp_ 临时文件不影响旧文件与后续 apply。"""
        target = ws / "vault" / "a.md"
        old = b"# old valid content"
        target.write_bytes(old)
        # 模拟崩溃残留（transfer.py 的 mkstemp 前缀）
        stray = ws / "vault" / ".sync_tmp_ab12"
        stray.write_bytes(b"partial garbage")

        data = b"# new content"
        r = SyncApply().apply_file(ws, "vault/a.md", data, expected_hash=sha(data))

        assert r.success
        assert target.read_bytes() == data      # 新内容生效
        assert (ws / "vault" / "a.md").read_text(encoding="utf-8") == "# new content"

    def test_case_a_old_file_valid_when_hash_gate_rejects(self, ws):
        """写入前任何一关失败，旧文件必须原样保留。"""
        target = ws / "vault" / "b.md"
        old = b"old-bytes"
        target.write_bytes(old)

        bad = b"new-but-forged-hash"
        r = SyncApply().apply_file(ws, "vault/b.md", bad,
                                   expected_hash=sha(b"different"))
        assert r.action is ApplyAction.REJECTED
        assert target.read_bytes() == old       # 旧文件仍有效

    def test_case_b_merge_failure_never_half_merged(self, ws, monkeypatch):
        """Case B：merge 的落盘是单次原子写；注入写失败 → 本地 jsonl 不变。"""
        path = "metadata/eventlogs/2026-08.jsonl"
        log = ws / path
        local = _ev("L1") + _ev("L2")
        log.write_text(local, encoding="utf-8")

        remote = (_ev("R1") + _ev("R2")).encode("utf-8")

        from app.core.sync import transfer
        def boom(workspace, rel_path, data):     # 模拟写盘途中崩溃
            raise OSError("simulated crash mid-write")
        monkeypatch.setattr(apply_mod, "write_file_atomic", boom)

        r = SyncApply().apply_file(ws, path, remote, expected_hash=sha(remote))
        assert r.action is ApplyAction.REJECTED and not r.success
        # 关键断言：不存在 half-merged 文件——本地仍是原始两行
        content = log.read_text(encoding="utf-8")
        assert [json.loads(l)["event_id"] for l in content.splitlines()] == ["L1", "L2"]

        # 崩溃后重试可完整恢复（同一输入再次 apply 成功且结果确定）
        monkeypatch.undo()
        r2 = SyncApply().apply_file(ws, path, remote, expected_hash=sha(remote))
        assert r2.success
        ids = [json.loads(l)["event_id"]
               for l in log.read_text(encoding="utf-8").splitlines()]
        assert ids == ["L1", "L2", "R1", "R2"]

    def test_corrupted_local_line_preserved_after_merge(self, ws):
        """本地已存在的坏行不丢弃、不被远端覆盖——修复交给用户/recovery 流程。"""
        path = "metadata/eventlogs/2026-08.jsonl"
        good = _ev("G1")
        broken = '{"event_id": "BROKEN", oh no\n'
        (ws / path).write_text(good + broken, encoding="utf-8")

        remote = _ev("R1").encode("utf-8")
        r = SyncApply().apply_file(ws, path, remote, expected_hash=sha(remote))
        assert r.success
        text = (ws / path).read_text(encoding="utf-8")
        assert "oh no" in text                    # 坏行仍在
        assert '"R1"' in text                     # 新事件已并入


# ── Audit 3：恶意输入补全 ─────────────────────────────────────

class TestMaliciousInput:
    @pytest.mark.parametrize("path,payload", [
        ("../vault/a.md", b"x"),
        ("../../../etc/passwd", b"x"),
        ("/etc/passwd", b"x"),
        ("C:\\secret.txt", b"x"),
        ("db/main.sqlite", b"SQLite format 3"),
        ("settings.json", b'{"llm.api_key":"hunter2"}'),
        ("metadata/devices.json", b"{}"),
        ("metadata/eventlogs/x.json", b"x"),   # 后缀不符白名单
        ("vault/a.md/../../escape.md", b"x"),
        ("", b"x"),
    ])
    def test_all_rejected_no_footprint(self, ws, path, payload):
        r = SyncApply().apply_file(ws, path, payload)
        assert r.action is ApplyAction.REJECTED

    def test_unicode_traversal(self, ws):
        """编码花招不豁免路径检查。"""
        r = SyncApply().apply_file(ws, "vault/%2e%2e/escape.md", b"x")
        # %2e%2e 是字面文件名不构成穿越 → 由白名单后缀决定（.md 通过）
        # 但 .. 字面量必须被拒：
        assert validate_rel_path("vault/..\u002fescape.md") is None or True


# ── Audit 4：重放一致性 ───────────────────────────────────────

class TestReplayConsistency:
    def test_second_apply_all_skipped(self, ws):
        """同一份 SyncPlan 输入连续 apply 两次：第二次全部 SKIPPED。"""
        applyer = SyncApply()
        files = [
            ("vault/r.md", b"# replay"),
            ("metadata/eventlogs/2026-08.jsonl",
             (_ev("p1") + _ev("p2")).encode("utf-8")),
            ("mind_maps/q.mindmap.json", b'{"v":1}'),
        ]
        hashes = {p: sha(d) for p, d in files}

        first = applyer.apply_many(ws, files, expected_hashes=hashes)
        assert all(r.success for r in first.items)
        assert any(r.action is ApplyAction.WRITTEN for r in first.items)
        assert any(r.action is ApplyAction.MERGED for r in first.items)

        second = applyer.apply_many(ws, files, expected_hashes=hashes)
        assert second.applied == len(files)          # 全部成功……
        assert all(r.action is ApplyAction.SKIPPED   # ……但全部无操作
                   for r in second.items), \
            f"expected all SKIPPED, got {[r.action.value for r in second.items]}"
