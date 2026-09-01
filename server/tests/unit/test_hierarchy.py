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
