"""pytest fixtures：隔离的临时 workspace + TestClient。"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def tmp_workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """每个用例独立 workspace，绝不触碰真实用户数据目录。"""
    ws = tmp_path / "workspace"
    monkeypatch.setenv("WORKSPACE_DIR", str(ws))
    return ws


@pytest.fixture()
def client(tmp_workspace: Path) -> TestClient:
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def core_conn(tmp_workspace: Path):
    """core 层直连用：隔离 workspace + 已跑 migration 的连接（用完即关）。"""
    import sqlite3

    from app.db import connect, init_db

    init_db()
    conn = connect()
    yield conn
    conn.close()
