"""M2 E2E 烟测（TestClient，无需真实 uvicorn/网络/PowerShell）。

覆盖批准条件：链接解析、桩升级、反链、图谱读模型、搜索、级联清理。
一条 pytest 命令跑完，~2s 出结果。
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.knowledge import (
    get_note_row,
    read_note_file,
    rebuild_note_links,
)


def _open_db(ws: Path) -> sqlite3.Connection:
    """打开测试隔离 workspace 的 DB（用完必须 close）。"""
    conn = sqlite3.connect(str(ws / "db" / "learning-os.db"))
    conn.row_factory = sqlite3.Row
    return conn


def test_m2_full_flow(client: TestClient, tmp_workspace: Path) -> None:
    """M2 全流程：创建 → 链接 → 反链 → 图谱 → 搜索 → 附件守卫 → 级联删除。"""

    # ── 1. 创建三笔记，两条链向同一目标 ─────────────────────────────
    r = client.post("/api/v1/notes", json={
        "title": "SortOverview",
        "content_md": "关联[[QuickSort]]和[[BubbleSort]]"})
    assert r.status_code == 201, r.text
    a_id = r.json()["note"]["id"]

    r = client.post("/api/v1/notes", json={
        "title": "QuickSort", "content_md": "分治思想"})
    assert r.status_code == 201, r.text
    b_id = r.json()["note"]["id"]

    r = client.post("/api/v1/notes", json={
        "title": "SortReview",
        "content_md": "复习[[QuickSort]]和[[BubbleSort]]"})
    assert r.status_code == 201, r.text

    # ── 2. 桩升级验证 ─────────────────────────────────────────────
    conn = _open_db(tmp_workspace)
    stubs = [r[0] for r in conn.execute(
        "SELECT title FROM concepts WHERE status='unconfirmed'").fetchall()]
    qs_note = conn.execute(
        "SELECT id FROM notes WHERE title='QuickSort'").fetchone()
    qs_stub = conn.execute(
        "SELECT id FROM concepts WHERE title='QuickSort' AND status='unconfirmed'"
    ).fetchone()
    conn.close()
    assert "BubbleSort" in stubs, f"stubs: {stubs}"
    assert qs_note is not None, "QuickSort should be a note"
    assert qs_stub is None, "concept stub should be promoted"

    # ── 3. 反链 ──────────────────────────────────────────────────
    r = client.get(f"/api/v1/notes/{b_id}/backlinks")
    assert r.status_code == 200, r.text
    bl = r.json()["backlinks"]
    titles = {x["title"] for x in bl}
    assert len(bl) == 2, f"backlinks: {titles}"
    assert titles >= {"SortOverview", "SortReview"}

    # ── 4. 图谱读模型 ────────────────────────────────────────────
    g = client.get(f"/api/v1/graph?root_type=note&root_id={a_id}&depth=2")
    assert g.status_code == 200, g.text
    data = g.json()
    assert len(data["nodes"]) >= 3, f"nodes: {len(data['nodes'])}"
    assert len(data["edges"]) >= 2, f"edges: {len(data['edges'])}"
    for n in data["nodes"]:
        assert n["learning"]["mastery"] is None
        assert n["learning"]["review_due"] is None

    # ── 5. 图谱非法参数 ──────────────────────────────────────────
    r = client.get("/api/v1/graph?root_type=alien")
    assert r.status_code == 400 and r.json()["error"]["code"] == "bad_params"
    r = client.get("/api/v1/graph?depth=9")
    assert r.status_code == 400

    # ── 6. FTS 搜索 ──────────────────────────────────────────────
    r = client.get("/api/v1/search?q=QuickSort")
    assert r.status_code == 200, r.text
    results = {x["title"] for x in r.json()["results"]}
    assert "QuickSort" in results, f"search: {results}"

    # ── 7. 附件路径守卫 ───────────────────────────────────────────
    r = client.post("/api/v1/notes", json={
        "title": "BadPath", "content_md": "![x](C:\\Users\\a.png)"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "bad_attachment_path"

    # ── 8. rebuild 幂等 ──────────────────────────────────────────
    conn = _open_db(tmp_workspace)
    db_row = get_note_row(conn, a_id)
    _, body = read_note_file(db_row["path"])
    rebuild_note_links(conn, a_id, body)
    c1 = conn.execute(
        "SELECT count(*) FROM links WHERE source_type='note' AND source_id=?",
        (a_id,)).fetchone()[0]
    rebuild_note_links(conn, a_id, body)
    c2 = conn.execute(
        "SELECT count(*) FROM links WHERE source_type='note' AND source_id=?",
        (a_id,)).fetchone()[0]
    conn.close()
    assert c1 == c2 == 2, f"idempotent: {c1} → {c2}"

    # ── 9. 级联删除 ──────────────────────────────────────────────
    r = client.delete(f"/api/v1/notes/{b_id}")
    assert r.status_code == 200, r.text
    r2 = client.get(f"/api/v1/notes/{a_id}/backlinks")
    assert r2.status_code == 200
    assert len(r2.json()["backlinks"]) == 0

    conn = _open_db(tmp_workspace)
    left = conn.execute(
        "SELECT count(*) FROM links WHERE target_type='note' AND target_id=?",
        (b_id,)).fetchone()[0]
    conn.close()
    assert left == 0, f"orphaned links: {left}"

    # ── 10. Vault 文件一致性 ──────────────────────────────────────
    r = client.get("/api/v1/notes")
    assert r.status_code == 200
    assert len(r.json()["notes"]) >= 2
