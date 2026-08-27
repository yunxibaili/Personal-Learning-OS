"""M2b-001 MindMap 测试：CRUD + ADR-019 Isolation。

覆盖：
  - Map CRUD
  - Node CRUD（含 concept_id nullable）
  - Edge CRUD
  - ADR-019 隔离：MindMap 操作不产生 learning_event
"""
from __future__ import annotations

import pytest


# ── Map CRUD ─────────────────────────────────────────────────────

class TestMapCRUD:
    def test_create_map(self, client):
        r = client.post("/api/v1/mindmaps", json={"title": "My Map"})
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "My Map"
        assert data["id"] > 0
        assert data["nodes"] == []
        assert data["edges"] == []

    def test_list_maps(self, client):
        client.post("/api/v1/mindmaps", json={"title": "Map A"})
        client.post("/api/v1/mindmaps", json={"title": "Map B"})
        r = client.get("/api/v1/mindmaps")
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_get_map(self, client):
        cid = client.post("/api/v1/mindmaps", json={"title": "Test"}).json()["id"]
        r = client.get(f"/api/v1/mindmaps/{cid}")
        assert r.status_code == 200
        assert r.json()["title"] == "Test"

    def test_get_map_not_found(self, client):
        r = client.get("/api/v1/mindmaps/9999")
        assert r.status_code == 404

    def test_delete_map(self, client):
        cid = client.post("/api/v1/mindmaps", json={"title": "To Delete"}).json()["id"]
        r = client.delete(f"/api/v1/mindmaps/{cid}")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert client.get(f"/api/v1/mindmaps/{cid}").status_code == 404

    def test_create_map_empty_title(self, client):
        r = client.post("/api/v1/mindmaps", json={"title": "  "})
        assert r.status_code == 400


# ── Node CRUD ────────────────────────────────────────────────────

class TestNodeCRUD:
    def _make_map(self, client):
        return client.post("/api/v1/mindmaps", json={"title": "NM"}).json()["id"]

    def test_add_node(self, client):
        mid = self._make_map(client)
        r = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={
            "label": "Gradient Descent",
        })
        assert r.status_code == 201
        n = r.json()
        assert n["label"] == "Gradient Descent"
        assert n["concept_id"] is None
        assert n["position_x"] == 0
        assert n["position_y"] == 0

    def test_add_node_with_concept(self, client):
        mid = self._make_map(client)
        # 直接插入 concept（无独立 POST API，通过 ensure_entity_by_title 创建）
        from app.db import connect
        conn = connect()
        cur = conn.execute(
            "INSERT INTO concepts (title, origin, status) VALUES (?, 'manual', 'active')",
            ("Matrix",),
        )
        concept_id = cur.lastrowid
        conn.commit()
        conn.close()
        r = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={
            "label": "Matrix",
            "concept_id": concept_id,
            "position_x": 100,
            "position_y": 200,
        })
        assert r.status_code == 201
        n = r.json()
        assert n["concept_id"] == concept_id
        assert n["position_x"] == 100

    def test_update_node_position(self, client):
        mid = self._make_map(client)
        nid = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "N"}).json()["id"]
        r = client.patch(f"/api/v1/mindmaps/{mid}/nodes/{nid}", json={
            "position_x": 50,
            "position_y": 75,
        })
        assert r.status_code == 200

    def test_update_node_label(self, client):
        mid = self._make_map(client)
        nid = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "Old"}).json()["id"]
        r = client.patch(f"/api/v1/mindmaps/{mid}/nodes/{nid}", json={"label": "New"})
        assert r.status_code == 200

    def test_delete_node(self, client):
        mid = self._make_map(client)
        nid = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "X"}).json()["id"]
        r = client.delete(f"/api/v1/mindmaps/{mid}/nodes/{nid}")
        assert r.status_code == 200

    def test_add_node_map_not_found(self, client):
        r = client.post("/api/v1/mindmaps/9999/nodes", json={"label": "X"})
        assert r.status_code == 404


# ── Edge CRUD ────────────────────────────────────────────────────

class TestEdgeCRUD:
    def _make_map_with_nodes(self, client):
        mid = client.post("/api/v1/mindmaps", json={"title": "EM"}).json()["id"]
        n1 = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "A"}).json()["id"]
        n2 = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "B"}).json()["id"]
        return mid, n1, n2

    def test_add_edge(self, client):
        mid, n1, n2 = self._make_map_with_nodes(client)
        r = client.post(f"/api/v1/mindmaps/{mid}/edges", json={
            "source": n1,
            "target": n2,
            "relation": "causes",
        })
        assert r.status_code == 201
        e = r.json()
        assert e["source"] == n1
        assert e["target"] == n2
        assert e["relation"] == "causes"

    def test_delete_edge(self, client):
        mid, n1, n2 = self._make_map_with_nodes(client)
        eid = client.post(f"/api/v1/mindmaps/{mid}/edges", json={
            "source": n1, "target": n2,
        }).json()["id"]
        r = client.delete(f"/api/v1/mindmaps/{mid}/edges/{eid}")
        assert r.status_code == 200

    def test_add_edge_map_not_found(self, client):
        r = client.post("/api/v1/mindmaps/9999/edges", json={
            "source": 1, "target": 2,
        })
        assert r.status_code == 404


# ── ADR-019 Isolation ───────────────────────────────────────────

class TestMindMapIsolation:
    """ADR-019 铁律：MindMap 操作不产生 learning_event。"""

    def test_move_node_no_learning_event(self, client):
        """移动节点不写入 learning_events。"""
        mid = client.post("/api/v1/mindmaps", json={"title": "Iso"}).json()["id"]
        nid = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "X"}).json()["id"]

        # 获取初始事件数
        from app.db import connect
        conn = connect()
        before = conn.execute("SELECT COUNT(*) c FROM learning_events").fetchone()["c"]
        conn.close()

        # 移动节点
        client.patch(f"/api/v1/mindmaps/{mid}/nodes/{nid}", json={
            "position_x": 100, "position_y": 200,
        })

        conn = connect()
        after = conn.execute("SELECT COUNT(*) c FROM learning_events").fetchone()["c"]
        conn.close()

        assert after == before

    def test_create_edge_no_learning_event(self, client):
        """创建边不写入 learning_events。"""
        mid = client.post("/api/v1/mindmaps", json={"title": "Iso2"}).json()["id"]
        n1 = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "A"}).json()["id"]
        n2 = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "B"}).json()["id"]

        from app.db import connect
        conn = connect()
        before = conn.execute("SELECT COUNT(*) c FROM learning_events").fetchone()["c"]
        conn.close()

        client.post(f"/api/v1/mindmaps/{mid}/edges", json={
            "source": n1, "target": n2,
        })

        conn = connect()
        after = conn.execute("SELECT COUNT(*) c FROM learning_events").fetchone()["c"]
        conn.close()

        assert after == before

    def test_concept_binding_is_reference(self, client):
        """concept_id 是引用，不复制 concept 数据。"""
        mid = client.post("/api/v1/mindmaps", json={"title": "Ref"}).json()["id"]
        # 直接插入 concept
        from app.db import connect
        conn = connect()
        cur = conn.execute(
            "INSERT INTO concepts (title, origin, status) VALUES (?, 'manual', 'active')",
            ("SomeConcept",),
        )
        concept_id = cur.lastrowid
        conn.commit()
        conn.close()
        r = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={
            "label": "Custom Label",
            "concept_id": concept_id,
        })
        assert r.status_code == 201
        node = r.json()
        # node 的 label 是用户给的，不是 concept.title
        assert node["label"] == "Custom Label"
        assert node["concept_id"] == concept_id


# ── Concept Binding（M2b-002）──────────────────────────────────

class TestConceptBinding:
    def _make_map_with_node(self, client):
        mid = client.post("/api/v1/mindmaps", json={"title": "Bind"}).json()["id"]
        nid = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "N"}).json()["id"]
        return mid, nid

    def _make_concept(self, client, title="TestConcept"):
        from app.db import connect
        conn = connect()
        cur = conn.execute(
            "INSERT INTO concepts (title, origin, status) VALUES (?, 'manual', 'active')",
            (title,),
        )
        cid = cur.lastrowid
        conn.commit()
        conn.close()
        return cid

    def test_bind_concept(self, client):
        mid, nid = self._make_map_with_node(client)
        cid = self._make_concept(client)
        r = client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={
            "concept_id": cid,
        })
        assert r.status_code == 200
        assert r.json()["concept_id"] == cid

    def test_unbind_concept(self, client):
        mid, nid = self._make_map_with_node(client)
        cid = self._make_concept(client)
        client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={
            "concept_id": cid,
        })
        r = client.delete(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind")
        assert r.status_code == 200
        # 验证已解绑
        m = client.get(f"/api/v1/mindmaps/{mid}").json()
        node = next(n for n in m["nodes"] if n["id"] == nid)
        assert node["concept_id"] is None

    def test_bind_nonexistent_concept(self, client):
        mid, nid = self._make_map_with_node(client)
        r = client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={
            "concept_id": 9999,
        })
        assert r.status_code == 404

    def test_search_concepts(self, client):
        cid = self._make_concept(client, "Gradient Descent")
        r = client.get("/api/v1/mindmaps/concepts/search?q=Gradient")
        assert r.status_code == 200
        results = r.json()
        assert any(c["id"] == cid for c in results)

    def test_search_concepts_empty(self, client):
        r = client.get("/api/v1/mindmaps/concepts/search?q=zzzznonexistent")
        assert r.status_code == 200
        assert r.json() == []


# ── ADR-019 Boundary Audit（M2b-002 Gate）──────────────────────

class TestMindMapBoundaryAudit:
    """ADR-019 五条铁律的完整审计测试。"""

    def _setup(self, client):
        from app.db import connect
        mid = client.post("/api/v1/mindmaps", json={"title": "Audit"}).json()["id"]
        nid = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "X"}).json()["id"]
        conn = connect()
        cur = conn.execute(
            "INSERT INTO concepts (title, origin, status) VALUES (?, 'manual', 'active')",
            ("AuditConcept",),
        )
        cid = cur.lastrowid
        conn.commit()
        conn.close()
        return mid, nid, cid

    def _count(self, table):
        from app.db import connect
        conn = connect()
        count = conn.execute(f"SELECT COUNT(*) c FROM {table}").fetchone()["c"]
        conn.close()
        return count

    def test_bind_no_learning_event(self, client):
        """铁律1：绑定 Concept 不产生 learning_event。"""
        mid, nid, cid = self._setup(client)
        before = self._count("learning_events")
        client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={"concept_id": cid})
        after = self._count("learning_events")
        assert after == before

    def test_bind_no_mastery_change(self, client):
        """铁律2：绑定 Concept 不修改 concept_mastery。"""
        mid, nid, cid = self._setup(client)
        from app.db import connect
        conn = connect()
        before = conn.execute(
            "SELECT COUNT(*) c FROM concept_mastery WHERE concept_id=?", (cid,)
        ).fetchone()["c"]
        conn.close()

        client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={"concept_id": cid})

        conn = connect()
        after = conn.execute(
            "SELECT COUNT(*) c FROM concept_mastery WHERE concept_id=?", (cid,)
        ).fetchone()["c"]
        conn.close()
        assert after == before

    def test_bind_no_review_queue_change(self, client):
        """铁律3：绑定 Concept 不修改 review_queue。"""
        mid, nid, cid = self._setup(client)
        before = self._count("review_queue")
        client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={"concept_id": cid})
        after = self._count("review_queue")
        assert after == before

    def test_bind_no_links_change(self, client):
        """铁律4：绑定 Concept 不修改 links 表。"""
        mid, nid, cid = self._setup(client)
        before = self._count("links")
        client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={"concept_id": cid})
        after = self._count("links")
        assert after == before

    def test_bind_no_concept_change(self, client):
        """铁律5：绑定 Concept 不修改 concept 属性。"""
        mid, nid, cid = self._setup(client)
        from app.db import connect
        conn = connect()
        before = conn.execute(
            "SELECT title, origin, status FROM concepts WHERE id=?", (cid,)
        ).fetchone()
        conn.close()

        client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={"concept_id": cid})

        conn = connect()
        after = conn.execute(
            "SELECT title, origin, status FROM concepts WHERE id=?", (cid,)
        ).fetchone()
        conn.close()
        assert dict(before) == dict(after)

    def test_unbind_no_side_effects(self, client):
        """解除绑定同样无副作用。"""
        mid, nid, cid = self._setup(client)
        client.post(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind", json={"concept_id": cid})

        before_events = self._count("learning_events")
        before_mastery = self._count("concept_mastery")
        client.delete(f"/api/v1/mindmaps/{mid}/nodes/{nid}/bind")

        after_events = self._count("learning_events")
        after_mastery = self._count("concept_mastery")
        assert after_events == before_events
        assert after_mastery == before_mastery


# ── Export / Import（M2b-003 ADR-021）──────────────────────────

class TestExportImport:
    def test_export_map(self, client):
        """导出 Map 为 Exchange Format v1。"""
        mid = client.post("/api/v1/mindmaps", json={"title": "Exp"}).json()["id"]
        n1 = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={
            "label": "A", "position_x": 10, "position_y": 20,
        }).json()["id"]
        n2 = client.post(f"/api/v1/mindmaps/{mid}/nodes", json={"label": "B"}).json()["id"]
        client.post(f"/api/v1/mindmaps/{mid}/edges", json={"source": n1, "target": n2})

        r = client.get(f"/api/v1/mindmaps/{mid}/export")
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "1.0"
        assert data["type"] == "mindmap"
        assert data["map"]["title"] == "Exp"
        assert len(data["map"]["nodes"]) == 2
        assert len(data["map"]["edges"]) == 1
        # 验证 position 格式
        node_a = next(n for n in data["map"]["nodes"] if n["label"] == "A")
        assert node_a["position"] == {"x": 10, "y": 20}

    def test_export_not_found(self, client):
        r = client.get("/api/v1/mindmaps/9999/export")
        assert r.status_code == 404

    def test_import_map(self, client):
        """导入 Exchange Format v1 → 新建 Map。"""
        payload = {
            "version": "1.0",
            "type": "mindmap",
            "map": {
                "title": "Imported Map",
                "nodes": [
                    {"id": 1, "label": "X", "position": {"x": 50, "y": 60}},
                    {"id": 2, "label": "Y", "position": {"x": 100, "y": 200}},
                ],
                "edges": [
                    {"source": 1, "target": 2, "relation": "causes"},
                ],
            },
        }
        r = client.post("/api/v1/mindmaps/import", json=payload)
        assert r.status_code == 201
        result = r.json()
        assert result["title"] == "Imported Map"
        assert result["node_count"] == 2
        assert result["edge_count"] == 1

        # 验证导入的 Map 可以正常访问
        mid = result["id"]
        detail = client.get(f"/api/v1/mindmaps/{mid}").json()
        assert len(detail["nodes"]) == 2
        assert len(detail["edges"]) == 1
        # ID 被重映射（新 DB 中可能恰好相同，但 source/target 引用必须正确）
        assert detail["edges"][0]["source"] != detail["edges"][0]["target"]

    def test_import_invalid_type(self, client):
        r = client.post("/api/v1/mindmaps/import", json={"type": "wrong"})
        assert r.status_code == 400

    def test_import_concept_id_reference(self, client):
        """导入时 concept_id 验证：存在则保留，不存在则置 NULL。"""
        from app.db import connect
        conn = connect()
        cur = conn.execute(
            "INSERT INTO concepts (title, origin, status) VALUES (?, 'manual', 'active')",
            ("ImportConcept",),
        )
        cid = cur.lastrowid
        conn.commit()
        conn.close()

        payload = {
            "version": "1.0",
            "type": "mindmap",
            "map": {
                "title": "With Concept",
                "nodes": [
                    {"id": 1, "label": "Bound", "concept_id": cid, "position": {"x": 0, "y": 0}},
                    {"id": 2, "label": "Missing", "concept_id": 9999, "position": {"x": 10, "y": 10}},
                ],
                "edges": [],
            },
        }
        r = client.post("/api/v1/mindmaps/import", json=payload)
        assert r.status_code == 201
        mid = r.json()["id"]
        detail = client.get(f"/api/v1/mindmaps/{mid}").json()
        nodes = {n["label"]: n for n in detail["nodes"]}
        assert nodes["Bound"]["concept_id"] == cid
        assert nodes["Missing"]["concept_id"] is None

    def test_import_no_mastery_side_effects(self, client):
        """导入不产生 learning_event / mastery 变化。"""
        from app.db import connect
        conn = connect()
        before_events = conn.execute("SELECT COUNT(*) c FROM learning_events").fetchone()["c"]
        before_mastery = conn.execute("SELECT COUNT(*) c FROM concept_mastery").fetchone()["c"]
        conn.close()

        client.post("/api/v1/mindmaps/import", json={
            "version": "1.0",
            "type": "mindmap",
            "map": {
                "title": "No Side Effects",
                "nodes": [{"id": 1, "label": "N", "position": {"x": 0, "y": 0}}],
                "edges": [],
            },
        })

        conn = connect()
        after_events = conn.execute("SELECT COUNT(*) c FROM learning_events").fetchone()["c"]
        after_mastery = conn.execute("SELECT COUNT(*) c FROM concept_mastery").fetchone()["c"]
        conn.close()
        assert after_events == before_events
        assert after_mastery == before_mastery
