"""M7-006 E2E LAN Demo：证明「两个真实进程经真实网络完成一次完整同步」。

阶段（docs/ai/ACTIVE_TASK.md 调整版）：
  Phase 1  SyncPair 双 workspace runner（无网络）
  Phase 2  四场景仿真（Case 1-4，仍走内存 transfer 对象）
  Phase 3.1  真实 socket：Device B = 独立 uvicorn 子进程，Device A 全链路 HTTP
  Phase 3.2  失败恢复：对端不可达 → 重试 → 最终一致

验收（ADR-020）：仅比较 Layer 1 Truth Source 字节；禁止比较 Derived State。
"""
from __future__ import annotations

import hashlib
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

from app.core.sync.apply import SyncApply
from app.core.sync.diff import Action, diff_manifests
from app.core.sync.messages import FileData
from app.core.sync.scanner import scan_workspace
from app.core.sync.status import find_conflicts, resolve_conflict
from app.core.sync.transport import SyncTransport


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class SyncPair:
    """Phase 1 runner：两个独立设备工作区 + 可复用的同步周期。"""

    def __init__(self, root: Path):
        self.a = self._make_device(root / "device_a", "device-a")
        self.b = self._make_device(root / "device_b", "device-b")

    @staticmethod
    def _make_device(path: Path, device_id: str) -> Path:
        for sub in ("vault", "metadata/eventlogs", "mind_maps"):
            (path / sub).mkdir(parents=True, exist_ok=True)
        return path

    def write(self, device: Path, rel: str, text: str) -> None:
        target = device / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")

    def sync(self) -> list[tuple[Action, str]]:
        """执行一次双向同步周期：scan → diff(双视角) → 按协议对象传输。

        策略：
          - 任一视角的 UPLOAD（对端缺失的新文件）→ 单向传输
          - CONFLICT 分类型：eventlogs/mindmaps 两侧都传输
            （jsonl 由 Apply 追加合并去重；mindmap 产生冲突备份），
            vault 保持原样（双份机制属 M7-007，未实现前不覆盖任何一方）
        返回 [(Action, path)]。
        """
        from app.core.sync.transfer import encode_content

        ma, mb = scan_workspace(self.a, "a"), scan_workspace(self.b, "b")
        plan_ab = diff_manifests(ma, mb)
        plan_ba = diff_manifests(mb, ma)
        moved: list[tuple[Action, str]] = []

        def move(src: Path, dst: Path, dst_is_b: bool, path: str) -> None:
            raw = (src / path).read_bytes()
            file_data = FileData(
                path=path,
                content=encode_content(raw),
                sha256=_sha(raw),
                size=len(raw),
            )
            ack = SyncTransport().receive_incoming(dst, file_data)
            assert ack.status == "ok", f"{path}: {ack.message}"
            action = Action.UPLOAD if dst_is_b else Action.DOWNLOAD
            moved.append((action, path))

        for item in plan_ab.get_items_by_action(Action.UPLOAD):
            move(self.a, self.b, True, item.path)
        for item in plan_ba.get_items_by_action(Action.UPLOAD):
            move(self.b, self.a, False, item.path)

        conflicts = {i.path for i in plan_ab.items if i.action == Action.CONFLICT}
        for path in sorted(conflicts):
            if (path.startswith("metadata/eventlogs/")
                    or path.startswith("mind_maps/")):
                move(self.a, self.b, True, path)
                move(self.b, self.a, False, path)
                moved.append((Action.CONFLICT, path))
            # vault 冲突：不动作（M7-007 前禁止静默覆盖任一方的真相）
        return moved

    def layer1_snapshot(self, device: Path) -> dict[str, str]:
        """ADR-020 Layer 1 文件的 sha256 快照（验收唯一比对对象）。"""
        snap: dict[str, str] = {}
        for sub in ("vault", "metadata/eventlogs", "mind_maps"):
            base = device / sub
            if not base.exists():
                continue
            for p in sorted(base.rglob("*")):
                if p.is_file():
                    snap[f"{sub}/{p.relative_to(base).as_posix()}"] = _sha(p.read_bytes())
        return snap


# ── Phase 2：四场景仿真 ────────────────────────────────────────

class TestSimulationCases:
    def test_case1_unidirectional_note(self, tmp_path):
        pair = SyncPair(tmp_path)
        pair.write(pair.a, "vault/python.md", "# Python")
        moved = pair.sync()
        assert (Action.UPLOAD, "vault/python.md") in moved
        assert (pair.b / "vault" / "python.md").read_text(encoding="utf-8") == "# Python"

    def test_case2_bidirectional_new_notes(self, tmp_path):
        pair = SyncPair(tmp_path)
        pair.write(pair.a, "vault/math.md", "# Math")
        pair.write(pair.b, "vault/physics.md", "# Physics")
        pair.sync()
        assert (pair.a / "vault" / "physics.md").exists()
        assert (pair.b / "vault" / "math.md").exists()
        assert pair.layer1_snapshot(pair.a) == pair.layer1_snapshot(pair.b)

    def test_case3_event_merge_dedup(self, tmp_path):
        pair = SyncPair(tmp_path)
        ev = lambda eid: json.dumps({"event_id": eid, "type": "explain"}) + "\n"
        pair.write(pair.a, "metadata/eventlogs/2026-08.jsonl", ev("e1"))
        pair.write(pair.b, "metadata/eventlogs/2026-08.jsonl", ev("e2"))
        moved = pair.sync()
        assert any(a is Action.CONFLICT for a, _ in moved)      # 双侧修改被识别
        ids_a = [json.loads(l)["event_id"]
                 for l in (pair.a / "metadata/eventlogs/2026-08.jsonl").read_text().splitlines()]
        ids_b = [json.loads(l)["event_id"]
                 for l in (pair.b / "metadata/eventlogs/2026-08.jsonl").read_text().splitlines()]
        assert sorted(ids_a) == ["e1", "e2"] == sorted(ids_b)   # 合并且去重

    def test_case4_mindmap_conflict_then_resolve(self, tmp_path):
        pair = SyncPair(tmp_path)
        pair.write(pair.b, "mind_maps/map.mindmap.json",
                   json.dumps({"v": 1, "src": "remote-first"}))
        pair.sync()                                             # A 获得 B 的初版
        # 两端各自分叉后再同步 → 双向传输后两侧主文件收敛一致；
        # 被覆盖一方的本地版留在 *.local.json 备份（不参与 Layer1 比较）
        local_version = {"v": 1, "layout": {"n1": [9, 9]}, "src": "local-edit"}
        (pair.a / "mind_maps" / "map.mindmap.json").write_text(
            json.dumps(local_version), encoding="utf-8")
        remote_edit = {"v": 1, "src": "remote-edit"}
        (pair.b / "mind_maps" / "map.mindmap.json").write_text(
            json.dumps(remote_edit), encoding="utf-8")
        moved = pair.sync()
        assert any(a is Action.CONFLICT for a, _ in moved)

        main_a = json.loads((pair.a / "mind_maps" / "map.mindmap.json")
                            .read_text(encoding="utf-8"))
        main_b = json.loads((pair.b / "mind_maps" / "map.mindmap.json")
                            .read_text(encoding="utf-8"))
        assert main_a == main_b                                 # 收敛：主文件一致
        backups = list((pair.a / "mind_maps").glob("*.local.json")) + \
                  list((pair.b / "mind_maps").glob("*.local.json"))
        assert len(backups) >= 1                                # 至少一侧保留了被覆盖版

        # 用户裁决：在存在本地备份的一侧执行 keep_local → artifact 清除
        target = pair.a if (pair.a / "mind_maps" / "map.local.json").exists() else pair.b
        ok, _ = resolve_conflict(target, "mind_maps/map.mindmap.json", "keep_local")
        assert ok
        assert find_conflicts(target) == []

    def test_idempotent_replay_all_skip(self, tmp_path):
        pair = SyncPair(tmp_path)
        pair.write(pair.a, "vault/dup.md", "x")
        pair.sync()
        assert pair.sync() == []                                # 第二轮零传输


# ── Phase 3.1 / 3.2：真实 socket（Device B 为独立进程）───────────

def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture()
def device_b_server(tmp_path):
    """独立子进程运行 FastAPI（WORKSPACE_DIR 指向 device_b），返回 (base_url, b_ws)。"""
    b_ws = tmp_path / "device_b"
    for sub in ("vault", "metadata/eventlogs", "mind_maps", "db"):
        (b_ws / sub).mkdir(parents=True, exist_ok=True)
    port = _free_port()
    env = {**os.environ, "WORKSPACE_DIR": str(b_ws), "PORT": str(port)}
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(Path(__file__).resolve().parents[3]),
        env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base_url = f"http://127.0.0.1:{port}"
    import urllib.request
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{base_url}/api/v1/health", timeout=2) as r:
                if r.status == 200:
                    break
        except OSError:
            time.sleep(0.25)
    else:
        proc.terminate()
        pytest.fail("device B server failed to start")
    yield base_url, b_ws
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


class TestRealLanDemo:
    def test_full_sync_over_real_http(self, tmp_path, device_b_server):
        """Phase 3.1：A 进程内通过真实 HTTP 完成 scan→diff→transport→apply 全链路。"""
        base_url, b_ws = device_b_server
        a_ws = tmp_path / "device_a"
        pair_dir = a_ws.parent
        sp = SyncPair.__new__(SyncPair)
        sp.a = SyncPair._make_device(a_ws, "device-a")
        sp.b = b_ws

        # 种子数据放在各自 workspace
        sp.write(sp.a, "vault/e2e.md", "# over real LAN")
        (b_ws / "metadata/eventlogs/2026-08.jsonl").write_text(
            json.dumps({"event_id": "r1"}) + "\n", encoding="utf-8")

        plan = diff_manifests(scan_workspace(sp.a, "a"), scan_workspace(b_ws, "b"))
        result = SyncTransport().execute_plan(plan, a_ws, peer_url=base_url)
        assert result.failed == 0, [r.message for r in result.results if not r.success]

        # Layer 1 字节级一致（Derived State 不参与比较）
        snap_a, snap_b = sp.layer1_snapshot(a_ws), sp.layer1_snapshot(b_ws)
        assert snap_a == snap_b

        # Phase 3.2 前置：对端已在但无事可做 → 再次全链路应零失败零传输
        plan2 = diff_manifests(scan_workspace(a_ws, "a"), scan_workspace(b_ws, "b"))
        transfers = [i for i in plan2.items if i.action != Action.SKIP]
        assert transfers == []

    def test_phase_3_2_peer_down_then_retry_recovers(self, tmp_path, device_b_server):
        """Phase 3.2：对端不可达时失败但不破坏本地；重试后最终一致。"""
        base_url, b_ws = device_b_server
        dead_url, _dead_port = f"http://127.0.0.1:{_free_port()}", None
        a_ws = tmp_path / "device_a"
        SyncPair._make_device(a_ws, "device-a")
        (a_ws / "vault/retry.md").write_text("# retry me", encoding="utf-8")

        # 1) 对端端口没人监听 → 传输失败，本地文件原样保留
        plan = diff_manifests(scan_workspace(a_ws, "a"), scan_workspace(b_ws, "b"))
        result = SyncTransport().execute_plan(plan, a_ws, peer_url=dead_url)
        assert result.failed >= 1
        assert (a_ws / "vault" / "retry.md").read_text(encoding="utf-8") == "# retry me"

        # 2) 对端恢复后同一计划重试 → 最终一致
        plan2 = diff_manifests(scan_workspace(a_ws, "a"), scan_workspace(b_ws, "b"))
        result2 = SyncTransport().execute_plan(plan2, a_ws, peer_url=base_url)
        assert result2.failed == 0, [r.message for r in result2.results if not r.success]
        assert _sha((a_ws / "vault" / "retry.md").read_bytes()) == \
               _sha((b_ws / "vault" / "retry.md").read_bytes())
