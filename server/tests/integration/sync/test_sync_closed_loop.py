"""M7-008 同步闭环集成测试：两台设备走完整链路。

守护对象：**链路本身**，而非某个函数。
单点测试（test_sync_pairing / test_sync_http / test_sync_apply）各自绿着，
不等于两台设备真能同步——历史上本项目多次出现「零件全对、接线没接」的失效
（memories router 漏挂、TutorPanel 零 props 渲染）。本文件把
**Discover → Pair → Manifest → Diff → Transport → Apply → Reindex → 收敛**
整条链一次跑通，任何一段断掉都会在这里先炸。

设备 A/B 用两个临时 workspace 模拟；workspace_root() 每次调用都读
WORKSPACE_DIR 环境变量，故可在同一 TestClient 上切换视角。
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def pair(tmp_path):
    """两台设备：独立 workspace + 已建库，返回 (client, ws_a, ws_b)。"""
    from app.db import init_db
    from app.main import app

    ws_a, ws_b = tmp_path / "deviceA", tmp_path / "deviceB"
    for ws in (ws_a, ws_b):
        (ws / "vault").mkdir(parents=True, exist_ok=True)
        os.environ["WORKSPACE_DIR"] = str(ws)
        init_db()

    with TestClient(app) as client:
        yield client, ws_a, ws_b


def switch(ws: Path) -> None:
    os.environ["WORKSPACE_DIR"] = str(ws)


def note(ws: Path, name: str, text: str) -> None:
    (ws / "vault" / name).write_text(text, encoding="utf-8")


def _seed(pair):
    """A：ml.md（独有）+ shared.md；B：rust.md（独有）+ shared.md（内容不同）。"""
    client, ws_a, ws_b = pair
    note(ws_a, "ml.md", "# 机器学习\n反向传播[[梯度下降]]")
    note(ws_a, "shared.md", "A 版本")
    note(ws_b, "rust.md", "# Rust 所有权")
    note(ws_b, "shared.md", "B 版本")
    return client, ws_a, ws_b


class TestSyncClosedLoop:
    def test_devices_have_distinct_identities(self, pair):
        """两端必须先有各自的身份，否则清单无法归属。"""
        client, ws_a, ws_b = pair
        switch(ws_a)
        id_a = client.get("/api/v1/sync/manifest").json()["device_id"]
        switch(ws_b)
        id_b = client.get("/api/v1/sync/manifest").json()["device_id"]
        assert id_a and id_b and id_a != id_b

    def test_manifest_exchange_reflects_each_side(self, pair):
        client, ws_a, ws_b = _seed(pair)
        switch(ws_a)
        ma = client.get("/api/v1/sync/manifest").json()
        switch(ws_b)
        mb = client.get("/api/v1/sync/manifest").json()

        assert set(ma["files"]) == {"vault/ml.md", "vault/shared.md"}
        assert set(mb["files"]) == {"vault/rust.md", "vault/shared.md"}
        # 配对簿属 Layer 3，绝不能进清单
        assert not any("paired_devices" in p for p in ma["files"])

    def test_plan_classifies_upload_download_conflict(self, pair):
        client, ws_a, ws_b = _seed(pair)
        switch(ws_a)
        ma = client.get("/api/v1/sync/manifest").json()

        switch(ws_b)
        plan = client.post("/api/v1/sync/plan", json={"manifest": ma}).json()
        actions = {i["path"]: i["action"] for i in plan["items"]}

        assert actions["vault/ml.md"] == "download"      # A 独有 → B 要拉
        assert actions["vault/rust.md"] == "upload"      # B 独有 → B 要推
        assert actions["vault/shared.md"] == "conflict"  # 双方都改 → 等人裁决
        assert sum(plan["summary"].values()) == len(plan["items"])

    def test_transfer_then_apply_lands_and_reindexes(self, pair):
        """传输 → Apply 落盘 → reindex hook 让新内容可被检索。"""
        client, ws_a, ws_b = _seed(pair)

        switch(ws_a)
        payload = client.get("/api/v1/sync/files/vault/ml.md").content

        switch(ws_b)
        r = client.post("/api/v1/sync/receive", content=payload)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

        # 字节级一致
        assert (ws_b / "vault" / "ml.md").read_text(encoding="utf-8") == \
               (ws_a / "vault" / "ml.md").read_text(encoding="utf-8")

        # 索引一致：同步落地的笔记必须能被检索到（否则 UI 看不到）
        found = client.get("/api/v1/search", params={"q": "机器学习"}).json()
        assert any("ml" in str(x).lower() for x in found["results"]), found

    def test_second_round_converges_and_conflict_persists(self, pair):
        """再同步一轮：已一致的收敛为 skip，冲突仍等人裁决（不自动合并）。"""
        client, ws_a, ws_b = _seed(pair)

        # 第一轮：A → B 传 ml.md
        switch(ws_a)
        payload = client.get("/api/v1/sync/files/vault/ml.md").content
        switch(ws_b)
        client.post("/api/v1/sync/receive", content=payload)

        # 第二轮：A 侧再看 B 的清单
        switch(ws_b)
        mb = client.get("/api/v1/sync/manifest").json()
        switch(ws_a)
        plan = client.post("/api/v1/sync/plan", json={"manifest": mb}).json()
        actions = {i["path"]: i["action"] for i in plan["items"]}

        assert actions["vault/ml.md"] == "skip", "字节一致后应收敛"
        assert actions["vault/rust.md"] == "download"
        assert actions["vault/shared.md"] == "conflict", "冲突不得被自动合并"

    def test_pairing_roundtrip_across_loop(self, pair):
        """配对 → 可读回 → 解配，且不污染同步清单。"""
        client, ws_a, ws_b = _seed(pair)
        switch(ws_a)
        id_a = client.get("/api/v1/sync/manifest").json()["device_id"]

        switch(ws_b)
        r = client.post("/api/v1/sync/pair", json={
            "device_id": id_a, "name": "device-A",
            "host": "127.0.0.1", "port": 8000})
        assert r.status_code == 201

        peers = client.get("/api/v1/sync/peers").json()["peers"]
        assert [p["device_id"] for p in peers] == [id_a]

        # 配对后清单不受影响
        files = client.get("/api/v1/sync/manifest").json()["files"]
        assert not any("paired_devices" in p for p in files)

        assert client.delete(f"/api/v1/sync/peers/{id_a}").status_code == 200
        assert client.get("/api/v1/sync/peers").json()["peers"] == []

    def test_pairing_is_local_not_synced(self, pair):
        """配对关系属 Layer 3：A 的登记簿不会同步到 B。"""
        client, ws_a, ws_b = _seed(pair)
        switch(ws_b)
        client.post("/api/v1/sync/pair", json={
            "device_id": "someone-else", "host": "10.0.0.9"})

        switch(ws_a)
        files = client.get("/api/v1/sync/manifest").json()["files"]
        assert not any("paired_devices" in p for p in files)
        # B 的配对簿不随任何同步动作流向 A
        assert not (ws_a / "metadata" / "paired_devices.json").exists()
