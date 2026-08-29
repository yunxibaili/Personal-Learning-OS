"""B4 自动链接建议测试：tokenize / overlap / suggest + API。"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.autolink import tokenize, content_overlap, suggest_note_links


# ── 分词 / 相似度 ─────────────────────────────────────────────────

class TestTokenize:
    def test_latin_words(self):
        t = tokenize("Attention Is All You Need attention")
        assert "attention" in t
        assert "need" in t

    def test_cjk_bigrams(self):
        t = tokenize("注意力机制")
        assert "注意" in t
        assert "意力" in t
        assert "机制" in t

    def test_empty(self):
        assert tokenize("") == set()


class TestOverlap:
    def test_identical_high(self):
        a = tokenize("gradient descent optimizer")
        b = tokenize("gradient descent optimizer")
        assert content_overlap(a, b) == 1.0

    def test_disjoint_zero(self):
        assert content_overlap(tokenize("cat dog"), tokenize("apple pear")) == 0.0

    def test_partial(self):
        a = tokenize("machine learning model")
        b = tokenize("deep learning model")
        s = content_overlap(a, b)
        assert 0.0 < s < 1.0


# ── suggest_note_links（core + 排除逻辑）───────────────────────────

class TestSuggest:
    def _mk_note(self, client, title, body):
        r = client.post("/api/v1/notes", json={"title": title, "content_md": body})
        assert r.status_code == 201, r.text
        return r.json()["note"]["id"]

    def test_suggests_related_by_overlap(self, core_conn, client):
        n1 = self._mk_note(client, "GradientDescent", "# Grad Desc\n\nlearning rate optimizer step")
        n2 = self._mk_note(client, "LearningRate", "# LR\n\nlearning rate too high harms")
        sug = suggest_note_links(core_conn, n1)
        assert any(s["target_note_id"] == n2 for s in sug)

    def test_excludes_self_and_existing_link(self, core_conn, client):
        n1 = self._mk_note(client, "Alpha", "shared token one two three")
        n2 = self._mk_note(client, "Beta", "shared token one two three four")
        # 预建已链接 → 排除
        core_conn.execute(
            "INSERT INTO links (source_type, source_id, target_type, target_id, relation, origin) "
            "VALUES ('note', ?, 'note', ?, 'related', 'manual')", (n1, n2))
        core_conn.commit()
        sug = suggest_note_links(core_conn, n1)
        assert all(s["target_note_id"] != n2 for s in sug)
        assert all(s["source_note_id"] == n1 for s in sug)


# ── API ─────────────────────────────────────────────────────────────

class TestAutolinkAPI:
    def test_endpoint_returns_suggestions(self, client):
        n1 = client.post("/api/v1/notes", json={
            "title": "API-1", "content_md": "machine learning gradient descent model"}).json()["note"]["id"]
        client.post("/api/v1/notes", json={
            "title": "API-2", "content_md": "machine learning gradient descent model training"})
        r = client.get(f"/api/v1/notes/{n1}/link-suggestions")
        assert r.status_code == 200
        body = r.json()
        assert body["note_id"] == n1
        assert len(body["suggestions"]) >= 1
        assert {"source_note_id", "target_note_id", "target_title", "score"} \
            <= set(body["suggestions"][0].keys())

    def test_endpoint_unknown_note_404(self, client):
        assert client.get("/api/v1/notes/999999/link-suggestions").status_code == 404

    def test_endpoint_min_score_filter(self, client):
        n1 = client.post("/api/v1/notes", json={
            "title": "F1", "content_md": "alpha beta gamma"}).json()["note"]["id"]
        client.post("/api/v1/notes", json={
            "title": "F2", "content_md": "delta epsilon zeta"})
        r = client.get(f"/api/v1/notes/{n1}/link-suggestions?min_score=0.5")
        assert r.status_code == 200
        assert r.json()["suggestions"] == []
