"""P1-MINDMAP-TRUTH 守护测试：sidecar producer + SQLite 从文件重建。

验收链（所有者 2026-09-02 裁定）：
  创建/修改/删除 MindMap → *.mindmap.json 正确变化 →
  SQLite 可从文件重建 → Sync 能发现 sidecar → 另一设备 Apply → 重建 cache。
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from app.core.mindmap import (
    add_edge,
    add_node,
    bind_concept,
    create_map,
    delete_map,
    rebuild_mindmaps,
    sidecar_relpath,
    unbind_concept,
    update_node_position,
    write_sidecar,
)
from app.db import connect, workspace_root
from app.core.sync.scanner import scan_workspace


@pytest.fixture()
def conn(core_conn: sqlite3.Connection) -> sqlite3.Connection:
    return core_conn


def _read_sidecar(ws: Path, map_id: int) -> dict:
    return json.loads((ws / sidecar_relpath(map_id)).read_text(encoding="utf-8"))


def _concept(conn: sqlite3.Connection, title: str) -> int:
    cur = conn.execute(
        "INSERT INTO concepts (title, origin, status) VALUES (?, 'manual', 'active')",
        (title,),
    )
    conn.commit()
    return cur.lastrowid


# ── 1. Producer：增删改 → sidecar 变化 ──────────────────────────

class TestProducer:
    def test_create_map_writes_sidecar(self, conn, tmp_workspace: Path):
        m = create_map("My Map", conn=conn)
        f = tmp_workspace / sidecar_relpath(m["id"])
        assert f.exists()
        data = _read_sidecar(tmp_workspace, m["id"])
        assert data["version"] == "1"
        assert data["type"] == "mindmap_state"
        assert data["map"]["title"] == "My Map"
        assert data["map"]["id"] == m["id"]
        assert data["nodes"] == [] and data["edges"] == []

    def test_add_node_updates_sidecar(self, conn, tmp_workspace: Path):
        m = create_map("M", conn=conn)
        add_node(m["id"], "A", position_x=1.5, position_y=2.5, conn=conn)
        data = _read_sidecar(tmp_workspace, m["id"])
        assert len(data["nodes"]) == 1
        assert data["nodes"][0]["label"] == "A"
        assert data["nodes"][0]["position_x"] == 1.5

    def test_update_position_updates_sidecar(self, conn, tmp_workspace: Path):
        m = create_map("M", conn=conn)
        n = add_node(m["id"], "A", conn=conn)
        assert update_node_position(n["id"], 9.0, 8.0, conn=conn)
        data = _read_sidecar(tmp_workspace, m["id"])
        assert data["nodes"][0]["position_x"] == 9.0
        assert data["nodes"][0]["position_y"] == 8.0

    def test_edge_add_delete_updates_sidecar(self, conn, tmp_workspace: Path):
        m = create_map("M", conn=conn)
        a = add_node(m["id"], "A", conn=conn)
        b = add_node(m["id"], "B", conn=conn)
        e = add_edge(m["id"], a["id"], b["id"], "causes", conn=conn)
        data = _read_sidecar(tmp_workspace, m["id"])
        assert len(data["edges"]) == 1
        assert data["edges"][0]["relation"] == "causes"
        # 删边 → sidecar 同步变空
        conn2 = connect()
        from app.core.mindmap import delete_edge
        assert delete_edge(e["id"], conn=conn2)
        conn2.close()
        data = _read_sidecar(tmp_workspace, m["id"])
        assert data["edges"] == []

    def test_bind_unbind_updates_sidecar(self, conn, tmp_workspace: Path):
        cid = _concept(conn, "贝叶斯定理")
        m = create_map("M", conn=conn)
        n = add_node(m["id"], "N", conn=conn)
        bind_concept(n["id"], cid, conn=conn)
        data = _read_sidecar(tmp_workspace, m["id"])
        assert data["nodes"][0]["concept_id"] == cid
        unbind_concept(n["id"], conn=conn)
        data = _read_sidecar(tmp_workspace, m["id"])
        assert data["nodes"][0]["concept_id"] is None

    def test_delete_map_removes_sidecar(self, conn, tmp_workspace: Path):
        m = create_map("M", conn=conn)
        f = tmp_workspace / sidecar_relpath(m["id"])
        assert f.exists()
        assert delete_map(m["id"], conn=conn)
        assert not f.exists()

    def test_missing_sidecar_recreated_on_next_mutation(
        self, conn, tmp_workspace: Path
    ):
        m = create_map("M", conn=conn)
        (tmp_workspace / sidecar_relpath(m["id"])).unlink()
        add_node(m["id"], "A", conn=conn)  # 下一次 mutation 自愈
        data = _read_sidecar(tmp_workspace, m["id"])
        assert len(data["nodes"]) == 1


# ── 2. Sync 能发现 sidecar（白名单扫描）─────────────────────────

class TestSyncDiscovery:
    def test_scan_workspace_includes_sidecar(self, conn, tmp_workspace: Path):
        m = create_map("Sync Me", conn=conn)
        manifest = scan_workspace(tmp_workspace, device_id="dev-a")
        rel = sidecar_relpath(m["id"])
        assert rel in manifest.files
        assert manifest.files[rel].size > 0


# ── 3. SQLite 可从文件重建 ──────────────────────────────────────

class TestRebuild:
    def test_rebuild_restores_full_state_with_ids(
        self, conn, tmp_workspace: Path
    ):
        cid = _concept(conn, "概念甲")
        m = create_map("完整地图", conn=conn)
        a = add_node(m["id"], "A", position_x=1, position_y=2, conn=conn)
        b = add_node(m["id"], "B", conn=conn)
        bind_concept(b["id"], cid, conn=conn)
        add_edge(m["id"], a["id"], b["id"], conn=conn)
        before = _read_sidecar(tmp_workspace, m["id"])

        # 模拟 DB 丢失（SQLite 是缓存）：清空三表
        conn.execute("DELETE FROM mind_map_edges")
        conn.execute("DELETE FROM mind_map_nodes")
        conn.execute("DELETE FROM mind_maps")
        conn.commit()

        stats = rebuild_mindmaps(conn, tmp_workspace)
        conn.commit()
        assert stats["maps_rebuilt"] == 1
        assert stats["nodes_restored"] == 2
        assert stats["edges_restored"] == 1
        assert stats["bindings_dropped"] == 0

        after = _read_sidecar(tmp_workspace, m["id"])  # 文件未被重建改动
        assert after == before
        row = conn.execute(
            "SELECT id, title FROM mind_maps WHERE id=?", (m["id"],)
        ).fetchone()
        assert row["title"] == "完整地图"  # id 保留
        n_b = conn.execute(
            "SELECT concept_id FROM mind_map_nodes WHERE id=?", (b["id"],)
        ).fetchone()
        assert n_b["concept_id"] == cid

    def test_rebuild_new_map_gets_fresh_autoincrement_id(self, conn, tmp_workspace: Path):
        m = create_map("M", conn=conn)
        stats = rebuild_mindmaps(conn, tmp_workspace)
        conn.commit()
        assert stats["maps_rebuilt"] == 1
        fresh = create_map("新图", conn=conn)
        assert fresh["id"] > m["id"]  # rowid 自动 = max+1，不冲突

    def test_rebuild_dangling_concept_binding_nulled(
        self, conn, tmp_workspace: Path
    ):
        cid = _concept(conn, "将被删除的概念")
        m = create_map("M", conn=conn)
        n = add_node(m["id"], "N", conn=conn)
        bind_concept(n["id"], cid, conn=conn)
        # 概念消失（跨设备 concept id 不对齐的现实场景）
        conn.execute("DELETE FROM concepts WHERE id=?", (cid,))
        conn.commit()
        conn.execute("DELETE FROM mind_maps WHERE id=?", (m["id"],))
        conn.commit()

        stats = rebuild_mindmaps(conn, tmp_workspace)
        conn.commit()
        assert stats["bindings_dropped"] == 1
        row = conn.execute(
            "SELECT concept_id FROM mind_map_nodes WHERE id=?", (n["id"],)
        ).fetchone()
        assert row["concept_id"] is None  # FK 硬约束下与 import_map 语义一致

    def test_rebuild_prunes_db_rows_without_sidecar(self, conn, tmp_workspace: Path):
        m = create_map("无文件孤儿", conn=conn)
        (tmp_workspace / sidecar_relpath(m["id"])).unlink()
        stats = rebuild_mindmaps(conn, tmp_workspace)
        conn.commit()
        assert stats["maps_dropped"] == 1
        row = conn.execute(
            "SELECT id FROM mind_maps WHERE id=?", (m["id"],)
        ).fetchone()
        assert row is None

    def test_rebuild_skips_broken_json(self, conn, tmp_workspace: Path):
        create_map("好的", conn=conn)
        bad = tmp_workspace / "mind_maps" / "999.mindmap.json"
        bad.write_text("{not json", encoding="utf-8")
        stats = rebuild_mindmaps(conn, tmp_workspace)
        conn.commit()
        assert stats["broken_files"] == 1
        assert stats["maps_rebuilt"] == 1

    def test_rebuild_idempotent(self, conn, tmp_workspace: Path):
        m = create_map("M", conn=conn)
        add_node(m["id"], "A", conn=conn)
        s1 = rebuild_mindmaps(conn, tmp_workspace)
        conn.commit()
        s2 = rebuild_mindmaps(conn, tmp_workspace)
        conn.commit()
        assert s1["maps_rebuilt"] == s2["maps_rebuilt"] == 1
        count = conn.execute("SELECT COUNT(*) c FROM mind_map_nodes").fetchone()
        assert count["c"] == 1  # 不翻倍


# ── 4. 另一设备闭环：sidecar → 新设备重建 cache ─────────────────

class TestCrossDeviceLoop:
    def test_sidecar_rebuilds_on_fresh_device(self, conn, tmp_workspace: Path):
        """设备 A 增删改产生 sidecar（文件即同步载荷，M7 Apply 已测）；
        设备 B（全新 DB）拿到同一批文件后重建 cache，状态与 A 一致。"""
        _concept(conn, "A 侧占位概念")  # 使「共享概念」id 错开 B 侧（id 由本地重建顺序决定）
        cid = _concept(conn, "共享概念")
        m = create_map("跨设备地图", conn=conn)
        a = add_node(m["id"], "A", position_x=3, position_y=4, conn=conn)
        b = add_node(m["id"], "B", conn=conn)
        bind_concept(a["id"], cid, conn=conn)
        add_edge(m["id"], a["id"], b["id"], conn=conn)
        state_a = _read_sidecar(tmp_workspace, m["id"])

        # 设备 B：独立 workspace（文件由 M7 Apply 落盘——本测试直接复制等价物）
        ws_b = tmp_workspace.parent / "device-b" / "workspace"
        (ws_b / "mind_maps").mkdir(parents=True)
        (ws_b / "mind_maps" / f"{m['id']}.mindmap.json").write_text(
            json.dumps(state_a, ensure_ascii=False), encoding="utf-8"
        )

        from app.db import init_db
        import os
        old_ws = os.environ.get("WORKSPACE_DIR")
        os.environ["WORKSPACE_DIR"] = str(ws_b)
        try:
            init_db()
            conn_b = connect()
            # 设备 B 本地也有一个同名概念（id 不同：本地重建顺序决定）
            cur = conn_b.execute(
                "INSERT INTO concepts (title, origin, status) VALUES (?, 'manual', 'active')",
                ("共享概念",),
            )
            local_cid = cur.lastrowid
            conn_b.commit()
            # 应用层断言：文件 → cache 重建
            stats = rebuild_mindmaps(conn_b, ws_b)
            conn_b.commit()
            assert stats["maps_rebuilt"] == 1
            assert stats["nodes_restored"] == 2 and stats["edges_restored"] == 1
            assert stats["bindings_dropped"] == 1  # A 的 concept id 在 B 不存在 → NULL
            row = conn_b.execute(
                "SELECT title FROM mind_maps WHERE id=?", (m["id"],)
            ).fetchone()
            assert row["title"] == "跨设备地图"
            assert local_cid > 0  # B 本地概念 id 与 A 不同是预期
            conn_b.close()
        finally:
            if old_ws is not None:
                os.environ["WORKSPACE_DIR"] = old_ws
            else:
                os.environ.pop("WORKSPACE_DIR", None)


# ── 5. write_sidecar 直接调用（防御性 API）──────────────────────

class TestWriteSidecar:
    def test_write_sidecar_missing_map_returns_false(self, conn, tmp_workspace: Path):
        assert write_sidecar(conn, 424242, workspace=tmp_workspace) is False

    def test_sidecar_json_is_stable_serializable(self, conn, tmp_workspace: Path):
        m = create_map("序列化", conn=conn)
        add_node(m["id"], "中文标签", conn=conn)
        data = _read_sidecar(tmp_workspace, m["id"])
        assert data["nodes"][0]["label"] == "中文标签"  # ensure_ascii=False round-trip
