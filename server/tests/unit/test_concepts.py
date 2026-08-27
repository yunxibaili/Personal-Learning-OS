"""P8-001A Concept CRUD 测试。

覆盖：
- create_concept: 创建纯 concept，不产生 learning_event/mastery/review/links
- list_concepts: 支持 domain/origin 过滤
- get_concept: 单个获取，含 mastery
- patch_concept: 仅更新 metadata
- boundary: 确认创建 concept 不产生 learning_event/mastery/review/links
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


def _create_concept(client: TestClient, title: str, **kwargs) -> dict:
    """辅助：创建 concept 并返回响应。"""
    r = client.post("/api/v1/concepts", json={"title": title, **kwargs})
    assert r.status_code == 201, r.text
    return r.json()


class TestConceptCRUD:
    def test_create_concept_basic(self, client: TestClient):
        """基础创建：返回包含 mastery 为 null 的 concept。"""
        r = _create_concept(client, "P8ConceptA")
        assert r["id"] > 0
        assert r["title"] == "P8ConceptA"
        assert r["origin"] == "manual"
        assert r["mastery"] is None  # 不自动创建 mastery

    def test_create_concept_with_domain(self, client: TestClient):
        """带 domain 创建。"""
        r = _create_concept(client, "P8ConceptDomain", domain="Optimization")
        assert r["domain"] == "Optimization"
        assert r["origin"] == "manual"

    def test_create_concept_with_origin(self, client: TestClient):
        """指定 origin 创建。"""
        r = _create_concept(client, "P8OriginGen", origin="ai_suggested")
        assert r["origin"] == "ai_suggested"

    def test_create_concept_invalid_origin(self, client: TestClient):
        """非法 origin 被拒绝。"""
        r = client.post("/api/v1/concepts", json={"title": "Bad", "origin": "invalid"})
        assert r.status_code == 400

    def test_create_duplicate_concept_rejected(self, client: TestClient):
        """同名 concept 不可重复创建。"""
        _create_concept(client, "P8DupConcept")
        r = client.post("/api/v1/concepts", json={"title": "P8DupConcept"})
        assert r.status_code == 409

    def test_list_concepts(self, client: TestClient):
        """列表查询。"""
        _create_concept(client, "ListA")
        _create_concept(client, "ListB")
        r = client.get("/api/v1/concepts")
        assert r.status_code == 200
        data = r.json()
        assert "concepts" in data
        assert len(data["concepts"]) >= 2

    def test_list_concepts_filter_domain(self, client: TestClient):
        """按 domain 过滤。"""
        _create_concept(client, "DomainA", domain="ML")
        _create_concept(client, "DomainB", domain="Optimization")
        r = client.get("/api/v1/concepts?domain=ML")
        data = r.json()
        assert all(c["domain"] == "ML" for c in data["concepts"])

    def test_list_concepts_filter_origin(self, client: TestClient):
        """按 origin 过滤。"""
        _create_concept(client, "ManualA", origin="manual")
        _create_concept(client, "GenA", origin="ai_suggested")
        r = client.get("/api/v1/concepts?origin=ai_suggested")
        data = r.json()
        assert all(c["origin"] == "ai_suggested" for c in data["concepts"])

    def test_get_concept_detail(self, client: TestClient):
        """获取单个 concept 详情（含 mastery）。"""
        created = _create_concept(client, "DetailConcept")
        r = client.get(f"/api/v1/concepts/{created['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == created["id"]
        assert data["mastery"] is None  # 无学习事件时为 null

    def test_get_nonexistent_concept(self, client: TestClient):
        """不存在的 concept 返回 404。"""
        r = client.get("/api/v1/concepts/999999")
        assert r.status_code == 404

    def test_patch_concept_domain(self, client: TestClient):
        """更新 domain。"""
        created = _create_concept(client, "PatchConcept")
        r = client.patch(f"/api/v1/concepts/{created['id']}", json={"domain": "NewDomain"})
        assert r.status_code == 200
        assert r.json()["domain"] == "NewDomain"

    def test_patch_concept_summary(self, client: TestClient):
        """更新 summary。"""
        created = _create_concept(client, "PatchSummary")
        r = client.patch(f"/api/v1/concepts/{created['id']}", json={"summary": "新摘要"})
        assert r.status_code == 200
        assert r.json()["summary"] == "新摘要"

    def test_patch_concept_aliases(self, client: TestClient):
        """更新 aliases。"""
        created = _create_concept(client, "PatchAliases")
        r = client.patch(f"/api/v1/concepts/{created['id']}", json={"aliases": ["别名1", "别名2"]})
        assert r.status_code == 200
        assert r.json()["aliases"] == ["别名1", "别名2"]

    def test_patch_concept_status(self, client: TestClient):
        """更新 status。"""
        created = _create_concept(client, "PatchStatus")
        r = client.patch(f"/api/v1/concepts/{created['id']}", json={"status": "archived"})
        assert r.status_code == 200
        assert r.json()["status"] == "archived"

    def test_patch_concept_invalid_status(self, client: TestClient):
        """非法 status 被拒绝。"""
        created = _create_concept(client, "BadStatus")
        r = client.patch(f"/api/v1/concepts/{created['id']}", json={"status": "invalid"})
        assert r.status_code == 400

    def test_patch_nonexistent_concept(self, client: TestClient):
        """不存在的 concept patch 返回 404。"""
        r = client.patch("/api/v1/concepts/999999", json={"domain": "X"})
        assert r.status_code == 404

    def test_list_domains(self, client: TestClient):
        """获取所有 domain 列表。"""
        _create_concept(client, "DomA", domain="ML")
        _create_concept(client, "DomB", domain="Optimization")
        r = client.get("/api/v1/concepts/domains")
        assert r.status_code == 200
        data = r.json()
        assert "ML" in data["domains"]
        assert "Optimization" in data["domains"]


class TestConceptBoundary:
    """边界测试：创建 concept 不应产生任何学习状态副作用。"""

    def test_create_concept_no_learning_event(self, client: TestClient, core_conn):
        """创建 concept 不产生 learning_events 行。"""
        before = core_conn.execute("SELECT COUNT(*) FROM learning_events").fetchone()[0]

        _create_concept(client, "BoundaryConcept")

        after = core_conn.execute("SELECT COUNT(*) FROM learning_events").fetchone()[0]
        assert after == before, "creating concept should not add learning_events"

    def test_create_concept_no_concept_mastery(self, client: TestClient, core_conn):
        """创建 concept 不产生 concept_mastery 行。"""
        before = core_conn.execute("SELECT COUNT(*) FROM concept_mastery").fetchone()[0]

        _create_concept(client, "BoundaryMastery")

        after = core_conn.execute("SELECT COUNT(*) FROM concept_mastery").fetchone()[0]
        assert after == before, "creating concept should not add concept_mastery"

    def test_create_concept_no_review_queue(self, client: TestClient, core_conn):
        """创建 concept 不产生 review_queue 行。"""
        before = core_conn.execute("SELECT COUNT(*) FROM review_queue").fetchone()[0]

        _create_concept(client, "BoundaryReview")

        after = core_conn.execute("SELECT COUNT(*) FROM review_queue").fetchone()[0]
        assert after == before, "creating concept should not add review_queue"

    def test_create_concept_no_links(self, client: TestClient, core_conn):
        """创建 concept 不产生 links 行。"""
        before = core_conn.execute("SELECT COUNT(*) FROM links").fetchone()[0]

        _create_concept(client, "BoundaryLinks")

        after = core_conn.execute("SELECT COUNT(*) FROM links").fetchone()[0]
        assert after == before, "creating concept should not add links"

    def test_create_concept_origin_note_allowed(self, client: TestClient):
        """origin=note 允许（用于内部同步/迁移）。"""
        r = _create_concept(client, "NoteConcept", origin="markdown")
        assert r["origin"] == "markdown"

    def test_create_concept_origin_manual_allowed(self, client: TestClient):
        """origin=manual 允许（用户手动创建）。"""
        r = _create_concept(client, "ManualConcept", origin="manual")
        assert r["origin"] == "manual"

    def test_create_concept_origin_ai_suggested_allowed(self, client: TestClient):
        """origin=ai_suggested 允许（AI 生成等）。"""
        r = _create_concept(client, "GenConcept", origin="ai_suggested")
        assert r["origin"] == "ai_suggested"


class TestConceptMasteryIntegration:
    """Concept 与 Mastery 集成：显式产生事件后 mastery 正确反映。"""

    def test_concept_mastery_after_events(self, client: TestClient):
        """显式发送 learning_event 后，concept mastery 更新。"""
        created = _create_concept(client, "MasteryConcept")
        cid = created["id"]

        # 初始 mastery 为 null
        r = client.get(f"/api/v1/concepts/{cid}")
        assert r.json()["mastery"] is None

        # 产生学习事件
        client.post("/api/v1/events", json={
            "concept_id": cid, "event_type": "answer_correct", "source": "review"
        })
        client.post("/api/v1/events", json={
            "concept_id": cid, "event_type": "explain", "source": "tutor"
        })

        # 再次查询，mastery 应更新
        r = client.get(f"/api/v1/concepts/{cid}")
        mastery = r.json()["mastery"]
        assert mastery is not None
        assert mastery["effective"] > 0


class TestConceptCoreFunctions:
    """直接测试 core/concepts.py 函数（不走 HTTP）；tmp_workspace 隔离真实数据。"""

    def test_create_concept_core(self, core_conn):
        from app.core.concepts import create_concept, VALID_ORIGINS
        c = create_concept(core_conn, title="CoreConcept", domain="Test", origin="manual")
        assert c.title == "CoreConcept"
        assert c.domain == "Test"
        assert c.origin == "manual"
        assert c.status == "active"

    def test_list_concepts_core(self, core_conn):
        from app.core.concepts import list_concepts
        cs = list_concepts(core_conn, domain="Test", limit=10)
        assert isinstance(cs, list)

    def test_update_concept_core(self, core_conn):
        from app.core.concepts import create_concept, update_concept
        c = create_concept(core_conn, title="CoreUpdate", domain="Old")
        c2 = update_concept(core_conn, c.id, domain="New")
        assert c2.domain == "New"

    def test_get_concept_domains_core(self, core_conn):
        from app.core.concepts import get_concept_domains, create_concept
        create_concept(core_conn, title="DomTest", domain="CustomDomain", origin="manual")
        domains = get_concept_domains(core_conn)
        assert "CustomDomain" in domains
        core_conn.close()