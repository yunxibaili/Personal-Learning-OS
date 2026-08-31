"""Scenario B + C — closed loop (isolated, API level).

B: mindmap 闭环: create -> nodes/edges -> bind concept -> export -> delete -> import -> roundtrip.
C: export -> rebuild: create data -> export zip -> fresh workspace -> notes/import + reindex ->
   compare counts (data-not-locked red line). Logs whether mastery/review survive reindex honestly.

Isolation: each scenario uses its own temp WORKSPACE_DIR; never touches real vault/DB.

Usage:  cd server && .venv\\Scripts\\python.exe ..\\scripts\\scenarios_bc_closed_loop.py
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import create_app  # noqa: E402
from app.db import init_db  # noqa: E402

PASS = 0
FAIL = 0


def log(ok: bool, step: str, detail: str) -> None:
    global PASS, FAIL
    PASS += bool(ok)
    FAIL += (not ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {step}  :: {detail}")


def short(data, n: int = 300) -> str:
    s = json.dumps(data, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + "…"


def set_ws(path: str) -> None:
    os.environ["WORKSPACE_DIR"] = path


def scenario_b(client) -> str:
    set_ws(WS_B)
    # concept to bind
    c = client.post("/api/v1/concepts", json={"title": "光的干涉", "domain": "Physics"})
    cid = c.json().get("id")
    # create map
    m = client.post("/api/v1/mindmaps", json={"title": "光的干涉导图"})
    mid = m.json().get("id")
    log(m.status_code == 201 and mid, "B1 建导图 /mindmaps", f"status={m.status_code} id={mid}")
    # nodes
    r = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "光的干涉"})
    n1 = r.json().get("id")
    r2 = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "双缝实验"})
    n2 = r2.json().get("id")
    log(r.status_code == 201 and n1 and r2.status_code == 201 and n2, "B2 建节点 /nodes", f"n1={n1} n2={n2}")
    # edge
    e = client.post(f"/api/v1/mindmaps/{mid}/edges", json={"source": n1, "target": n2, "relation": "requires"})
    log(e.status_code == 201, "B3 建边 /edges", f"status={e.status_code} {short(e.json())}")
    # bind concept to node (mastery color path)
    b = client.post(f"/api/v1/mindmaps/{mid}/nodes/{n1}/bind", json={"concept_id": cid})
    log(b.status_code == 200, "B4 绑定概念 /bind", f"status={b.status_code} {short(b.json())}")
    # export exchange format
    ex = client.get(f"/api/v1/mindmaps/{mid}/export")
    fmt = ex.json()
    log(ex.status_code == 200 and "map" in fmt, "B5 导出导图 /export", f"status={ex.status_code} keys={list(fmt.keys())}")
    # delete map
    dl = client.delete(f"/api/v1/mindmaps/{mid}")
    log(dl.status_code in (200, 204), "B6 删除导图 /mindmaps/{id}", f"status={dl.status_code}")
    # import exchange format -> new map, compare node/edge counts
    im = client.post("/api/v1/mindmaps/import", json=fmt)
    log(im.status_code == 201, "B7 导入导图 /import", f"status={im.status_code} {short(im.json())}")
    newm = im.json()
    ok = newm.get("node_count", 0) >= 2 and newm.get("edge_count", 0) >= 1
    log(ok, "B8 roundtrip 校验", f"node_count={newm.get('node_count')} edge_count={newm.get('edge_count')}")
    return mid


def scenario_c(client) -> None:
    # --- C1: seed data in WS_A ---
    set_ws(WS_A)
    init_db()
    a = client.post("/api/v1/notes", json={"title": "光的干涉", "content_md": "光的干涉。[[双缝实验]]。"}).json().get("note", {}).get("id")
    b = client.post("/api/v1/notes", json={"title": "双缝实验", "content_md": "双缝实验。"}).json().get("note", {}).get("id")
    # create a concept + mastery + review
    c = client.post("/api/v1/concepts", json={"title": "光的干涉", "domain": "Physics"}).json()
    cid = c["id"]
    client.post("/api/v1/events", json={"concept_id": cid, "event_type": "study", "dimension": "knowledge", "weight": 1.0, "source": "manual"})
    client.post(f"/api/v1/review/{cid}/answer", json={"quality": 3})

    before = {
        "notes": len(client.get("/api/v1/notes").json().get("notes", [])),
        "concepts": len(client.get("/api/v1/concepts").json().get("concepts", [])),
    }
    g = client.get("/api/v1/graph").json()
    before["edges"] = len(g.get("edges", []))
    before["mastery"] = client.get("/api/v1/mastery").json()
    before["review"] = client.get("/api/v1/review/today").json().get("reviews", [])

    # --- C2: export zip ---
    z = client.get("/api/v1/export")
    data = z.content
    names = []
    with zipfile.ZipFile(BytesIO(data)) as zf:
        names = zf.namelist()
        zf.extractall(WS_A_STAGE)
    has_db = any(n.startswith("db/") for n in names)
    has_key = any("sk-" in n or "key" in n.lower() for n in names)
    has_vault = any(n.startswith("vault/") and n.endswith(".md") for n in names)
    log(z.status_code == 200 and has_vault and not has_db, "C2 导出 /export (zip)", f"status={z.status_code} vault_md={has_vault} db泄露={has_db} key嫌疑={has_key} files={len(names)}")

    # --- C3: rebuild in fresh workspace (data-not-locked red line) ---
    set_ws(WS_C)
    init_db()
    stage_vault = WS_A_STAGE / "vault"
    im = client.post("/api/v1/notes/import", json={"source": str(stage_vault), "prefix": ""})
    after_import = im.json()
    client.post("/api/v1/admin/reindex", json={})
    after = {
        "notes": len(client.get("/api/v1/notes").json().get("notes", [])),
        "concepts": len(client.get("/api/v1/concepts").json().get("concepts", [])),
    }
    ga = client.get("/api/v1/graph").json()
    after["edges"] = len(ga.get("edges", []))
    after["mastery"] = client.get("/api/v1/mastery").json()
    after["review"] = client.get("/api/v1/review/today").json().get("reviews", [])

    log(after_import.get("imported", 0) > 0, "C3 导入重建 /notes/import", f"imported={after_import.get('imported')} skipped={after_import.get('skipped')}")
    log(after["notes"] == before["notes"], "C4 笔记数一致 (reindex)", f"before={before['notes']} after={after['notes']}")
    log(after["concepts"] >= 1, "C5 概念重建", f"before={before['concepts']} after={after['concepts']}")
    log(after["edges"] == before["edges"], "C6 链接/边一致", f"before={before['edges']} after={after['edges']}")
    # factual observation (may legitimately not restore -> findings)
    m_before = len(before["mastery"]) if isinstance(before["mastery"], list) else len(before["mastery"].get("mastery", []))
    m_after = len(after["mastery"]) if isinstance(after["mastery"], list) else len(after["mastery"].get("mastery", []))
    r_before = len(before["review"])
    r_after = len(after["review"])
    log(m_after == m_before, "C7 掌握度行重建(观察)", f"before={m_before} after={m_after}")
    log(r_after == r_before, "C8 复习记录重建(观察)", f"before={r_before} after={r_after}")


def main() -> int:
    # set env BEFORE TestClient(lifespan runs init_db) so the first workspace is initialized
    set_ws(WS_B)
    with TestClient(create_app()) as client:
        scenario_b(client)
        scenario_c(client)
    print()
    print(f"SCENARIOS B+C RESULT: {PASS} passed / {FAIL} failed")
    return 0 if FAIL == 0 else 1


WS_B = tempfile.mkdtemp(prefix="plos_scenario_b_")
WS_A = tempfile.mkdtemp(prefix="plos_scenario_c_a_")
WS_A_STAGE = Path(tempfile.mkdtemp(prefix="plos_scenario_c_stage_"))
WS_C = tempfile.mkdtemp(prefix="plos_scenario_c_b_")

if __name__ == "__main__":
    try:
        code = main()
    finally:
        for p in (WS_B, WS_A, WS_A_STAGE, WS_C):
            shutil.rmtree(str(p), ignore_errors=True)
    raise SystemExit(code)
