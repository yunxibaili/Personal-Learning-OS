"""P8-003D Tutor Knowledge Base 守护测试（先于实现编写）。

三类守护（TECH_DESIGN_REVIEW §6.8 定案）：
1. 连通性 5 跳：note 文件 → notes 表 → context.notes → prompt → Provider 收到
2. 反向断言：不该有的不能有（未引用笔记全文 / api_key / vault 绝对路径）
3. 正向可达性：note_ids 传入必出现在 context.notes；死 tab 回归守护

背景：本项目两次断链（eventlogs 无生产者 / event_uuid 未落库）都是
"只验中间跳"造成的；Tutor 链路的风险方向相反——不该有的混入。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.ai.providers.base import LLMProvider
from app.core.ai.service import TutorService
from app.core.tutor_context import build_tutor_context

# 与 core 约定一致（实现后 import 校验常量也存在）
MAX_NOTE_EXCERPTS = 2
MAX_NOTE_EXCERPT_CHARS = 600


# ── Helpers ─────────────────────────────────────────────────────────

def _mk_note(client: TestClient, title: str, body: str) -> int:
    """经公开 API 创建笔记（真实落盘文件 + 索引），返回 note_id。"""
    r = client.post("/api/v1/notes", json={"title": title, "content_md": body})
    assert r.status_code == 201, r.text
    return r.json()["note"]["id"]


def _mk_concept(client: TestClient, title: str) -> int:
    r = client.post("/api/v1/concepts", json={"title": title})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _referenced_title_in(prompt: dict) -> str:
    """从 TutorPrompt 中取出全部文本（system + messages），供子串断言。"""
    parts = [prompt.get("system", "")]
    for m in prompt.get("messages", []):
        parts.append(str(m.get("content", "")))
    return "\n".join(parts)


class _CapturingProvider(LLMProvider):
    """第 5 跳守护：捕获 Provider 实际收到的 prompt。"""

    def __init__(self) -> None:
        self.captured: dict | None = None

    def complete(self, prompt: dict) -> str:  # type: ignore[override]
        self.captured = prompt
        return "mock answer"

    def stream(self, prompt: dict):  # type: ignore[override]
        self.captured = prompt
        yield "mock answer"


@pytest.fixture()
def seeded(client: TestClient):
    """两篇笔记 + 一个概念。返回 (concept_id, note_a, note_b)。"""
    body_a = "特征值是线性代数的核心概念。" * 3
    body_b = ("梯度下降是优化算法，与特征值无关的独立内容。" * 3)
    note_a = _mk_note(client, "特征值笔记", body_a)
    note_b = _mk_note(client, "梯度下降笔记", body_b)
    concept = _mk_concept(client, "特征值")
    return {"concept_id": concept, "note_a": note_a, "note_b": note_b,
            "body_a": body_a, "body_b": body_b}


# ── 1. 连通性 5 跳 ──────────────────────────────────────────────────

class TestConnectivity:
    def test_note_file_to_context(self, client: TestClient, seeded, tmp_workspace: Path):
        """跳1→3：文件落盘 → notes 表 → context.notes 带 excerpt。"""
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
            "note_ids": [seeded["note_a"]],
        })
        assert r.status_code == 200, r.text
        ctx = r.json()
        assert len(ctx["notes"]) == 1
        note = ctx["notes"][0]
        assert note["note_id"] == seeded["note_a"]
        assert note["title"] == "特征值笔记"
        assert note["excerpt"], "excerpt 为空——文件→context 断链"
        assert "特征值" in note["excerpt"]

    def test_context_to_prompt_to_provider(self, client: TestClient, seeded):
        """跳4→5：context 片段进入 prompt，Provider 收到的就是同一份。"""
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
            "note_ids": [seeded["note_a"]],
        })
        ctx = r.json()

        svc = TutorService(_CapturingProvider())
        prompt = svc.build_prompt_only(ctx, "什么是特征值？")
        text = _referenced_title_in(prompt)
        assert "特征值是线性代数的核心概念" in text, "片段未进入 prompt"

        provider = _CapturingProvider()
        TutorService(provider).ask(ctx, "什么是特征值？")
        assert provider.captured is not None
        assert "特征值是线性代数的核心概念" in _referenced_title_in(provider.captured), (
            "Provider 收到的 prompt 与 build_prompt 产出不一致"
        )

    def test_excerpt_is_deterministic_slice(self, client: TestClient, seeded,
                                            tmp_workspace: Path):
        """excerpt 必须等于文件正文的确定性切片（可复算）。"""
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
            "note_ids": [seeded["note_a"]],
        })
        excerpt = r.json()["notes"][0]["excerpt"]
        detail = client.get(f"/api/v1/notes/{seeded['note_a']}").json()["note"]
        body = detail["content_md"].replace("\n", " ")
        while "  " in body:
            body = body.replace("  ", " ")
        assert excerpt.rstrip("…") in body.replace("\n", " "), (
            "excerpt 不是文件正文的子串——来源不明"
        )


# ── 2. 反向断言：不该有的不能有 ─────────────────────────────────────

class TestReverseAssertions:
    def test_unreferenced_note_content_absent(self, client: TestClient, seeded):
        """只引用 A → B 的正文不得出现在 context / prompt。"""
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
            "note_ids": [seeded["note_a"]],
        })
        ctx_text = json.dumps(r.json(), ensure_ascii=False)
        assert "梯度下降是优化算法" not in ctx_text, "未引用笔记正文泄漏进 context"

        svc = TutorService(_CapturingProvider())
        prompt = svc.build_prompt_only(r.json(), "q")
        assert "梯度下降是优化算法" not in _referenced_title_in(prompt), (
            "未引用笔记正文泄漏进 prompt"
        )

    def test_no_sensitive_fields_or_paths(self, client: TestClient, seeded,
                                          tmp_workspace: Path):
        """context 不含 api_key/secret 字段值，也不含 vault 绝对路径。"""
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
            "note_ids": [seeded["note_a"]],
        })
        ctx_text = json.dumps(r.json(), ensure_ascii=False)
        for token in ("api_key", "sk-", "Bearer ", "password"):
            assert token not in ctx_text.lower(), f"敏感标记泄漏: {token}"
        assert str(tmp_workspace) not in ctx_text, "vault 绝对路径泄漏进 context"


# ── 3. 正向可达性（死 tab 回归守护）──────────────────────────────────

class TestReachability:
    def test_note_ids_present_in_context(self, client: TestClient, seeded):
        """传了 note_ids 就必须出现在 context.notes（组件数据源契约）。"""
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
            "note_ids": [seeded["note_a"], seeded["note_b"]],
        })
        ids = [n["note_id"] for n in r.json()["notes"]]
        assert ids == [seeded["note_a"], seeded["note_b"]]

    def test_no_note_ids_means_empty_notes(self, client: TestClient, seeded):
        """不传 note_ids → notes 为空列表，行为与旧版一致。"""
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
        })
        ctx = r.json()
        assert ctx.get("notes") == []
        # 旧 GET 端点同样带空 notes（向后兼容消费者）
        r2 = client.get(f"/api/v1/tutor/context/{seeded['concept_id']}")
        assert r2.json().get("notes") == []

    def test_focus_concept_id_store_contract(self):
        """ui store 的 focusConceptId 必须遵循 focusNoteId 同款跳转目标模式。"""
        import re
        from pathlib import Path
        src = (Path(__file__).resolve().parents[3] / "web" / "src"
               / "stores" / "ui.ts").read_text(encoding="utf-8")
        assert "focusConceptId" in src, "store 未接 focusConceptId——死 tab 回归"
        # 跳转目标消费模式：必须有 open 动作与 clear（与 focusNoteId 同构）
        assert re.search(r"focusConceptId:\s*null", src)
        assert re.search(r"clearConceptFocus", src)


# ── 4. 预算与边界 ───────────────────────────────────────────────────

class TestBudgetAndBounds:
    def test_excerpt_capped(self, client: TestClient):
        """超长正文切片 ≤600 字符（预算契约）。"""
        long_body = "线性代数知识点内容测试。" * 200  # 远超 600 字符
        nid = _mk_note(client, "超长笔记", long_body)
        cid = _mk_concept(client, "线性代数")
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": cid, "note_ids": [nid],
        })
        excerpt = r.json()["notes"][0]["excerpt"]
        assert 0 < len(excerpt) <= MAX_NOTE_EXCERPT_CHARS + 1  # +1 容忍省略号

    def test_more_than_two_notes_rejected(self, client: TestClient, seeded):
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"],
            "note_ids": [seeded["note_a"], seeded["note_b"], seeded["note_a"]],
        })
        assert r.status_code == 400

    def test_unknown_note_404(self, client: TestClient, seeded):
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": seeded["concept_id"], "note_ids": [999999],
        })
        assert r.status_code == 404

    def test_unknown_concept_404(self, client: TestClient, seeded):
        r = client.post("/api/v1/tutor/context", json={
            "concept_id": 999999, "note_ids": [seeded["note_a"]],
        })
        assert r.status_code == 404

    def test_injection_shrinks_related_and_recent(self, client: TestClient):
        """注入笔记时 related≤6 / recent≤3（token 预算契约）。"""
        from app.core.tutor_context import (
            build_tutor_context, MAX_RELATED, MAX_RECENT_EVENTS,
        )
        # 常量收缩必须在实现里体现（注入态用收缩值）
        from app.core import tutor_context as tc
        assert tc.NOTE_RELATED_CAP <= 6
        assert tc.NOTE_RECENT_CAP <= 3
        assert MAX_RELATED == 10 and MAX_RECENT_EVENTS == 5  # 基线不变
