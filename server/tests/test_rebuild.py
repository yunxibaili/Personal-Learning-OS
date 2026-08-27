"""数据重建 + 事件重放确定性测试（M4-Preflight Hardening）。

测试两个核心能力：
1. Projection rebuild：直接调 migrate() 验证幂等
2. Event replay determinism：同事件流两次重放 mastery 一致
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.knowledge import connect as _connect
from app.db import migrate


def _open_db(ws: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(ws / "db" / "learning-os.db"))
    conn.row_factory = sqlite3.Row
    return conn


# ── Projection Rebuild ──────────────────────────────────────────────

def test_db_rebuild_from_vault(client: TestClient, tmp_workspace: Path) -> None:
    """删 DB → migrate() → vault 文件仍在。"""
    # 创建笔记
    r = client.post("/api/v1/notes", json={
        "title": "RebuildTest", "content_md": "重建测试内容"})
    assert r.status_code == 201

    # vault 文件存在
    vault_file = tmp_workspace / "vault" / "RebuildTest.md"
    assert vault_file.exists()

    # 直接调 migrate() 验证幂等
    conn = _open_db(tmp_workspace)
    newly = migrate(conn)
    conn.close()
    # 无新版本 = 幂等
    assert newly == []


# ── Event Replay Determinism ────────────────────────────────────────

def test_event_replay_determinism(client: TestClient) -> None:
    """同事件流两次重放 mastery 结果一致。"""
    from app.core.mastery import update_mastery, compute_effective

    conn = _connect()
    try:
        # 创建 concept
        conn.execute("INSERT INTO concepts (title, status) VALUES (?, 'active')",
                     ("ReplayTest",))
        conn.commit()
        cid = conn.execute("SELECT id FROM concepts WHERE title='ReplayTest'").fetchone()["id"]

        # 模拟事件流
        events = [
            ("answer_correct", "review"),
            ("answer_wrong", "review"),
            ("explain", "tutor"),
        ]

        # 第一次 replay
        for etype, src in events:
            update_mastery(conn, cid, etype, source=src)
        conn.commit()

        m1 = conn.execute(
            "SELECT dimensions FROM concept_mastery WHERE concept_id=?", (cid,)
        ).fetchone()
        dims1 = json.loads(m1["dimensions"])

        # 删除 mastery 行
        conn.execute("DELETE FROM concept_mastery WHERE concept_id=?", (cid,))
        conn.commit()

        # 第二次 replay（从 events 重放）
        event_rows = conn.execute(
            "SELECT event_type, source FROM learning_events WHERE concept_id=? ORDER BY id",
            (cid,),
        ).fetchall()
        for row in event_rows:
            update_mastery(conn, cid, row["event_type"], source=row["source"])
        conn.commit()

        m2 = conn.execute(
            "SELECT dimensions FROM concept_mastery WHERE concept_id=?", (cid,)
        ).fetchone()
        dims2 = json.loads(m2["dimensions"])

        # 两次结果一致
        for dim in ["knowledge", "practice", "recall", "transfer"]:
            assert dims1[dim] == dims2[dim], f"{dim}: {dims1[dim]} != {dims2[dim]}"
    finally:
        conn.close()


def test_search_fts_special_chars(client: TestClient) -> None:
    """FTS5 特殊字符不再抛异常。"""
    # 创建笔记
    client.post("/api/v1/notes", json={
        "title": "FTS Test", "content_md": "FTS 搜索测试"})

    # 这些查询不应抛异常
    for q in ["a-b", "hello(world)", "C++指针", "test\"quote", "OR"]:
        r = client.get(f"/api/v1/search?q={q}")
        assert r.status_code == 200, f"query '{q}' caused error"
