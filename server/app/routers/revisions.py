"""Document Changes / Revision / Diff API（ADR-028）。

与 Git 解耦的文档变更抽象层。当前只实现两个 revision source：

    current   直接读 vault/ 下的 Markdown（唯一事实源，ADR-001）
    snapshot  读 workspace/metadata/revisions/ 下的历史快照

Git adapter 是后续独立任务 —— 本文件不引入任何 Git 概念
（无 branch / commit / merge / rebase / stash / cherry-pick）。

两个 router：
  router        `/api/v1/notes`  —— 版本列表/读取/打点/diff/恢复/清理
  admin_router  `/api/v1/admin`  —— 孤儿快照列举与重建（决策 D 收尾）
新增后**必须**在 `main.py` include_router（两者都要），
否则 `tests/api/test_router_registration.py` 的接线守护会失败。
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core import knowledge as K
from ..core import revisions as R
from ..db import connect
from .notes import _create_note_vault, _detail, _parent_map

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/notes", tags=["notes"])
# 决策 D 收尾：孤儿快照的列举与重建是管理面，挂 /api/v1/admin（与 notes.py 的
# admin_router 同前缀；test_router_registration.py 会扫描本模块全部 APIRouter）
admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message}})


def _note_path(conn, note_id: int) -> str | None:
    """note_id → vault 相对路径；不存在则 None。"""
    row = K.get_note_row(conn, note_id)
    return row["path"] if row else None


# ── 请求体 ────────────────────────────────────────────────────────

class RevisionRef(BaseModel):
    """一个 revision 端点引用。

    `source` 取 `REVISION_SOURCES`；`ref` 对 snapshot 是 rev_id，
    None/"latest" 表示最新一份；current 忽略 ref。
    """
    source: str = "snapshot"
    ref: str | None = None


class DiffBody(BaseModel):
    from_ref: RevisionRef
    to_ref: RevisionRef


class RestoreOrphanBody(BaseModel):
    """孤儿快照重建请求：vault 相对路径（即 metadata/revisions/ 下的目录键）。"""
    path: str


# ── 端点 ──────────────────────────────────────────────────────────

@router.get("/{note_id}/revisions")
def list_revisions(note_id: int, limit: int = 50) -> dict:
    """版本列表：首位是 `current` 虚拟项，其余为快照（时间倒序）。

    `limit` 手工 422 —— 用 Query(ge/le) 会先被 main.py 的全局
    RequestValidationError handler 转成 400，丢失错误码（同 notes.py /tree）。
    """
    if limit < 1 or limit > 200:
        return _err(422, "invalid_limit", "limit must be between 1 and 200")
    conn = connect()
    try:
        rel = _note_path(conn, note_id)
    finally:
        conn.close()
    if rel is None:
        return _err(404, "http_404", "笔记不存在")

    items: list[dict] = []
    cur = R.read_current(rel)
    if cur is not None:
        items.append(cur.summary())
    for s in R.list_snapshots(rel, limit=limit):
        items.append({**s.to_dict(), "source": "snapshot"})
    return {"note_id": note_id, "revisions": items}


@router.post("/{note_id}/revisions")
def create_revision(note_id: int) -> dict:
    """手动打点快照（决策 B 的手动分支）。

    只做内容哈希去重（与最新一份相同则不新建），**不受**写前时间窗去抖约束 ——
    用户显式点了「保存版本」就该落一份。
    """
    conn = connect()
    try:
        rel = _note_path(conn, note_id)
    finally:
        conn.close()
    if rel is None:
        return _err(404, "http_404", "笔记不存在")

    try:
        meta, _, body = K.read_note_meta(rel)
    except (OSError, ValueError):
        return _err(500, "io_error", "读取笔记失败")

    snap = R.create_snapshot(rel, meta, body, origin="manual")
    if snap is None:
        latest = R.latest_snapshot(rel)
        return {
            "note_id": note_id,
            "created": False,
            "reason": "unchanged",
            "revision": ({**latest.to_dict(), "source": "snapshot"}
                         if latest else None),
        }
    return {
        "note_id": note_id,
        "created": True,
        "reason": "created",
        "revision": {**snap.to_dict(), "source": "snapshot"},
    }


@router.get("/{note_id}/revisions/{rev_id}")
def get_revision(note_id: int, rev_id: str) -> dict:
    """读取指定版本内容。`rev_id="current"` 读 vault 当前内容。"""
    conn = connect()
    try:
        rel = _note_path(conn, note_id)
    finally:
        conn.close()
    if rel is None:
        return _err(404, "http_404", "笔记不存在")

    if rev_id == R.CURRENT_REF:
        rev = R.read_current(rel)
    else:
        rev = R.resolve_revision(rel, "snapshot", rev_id)
    if rev is None:
        return _err(404, "revision_not_found", f"版本不存在：{rev_id}")
    return {"note_id": note_id, "revision": rev.detail()}


@router.get("/{note_id}/changes")
def get_changes(note_id: int) -> dict:
    """当前内容 vs 最新快照的变更概览。

    无快照时 `compared_against` 为 null、stats 全零 —— 不伪造「全部新增」
    （那会把「首次打开笔记」误报成「整篇重写」）。
    """
    conn = connect()
    try:
        rel = _note_path(conn, note_id)
    finally:
        conn.close()
    if rel is None:
        return _err(404, "http_404", "笔记不存在")

    base = R.resolve_revision(rel, "snapshot", None)
    cur = R.read_current(rel)
    if cur is None:
        return _err(404, "http_404", "笔记不存在")

    if base is None:
        return {
            "note_id": note_id,
            "has_snapshot": False,
            "compared_against": None,
            "stats": {"added": 0, "removed": 0, "changed": 0},
            "hunks": [],
        }

    d = R.diff_texts(base.content_md, cur.content_md,
                     from_label=base.ref, to_label=R.CURRENT_REF)
    return {
        "note_id": note_id,
        "has_snapshot": True,
        "compared_against": base.summary(),
        "stats": d["stats"],
        "hunks": d["hunks"],
    }


@router.post("/{note_id}/diff")
def diff_revisions(note_id: int, body: DiffBody) -> dict:
    """任意两个 revision 之间的结构化 diff。

    body: `{"from_ref": {"source","ref"}, "to_ref": {"source","ref"}}`
    """
    for label, ref in (("from_ref", body.from_ref), ("to_ref", body.to_ref)):
        if ref.source not in R.REVISION_SOURCES:
            return _err(400, "invalid_source",
                        f"{label}.source must be one of {list(R.REVISION_SOURCES)}, "
                        f"got {ref.source!r}")

    conn = connect()
    try:
        rel = _note_path(conn, note_id)
    finally:
        conn.close()
    if rel is None:
        return _err(404, "http_404", "笔记不存在")

    left = R.resolve_revision(rel, body.from_ref.source, body.from_ref.ref)
    right = R.resolve_revision(rel, body.to_ref.source, body.to_ref.ref)
    if left is None:
        return _err(404, "revision_not_found",
                    f"from_ref 无法解析：{body.from_ref.source}/{body.from_ref.ref}")
    if right is None:
        return _err(404, "revision_not_found",
                    f"to_ref 无法解析：{body.to_ref.source}/{body.to_ref.ref}")

    d = R.diff_texts(left.content_md, right.content_md,
                     from_label=left.ref, to_label=right.ref)
    return {
        "note_id": note_id,
        "from_ref": left.summary(),
        "to_ref": right.summary(),
        "stats": d["stats"],
        "hunks": d["hunks"],
        "unified": d["unified"],
    }


@router.delete("/{note_id}/revisions")
def delete_revisions(note_id: int) -> dict:
    """显式清理该笔记的全部快照。

    注意（决策 D）：`DELETE /notes/{id}` **保留**快照目录以支持误删恢复，
    本端点是唯一的人工清理入口，且只在笔记尚存时可达。
    """
    conn = connect()
    try:
        rel = _note_path(conn, note_id)
    finally:
        conn.close()
    if rel is None:
        return _err(404, "http_404", "笔记不存在")
    return {"note_id": note_id, "deleted": R.purge_revisions(rel)}


# ── 恢复（决策 D 的承诺：保留 = 可恢复）──────────────────────────

def _write_restored_file(rel: str, note_id: int, title: str,
                         note_meta: dict, body: str) -> None:
    """把 (meta, body) 写回 vault 并同步索引/链接/父边。

    调用方须**先**对被覆盖状态打 origin=restore 快照（保证恢复本身可逆），
    再调用本函数。OSError/ValueError 由调用方转 500。
    """
    target = K.resolve_vault_file(rel)
    K.atomic_write_file(target, K.compose_file(note_meta, body))

    tags = [t.strip() for t in str(note_meta.get("tags", "") or "").split(",")
            if t.strip()]
    conn = connect()
    try:
        K.upsert_note_index(conn, note_id=note_id, path=rel, title=title,
                            tags=tags, body=body, mtime=time.time())
        K.rebuild_note_links(conn, note_id, body)
        from ..core.hierarchy import sync_note_parent
        sync_note_parent(conn, note_id)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.post("/{note_id}/revisions/{rev_id}/restore")
def restore_revision(note_id: int, rev_id: str) -> dict:
    """把笔记恢复到指定快照（frontmatter + 正文整体回滚）。

    - 恢复**前**先对当前状态打一份 `origin=restore` 的快照 → 恢复本身可逆；
      该快照失败不阻断恢复（vault 是唯一事实源，恢复写优先）；
    - 内容与 frontmatter 均与目标一致时为 no-op（`restored: false`）；
    - `rev_id="current"` 无意义 → 400 `invalid_target`。
    """
    conn = connect()
    try:
        row = K.get_note_row(conn, note_id)
    finally:
        conn.close()
    if row is None:
        return _err(404, "http_404", "笔记不存在")
    rel = row["path"]
    if rev_id == R.CURRENT_REF:
        return _err(400, "invalid_target", "不能恢复到 current——它就是当前状态")

    got = R.read_snapshot(rel, rev_id)
    if got is None:
        return _err(404, "revision_not_found", f"版本不存在：{rev_id}")
    snap, note_meta, body = got

    try:
        cur_meta, _, cur_body = K.read_note_meta(rel)
    except (OSError, ValueError):
        return _err(500, "io_error", "读取笔记失败")

    restored_from = snap.to_dict() | {"source": "snapshot"}
    if cur_body == body and cur_meta == note_meta:
        return {"note_id": note_id, "restored": False, "reason": "unchanged",
                "restored_from": restored_from}

    # pre-write 留存被覆盖状态（必须携带当前真实 frontmatter，否则留存件会丢 tags/parent）
    try:
        R.create_snapshot(rel, cur_meta, cur_body, origin="restore")
    except Exception:
        logger.exception("恢复前快照失败（不阻断恢复）：%s", rel)

    try:
        _write_restored_file(rel, note_id, row["title"], note_meta, body)
    except (OSError, ValueError):
        return _err(500, "io_error", "恢复写入失败")
    return {"note_id": note_id, "restored": True,
            "restored_from": restored_from}


# ── 孤儿快照（决策 D：删除保留 → 必须可重建）─────────────────────

@admin_router.get("/revisions/orphans")
def list_orphan_revisions() -> dict:
    """快照目录存在、但 notes 行已消失的路径（笔记被删后遗留的可恢复清单）。"""
    return {"orphans": R.list_orphan_paths()}


@admin_router.post("/revisions/restore")
def restore_orphan_revision(body: RestoreOrphanBody) -> dict:
    """从孤儿快照重建已删除的笔记（取该路径**最新**一份快照）。

    用 `_create_note_vault` 走与常规创建完全相同的写路径（校验/防覆盖/索引/链接/
    父边），title 取文件名 stem，path 原样保留（支持 importer 的嵌套路径）。
    """
    rel = body.path
    if R.revision_dir(rel) is None:
        return _err(400, "invalid_path", f"非法快照路径：{rel}")

    conn = connect()
    try:
        exists = conn.execute("SELECT 1 FROM notes WHERE path=?", (rel,)).fetchone()
    finally:
        conn.close()
    if exists:
        return _err(409, "duplicate_title", f"笔记已存在，无需重建：{rel}")

    snaps = R.list_snapshots(rel)
    if not snaps:
        return _err(404, "revision_not_found", f"该路径没有可用快照：{rel}")
    got = R.read_snapshot(rel, snaps[0].rev_id)
    if got is None:  # list 与 read 之间的竞态防御
        return _err(500, "io_error", "快照读取失败")
    _, note_meta, snap_body = got

    try:
        title = K.sanitize_title(Path(rel).stem)
    except ValueError:
        return _err(400, "empty_title", f"无法从路径派生标题：{rel}")

    conn = connect()
    try:
        status, note_id = _create_note_vault(
            conn, title=title, content_md=snap_body,
            meta=note_meta, rel_path=rel)
    finally:
        conn.close()
    if status != "ok":
        return _err({"empty_title": 400, "duplicate_title": 409,
                     "bad_attachment_path": 400, "io_error": 500}[status],
                    status, f"重建失败：{status}")

    conn = connect()
    try:
        row = K.get_note_row(conn, note_id)
        parent_of = _parent_map(conn)
    finally:
        conn.close()
    _, body_text = K.read_note_file(row["path"])
    return {"restored": True, "path": rel,
            "restored_from": snaps[0].to_dict() | {"source": "snapshot"},
            "note": _detail(row, body_text, parent_of)["note"]}
