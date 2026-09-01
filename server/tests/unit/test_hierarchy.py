"""ADR-024 主/副笔记 — P0-5 守护测试（12 项验收 + round-trip + export→rebuild）。"""
from __future__ import annotations

from app.core import knowledge as K
from app.core import hierarchy as H
from app.db import connect
from app.core.reindex import reindex_vault


def _mk(client, title: str, parent: str | None = None, content: str = "") -> int:
    """POST /notes 建笔记；可选经 PATCH 设置 parent。返回 note_id。"""
    r = client.post("/api/v1/notes", json={"title": title, "content_md": content})
    assert r.status_code == 201, r.text
    nid = r.json()["note"]["id"]
    if parent is not None:
        _set_parent(client, nid, parent)
    return nid


def _set_parent(client, note_id: int, parent: str | None) -> None:
    r = client.patch(f"/api/v1/notes/{note_id}", json={"parent": parent})
    assert r.status_code == 200, f"PATCH parent failed: {r.text}"


def _h(client) -> dict:
    conn = connect()
    try:
        return H.resolve_hierarchy(conn)
    finally:
        conn.close()


def _invalid_reasons(client) -> dict[int, str]:
    return {i["note_id"]: i["reason"] for i in _h(client)["invalid"]}


def _graph_parent_edges(client) -> list[tuple[int, int]]:
    g = client.get("/api/v1/graph?depth=3")
    assert g.status_code == 200, g.text
    return [
        (int(e["source"].split("-")[1]), int(e["target"].split("-")[1]))
        for e in g.json().get("edges", [])
        if e.get("relation") == "parent"
    ]


def _note_meta(client, note_id: int) -> dict[str, str]:
    conn = connect()
    try:
        row = K.get_note_row(conn, note_id)
        meta, _, _ = K.parse_frontmatter(
            K.resolve_vault_file(row["path"]).read_text("utf-8"))
        return meta
    finally:
        conn.close()


# ---------- 用例 ----------


def test_1_no_parent_normal(client):
    a = _mk(client, "A")
    assert a not in _h(client)["parent_of"]
    _set_parent(client, a, None)
    assert a not in _h(client)["parent_of"]


def test_2_parent_to_existing_note(client):
    a = _mk(client, "A")
    b = _mk(client, "B", parent="A")
    assert _h(client)["parent_of"][b] == a
    assert not any(i["note_id"] == b for i in _h(client)["invalid"])
    assert (b, a) in _graph_parent_edges(client)


def test_3_parent_missing_preserved_invalid(client):
    a = _mk(client, "A")
    b = _mk(client, "B", parent="不存在的主笔记")
    assert b not in _h(client)["parent_of"]
    assert _invalid_reasons(client).get(b) == H.REASON_ORPHAN
    assert K.parse_parent(_note_meta(client, b)) == "不存在的主笔记"


def test_4_self_parent_preserved_invalid(client):
    a = _mk(client, "A")
    _set_parent(client, a, "A")
    assert a not in _h(client)["parent_of"]
    assert _invalid_reasons(client).get(a) == H.REASON_SELF


def test_5_cycle_detected(client):
    a = _mk(client, "A")
    b = _mk(client, "B")
    _set_parent(client, a, "B")
    _set_parent(client, b, "A")
    h = _h(client)
    assert a not in h["parent_of"] and b not in h["parent_of"]
    reasons = _invalid_reasons(client)
    assert reasons.get(a) == H.REASON_CYCLE and reasons.get(b) == H.REASON_CYCLE


def test_6_two_children_same_parent(client):
    p = _mk(client, "P")
    c1 = _mk(client, "C1", parent="P")
    c2 = _mk(client, "C2", parent="P")
    h = _h(client)
    assert h["parent_of"].get(c1) == p and h["parent_of"].get(c2) == p
    assert sorted(h["children"][p]) == sorted([c1, c2])


def test_7_change_parent_old_gone(client):
    a = _mk(client, "A")
    b = _mk(client, "B")
    c = _mk(client, "C", parent="A")
    _set_parent(client, c, "B")
    h = _h(client)
    assert h["parent_of"].get(c) == b
    assert c not in h["children"].get(a, [])


def test_8_delete_parent_file_child_not_deleted(client):
    a = _mk(client, "A")
    b = _mk(client, "B", parent="A")
    assert client.delete(f"/api/v1/notes/{a}").status_code in (200, 204)
    r = client.get("/api/v1/notes")
    assert r.status_code == 200
    assert b in _invalid_reasons(client)


def test_9_compose_roundtrip_preserves_parent(client):
    _mk(client, "A")
    b = _mk(client, "B", parent="A")
    assert K.parse_parent(_note_meta(client, b)) == "A"
    assert client.patch(f"/api/v1/notes/{b}", json={"content_md": "正文改动"}).status_code == 200
    assert K.parse_parent(_note_meta(client, b)) == "A"


def test_10_export_rebuild_parent_not_lost(client, tmp_workspace):
    """parent 事实源在 vault 文件，reindex 重读 frontmatter 后不丢（对应 BUG-1/场景 C）。"""
    a = _mk(client, "A")
    b = _mk(client, "B", parent="A")
    assert (b, a) in _graph_parent_edges(client)
    # 模拟重建：从 vault 文件重算索引 → parent 仍可解析、/graph 仍带出父边
    conn = connect()
    try:
        reindex_vault(conn, tmp_workspace / "vault")
        conn.commit()
    finally:
        conn.close()
    assert K.parse_parent(_note_meta(client, b)) == "A"
    assert (b, a) in _graph_parent_edges(client)


def test_11_legacy_no_parent_inferred(client):
    a = _mk(client, "A")
    b = _mk(client, "B", content="链接到 [[A]] 的内容")
    # content 里的 wikilink 在创建时已 rebuild → b 出链指向 a（无显式 parent）
    h = _h(client)
    assert h["parent_of"].get(b) == a
    assert h["source"].get(b) == H.INFERRED


def test_12_explicit_parent_wins_over_links(client):
    """最关键：显式 parent 与 wikilink 推断冲突时，显式优先（禁止结果摇摆）。"""
    a = _mk(client, "A")
    _mk(client, "B")
    c = _mk(client, "C", content="[[B]]")   # 推断 C 属于 B
    _set_parent(client, c, "A")             # 显式 C.parent = A
    h = _h(client)
    assert h["parent_of"].get(c) == a
    assert h["source"].get(c) == H.EXPLICIT


# ---------- frontmatter 边界测试（GPT 评审建议 · 2026-09-01）----------


def test_13_parent_with_special_chars(client):
    """parent 标题含特殊字符（中文括号、点号）仍可正常解析。"""
    a = _mk(client, "机器学习（基础）")
    b = _mk(client, "优化器", parent="机器学习（基础）")
    assert _h(client)["parent_of"].get(b) == a
    assert K.parse_parent(_note_meta(client, b)) == "机器学习（基础）"


def test_14_parent_with_dots(client):
    """parent 标题含点号（如 '3.14'）。"""
    a = _mk(client, "第3.14章")
    b = _mk(client, "子节点", parent="第3.14章")
    assert _h(client)["parent_of"].get(b) == a


def test_15_parent_long_title(client):
    """超长 parent 标题（100 字符）仍可正常解析。"""
    long_title = "A" * 100
    a = _mk(client, long_title)
    b = _mk(client, "子节点", parent=long_title)
    assert _h(client)["parent_of"].get(b) == a
    assert K.parse_parent(_note_meta(client, b)) == long_title


def test_16_parent_empty_string(client):
    """parent='' 等同于无 parent（真删除 frontmatter key）。"""
    a = _mk(client, "A")
    _set_parent(client, a, "")
    meta = _note_meta(client, a)
    assert "parent" not in meta
    assert a not in _h(client)["parent_of"]


def test_17_parent_whitespace_only(client):
    """parent='   ' 等同于无 parent。"""
    a = _mk(client, "A")
    _set_parent(client, a, "   ")
    assert a not in _h(client)["parent_of"]


def test_18_parent_wikilink_syntax_variants(client):
    """兼容 `[[标题]]` 和裸标题两种写法——parse_parent 都能正确解析。"""
    # 验证 parse_parent 对两种格式的解析
    assert K.parse_parent({"parent": "[[主笔记]]"}) == "主笔记"
    assert K.parse_parent({"parent": "主笔记"}) == "主笔记"
    assert K.parse_parent({"parent": "  [[带空格]]  "}) == "带空格"
    assert K.parse_parent({}) is None
    assert K.parse_parent({"parent": ""}) is None

    # 实际创建+设置验证
    a = _mk(client, "主笔记")
    b1 = _mk(client, "子1")
    _set_parent(client, b1, "主笔记")  # 裸标题
    b2 = _mk(client, "子2")
    _set_parent(client, b2, "主笔记")  # 同样裸标题（set_meta_parent 会自动包 [[ ]]）
    h = _h(client)
    assert h["parent_of"].get(b1) == a
    assert h["parent_of"].get(b2) == a


def test_19_create_note_with_parent_directly(client):
    """POST /notes 直接带 parent 参数（一步创建副笔记）。"""
    a = _mk(client, "主笔记")
    r = client.post("/api/v1/notes", json={
        "title": "副笔记",
        "content_md": "内容",
        "parent": "主笔记",
    })
    assert r.status_code == 201
    b = r.json()["note"]["id"]
    assert _h(client)["parent_of"].get(b) == a
    assert K.parse_parent(_note_meta(client, b)) == "主笔记"


def test_20_create_note_with_invalid_parent(client):
    """POST /notes parent 指向不存在的笔记 → 不阻断创建，标 orphan。"""
    r = client.post("/api/v1/notes", json={
        "title": "孤儿",
        "parent": "不存在的笔记",
    })
    assert r.status_code == 201
    nid = r.json()["note"]["id"]
    assert _invalid_reasons(client).get(nid) == H.REASON_ORPHAN
    assert K.parse_parent(_note_meta(client, nid)) == "不存在的笔记"
