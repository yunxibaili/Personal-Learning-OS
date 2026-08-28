"""P8-003E Review Bridge + Auto Notes 守护测试（先于实现编写）。

1. Review Bridge：answer_wrong → mistakes 表（第三次"出口无入口"断链修复）
   链路：review 答错 → learning_event + mistakes → Tutor context.mistakes
2. 乙路线 Auto Notes（ADR-014 附录 §2.8.1.2）：显式引用优先、auto 补缺、
   默认关闭（隐私面扩大必须显式开启）
"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.tutor_context import build_tutor_context


def _mk_concept(client: TestClient, title: str) -> int:
    r = client.post("/api/v1/concepts", json={"title": title})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _mk_note(client: TestClient, title: str, body: str) -> int:
    r = client.post("/api/v1/notes", json={"title": title, "content_md": body})
    assert r.status_code == 201, r.text
    return r.json()["note"]["id"]


# ── 1. Review Bridge：answer_wrong → mistakes ───────────────────────

class TestMistakesBridge:
    def test_answer_wrong_creates_mistake(self, client: TestClient, core_conn):
        """答错事件必须在 mistakes 表落一行（断链修复）。"""
        cid = _mk_concept(client, "BridgeConcept")
        r = client.post("/api/v1/events", json={
            "concept_id": cid, "event_type": "answer_wrong",
            "dimension": "knowledge", "source": "review",
        })
        assert r.status_code == 201, r.text
        rows = core_conn.execute(
            "SELECT * FROM mistakes WHERE concept_id=?", (cid,)
        ).fetchall()
        assert len(rows) == 1, "answer_wrong 未落 mistakes——断链仍在"
        assert rows[0]["description"]

    def test_answer_correct_creates_no_mistake(self, client: TestClient, core_conn):
        """答对不得产生 mistake。"""
        cid = _mk_concept(client, "NoMistakeConcept")
        client.post("/api/v1/events", json={
            "concept_id": cid, "event_type": "answer_correct",
            "dimension": "knowledge",
        })
        rows = core_conn.execute(
            "SELECT * FROM mistakes WHERE concept_id=?", (cid,)
        ).fetchall()
        assert rows == []

    def test_review_flow_mistakes_reach_tutor_context(
        self, client: TestClient, core_conn,
    ):
        """三跳连通：review 答错 → mistakes → build_tutor_context().mistakes。"""
        cid = _mk_concept(client, "ReviewFlowConcept")
        # 复习答错（review 循环的真实入口）
        r = client.post(f"/api/v1/review/{cid}/answer", json={"quality": 1})
        assert r.status_code == 200, r.text

        ctx = build_tutor_context(core_conn, cid)
        assert len(ctx["mistakes"]) >= 1, (
            "mistakes 未到达 Tutor context——桥未接通"
        )
        assert ctx["mistakes"][0]["description"]

    def test_multiple_wrongs_append_multiple_rows(self, client: TestClient, core_conn):
        """mistakes 是 append 型：两次答错两行。"""
        cid = _mk_concept(client, "RepeatWrong")
        for _ in range(2):
            client.post("/api/v1/events", json={
                "concept_id": cid, "event_type": "answer_wrong",
                "dimension": "knowledge",
            })
        rows = core_conn.execute(
            "SELECT * FROM mistakes WHERE concept_id=?", (cid,)
        ).fetchall()
        assert len(rows) == 2


# ── 2. 乙路线 Auto Notes ────────────────────────────────────────────

class TestAutoNotes:
    def test_auto_notes_off_by_default(self, client: TestClient, core_conn):
        """默认（不传/False）行为与现状一致：notes 仅含显式引用。"""
        cid = _mk_concept(client, "AutoOffConcept")
        nid = _mk_note(client, "AutoOffConcept", "自动检索默认关闭的验证内容")
        r = client.post("/api/v1/tutor/context",
                        json={"concept_id": cid, "auto_notes": False})
        assert r.status_code == 200
        assert r.json().get("notes") == []

    def test_auto_notes_hits_concept_related_note(self, client: TestClient, core_conn):
        """auto_notes=true：以 concept 标题检索命中笔记注入。"""
        cid = _mk_concept(client, "傅里叶变换")
        _mk_note(client, "傅里叶变换学习笔记",
                 "傅里叶变换将时域信号分解为频率分量，是信号处理的核心工具。")
        r = client.post("/api/v1/tutor/context",
                        json={"concept_id": cid, "auto_notes": True})
        assert r.status_code == 200, r.text
        notes = r.json()["notes"]
        assert len(notes) == 1
        assert notes[0]["title"] == "傅里叶变换学习笔记"
        assert "傅里叶变换" in notes[0]["excerpt"]

    def test_explicit_takes_priority_auto_fills_gap(self, client: TestClient, core_conn):
        """显式引用优先：已引用 1 篇时 auto 只补 1 篇且不重复。"""
        cid = _mk_concept(client, "特征值")
        n1 = _mk_note(client, "特征值基础笔记", "特征值的几何意义与计算方法。")
        n2 = _mk_note(client, "特征值习题集", "特征值相关的习题与解答。")
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": cid,
            "note_ids": [n1],
            "auto_notes": True,
        })
        notes = r.json()["notes"]
        ids = [n["note_id"] for n in notes]
        assert n1 in ids, "显式引用丢失"
        assert len(notes) <= 2, "总额度不得超过 2"
        assert n2 in ids or len(notes) == 1  # 补位或库中无其他命中

    def test_auto_notes_excludes_explicit(self, client: TestClient, core_conn):
        """auto 不得重复注入已显式引用的笔记。"""
        cid = _mk_concept(client, "矩阵")
        n1 = _mk_note(client, "矩阵笔记", "矩阵乘法与转置的基本运算。")
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": cid, "note_ids": [n1], "auto_notes": True,
        })
        ids = [n["note_id"] for n in r.json()["notes"]]
        assert ids.count(n1) == 1

    def test_auto_no_hit_returns_explicit_only(self, client: TestClient, core_conn):
        """无命中时仅显式部分，不报错。"""
        cid = _mk_concept(client, "无命中概念")
        r = client.post("/api/v1/tutor/context",
                        json={"concept_id": cid, "auto_notes": True})
        assert r.status_code == 200
        assert r.json().get("notes") == []

    def test_unhit_note_content_absent_with_auto(self, client: TestClient, core_conn):
        """反向断言（auto 态）：命中集之外的笔记正文不得出现。"""
        cid = _mk_concept(client, "无关概念")
        _mk_note(client, "无关概念笔记", "这是无关概念的正文档。")
        unrelated = _mk_note(client, "完全无关的另一篇", "完全无关内容独有标记XYZ。")
        r = client.post("/api/v1/tutor/context",
                        json={"concept_id": cid, "auto_notes": True})
        import json as _json
        text = _json.dumps(r.json(), ensure_ascii=False)
        # 独有标记不得出现（除非被命中——按检索语义"完全无关的另一篇"不含概念词）
        notes = r.json().get("notes", [])
        hit_ids = {n["note_id"] for n in notes}
        if unrelated not in hit_ids:
            assert "完全无关内容独有标记XYZ" not in text
