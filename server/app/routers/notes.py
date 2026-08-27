"""notes CRUD API：文件为真相，SQLite 只存索引（ADR-001）。

写路径统一流程：校验 → 改文件 → 事务内更新索引 → commit；任何一步失败回滚并报错。
注意：FastAPI 会把返回注解当作响应模型，端点一律注解为 dict；
需要返回错误 JSONResponse 时直接 return Response 实例即可（自动跳过序列化）。
"""
from __future__ import annotations

import json
import os
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core import knowledge as K
from ..db import connect

router = APIRouter(prefix="/api/v1/notes", tags=["notes"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


def _summary(row) -> dict:
    return {
        "id": row["id"],
        "path": row["path"],
        "title": row["title"],
        "tags": json.loads(row["tags_json"]),
        "updated_at": row["updated_at"],
    }


def _detail(row, body: str) -> dict:
    d = _summary(row)
    d["content_md"] = body
    return {"note": d}


class NoteCreate(BaseModel):
    title: str
    content_md: str = ""


class NotePatch(BaseModel):
    title: str | None = None
    content_md: str | None = None
    tags: list[str] | None = None


@router.get("")
def list_notes() -> dict:
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT * FROM notes ORDER BY updated_at DESC, id DESC"
        ).fetchall()
        return {"notes": [_summary(r) for r in rows]}
    finally:
        conn.close()


@router.post("", status_code=201)
def create_note(body: NoteCreate) -> dict:
    try:
        title = K.sanitize_title(body.title)
    except ValueError:
        return _err(400, "empty_title", "标题不能为空")
    rel_path = f"{title}.md"

    conn = connect()
    try:
        if conn.execute("SELECT 1 FROM notes WHERE path=?", (rel_path,)).fetchone():
            return _err(409, "duplicate_title", f"已存在同名笔记：{title}")
        target = K.resolve_vault_file(rel_path)
        if target.exists():  # 文件在但索引缺失——视为冲突，提示而非覆盖
            return _err(409, "duplicate_title", f"vault 中已存在 {rel_path}")
        if K.has_forbidden_media_path(body.content_md):
            return _err(400, "bad_attachment_path",
                        "禁止绝对盘符/file:// 附件路径，请先经附件上传获取相对 URL")

        cur = conn.execute(
            "INSERT INTO notes (path, title, tags_json, content_hash) "
            "VALUES (?, ?, '[]', '')",
            (rel_path, title),
        )
        note_id = cur.lastrowid
        K.atomic_write_file(target, K.compose_file([], body.content_md))
        mtime = time.time()
        _, _, body_text = K.parse_frontmatter(target.read_text(encoding="utf-8"))
        K.upsert_note_index(conn, note_id=note_id, path=rel_path, title=title,
                            tags=[], body=body_text, mtime=mtime)
        K.promote_stub_to_note(conn, note_id, title)
        link_stats = K.rebuild_note_links(conn, note_id, body_text)
        conn.commit()
    except OSError as exc:
        conn.rollback()
        return _err(500, "io_error", f"写入失败: {exc}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    row = K.get_note_row(connect(), note_id)
    _, body_text = K.read_note_file(rel_path)
    return _detail(row, body_text)


@router.get("/{note_id}")
def get_note(note_id: int) -> dict:
    conn = connect()
    try:
        row = K.get_note_row(conn, note_id)
        if row is None:
            return _err(404, "http_404", "笔记不存在")
    finally:
        conn.close()
    tags, body = K.read_note_file(row["path"])
    return _detail(row, body)


@router.patch("/{note_id}")
def patch_note(note_id: int, body: NotePatch) -> dict:
    conn = connect()
    try:
        row = K.get_note_row(conn, note_id)
        if row is None:
            return _err(404, "http_404", "笔记不存在")

        old_path = row["path"]
        new_title = row["title"]
        new_rel = old_path
        if body.title is not None:
            try:
                new_title = K.sanitize_title(body.title)
            except ValueError:
                return _err(400, "empty_title", "标题不能为空")
            new_rel = f"{new_title}.md"
            if new_rel != old_path and conn.execute(
                "SELECT 1 FROM notes WHERE path=? AND id<>?",
                (new_rel, note_id),
            ).fetchone():
                return _err(409, "duplicate_title", f"已存在同名笔记:{new_title}")

        cur_tags, cur_body = K.read_note_file(old_path)
        new_tags = sorted(set(body.tags)) if body.tags is not None else cur_tags
        new_body = body.content_md if body.content_md is not None else cur_body

        target = K.resolve_vault_file(new_rel)
        changed_file = (
            new_rel != old_path or new_body != cur_body or new_tags != cur_tags
        )
        mtime = time.time()
        if changed_file:
            if K.has_forbidden_media_path(new_body):
                conn.rollback()
                return _err(400, "bad_attachment_path",
                            "禁止绝对盘符/file:// 附件路径，请先经附件上传获取相对 URL")
            K.atomic_write_file(target, K.compose_file(new_tags, new_body))
            if new_rel != old_path:
                os.unlink(K.resolve_vault_file(old_path))

        K.upsert_note_index(conn, note_id=note_id, path=new_rel, title=new_title,
                            tags=new_tags, body=new_body, mtime=mtime)
        if changed_file:
            K.rebuild_note_links(conn, note_id, new_body)
        conn.commit()
    except OSError as exc:
        conn.rollback()
        return _err(500, "io_error", f"写入失败: {exc}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    conn = connect()
    try:
        row = K.get_note_row(conn, note_id)
    finally:
        conn.close()
    tags, body_text = K.read_note_file(row["path"])
    return _detail(row, body_text)


@router.delete("/{note_id}")
def delete_note(note_id: int) -> dict:
    conn = connect()
    try:
        row = K.get_note_row(conn, note_id)
        if row is None:
            return _err(404, "http_404", "笔记不存在")
        p = K.resolve_vault_file(row["path"])
        if p.exists():
            p.unlink()
        K.drop_note_index(conn, note_id)
        K.cascade_drop_entity(conn, "note", note_id)
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
