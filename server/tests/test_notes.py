"""M1 notes/search 契约与行为测试。所有用例跑在隔离的临时 workspace。"""
from __future__ import annotations

from fastapi.testclient import TestClient

SUMMARY_KEYS = {"id", "path", "title", "tags", "updated_at"}
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
