"""Mistakes 核心（B12）：错题本查询 / 更新 / 删除 / 统计。

mistakes 表生产者 = mastery.update_mastery（event_type == 'answer_wrong'，P8-003E）。
本模块补齐消费面：查询（可过滤）、详情、标记已解决、删除、统计，
收口「答错 → 落 mistakes → 错题本可见/可改/可统计」的闭环。

纯逻辑层：不 import FastAPI，仅 sqlite3 直写。ref: docs/DATA_MODEL.md §mistakes。
"""
from __future__ import annotations


class MistakeNotFoundError(Exception):
    """mistake_id 不存在。"""
    def __init__(self, mistake_id: int) -> None:
        self.mistake_id = mistake_id
        super().__init__(f"mistake {mistake_id} not found")


class MistakeValidationError(ValueError):
    """入参非法（resolved 等）。"""


def _row_to_dict(row) -> dict:
    d = dict(row)
    d["resolved"] = bool(d.get("resolved"))
    return d


def list_mistakes(
    conn,
    *,
    resolved: bool | None = None,
    concept_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "occurred_at",
) -> list[dict]:
    """错题列表，可按 resolved / concept_id 过滤，分页。

    sort: 'occurred_at'（新→旧）默认，或 'concept'（按概念标题）。
    """
    where: list[str] = []
    params: list = []
    if resolved is not None:
        where.append("m.resolved=?")
        params.append(1 if resolved else 0)
    if concept_id is not None:
        where.append("m.concept_id=?")
        params.append(concept_id)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    order = {
        "occurred_at": "m.occurred_at DESC, m.id DESC",
        "concept": "c.title ASC, m.occurred_at DESC",
    }.get(sort, "m.occurred_at DESC, m.id DESC")

    rows = conn.execute(
        "SELECT m.*, c.title AS concept_title, c.status AS concept_status "
        "FROM mistakes m JOIN concepts c ON c.id = m.concept_id "
        f"{where_sql} ORDER BY {order} LIMIT ? OFFSET ?",
        (*params, limit, offset),
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_mistake(conn, mistake_id: int) -> dict:
    """错题详情（含概念标题）。不存在抛 MistakeNotFoundError。"""
    row = conn.execute(
        "SELECT m.*, c.title AS concept_title, c.status AS concept_status "
        "FROM mistakes m JOIN concepts c ON c.id = m.concept_id "
        "WHERE m.id=?",
        (mistake_id,),
    ).fetchone()
    if row is None:
        raise MistakeNotFoundError(mistake_id)
    return _row_to_dict(row)


def set_mistake_resolved(conn, mistake_id: int, resolved: bool) -> dict:
    """标记错题已解决 / 未解决。不存在抛 MistakeNotFoundError。"""
    if conn.execute("SELECT 1 FROM mistakes WHERE id=?", (mistake_id,)).fetchone() is None:
        raise MistakeNotFoundError(mistake_id)
    conn.execute("UPDATE mistakes SET resolved=? WHERE id=?", (1 if resolved else 0, mistake_id))
    conn.commit()
    return get_mistake(conn, mistake_id)


def delete_mistake(conn, mistake_id: int) -> None:
    """删除一条错题。不存在抛 MistakeNotFoundError。"""
    if conn.execute("SELECT 1 FROM mistakes WHERE id=?", (mistake_id,)).fetchone() is None:
        raise MistakeNotFoundError(mistake_id)
    conn.execute("DELETE FROM mistakes WHERE id=?", (mistake_id,))
    conn.commit()


def mistake_stats(conn) -> dict:
    """错题统计：总数 / 未解决 / 已解决 / 按概念归因 top-N。"""
    total = conn.execute("SELECT COUNT(*) FROM mistakes").fetchone()[0]
    unresolved = conn.execute(
        "SELECT COUNT(*) FROM mistakes WHERE resolved=0").fetchone()[0]
    by_concept = conn.execute(
        "SELECT m.concept_id, c.title, COUNT(*) AS count, "
        "  SUM(CASE WHEN m.resolved=0 THEN 1 ELSE 0 END) AS unresolved "
        "FROM mistakes m JOIN concepts c ON c.id = m.concept_id "
        "GROUP BY m.concept_id ORDER BY count DESC, m.concept_id ASC LIMIT 10"
    ).fetchall()
    return {
        "total": total,
        "unresolved": unresolved,
        "resolved": total - unresolved,
        "by_concept": [
            {"concept_id": r["concept_id"], "title": r["title"],
             "count": r["count"], "unresolved": r["unresolved"]}
            for r in by_concept
        ],
    }


__all__ = [
    "MistakeNotFoundError",
    "MistakeValidationError",
    "list_mistakes",
    "get_mistake",
    "set_mistake_resolved",
    "delete_mistake",
    "mistake_stats",
]
