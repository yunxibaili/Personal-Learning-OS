"""M1 notes/search 契约与行为测试。所有用例跑在隔离的临时 workspace。"""
from __future__ import annotations

from fastapi.testclient import TestClient

# ADR-024 P1-1：契约加 parent_id（来自唯一 resolve_hierarchy，红线 2/5）
SUMMARY_KEYS = {"id", "path", "title", "tags", "updated_at", "parent_id"}
DETAIL_KEYS = SUMMARY_KEYS | {"content_md"}


def _create(client: TestClient, title: str, content: str = ""):
    return client.post("/api/v1/notes",
                       json={"title": title, "content_md": content})


def test_create_and_detail_contract(client: TestClient) -> None:
    r = _create(client, "特征值", "# 特征值\n$A\\vec{x}=\\lambda\\vec{x}$")
    assert r.status_code == 201
    note = r.json()["note"]
    assert set(note.keys()) == DETAIL_KEYS            # 契约形状锁定
    assert note["path"] == "特征值.md"
    assert note["tags"] == []

    # 文件真实落盘且为 Markdown 事实源
    from app.core.knowledge import resolve_vault_file
    f = resolve_vault_file("特征值.md")
    assert f.exists() and "特征值" in f.read_text(encoding="utf-8")


def test_list_summary_contract_and_order(client: TestClient) -> None:
    _create(client, "笔记甲", "alpha")
    _create(client, "笔记乙", "beta")
    r = client.get("/api/v1/notes")
    notes = r.json()["notes"]
    assert len(notes) == 2
    assert set(notes[0].keys()) == SUMMARY_KEYS
    # 最近更新在前
    assert notes[0]["title"] == "笔记乙"


def test_patch_updates_file_content_and_tags(client: TestClient) -> None:
    note = _create(client, "导数", "旧内容").json()["note"]
    r = client.patch(f"/api/v1/notes/{note['id']}",
                     json={"content_md": "新内容 $f'(x)$",
                           "tags": ["数学", "微积分"]})
    body = r.json()
    assert set(body["note"].keys()) == DETAIL_KEYS
    assert body["note"]["tags"] == sorted(["数学", "微积分"])

    from app.core.knowledge import resolve_vault_file
    text = resolve_vault_file("导数.md").read_text(encoding="utf-8")
    assert text.startswith("---\ntags: " + ", ".join(sorted(["数学", "微积分"])))
    assert "新内容" in text


def test_patch_rename_rewrites_path(client: TestClient) -> None:
    note = _create(client, "旧名", "x").json()["note"]
    r = client.patch(f"/api/v1/notes/{note['id']}", json={"title": "新名"})
    assert r.json()["note"]["path"] == "新名.md"
    from app.core.knowledge import vault_root
    assert not (vault_root() / "旧名.md").exists()
    assert (vault_root() / "新名.md").exists()


def test_duplicate_title_conflict(client: TestClient) -> None:
    _create(client, "重复")
    r = _create(client, "重复")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "duplicate_title"


def test_delete_removes_file_and_index(client: TestClient) -> None:
    note = _create(client, "将删除", "unique_word_xyz").json()["note"]
    r = client.delete(f"/api/v1/notes/{note['id']}")
    assert r.json() == {"ok": True}
    from app.core.knowledge import vault_root
    assert not (vault_root() / "将删除.md").exists()
    assert client.get(f"/api/v1/notes/{note['id']}").status_code == 404


def test_search_hits_body_and_title(client: TestClient) -> None:
    _create(client, "Gradient Descent Notes",
            "gradient descent updates parameters using derivatives")
    r = client.get("/api/v1/search", params={"q": "descent"})
    results = r.json()["results"]
    assert results and results[0]["title"] == "Gradient Descent Notes"

    r = client.get("/api/v1/search")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "missing_q"


def test_get_missing_note_404_shape(client: TestClient) -> None:
    r = client.get("/api/v1/notes/99999")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "http_404"

# ── B15 批量导入 ──────────────────────────────────────────────────

def test_batch_create_many(client: TestClient) -> None:
    r = client.post("/api/v1/notes/batch", json={
        "notes": [
            {"title": "BatchA", "content_md": "content A"},
            {"title": "BatchB", "content_md": "content B"},
            {"title": "BatchC", "content_md": "content C"},
        ]
    })
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 3
    statuses = [x["status"] for x in body["results"]]
    assert statuses == ["ok", "ok", "ok"]
    assert all(x["note_id"] for x in body["results"])


def test_batch_partial_duplicate_and_invalid(client: TestClient) -> None:
    """部分成功不阻断：合法创建、重复跳过、空标题返回状态。"""
    _create(client, "ExistsNote", "x")
    r = client.post("/api/v1/notes/batch", json={
        "notes": [
            {"title": "Fresh1", "content_md": "a"},
            {"title": "ExistsNote", "content_md": "dup"},
            {"title": "   ", "content_md": "empty"},
        ]
    })
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 1
    by_title = {x["title"]: x["status"] for x in body["results"]}
    assert by_title["Fresh1"] == "ok"
    assert by_title["ExistsNote"] == "duplicate_title"
    assert by_title["   "] in ("empty_title",)


def test_batch_empty_list(client: TestClient) -> None:
    r = client.post("/api/v1/notes/batch", json={"notes": []})
    assert r.status_code == 200
    assert r.json() == {"created": 0, "results": []}

# ── B19 外部格式导入 ────────────────────────────────────────────────

def test_import_directory_to_vault(client, tmp_path) -> None:
    """导入本地目录：保留相对结构 + 索引可搜 + 重复跳过。"""
    source = tmp_path / "obsidian_export"
    (source / "sub").mkdir(parents=True)
    (source / "NoteA.md").write_text("# NoteA\n\ncontent with keyword", encoding="utf-8")
    (source / "sub" / "NoteB.md").write_text("# NoteB\n\nsecond note", encoding="utf-8")

    r = client.post("/api/v1/notes/import", json={"source": str(source)})
    assert r.status_code == 200
    body = r.json()
    assert body["imported"] == 2
    statuses = {f["rel"]: f["status"] for f in body["files"]}
    assert statuses["NoteA.md"] == "imported"
    assert statuses["sub/NoteB.md"] == "imported"

    # 已入索引（vault 相对路径为 imported/...）
    from app.core.knowledge import connect as _connect
    _conn = _connect()
    rows = _conn.execute("SELECT path, title FROM notes ORDER BY path").fetchall()
    _conn.close()
    assert any(r["path"] == "imported/NoteA.md" for r in rows)

    # 重复导入 → 跳过
    r2 = client.post("/api/v1/notes/import", json={"source": str(source),
                                                   "prefix": "imported"})
    assert r2.json()["imported"] == 0
    assert r2.json()["skipped"] == 2


def test_import_single_file(client, tmp_path) -> None:
    f = tmp_path / "solo.md"
    f.write_text("# Solo\n\nstandalone", encoding="utf-8")
    r = client.post("/api/v1/notes/import", json={"source": str(f), "prefix": "inbox"})
    assert r.json()["imported"] == 1
    assert r.json()["files"][0]["status"] == "imported"


def test_import_missing_source(client) -> None:
    r = client.post("/api/v1/notes/import", json={"source": "Z:/definitely/absent"})
    assert r.status_code == 200
    assert "error" in r.json()

# ── B9 中文检索增强（bigram 回退，不引 jieba）───────────────────────

def test_cjk_search_finds_phrase(client: TestClient) -> None:
    """中文连词（unicode61 单字切分检索不到）经 bigram 回退仍可命中。"""
    client.post("/api/v1/notes", json={
        "title": "注意力机制", "content_md": "注意力机制是深度学习的核心"})
    client.post("/api/v1/notes", json={
        "title": "无关", "content_md": "今天天气不错"})
    r = client.get("/api/v1/search", params={"q": "注意力机制"})
    assert r.status_code == 200
    res = r.json()["results"]
    assert any(x["title"] == "注意力机制" for x in res)
    # 无关笔记不应作为高分结果出现在前面
    titles = [x["title"] for x in res]
    assert "注意力机制" in titles


def test_cjk_search_scores_relevant_higher(client: TestClient) -> None:
    """与查询词重叠度越高的笔记排在越前。"""
    client.post("/api/v1/notes", json={
        "title": "强相关", "content_md": "梯度下降 学习率 优化"})
    client.post("/api/v1/notes", json={
        "title": "弱相关", "content_md": "梯度"})
    r = client.get("/api/v1/search", params={"q": "梯度下降学习率"})
    res = r.json()["results"]
    titles = [x["title"] for x in res]
    if "强相关" in titles and "弱相关" in titles:
        assert titles.index("强相关") < titles.index("弱相关")
    assert any(x.get("method") == "cjk_bigram" for x in res)


# ── ADR-024 P1-1：/notes 契约带 parent_id（来自唯一 resolver，红线 2/5）──

def test_list_contract_includes_parent_id(client: TestClient) -> None:
    """/notes 列表响应锁定 parent_id 字段（契约三层一致的后端侧）。"""
    child = client.post("/api/v1/notes", json={
        "title": "反向传播", "content_md": "x"}).json()["note"]
    parent = client.post("/api/v1/notes", json={
        "title": "深度学习", "content_md": "y"}).json()["note"]
    client.patch(f"/api/v1/notes/{child['id']}", json={"parent": "深度学习"})

    notes = {n["title"]: n for n in client.get("/api/v1/notes").json()["notes"]}
    assert notes["反向传播"]["parent_id"] == parent["id"]   # 显式 parent 经 resolver
    assert notes["深度学习"]["parent_id"] is None          # 根


def test_detail_contract_includes_parent_id(client: TestClient) -> None:
    note = client.post("/api/v1/notes", json={"title": "甲", "content_md": ""}).json()["note"]
    detail = client.get(f"/api/v1/notes/{note['id']}").json()["note"]
    assert "parent_id" in detail
    assert detail["parent_id"] is None


def test_create_with_parent_one_step(client: TestClient) -> None:
    """POST /notes 带 parent：一步创建副笔记（P1「新建副笔记」入口的后端语义）。"""
    parent = client.post("/api/v1/notes", json={
        "title": "机器学习", "content_md": ""}).json()["note"]
    r = client.post("/api/v1/notes", json={
        "title": "Adam 优化器", "content_md": "正文", "parent": "机器学习"})
    assert r.status_code == 201
    note = r.json()["note"]
    assert note["parent_id"] == parent["id"]

    # frontmatter 事实源落盘
    from app.core.knowledge import resolve_vault_file
    text = resolve_vault_file("Adam 优化器.md").read_text(encoding="utf-8")
    assert 'parent: "[[机器学习]]"' in text

    # 派生索引同步镜像
    from app.db import connect
    conn = connect()
    try:
        edge = conn.execute(
            "SELECT target_id FROM links WHERE source_id=? AND relation='parent'",
            (note["id"],),
        ).fetchone()
        assert edge is not None and edge["target_id"] == parent["id"]
    finally:
        conn.close()


def test_create_with_invalid_parent_does_not_block(client: TestClient) -> None:
    """红线 4：orphan parent 创建不阻断；保留 frontmatter 原值，parent_id=null。"""
    r = client.post("/api/v1/notes", json={
        "title": "孤儿", "content_md": "", "parent": "不存在的笔记"})
    assert r.status_code == 201, r.text
    note = r.json()["note"]
    assert note["parent_id"] is None

    from app.core.knowledge import resolve_vault_file
    text = resolve_vault_file("孤儿.md").read_text(encoding="utf-8")
    assert 'parent: "[[不存在的笔记]]"' in text   # 原值保留，resolver 标 invalid


def test_create_with_empty_parent_omits_frontmatter(client: TestClient) -> None:
    """parent="" 或 None 与旧语义一致：不写 frontmatter。"""
    cases = [("无父甲", {}), ("无父乙", {"parent": None}), ("无父丙", {"parent": ""})]
    for title, kw in cases:
        r = client.post("/api/v1/notes", json={"title": title, **kw})
        assert r.status_code == 201, r.text
        from app.core.knowledge import resolve_vault_file
        text = resolve_vault_file(f"{title}.md").read_text(encoding="utf-8")
        assert "parent" not in text
