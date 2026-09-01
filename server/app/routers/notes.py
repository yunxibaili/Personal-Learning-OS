"""notes CRUD API：文件为真相，SQLite 只存索引（ADR-001）。

写路径统一流程：校验 → 改文件 → 事务内更新索引 → commit；任何一步失败回滚并报错。
注意：FastAPI 会把返回注解当作响应模型，端点一律注解为 dict；
需要返回错误 JSONResponse 时直接 return Response 实例即可（自动跳过序列化）。
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core import knowledge as K
from ..core.autolink import suggest_note_links
from ..core.importer import import_markdown
from ..core.reindex import reindex_vault
from ..core.vault_watcher import VaultWatcher, current_watcher, set_watcher
from ..db import connect, workspace_root

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
    # ADR-024：parent 事实源在 frontmatter。None=未传不改；""=真删；"[[X]]"/"X"=设置。
    parent: str | None = None


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


def _create_note_vault(conn, title: str, content_md: str) -> tuple[str, int | None]:
    """写 vault 文件 + 更新 SQLite 索引（单篇）。返回 (status, note_id|None)。

    供单篇 create_note 与批量导入（B15）共用，避免重复。
    status：ok | empty_title | duplicate_title | bad_attachment_path | io_error
    """
    try:
        title = K.sanitize_title(title)
    except ValueError:
        return ("empty_title", None)
    rel_path = f"{title}.md"
    if conn.execute("SELECT 1 FROM notes WHERE path=?", (rel_path,)).fetchone():
        return ("duplicate_title", None)
    target = K.resolve_vault_file(rel_path)
    if target.exists():  # 文件在但索引缺失——视为冲突，提示而非覆盖
        return ("duplicate_title", None)
    if K.has_forbidden_media_path(content_md):
        return ("bad_attachment_path", None)

    cur = conn.execute(
        "INSERT INTO notes (path, title, tags_json, content_hash) "
        "VALUES (?, ?, '[]', '')",
        (rel_path, title),
    )
    note_id = cur.lastrowid
    try:
        K.atomic_write_file(target, K.compose_file({}, content_md))
        mtime = time.time()
        _, _, body_text = K.parse_frontmatter(target.read_text(encoding="utf-8"))
        K.upsert_note_index(conn, note_id=note_id, path=rel_path, title=title,
                            tags=[], body=body_text, mtime=mtime)
        K.promote_stub_to_note(conn, note_id, title)
        K.rebuild_note_links(conn, note_id, body_text)
        conn.commit()
    except OSError:
        conn.rollback()
        return ("io_error", None)
    return ("ok", note_id)


@router.post("", status_code=201)
def create_note(body: NoteCreate) -> dict:
    conn = connect()
    try:
        status, note_id = _create_note_vault(conn, body.title, body.content_md)
        if status == "empty_title":
            return _err(400, "empty_title", "标题不能为空")
        if status == "duplicate_title":
            return _err(409, "duplicate_title", f"已存在同名笔记：{body.title}")
        if status == "bad_attachment_path":
            return _err(400, "bad_attachment_path",
                        "禁止绝对盘符/file:// 附件路径，请先经附件上传获取相对 URL")
        if status == "io_error":
            return _err(500, "io_error", "写入失败")
        row = K.get_note_row(conn, note_id)
    finally:
        conn.close()

    _, body_text = K.read_note_file(row["path"])
    return _detail(row, body_text)


class NoteBatchBody(BaseModel):
    notes: list[NoteCreate]


@router.post("/batch")
def batch_create_notes(body: NoteBatchBody) -> dict:
    """批量导入笔记（B15）：逐篇创建，部分成功不阻断整体。

    每篇状态：ok / empty_title / duplicate_title / bad_attachment_path / io_error
    """
    conn = connect()
    results = []
    created = 0
    try:
        for item in body.notes:
            status, note_id = _create_note_vault(conn, item.title, item.content_md)
            if status == "ok":
                created += 1
            results.append({"title": item.title, "status": status,
                            "note_id": note_id if status == "ok" else None})
    finally:
        conn.close()
    return {"created": created, "results": results}


class ImportBody(BaseModel):
    source: str  # 本地绝对路径（Obsidian/Notion/Markdown 目录或单文件）
    prefix: str = "imported"  # 导入到 vault 下的相对前缀


@router.post("/import")
def import_notes(body: ImportBody) -> dict:
    """外部格式导入（B19）：本地 .md 目录/文件 → vault（保留相对结构）。

    重复篇跳过（不覆盖）；逐篇独立，部分成功不阻断。
    """
    conn = connect()
    try:
        return import_markdown(conn, Path(body.source), body.prefix)
    finally:
        conn.close()


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

        cur_meta, cur_tags, cur_body = K.read_note_meta(old_path)
        new_tags = sorted(set(body.tags)) if body.tags is not None else cur_tags
        new_body = body.content_md if body.content_md is not None else cur_body

        # ADR-024：parent 事实源在 frontmatter；未显式传则不改（None 与「未传」区分）。
        # 红线 4：自指/不存在**不阻断保存**（保留原值，由 resolve_hierarchy 标 invalid）。
        parent_changed = "parent" in body.model_fields_set
        if parent_changed:
            raw_parent = (body.parent or "").strip()
            new_meta = K.set_meta_parent(cur_meta, raw_parent or None)
        else:
            new_meta = cur_meta
        new_meta = K.set_meta_tags(new_meta, new_tags)

        target = K.resolve_vault_file(new_rel)
        changed_file = (
            new_rel != old_path or new_body != cur_body
            or new_tags != cur_tags or new_meta != cur_meta
        )
        mtime = time.time()
        if changed_file:
            if K.has_forbidden_media_path(new_body):
                conn.rollback()
                return _err(400, "bad_attachment_path",
                            "禁止绝对盘符/file:// 附件路径，请先经附件上传获取相对 URL")
            K.atomic_write_file(target, K.compose_file(new_meta, new_body))
            if new_rel != old_path:
                os.unlink(K.resolve_vault_file(old_path))

        K.upsert_note_index(conn, note_id=note_id, path=new_rel, title=new_title,
                            tags=new_tags, body=new_body, mtime=mtime)
        if changed_file:
            K.rebuild_note_links(conn, note_id, new_body)
            # ADR-024 §2.4：parent 边是派生索引，随写同步该笔记的父边（镜像权威 resolver）
            if parent_changed:
                from ..core.hierarchy import sync_note_parent
                sync_note_parent(conn, note_id)
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


# ── B4 自动链接建议（确定性内容重叠）───────────────────────────────

@router.get("/{note_id}/link-suggestions")
def note_link_suggestions(
    note_id: int,
    limit: int = 5,
    min_score: float = 0.0,
) -> dict:
    """为指定笔记建议 related 链接候选（不写库，需用户确认）。"""
    conn = connect()
    try:
        if conn.execute("SELECT 1 FROM notes WHERE id=?", (note_id,)).fetchone() is None:
            return _err(404, "note_not_found", f"note {note_id} not found")
        suggestions = suggest_note_links(
            conn, note_id, limit=limit, min_score=min_score)
    finally:
        conn.close()
    return {"note_id": note_id, "suggestions": suggestions}


# ── Admin: Vault Reindex（P8-003C）────────────────────────────────────

admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class ReindexBody(BaseModel):
    changed_paths: list[str] | None = None  # B17：增量路径；None=全量
    prune: bool | None = None


@admin_router.post("/reindex")
def admin_reindex(body: ReindexBody | None = None, prune: bool = False) -> dict:
    """扫描 vault/ → 同步 SQLite notes + FTS5 + links。

    两种用法：
      - 全量：POST /admin/reindex（body 或 `?prune=true`）
      - 增量（B17）：POST /admin/reindex body={"changed_paths": ["a.md", "b.md"]}
        文件存在则 upsert，不存在则删除该 note（含级联）。
    """
    conn = connect()
    try:
        vault = workspace_root() / "vault"
        changed = body.changed_paths if body is not None else None
        prune_flag = prune
        if body is not None and body.prune is not None:
            prune_flag = body.prune
        stats = reindex_vault(conn, vault, changed_paths=changed,
                              prune_missing=prune_flag)
        conn.commit()
    finally:
        conn.close()
    return {"stats": stats}


# ── Admin: Vault Watcher（B16）────────────────────────────────────────

@admin_router.post("/watcher/start")
def watcher_start() -> dict:
    """启动 vault 自动监听（stdlib 轮询，变化即增量 reindex）。"""
    vault = workspace_root() / "vault"
    w = current_watcher()
    if w is None or str(w.vault) != str(vault.resolve()):
        if w is not None and w.running:
            w.stop()
        w = VaultWatcher(vault)
        set_watcher(w)
    w.start()
    return {"running": w.running, "interval": w.interval}


@admin_router.post("/watcher/stop")
def watcher_stop() -> dict:
    w = current_watcher()
    if w is not None:
        w.stop()
    return {"running": False}


@admin_router.get("/watcher/status")
def watcher_status() -> dict:
    w = current_watcher()
    return {"running": w.running if w else False,
            "interval": w.interval if w else None,
            "last_poll_count": w.last_poll_count if w else 0}
