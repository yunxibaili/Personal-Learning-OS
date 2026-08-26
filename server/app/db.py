"""Data Layer：SQLite 连接、workspace 目录、migration runner。

规则（docs/architecture/separation.md）：
- 只有本模块及其调用方（core 内数据访问函数）允许触碰 SQLite；
- 数据库是可重建缓存，workspace 文件才是事实源（ADR-001/005）。
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]      # .../learning-os
SERVER_DIR = APP_ROOT / "server"
MIGRATIONS_DIR = SERVER_DIR / "migrations"


def workspace_root() -> Path:
    """workspace 根目录：环境变量 WORKSPACE_DIR 优先，默认 <repo>/workspace。"""
    env = os.environ.get("WORKSPACE_DIR")
    return Path(env).resolve() if env else APP_ROOT / "workspace"


def db_path() -> Path:
    return workspace_root() / "db" / "learning-os.db"


WORKSPACE_SUBDIRS = (
    "db",
    "vault",
    "attachments",
    "metadata",
    "metadata/eventlogs",
)


def ensure_workspace() -> Path:
    root = workspace_root()
    for sub in WORKSPACE_SUBDIRS:
        (root / sub).mkdir(parents=True, exist_ok=True)
    return root


def connect() -> sqlite3.Connection:
    """每次调用返回独立连接；外键约束开启；行转 dict 友好。"""
    ensure_workspace()
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _applied_versions(conn: sqlite3.Connection) -> set[str]:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " version TEXT PRIMARY KEY,"
        " applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
    )
    rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
    return {r["version"] for r in rows}


def migrate(conn: sqlite3.Connection | None = None) -> list[str]:
    """按文件名序执行未应用的 migrations/*.sql，幂等可重复执行。

    返回本次新应用的版本号列表。FTS5 初始化包含在 001_init.sql 中。
    """
    own = conn is None
    conn = conn or connect()
    applied = _applied_versions(conn)
    newly: list[str] = []
    try:
        for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            version = sql_file.stem  # e.g. "001_init"
            if version in applied:
                continue
            conn.executescript(sql_file.read_text(encoding="utf-8"))
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?)", (version,)
            )
            newly.append(version)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if own:
            conn.close()
    return newly


def init_db() -> list[str]:
    """初始化入口：建目录 + 跑 migration。"""
    ensure_workspace()
    return migrate()
