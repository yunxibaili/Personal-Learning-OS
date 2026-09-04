"""Document Changes / Revision / Diff API（ADR-028）。

与 Git 解耦的文档变更抽象层。当前只实现两个 revision source：

    current   直接读 vault/ 下的 Markdown（唯一事实源，ADR-001）
    snapshot  读 workspace/metadata/revisions/ 下的历史快照

Git adapter 是后续独立任务 —— 本文件不引入任何 Git 概念
（无 branch / commit / merge / rebase / stash / cherry-pick）。

端点全部挂在 `/api/v1/notes` 下，与 `routers/notes.py` 同前缀（FastAPI 允许
多个 router 共用前缀）。新增本文件后**必须**在 `main.py` include_router，
否则 `tests/api/test_router_registration.py` 的接线守护会失败。
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core import knowledge as K
from ..core import revisions as R
from ..db import connect

router = APIRouter(prefix="/api/v1/notes", tags=["notes"])


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
