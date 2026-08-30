"""M7-008 Sync HTTP 层测试：manifest exchange + pairing 端点。

冻结边界：
  - /sync/plan 只算差异，不落盘（写入仍由 /sync/receive 经 SyncApply 完成）
  - 配对端点只写 Layer 3 metadata/paired_devices.json
  - Router 不直接读写 SQLite / vault
"""
from __future__ import annotations

import hashlib

import pytest

from app.core.sync.manifest import FileEntry, Manifest


def _entry(path: str, content: str) -> FileEntry:
    data = content.encode("utf-8")
    return FileEntry(
        path=path,
        sha256=hashlib.sha256(data).hexdigest(),
        size=len(data),
        mtime=1700000000.0,
    )


def _remote_manifest(*entries: FileEntry, device_id: str = "remote-dev") -> dict:
    return Manifest(
        device_id=device_id,
        files={e.path: e for e in entries},
    ).to_dict()


@pytest.fixture()
def vault(tmp_workspace):
    d = tmp_workspace / "vault"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write(vault, name: str, content: str) -> None:
    (vault / name).write_text(content, encoding="utf-8")


# ── GET /sync/manifest ────────────────────────────────────────

class TestManifestEndpoint:
    def test_returns_manifest_shape(self, client, vault):
        _write(vault, "ml.md", "# ML")
        r = client.get("/api/v1/sync/manifest")
        assert r.status_code == 200
        body = r.json()
        assert body["version"] == 1
        assert body["device_id"]  # 来自 load_or_create_device
        assert body["generated_at"]
        assert "vault/ml.md" in body["files"]
        entry = body["files"]["vault/ml.md"]
        assert set(entry) == {"path", "sha256", "size", "mtime"}

    def test_sha256_matches_content(self, client, vault):
        _write(vault, "a.md", "hello")
        files = client.get("/api/v1/sync/manifest").json()["files"]
        assert files["vault/a.md"]["sha256"] == hashlib.sha256(b"hello").hexdigest()

    def test_excludes_non_layer1_files(self, client, vault, tmp_workspace):
        """SQLite / 配对登记簿 / 隐藏文件不得进清单（ADR-020）。"""
        _write(vault, "a.md", "hello")
        (tmp_workspace / "vault" / "secret.txt").write_text("x", encoding="utf-8")
        (tmp_workspace / "db").mkdir(exist_ok=True)
        (tmp_workspace / "db" / "learning-os.db").write_bytes(b"sqlite")
        (tmp_workspace / "metadata").mkdir(parents=True, exist_ok=True)
        (tmp_workspace / "metadata" / "paired_devices.json").write_text("[]", encoding="utf-8")

        files = client.get("/api/v1/sync/manifest").json()["files"]
        assert any(p.endswith(".txt") for p in files) is False
        assert any("learning-os.db" in p for p in files) is False
        assert any("paired_devices" in p for p in files) is False

    def test_empty_vault_returns_empty_files(self, client):
        assert client.get("/api/v1/sync/manifest").json()["files"] == {}


# ── POST /sync/plan ───────────────────────────────────────────

class TestPlanEndpoint:
    def test_local_only_yields_upload(self, client, vault):
        _write(vault, "local.md", "mine")
        r = client.post("/api/v1/sync/plan", json={"manifest": _remote_manifest()})
        assert r.status_code == 200
        plan = r.json()
        item = next(i for i in plan["items"] if i["path"] == "vault/local.md")
        assert item["action"] == "upload"
        assert plan["summary"]["upload"] >= 1

    def test_remote_only_yields_download(self, client, vault):
        r = client.post(
            "/api/v1/sync/plan",
            json={"manifest": _remote_manifest(_entry("vault/remote.md", "theirs"))},
        )
        plan = r.json()
        item = next(i for i in plan["items"] if i["path"] == "vault/remote.md")
        assert item["action"] == "download"

    def test_identical_yields_skip(self, client, vault):
        _write(vault, "same.md", "identical content")
        r = client.post(
            "/api/v1/sync/plan",
            json={"manifest": _remote_manifest(_entry("vault/same.md", "identical content"))},
        )
        item = next(i for i in r.json()["items"] if i["path"] == "vault/same.md")
        assert item["action"] == "skip"

    def test_divergent_yields_conflict(self, client, vault):
        _write(vault, "d.md", "local version")
        r = client.post(
            "/api/v1/sync/plan",
            json={"manifest": _remote_manifest(_entry("vault/d.md", "remote version"))},
        )
        plan = r.json()
        item = next(i for i in plan["items"] if i["path"] == "vault/d.md")
        assert item["action"] == "conflict"
        assert plan["summary"]["conflict"] == 1

    def test_summary_counts_match_items(self, client, vault):
        _write(vault, "u.md", "only local")
        _write(vault, "s.md", "same both")
        r = client.post(
            "/api/v1/sync/plan",
            json={
                "manifest": _remote_manifest(
                    _entry("vault/s.md", "same both"),
                    _entry("vault/down.md", "only remote"),
                )
            },
        )
        plan = r.json()
        total = sum(plan["summary"].values())
        assert total == len(plan["items"])

    def test_plan_does_not_write_anything(self, client, vault, tmp_workspace):
        """plan 是纯计算：不得产生内容文件（写入口唯一性 Rule 1）。

        先调 manifest 预热设备身份——devices.json 属 Layer 3 身份文件，
        首次访问时创建一次属预期副作用，不是 plan 的写盘行为。
        """
        _write(vault, "u.md", "only local")
        client.get("/api/v1/sync/manifest")  # 预热 devices.json
        before = {p.as_posix() for p in tmp_workspace.rglob("*")}
        client.post(
            "/api/v1/sync/plan",
            json={"manifest": _remote_manifest(_entry("vault/remote.md", "theirs"))},
        )
        after = {p.as_posix() for p in tmp_workspace.rglob("*")}
        assert before == after, "plan 不应写盘——写入只能经 /sync/receive + SyncApply"

    @pytest.mark.parametrize("bad,code", [
        # 结构缺字段 / 类型错 → pydantic 拦截（本项目统一映射 400 invalid_body）
        ({}, "invalid_body"),
        ({"manifest": "not-a-dict"}, "invalid_body"),
        # 结构对但内容非法 → 落到 core 解析，由本端点返回 bad_manifest
        ({"manifest": {}}, "bad_manifest"),
        ({"manifest": {"device_id": "r", "files": {"a": {"path": "a"}}}}, "bad_manifest"),
        ({"manifest": {"device_id": "r", "files": []}}, "bad_manifest"),
    ])
    def test_malformed_manifest_returns_400(self, client, bad, code):
        r = client.post("/api/v1/sync/plan", json=bad)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == code

    def test_error_body_leaks_no_input(self, client):
        """400 响应体不得回显原始输入（main.py 剥离 input/url 的回归保护）。"""
        r = client.post("/api/v1/sync/plan", json={"manifest": {}})
        assert "manifest" not in r.text or "bad_manifest" in r.text


# ── 配对端点 ──────────────────────────────────────────────────

class TestPairingEndpoints:
    def test_pair_then_list(self, client, tmp_workspace):
        r = client.post("/api/v1/sync/pair", json={
            "device_id": "peer-abc", "name": "MacBook",
            "host": "192.168.1.20", "port": 8100,
        })
        assert r.status_code == 201
        assert r.json()["ok"] is True
        assert r.json()["message"] == "paired"

        peers = client.get("/api/v1/sync/peers").json()["peers"]
        assert len(peers) == 1
        assert peers[0]["device_id"] == "peer-abc"
        assert peers[0]["host"] == "192.168.1.20"
        assert peers[0]["port"] == 8100
        assert peers[0]["paired_at"]

    def test_repair_is_idempotent(self, client):
        body = {"device_id": "peer-abc", "host": "192.168.1.20", "port": 8100}
        client.post("/api/v1/sync/pair", json=body)
        r = client.post("/api/v1/sync/pair", json={**body, "port": 8200})
        assert r.json()["message"] == "updated"
        peers = client.get("/api/v1/sync/peers").json()["peers"]
        assert len(peers) == 1 and peers[0]["port"] == 8200

    def test_pair_with_default_port(self, client):
        r = client.post("/api/v1/sync/pair", json={
            "device_id": "peer-def", "host": "10.0.0.7",
        })
        assert r.status_code == 201
        assert client.get("/api/v1/sync/peers").json()["peers"][0]["port"] == 8000

    @pytest.mark.parametrize("bad,code", [
        # 类型/范围错误 → pydantic 字段约束先拦下（invalid_body）
        ({"device_id": "peer-1", "host": "10.0.0.1", "port": 0}, "invalid_body"),
        ({"device_id": "peer-1", "host": "10.0.0.1", "port": 70000}, "invalid_body"),
        ({"device_id": "", "host": "10.0.0.1"}, "invalid_body"),
        # 类型合法但语义非法 → 落到 core 的 fail-closed 校验（pair_rejected）
        ({"device_id": "peer-1", "host": "999.999.999.999"}, "pair_rejected"),
        ({"device_id": "peer-1", "host": "http://evil.com/x"}, "pair_rejected"),
        ({"device_id": "../etc", "host": "10.0.0.1"}, "pair_rejected"),
    ])
    def test_invalid_pair_rejected(self, client, bad, code):
        r = client.post("/api/v1/sync/pair", json=bad)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == code
        assert client.get("/api/v1/sync/peers").json()["peers"] == []

    def test_unpair(self, client):
        client.post("/api/v1/sync/pair", json={"device_id": "peer-x", "host": "10.0.0.5"})
        assert client.delete("/api/v1/sync/peers/peer-x").json()["ok"] is True
        assert client.get("/api/v1/sync/peers").json()["peers"] == []

    def test_unpair_unknown_is_404(self, client):
        r = client.delete("/api/v1/sync/peers/ghost")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "peer_not_found"

    def test_peers_is_per_workspace(self, client, tmp_workspace):
        """配对属 Layer 3 本地缓存：不进 vault，也不进 manifest。"""
        client.post("/api/v1/sync/pair", json={"device_id": "peer-1", "host": "10.0.0.1"})
        files = client.get("/api/v1/sync/manifest").json()["files"]
        assert not any("paired_devices" in p for p in files)


# ── GET /sync/discover ────────────────────────────────────────

class TestDiscoverEndpoint:
    def test_returns_peer_list_shape(self, client):
        r = client.get("/api/v1/sync/discover?timeout=0.2")
        assert r.status_code == 200
        body = r.json()
        assert "peers" in body and isinstance(body["peers"], list)
        assert "degraded" in body

    def test_timeout_is_bounded(self, client):
        """发现是同步请求路径上的一步，超时参数不得被放大。

        注：本项目把参数校验统一映射为 400（main.py 的 invalid_body 处理器），
        而非 FastAPI 默认的 422。
        """
        for bad in ("99", "0", "0.1", "abc"):
            r = client.get(f"/api/v1/sync/discover?timeout={bad}")
            assert r.status_code == 400, f"timeout={bad} 应被 ge/le 挡下"
