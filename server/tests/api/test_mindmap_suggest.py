"""B6 AI 生成思维导图（LLM → 建议结构，不写库）测试。"""
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.core.mindmap import suggest_structure

_GOOD = {
    "topic": "机器学习",
    "root": {
        "label": "机器学习",
        "children": [
            {"label": "监督学习", "children": [{"label": "回归", "children": []}]},
            {"label": "无监督学习", "children": []},
        ],
    },
}


class _GoodProvider:
    def complete(self, prompt):
        return json.dumps(_GOOD, ensure_ascii=False)


class _BadProvider:
    def complete(self, prompt):
        return "not json"


class TestSuggestStructure:
    def test_parses_good_json(self):
        s = suggest_structure(_GoodProvider(), "机器学习")
        assert s is not None
        assert s["topic"] == "机器学习"
        assert s["root"]["label"] == "机器学习"
        assert len(s["root"]["children"]) == 2

    def test_bad_provider_returns_none(self):
        assert suggest_structure(_BadProvider(), "t") is None

    def test_missing_root_returns_none(self):
        class NoRoot:
            def complete(self, prompt):
                return '{"topic":"x","foo":1}'
        assert suggest_structure(NoRoot(), "x") is None

    def test_fenced_json_stripped(self):
        class Fenced:
            def complete(self, prompt):
                return f"```json\n{json.dumps(_GOOD)}\n```"
        s = suggest_structure(Fenced(), "机器学习")
        assert s is not None and s["root"]["label"] == "机器学习"


class TestMindmapSuggestAPI:
    def test_endpoint_returns_200(self, client: TestClient):
        r = client.post("/api/v1/mindmaps/suggest", json={"topic": "机器学习"})
        assert r.status_code == 200
        assert "suggestion" in r.json()  # 默认 mock 可能为 None，但契约在
