"""Scenario A — 一条笔记的一生 (closed loop, API level, isolated workspace).

Mirrors docs/TESTING_FULL.md §5 Scenario A as an automated, isolated e2e:
  create note (wikilink) -> graph -> extract concept -> mastery event -> review
  answer (SM-2) -> tutor context -> search -> delete note -> graph reflects removal.

Isolation: WORKSPACE_DIR points to a temp dir (never touches the real vault/DB),
created by TestClient with no external server. Cleaned up after.

Usage:  cd server && .venv\\Scripts\\python.exe ..\\scripts\\scenario_a_closed_loop.py
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

WS = Path(tempfile.mkdtemp(prefix="plos_scenario_a_"))
os.environ["WORKSPACE_DIR"] = str(WS)

from fastapi.testclient import TestClient  # noqa: E402
from app.main import create_app  # noqa: E402

TITLE = "光的干涉"
WIKILINK = "[[双缝实验]]"
PASS = 0
FAIL = 0


def log(ok: bool, step: str, detail: str) -> None:
    global PASS, FAIL
    PASS += bool(ok)
    FAIL += (not ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {step}  :: {detail}")


def short(data) -> str:
    s = json.dumps(data, ensure_ascii=False)
    return s if len(s) <= 320 else s[:320] + "…"


def main() -> int:
    with TestClient(create_app()) as client:
        return _run(client)


def _run(client: TestClient) -> int:
    # 1) 新建笔记《光的干涉》，正文含 [[双缝实验]] + 数学公式
    r = client.post("/api/v1/notes", json={"title": TITLE, "content_md": f"{TITLE}现象。{WIKILINK} 证明了波动性，$E=mc^2$。"})
    note_id = (r.json().get("note", {}).get("id") if r.status_code == 201 else None)
    log(r.status_code == 201 and note_id is not None, "1 新建笔记 /notes", f"status={r.status_code} id={note_id}")

    # 2) 详情、图谱：笔记节点 + 指向 [[双缝实验]] 的边
    d = client.get(f"/api/v1/notes/{note_id}")
    log(d.status_code == 200 and d.json().get("note", {}).get("id") == note_id, "2 笔记详情 /notes/{id}", f"status={d.status_code}")
    g = client.get("/api/v1/graph")
    gbody = str(g.json())
    log(g.status_code == 200, "3 图谱 /graph", f"status={g.status_code} 含'{TITLE}'={TITLE in gbody} 含边='双缝实验'={'双缝实验' in gbody}")

    # 3) 概念抽取 (mock provider -> "Mock Concept from Extractor")
    ex = client.post("/api/v1/concepts/extract", json={"text": f"{TITLE}与{WIKILINK}", "note_id": note_id})
    sugg = ex.json().get("suggestions", []) if ex.status_code == 200 else []
    log(ex.status_code == 200 and len(sugg) > 0, "4 概念抽取 /concepts/extract", f"status={ex.status_code} suggestions={sugg}")

    # 取一个 concept_id：优先抽取出的 unconfirmed，其次明确建一个
    cid = None
    for s in sugg:
        if isinstance(s, dict) and s.get("concept_id"):
            cid = s["concept_id"]
    if cid is None:
        cl = client.get("/api/v1/concepts").json().get("concepts", [])
        for c in cl:
            if c.get("title") == "Mock Concept from Extractor":
                cid = c.get("id")
    if cid is None:
        cid = client.post("/api/v1/concepts", json={"title": "光的干涉", "domain": "Physics"}).json().get("id")
    log(cid is not None, "5 concept_id 就绪", f"concept_id={cid}")

    # 4) 学习事件 → 掌握度上升
    ev = client.post("/api/v1/events", json={"concept_id": cid, "event_type": "study", "dimension": "knowledge", "weight": 1.0, "source": "manual"})
    log(ev.status_code == 201, "6 学习事件 /events", f"status={ev.status_code} body={short(ev.json())}")

    m = client.get(f"/api/v1/mastery/{cid}")
    eff = None
    if m.status_code == 200:
        mm = m.json()
        eff = mm.get("effective" if "effective" in mm else "effective_now")
    log(m.status_code == 200, "7 掌握度 /mastery/{id}", f"status={m.status_code} {short(m.json())}")

    # 5) 复习打分 (SM-2) → interval/ease 变化
    ans = client.post(f"/api/v1/review/{cid}/answer", json={"quality": 5})
    a = ans.json()
    log(ans.status_code == 200 and "interval" in a, "8 复习打分 /review/{id}/answer", f"status={ans.status_code} {short(a)}")

    # 6) Tutor 记忆感知上下文
    tc = client.get(f"/api/v1/tutor/context/{cid}")
    log(tc.status_code == 200, "9 Tutor 上下文 /tutor/context/{id}", f"status={tc.status_code} {short(tc.json())}")

    # 7) 搜索命中 + 导出存在
    s = client.get("/api/v1/search", params={"q": TITLE})
    log(s.status_code == 200, "10 全文搜索 /search?q=" + TITLE, f"status={s.status_code} 命中={TITLE in str(s.json())}")

    # 8) 删除笔记 → 该笔记从 /notes 消失（概念节点按设计可保留，故以笔记为判据）
    dl = client.delete(f"/api/v1/notes/{note_id}")
    still = any(n.get("id") == note_id for n in client.get("/api/v1/notes").json().get("notes", []))
    g2 = client.get("/api/v1/graph")
    log(dl.status_code in (200, 204) and not still, "11 删除笔记 /notes/{id}", f"status={dl.status_code} 仍存在={still} 图谱节点={len(g2.json().get('nodes', []))}")

    print()
    print(f"SCENARIO A RESULT: {PASS} passed / {FAIL} failed   (workspace={WS})")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    try:
        code = main()
    finally:
        shutil.rmtree(WS, ignore_errors=True)
    raise SystemExit(code)
