"""M7-001.5 Sync Simulation：双设备同步集成测试。

模拟两个独立 workspace，测试完整的扫描→diff→同步流程。
不涉及网络通信，只测试同步逻辑正确性。

ADR-020 冻结：
  - 同步只复制 Layer 1 文件（vault/eventlogs/mind_maps）
  - SQLite 永不同步
  - 冲突保留双份 + 用户手动合并
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest


# ── Test Helper ───────────────────────────────────────────────

class DualWorkspace:
    """模拟双设备 workspace 环境。"""

    def __init__(self, tmp_path: Path):
        self.root = tmp_path
        self.a = tmp_path / "device_a"
        self.b = tmp_path / "device_b"
        self._init_workspace(self.a)
        self._init_workspace(self.b)

    def _init_workspace(self, ws: Path) -> None:
        for sub in ("vault", "metadata/eventlogs", "mind_maps", "db"):
            (ws / sub).mkdir(parents=True, exist_ok=True)

    def write_vault(self, device: Path, name: str, content: str) -> None:
        (device / "vault" / name).write_text(content, encoding="utf-8")

    def read_vault(self, device: Path, name: str) -> str:
        return (device / "vault" / name).read_text(encoding="utf-8")

    def vault_exists(self, device: Path, name: str) -> bool:
        return (device / "vault" / name).exists()

    def write_eventlog(self, device: Path, filename: str, lines: list[dict]) -> None:
        path = device / "metadata" / "eventlogs" / filename
        with open(path, "a", encoding="utf-8") as f:
            for line in lines:
                f.write(json.dumps(line, ensure_ascii=False) + "\n")

    def read_eventlog(self, device: Path, filename: str) -> list[dict]:
        path = device / "metadata" / "eventlogs" / filename
        if not path.exists():
            return []
        lines = []
        with open(path, encoding="utf-8") as f:
            for raw in f:
                raw = raw.strip()
                if raw:
                    lines.append(json.loads(raw))
        return lines

    def scan(self, device: Path, device_id: str):
        from app.core.sync.scanner import scan_workspace
        return scan_workspace(device, device_id=device_id)

    def diff(self, local, remote, *, conflict_on_both_modified: bool = True):
        from app.core.sync.diff import diff_manifests
        return diff_manifests(local, remote, conflict_on_both_modified=conflict_on_both_modified)

    def apply_upload(self, local: Path, remote: Path, plan) -> int:
        """模拟上传：将 local 独有的文件复制到 remote。"""
        from app.core.sync.diff import Action
        count = 0
        for item in plan.get_items_by_action(Action.UPLOAD):
            src = local / item.path
            dst = remote / item.path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            count += 1
        return count

    def apply_download(self, local: Path, remote: Path, plan) -> int:
        """模拟下载：将 remote 独有的文件复制到 local。"""
        from app.core.sync.diff import Action
        count = 0
        for item in plan.get_items_by_action(Action.DOWNLOAD):
            src = remote / item.path
            dst = local / item.path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            count += 1
        return count

    def apply_full_sync(self, device_a: Path, device_b: Path, *, conflict_on_both_modified: bool = True):
        """完整同步流程：scan → diff → apply。"""
        ma = self.scan(device_a, "device-a")
        mb = self.scan(device_b, "device-b")
        plan = self.diff(ma, mb, conflict_on_both_modified=conflict_on_both_modified)
        # A→B: upload A 独有的文件到 B
        uploaded = self.apply_upload(device_a, device_b, plan)
        # B→A: download B 独有的文件到 A
        downloaded = self.apply_download(device_a, device_b, plan)
        return plan, uploaded, downloaded


# ── Case 1: 首次同步 A→B ────────────────────────────────────

class TestFirstSync:
    def test_a_to_b_upload(self, tmp_path):
        """A 有文件，B 为空 → A 上传到 B。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "ml.md", "# Machine Learning")

        plan, uploaded, downloaded = ws.apply_full_sync(ws.a, ws.b)

        assert uploaded == 1  # A uploads ml.md to B
        assert downloaded == 0
        assert ws.vault_exists(ws.b, "ml.md")
        assert ws.read_vault(ws.b, "ml.md") == "# Machine Learning"

    def test_b_to_a_upload(self, tmp_path):
        """B 有文件，A 为空 → B 上传到 A（A 下载）。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.b, "math.md", "# Mathematics")

        plan, uploaded, downloaded = ws.apply_full_sync(ws.a, ws.b)

        assert uploaded == 0
        assert downloaded == 1  # A downloads math.md from B
        assert ws.vault_exists(ws.a, "math.md")
        assert ws.read_vault(ws.a, "math.md") == "# Mathematics"

    def test_both_empty_noop(self, tmp_path):
        """双方都空 → 无操作。"""
        ws = DualWorkspace(tmp_path)
        plan, uploaded, downloaded = ws.apply_full_sync(ws.a, ws.b)
        assert uploaded == 0
        assert downloaded == 0


# ── Case 2: 双向新增 ─────────────────────────────────────────

class TestBidirectionalAdd:
    def test_both_add_different_files(self, tmp_path):
        """A 添加 math.md，B 添加 ml.md → 双方互相下载。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "math.md", "# Math")
        ws.write_vault(ws.b, "ml.md", "# ML")

        plan, uploaded, downloaded = ws.apply_full_sync(ws.a, ws.b)

        # A 上传 math.md，B 上传 ml.md
        assert uploaded == 1  # math.md A→B
        assert downloaded == 1  # ml.md B→A
        assert ws.vault_exists(ws.a, "ml.md")
        assert ws.vault_exists(ws.b, "math.md")

    def test_three_files_sync(self, tmp_path):
        """A 有 2 个文件，B 有 1 个文件 → 互补。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "a1.md", "A1")
        ws.write_vault(ws.a, "a2.md", "A2")
        ws.write_vault(ws.b, "b1.md", "B1")

        plan, uploaded, downloaded = ws.apply_full_sync(ws.a, ws.b)

        assert uploaded == 2  # a1.md, a2.md
        assert downloaded == 1  # b1.md
        assert ws.vault_exists(ws.a, "b1.md")
        assert ws.vault_exists(ws.b, "a1.md")
        assert ws.vault_exists(ws.b, "a2.md")


# ── Case 3: 冲突检测 ─────────────────────────────────────────

class TestConflict:
    def test_conflict_detected(self, tmp_path):
        """双方修改同一文件 → CONFLICT。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "note.md", "version A")
        ws.write_vault(ws.b, "note.md", "version B")

        ma = ws.scan(ws.a, "device-a")
        mb = ws.scan(ws.b, "device-b")
        plan = ws.diff(ma, mb)

        from app.core.sync.diff import Action
        items = plan.get_items_by_action(Action.CONFLICT)
        assert len(items) == 1
        assert items[0].path == "vault/note.md"

    def test_conflict_no_file_loss(self, tmp_path):
        """冲突时双方文件都不丢失。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "note.md", "version A")
        ws.write_vault(ws.b, "note.md", "version B")

        # 冲突时不自动同步，只检测
        ma = ws.scan(ws.a, "device-a")
        mb = ws.scan(ws.b, "device-b")
        plan = ws.diff(ma, mb)

        # 不执行 apply，文件保持原样
        assert ws.read_vault(ws.a, "note.md") == "version A"
        assert ws.read_vault(ws.b, "note.md") == "version B"

    def test_lww_mindmap(self, tmp_path):
        """MindMap 冲突使用 last-write-wins。"""
        ws = DualWorkspace(tmp_path)
        # A 的 mindmap 更新
        (ws.a / "mind_maps").mkdir(exist_ok=True)
        (ws.a / "mind_maps" / "p.mindmap.json").write_text('{"v":"a"}')
        (ws.b / "mind_maps").mkdir(exist_ok=True)
        (ws.b / "mind_maps" / "p.mindmap.json").write_text('{"v":"b"}')

        # 设置不同的 mtime
        import os
        os.utime(ws.a / "mind_maps" / "p.mindmap.json", (200, 200))
        os.utime(ws.b / "mind_maps" / "p.mindmap.json", (100, 100))

        ma = ws.scan(ws.a, "device-a")
        mb = ws.scan(ws.b, "device-b")
        plan = ws.diff(ma, mb, conflict_on_both_modified=False)

        from app.core.sync.diff import Action
        # A 的 mtime 更新，应该 UPLOAD（覆盖 B）
        items = plan.get_items_by_action(Action.UPLOAD)
        assert len(items) == 1
        assert items[0].path == "mind_maps/p.mindmap.json"

    def test_skip_identical_files(self, tmp_path):
        """相同文件 → SKIP。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "note.md", "same content")
        ws.write_vault(ws.b, "note.md", "same content")

        ma = ws.scan(ws.a, "device-a")
        mb = ws.scan(ws.b, "device-b")
        plan = ws.diff(ma, mb)

        from app.core.sync.diff import Action
        assert len(plan.get_items_by_action(Action.SKIP)) == 1


# ── Case 4: Event Log Merge ──────────────────────────────────

class TestEventMerge:
    def test_merge_disjoint_events(self, tmp_path):
        """A 有 event1+2，B 有 event2+3 → 合并无重复。"""
        ws = DualWorkspace(tmp_path)
        ws.write_eventlog(ws.a, "2026-08.jsonl", [
            {"event_id": "e1", "type": "review"},
            {"event_id": "e2", "type": "learn"},
        ])
        ws.write_eventlog(ws.b, "2026-08.jsonl", [
            {"event_id": "e2", "type": "learn"},
            {"event_id": "e3", "type": "review"},
        ])

        # 读取并合并（模拟 append-only + idempotent）
        events_a = ws.read_eventlog(ws.a, "2026-08.jsonl")
        events_b = ws.read_eventlog(ws.b, "2026-08.jsonl")

        # 按 event_id 去重合并
        seen = set()
        merged = []
        for e in events_a + events_b:
            eid = e["event_id"]
            if eid not in seen:
                seen.add(eid)
                merged.append(e)

        assert len(merged) == 3
        assert [e["event_id"] for e in merged] == ["e1", "e2", "e3"]

    def test_event_idempotent_import(self, tmp_path):
        """重复导入相同 event → 不重复。"""
        ws = DualWorkspace(tmp_path)
        events = [
            {"event_id": "e1", "type": "review"},
            {"event_id": "e2", "type": "learn"},
        ]
        ws.write_eventlog(ws.a, "2026-08.jsonl", events)
        ws.write_eventlog(ws.a, "2026-08.jsonl", events)  # 重复导入

        all_events = ws.read_eventlog(ws.a, "2026-08.jsonl")
        # 去重
        seen = set()
        unique = []
        for e in all_events:
            if e["event_id"] not in seen:
                seen.add(e["event_id"])
                unique.append(e)

        assert len(unique) == 2

    def test_empty_eventlog_merge(self, tmp_path):
        """空 eventlog 合并 → 无操作。"""
        ws = DualWorkspace(tmp_path)
        events_a = ws.read_eventlog(ws.a, "2026-08.jsonl")
        events_b = ws.read_eventlog(ws.b, "2026-08.jsonl")
        assert events_a == []
        assert events_b == []


# ── Case 5: 幂等性 ──────────────────────────────────────────

class TestIdempotency:
    def test_sync_twice_same_result(self, tmp_path):
        """同步两次，第二次所有文件 SKIP。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "note.md", "content")

        # 第一次同步
        plan1, u1, d1 = ws.apply_full_sync(ws.a, ws.b)
        assert u1 + d1 == 1  # 有一次传输

        # 第二次同步
        plan2, u2, d2 = ws.apply_full_sync(ws.a, ws.b)
        assert u2 == 0
        assert d2 == 0
        assert plan2.summary["skip"] >= 1

    def test_manifest_deterministic(self, tmp_path):
        """相同 workspace 两次扫描结果一致。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "note.md", "content")

        m1 = ws.scan(ws.a, "device-a")
        m2 = ws.scan(ws.a, "device-a")

        assert len(m1.files) == len(m2.files)
        for path in m1.files:
            assert path in m2.files
            assert m1.files[path].sha256 == m2.files[path].sha256

    def test_diff_deterministic(self, tmp_path):
        """相同 manifest 对两次 diff 结果一致。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "a.md", "a")
        ws.write_vault(ws.b, "b.md", "b")

        ma = ws.scan(ws.a, "device-a")
        mb = ws.scan(ws.b, "device-b")

        plan1 = ws.diff(ma, mb)
        plan2 = ws.diff(ma, mb)
        assert plan1.to_dict() == plan2.to_dict()


# ── Case 6: 复杂场景 ─────────────────────────────────────────

class TestComplexScenario:
    def test_full_cycle(self, tmp_path):
        """完整周期：初始同步 → 各自修改 → 再同步 → 冲突检测。"""
        ws = DualWorkspace(tmp_path)

        # Step 1: A 创建文件
        ws.write_vault(ws.a, "note.md", "original")

        # Step 2: 首次同步 A→B
        plan1, u1, d1 = ws.apply_full_sync(ws.a, ws.b)
        assert u1 == 1  # A uploads note.md to B
        assert d1 == 0
        assert ws.read_vault(ws.b, "note.md") == "original"

        # Step 3: 双方各自修改
        ws.write_vault(ws.a, "note.md", "modified by A")
        ws.write_vault(ws.b, "note.md", "modified by B")
        ws.write_vault(ws.a, "new_a.md", "new from A")

        # Step 4: 再次同步 → 检测到冲突 + 上传
        ma = ws.scan(ws.a, "device-a")
        mb = ws.scan(ws.b, "device-b")
        plan2 = ws.diff(ma, mb)

        from app.core.sync.diff import Action
        assert len(plan2.get_items_by_action(Action.CONFLICT)) == 1  # note.md
        assert len(plan2.get_items_by_action(Action.UPLOAD)) == 1   # new_a.md

    def test_nested_directory_sync(self, tmp_path):
        """嵌套目录文件同步。"""
        ws = DualWorkspace(tmp_path)
        (ws.a / "vault" / "ml" / "topics").mkdir(parents=True)
        (ws.a / "vault" / "ml" / "topics" / "nn.md").write_text("# NN")

        plan, u, d = ws.apply_full_sync(ws.a, ws.b)

        assert u == 1  # A uploads to B
        assert ws.vault_exists(ws.b, "ml/topics/nn.md")

    def test_chinese_filename_sync(self, tmp_path):
        """中文文件名同步。"""
        ws = DualWorkspace(tmp_path)
        ws.write_vault(ws.a, "机器学习.md", "# 机器学习\n\n深度学习是子集。")

        plan, u, d = ws.apply_full_sync(ws.a, ws.b)

        assert u == 1  # A uploads to B
        assert ws.vault_exists(ws.b, "机器学习.md")
        assert "深度学习" in ws.read_vault(ws.b, "机器学习.md")
