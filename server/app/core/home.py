"""Home 聚合读模型（P8-003 D1）：一次请求组装首页所需数据。

纯逻辑层：不 import FastAPI。只读现有表，零新表零 migration。
聚合范围（TECH_DESIGN §10 backlog「GET /api/v1/home」行，v1 最小集）：
  recent_notes   最近更新的笔记（首页快捷入口）
  weak_concepts  effective 最低的概念（薄弱环节，复用 get_weak_concepts）
  review_due     今日到期待复习条数（due_at <= now 且 pending）
"""
from __future__ import annotations

from .mastery import get_weak_concepts
from .timeutil import now_iso

DEFAULT_RECENT_NOTES = 5
DEFAULT_WEAK_CONCEPTS = 5


def home_summary(conn, *, recent_limit: int = DEFAULT_RECENT_NOTES,
                 weak_limit: int = DEFAULT_WEAK_CONCEPTS) -> dict:
    """首页聚合：recent_notes + weak_concepts + review_due 计数。"""
    note_rows = conn.execute(
        "SELECT id, title, updated_at FROM notes "
        "ORDER BY updated_at DESC, id DESC LIMIT ?",
        (recent_limit,),
    ).fetchall()
    weak_rows = get_weak_concepts(conn, limit=weak_limit)
    review_row = conn.execute(
        "SELECT COUNT(*) AS n FROM review_queue "
        "WHERE due_at <= ? AND status = 'pending'",
        (now_iso(),),
    ).fetchone()
    return {
        "recent_notes": [dict(r) for r in note_rows],
        "weak_concepts": [
            {"concept_id": r["concept_id"], "title": r["title"],
             "effective": r["effective"]}
            for r in weak_rows
        ],
        "review_due": review_row["n"] if review_row else 0,
    }


__all__ = ["home_summary", "DEFAULT_RECENT_NOTES", "DEFAULT_WEAK_CONCEPTS"]
