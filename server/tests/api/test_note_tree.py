"""`GET /notes/tree` 守护测试（ADR-026 v3 §3.2 / §6）。

覆盖：多级链 · forest · orphan 不进树 · cycle 走 `_detect_cycles` 路径不进树 ·
depth 后端剪枝 + truncated · root_id 懒加载子树 · created_at 升序 ·
depth 越界手工 422（不能被全局 handler 转 400）· root_id 404。
路由顺序（/tree 必须在 /{note_id} 前）由 test_tree_route_order 锁定。
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def _mk_note(client: TestClient, title: str, parent: str | None = None) -> dict:
    body = {"title": title, "content_md": f"# {title}\n\n正文。"}
    if parent is not None:
        body["parent"] = parent
    r = client.post("/api/v1/notes", json=body)
    assert r.status_code == 201, r.text
    return r.json()["note"]


def _tree(client: TestClient, **params) -> dict:
    r = client.get("/api/v1/notes/tree", params=params or None)
    assert r.status_code == 200, r.text
    return r.json()


def _titles(nodes: list[dict]) -> list[str]:
    return [n["note"]["title"] for n in nodes]


# --- 结构 ---

def test_multi_level_chain_full_depth(client):
    """≥3 层 parent 链完整入树（depth 默认 3：三层全可见）"""
    _mk_note(client, "层1")
    _mk_note(client, "层2", parent="层1")
    _mk_note(client, "层3", parent="层2")
    body = _tree(client)
    assert _titles(body["trees"]) == ["层1"]
    lvl1 = body["trees"][0]
    assert lvl1["truncated"] is False
    assert _titles(lvl1["children"]) == ["层2"]
    lvl2 = lvl1["children"][0]
    assert _titles(lvl2["children"]) == ["层3"]
    assert lvl2["truncated"] is False
    # parent_id 来自唯一 resolver（非 links 直读）
    assert lvl2["children"][0]["note"]["parent_id"] == lvl2["note"]["id"]


def test_depth_prunes_and_marks_truncated(client):
    """depth=2 剪枝：第 3 层不序列化，剪枝处 truncated=True"""
    _mk_note(client, "层1")
    _mk_note(client, "层2", parent="层1")
    _mk_note(client, "层3", parent="层2")
    body = _tree(client, depth=2)
    lvl1 = body["trees"][0]
    assert _titles(lvl1["children"]) == ["层2"]
    lvl2 = lvl1["children"][0]
    assert lvl2["children"] == []
    assert lvl2["truncated"] is True
    # truncated 节点的 note 不包含被剪枝层的内容
    assert all(c["note"]["title"] != "层3" for c in lvl1["children"])


def test_root_id_returns_subtree(client):
    """root_id 懒加载入口：返回该节点为根的子树（懒加载语义 §3.1）"""
    _mk_note(client, "层1")
    _mk_note(client, "层2", parent="层1")
    _mk_note(client, "层3", parent="层2")
    notes = client.get("/api/v1/notes").json()["notes"]
    lvl2_id = next(n["id"] for n in notes if n["title"] == "层2")
    body = _tree(client, root_id=lvl2_id)
    assert _titles(body["trees"]) == ["层2"]
    assert _titles(body["trees"][0]["children"]) == ["层3"]
    # 子树里的 parent_id 仍指向真实父（不是 root）
    assert body["trees"][0]["children"][0]["note"]["parent_id"] == lvl2_id


def test_root_id_unknown_404(client):
    r = client.get("/api/v1/notes/tree", params={"root_id": 999999})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "http_404"


# --- 失败语义（ADR-024 沿用，零新代码） ---

def test_orphan_visible_as_root_never_hanging(client):
    """orphan（parent 指向不存在笔记）：不悬挂为任何节点的 child，
    以根身份保持可见（parent_id=null）——resolver roots 本含 invalid
    （ADR-024 失败语义：保留声明值不丢笔记），前端 P1-1 同语义。"""
    _mk_note(client, "有主笔记")
    r = client.post("/api/v1/notes", json={
        "title": "孤儿笔记", "content_md": "x", "parent": "不存在的父"})
    assert r.status_code == 201
    body = _tree(client)
    orphan = next(n for n in body["trees"] if n["note"]["title"] == "孤儿笔记")
    assert orphan["note"]["parent_id"] is None
    assert orphan["truncated"] is False
    # 不悬挂：有主笔记的 children 里没有孤儿
    host = next(n for n in body["trees"] if n["note"]["title"] == "有主笔记")
    assert host["children"] == []


def test_cycle_nodes_never_hanging_visible_as_roots(client):
    """A→B→C→A 成环：环上节点经 _detect_cycles 判 invalid、关系不成立——
    不互相悬挂为 child（否则 build 会无限递归），以根身份保持可见可修复。"""
    _mk_note(client, "环A", parent="环C")
    _mk_note(client, "环B", parent="环A")
    _mk_note(client, "环C", parent="环B")
    body = _tree(client)
    # 全部以根出现（可见性），parent_id=null（关系不成立）
    by_title = {n["note"]["title"]: n for n in body["trees"]}
    for t in ("环A", "环B", "环C"):
        assert t in by_title, f"{t} 应作为根可见"
        assert by_title[t]["note"]["parent_id"] is None
        assert by_title[t]["children"] == []
    # 互不为父子（关系全部不成立）
    for n in body["trees"]:
        for c in n["children"]:
            assert c["note"]["title"] not in ("环A", "环B", "环C")


# --- 排序（v3 修订：created_at 升序） ---

def test_same_level_sorted_by_created_at_ascending(client):
    """同层按 created_at 升序（先建的在前），tiebreak id 升序"""
    _mk_note(client, "父笔记")
    _mk_note(client, "子甲", parent="父笔记")
    _mk_note(client, "子乙", parent="父笔记")
    _mk_note(client, "子丙", parent="父笔记")
    body = _tree(client)
    top = next(n for n in body["trees"] if n["note"]["title"] == "父笔记")
    assert _titles(top["children"]) == ["子甲", "子乙", "子丙"]


# --- 参数校验 ---

def test_depth_out_of_range_is_manual_422(client):
    """depth 越界手工 422——不能用 Query 校验（全局 handler 会转 400）"""
    for bad in (0, 11, -1, 100):
        r = client.get("/api/v1/notes/tree", params={"depth": bad})
        assert r.status_code == 422, f"depth={bad} → {r.status_code}"
        assert r.json()["error"]["code"] == "invalid_depth"


def test_depth_boundary_accepted(client):
    """边界 1 与 10 合法"""
    assert client.get("/api/v1/notes/tree", params={"depth": 1}).status_code == 200
    assert client.get("/api/v1/notes/tree", params={"depth": 10}).status_code == 200


def test_tree_route_order_before_note_id(client):
    """/tree 必须注册在 /{note_id} 之前——"tree" 不是 int，路由顺序错会落到
    /{note_id} 而得到 422（FastAPI path param int 校验）"""
    r = client.get("/api/v1/notes/tree")
    assert r.status_code == 200
    assert "trees" in r.json()
