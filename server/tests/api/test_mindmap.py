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
