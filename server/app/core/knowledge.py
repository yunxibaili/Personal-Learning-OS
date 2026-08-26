"""知识库核心：标题安全化、frontmatter、哈希、索引管线、FTS 检索。

纯逻辑层：不 import FastAPI，可被 pytest 直接测试（separation.md §一）。
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

from ..db import connect, workspace_root

_ILLEGAL = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_FRONT_RE = re.compile(r"^---\n(.*?)\n---\n?", re.S)
_ATTACH_NAME_RE = re.compile(r"^[0-9a-f]{12}\.[a-z0-9]+$")


# ---------- 标题与路径 ----------

def sanitize_title(raw: str) -> str:
    """清洗用户输入的笔记标题：去非法字符、压缩空白；空则抛 ValueError。"""
    t = _ILLEGAL.sub("", (raw or "").strip())
    t = re.sub(r"\s+", " ", t).strip().strip(".")
    if not t:
        raise ValueError("empty title")
    return t


def vault_root() -> Path:
    root = workspace_root() / "vault"
    root.mkdir(parents=True, exist_ok=True)
    return root


def attachments_dir() -> Path:
    d = workspace_root() / "attachments"
    d.mkdir(parents=True, exist_ok=True)
    return d


def resolve_vault_file(rel_path: str) -> Path:
    """把 notes.path 解析为 vault 内绝对路径；越界即拒绝。"""
    p = (vault_root() / rel_path).resolve()
    if not str(p).startswith(str(vault_root().resolve()) + os.sep):
        raise ValueError(f"path escapes vault: {rel_path}")
    return p


def is_safe_attachment_name(name: str) -> bool:
    return bool(_ATTACH_NAME_RE.match(name))


# ---------- Frontmatter / 哈希 ----------

def parse_frontmatter(text: str) -> tuple[dict[str, str], list[str], str]:
    """返回 (meta, tags, body)。仅支持顶层 key: value 与逗号分隔 tags。"""
    meta: dict[str, str] = {}
    body = text
    m = _FRONT_RE.match(text)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = text[m.end():]
    tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
    return meta, tags, body.lstrip("\n")


def compose_file(tags: list[str], body: str) -> str:
    """组合完整 .md 文件内容；无 tags 时不写 frontmatter。"""
    if not tags:
        return body
    return "---\ntags: " + ", ".join(tags) + "\n---\n\n" + body


def body_hash(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


# ---------- 索引管线 ----------

def upsert_note_index(
    conn,
    *,
    note_id: int,
    path: str,
    title: str,
    tags: list[str],
    body: str,
    mtime: float,
) -> None:
    """notes 表 upsert + FTS 全量重建（该行）。调用方负责 commit/rollback。"""
    conn.execute(
        """
        INSERT INTO notes (id, path, title, tags_json, content_hash, mtime,
                           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          path = excluded.path,
          title = excluded.title,
          tags_json = excluded.tags_json,
          content_hash = excluded.content_hash,
          mtime = excluded.mtime,
          updated_at = datetime('now')
        """,
        (note_id, path, title, json.dumps(tags, ensure_ascii=False),
         body_hash(body), mtime),
    )
    conn.execute("DELETE FROM notes_fts WHERE note_id = ?", (note_id,))
    conn.execute(
        "INSERT INTO notes_fts (title, body, note_id) VALUES (?, ?, ?)",
        (title, body, note_id),
    )


def drop_note_index(conn, note_id: int) -> None:
    conn.execute("DELETE FROM notes_fts WHERE note_id = ?", (note_id,))
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))


def search_notes(conn, q: str, limit: int = 50) -> list[dict]:
    safe = '"' + q.replace('"', '""') + '"'
    rows = conn.execute(
        """
        SELECT n.id AS note_id, n.title AS title
        FROM notes_fts f JOIN notes n ON n.id = f.note_id
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT ?
        """,
        (safe, limit),
    ).fetchall()
    return [{"note_id": r["note_id"], "title": r["title"]} for r in rows]


# ---------- 便捷读取 ----------

def read_note_file(rel_path: str) -> tuple[list[str], str]:
    """读文件并解析回 (tags, body)。文件缺失时抛 FileNotFoundError。"""
    _, tags, body = parse_frontmatter(
        resolve_vault_file(rel_path).read_text(encoding="utf-8")
    )
    return tags, body


def get_note_row(conn, note_id: int):
    return conn.execute(
        "SELECT * FROM notes WHERE id = ?", (note_id,)
    ).fetchone()


__all__ = [
    "sanitize_title", "vault_root", "attachments_dir", "resolve_vault_file",
    "is_safe_attachment_name", "parse_frontmatter", "compose_file",
    "body_hash", "upsert_note_index", "drop_note_index", "search_notes",
    "read_note_file", "get_note_row", "connect",
]
