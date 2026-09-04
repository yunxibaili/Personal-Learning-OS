"""Data Layer：SQLite 连接、workspace 目录、migration runner。

规则（docs/adr/separation.md）：
- 只有本模块及其调用方（core 内数据访问函数）允许触碰 SQLite；
- 数据库是可重建缓存，workspace 文件才是事实源（ADR-001/005）。
"""
from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    # PyInstaller 打包态（P0-2b 桌面 sidecar）：模块在 _MEIPASS/app 下解包，
    # migrations 作为 datas 打在 _MEIPASS/server/migrations（见 plos_backend.spec）。
    # 路径真实原因：打包态资源目录，方案 i（所有者已授权）明确包含。
    APP_ROOT = Path(getattr(sys, "_MEIPASS"))
    SERVER_DIR = APP_ROOT / "server"
    MIGRATIONS_DIR = SERVER_DIR / "migrations"
else:
    APP_ROOT = Path(__file__).resolve().parents[2]      # .../learning-os
    SERVER_DIR = APP_ROOT / "server"
    MIGRATIONS_DIR = SERVER_DIR / "migrations"

# 应用后需要全量重建 FTS 的 migration 版本（main.lifespan 消费）：
# notes_fts 是纯派生索引，DROP+CREATE 后必须从 vault reindex 才可检索。
FTS_REBUILD_VERSIONS = {"010_fts_bigram"}


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
    # 文档快照（ADR-028）：进导出包、不进同步白名单的本地历史
    "metadata/revisions",
    # MindMap sidecar（P1-MINDMAP-TRUTH）：*.mindmap.json 是结构事实源（ADR-002），
    # SQLite 三表是可重建缓存；目录入 Sync 白名单（M7 mind_maps/**/*.mindmap.json）
    "mind_maps",
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


# ── Settings 数据访问（路由层禁止直连 SQLite）──────────────────

def get_all_settings() -> dict[str, str]:
    """读取全部 settings KV。"""
    conn = connect()
    try:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}
    finally:
        conn.close()


def put_settings(settings: dict[str, str]) -> None:
    """批量写入 settings KV（upsert）。"""
    conn = connect()
    try:
        conn.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            list(settings.items()),
        )
        conn.commit()
    except sqlite3.Error:
        conn.rollback()
        raise
    finally:
        conn.close()
