"""Vault Reindex（P8-003C）：Markdown → SQLite 索引恢复机制。

职责：扫描 vault/ 目录，将 Markdown 文件同步到 notes + FTS5 + links + concepts。
属于 Workspace synchronization，不负责单文件 Entity mutation（由 knowledge.py 处理）。

接口设计：
  reindex_vault(conn, vault_root, changed_paths=None, prune_missing=False)
    - changed_paths=None  → 全量扫描（MVP 默认）
    - changed_paths=[...] → 增量扫描（预留接口，当前退化为全量）
    - prune_missing=False → 只新增/更新，不删除（安全默认）
    - prune_missing=True  → 删除 vault 中不存在的 notes（Admin 模式）

调用链：
  reindex.py → knowledge.upsert_note_index()
             → knowledge.rebuild_note_links()
             → knowledge.drop_note_index()（仅 prune 模式）
             → knowledge.cascade_drop_entity()（仅 prune 模式）
"""
from __future__ import annotations

import logging
from pathlib import Path

from . import knowledge as K

logger = logging.getLogger(__name__)


def reindex_vault(
    conn,
    vault_root: Path,
    *,
    changed_paths: list[str] | None = None,
    prune_missing: bool = False,
) -> dict:
    """扫描 vault/ → 同步 SQLite notes + FTS5 + links + concepts。

    参数：
      conn:         SQLite 连接（调用方负责 commit/rollback）
      vault_root:   vault 目录绝对路径
      changed_paths: 增量路径列表（MVP 忽略，退化为全量）
      prune_missing: 是否删除 vault 中不存在的 notes

    返回统计字典：
      {notes_scanned, notes_upserted, notes_dropped, links_rebuilt, stubs_created}
    """
    stats = {
        "notes_scanned": 0,
        "notes_upserted": 0,
        "notes_dropped": 0,
        "links_rebuilt": 0,
        "stubs_created": 0,
    }

    if not vault_root.exists():
        logger.warning("vault_root does not exist: %s", vault_root)
        return stats

    # 1. 扫描 vault/*.md，建立 path → file 映射
    existing_paths: set[str] = set()
    for md_file in vault_root.rglob("*.md"):
        rel = md_file.relative_to(vault_root).as_posix()
        existing_paths.add(rel)
        stats["notes_scanned"] += 1

        try:
            _upsert_single_note(conn, md_file, rel, vault_root, stats)
        except Exception:
            logger.exception("reindex failed for %s", rel)

    # 2. 删除检测（仅 prune 模式）
    if prune_missing:
        for row in conn.execute("SELECT id, path FROM notes").fetchall():
            if row["path"] not in existing_paths:
                K.drop_note_index(conn, row["id"])
                K.cascade_drop_entity(conn, "note", row["id"])
                stats["notes_dropped"] += 1
                logger.info("pruned orphan note: %s", row["path"])

    return stats


def _upsert_single_note(
    conn,
    md_file: Path,
    rel_path: str,
    vault_root: Path,
    stats: dict,
) -> None:
    """处理单个 Markdown 文件的索引更新。"""
    text = md_file.read_text(encoding="utf-8")
    _, tags, body = K.parse_frontmatter(text)
    title = md_file.stem
    mtime = md_file.stat().st_mtime

    # 查找或创建 note_id
    row = conn.execute("SELECT id FROM notes WHERE path=?", (rel_path,)).fetchone()
    if row:
        note_id = row["id"]
    else:
        cur = conn.execute(
            "INSERT INTO notes (path, title, tags_json, content_hash) "
            "VALUES (?, ?, '[]', '')",
            (rel_path, title),
        )
        note_id = cur.lastrowid

    # upsert note + FTS
    K.upsert_note_index(
        conn, note_id=note_id, path=rel_path, title=title,
        tags=tags, body=body, mtime=mtime,
    )
    stats["notes_upserted"] += 1

    # rebuild links
    link_stats = K.rebuild_note_links(conn, note_id, body)
    stats["links_rebuilt"] += link_stats["extracted"]
    stats["stubs_created"] += link_stats["created_stubs"]


__all__ = ["reindex_vault"]
