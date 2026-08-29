"""Concepts Core Service (P8-001A) - Concept CRUD 核心逻辑。

职责：
- Concept 创建/读取/更新（不含 DELETE）
- 创建 concept 时：不产生 learning_event / mastery / review_queue / links
- origin 定义概念身份来源：manual / markdown / ai_suggested（唯一来源字段）

边界（ADR-019/022）：
- Concept ≠ Note
- Concept 不自动创建学习状态
- 学习状态由显式 /api/v1/events 触发
- origin 为唯一事实来源字段；不再使用派生/source_type 列
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from ..db import connect


VALID_ORIGINS = {"manual", "markdown", "ai_suggested"}  # ADR-008/009 冻结枚举（用户裁决 2026-08-27）
VALID_STATUS = {"unconfirmed", "confirmed", "active", "archived", "ignored"}  # B7.2: +ignored 软删（M7-007 裁决 1 解除）


@dataclass
class Concept:
    id: int
    title: str
    aliases: list[str]
    summary: str
    domain: str
    origin: str
    created_at: str
    updated_at: str
    status: str

    @classmethod
    def from_row(cls, row) -> Concept:
        return cls(
            id=row["id"],
            title=row["title"],
            aliases=json.loads(row["aliases_json"] or "[]"),
            summary=row["summary"] or "",
            domain=row["domain"] or "",
            origin=row["origin"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            status=row["status"],
        )

    def to_dict(self, include_mastery: bool = False) -> dict[str, Any]:
        d = {
            "id": self.id,
            "title": self.title,
            "aliases": self.aliases,
            "summary": self.summary,
            "domain": self.domain or None,
            "origin": self.origin,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "status": self.status,
        }
        if include_mastery:
            d["mastery"] = None  # 填充由 router 调用 _get_mastery
        return d


def create_concept(
    conn,
    *,
    title: str,
    domain: str = "",
    origin: str = "manual",
    aliases: list[str] | None = None,
    summary: str = "",
) -> Concept:
    """创建纯 concept（不产生 learning_event/mastery/review/links）。

    Args:
        conn: 数据库连接
        title: 概念标题（必填）
        domain: 领域分类（可选）
        origin: 来源类型，必须为 manual/markdown/ai_suggested
        aliases: 别名列表
        summary: 概念摘要

    Returns:
        Concept 对象

    Raises:
        ValueError: title 为空、origin 非法、或同名 concept 已存在
    """
    if not title or not title.strip():
        raise ValueError("title required")
    title = title.strip()
    if origin not in VALID_ORIGINS:
        raise ValueError(f"invalid origin: {origin}")

    # 检查同名 concept 是否已存在
    existing = conn.execute(
        "SELECT id FROM concepts WHERE title = ?", (title,)
    ).fetchone()
    if existing:
        raise ValueError(f"concept already exists: {title}")

    aliases_json = json.dumps(aliases or [], ensure_ascii=False)
    cur = conn.execute(
        """
        INSERT INTO concepts (title, aliases_json, summary, domain, origin, status)
        VALUES (?, ?, ?, ?, ?, 'active')
        """,
        (title, aliases_json, summary, domain, origin),
    )
    concept_id = cur.lastrowid

    row = conn.execute("SELECT * FROM concepts WHERE id = ?", (concept_id,)).fetchone()
    return Concept.from_row(row)


def get_concept(conn, concept_id: int) -> Concept | None:
    """按 ID 获取 concept。"""
    row = conn.execute("SELECT * FROM concepts WHERE id = ?", (concept_id,)).fetchone()
    return Concept.from_row(row) if row else None


def get_concept_by_title(conn, title: str) -> Concept | None:
    """按标题获取 concept。"""
    row = conn.execute("SELECT * FROM concepts WHERE title = ?", (title,)).fetchone()
    return Concept.from_row(row) if row else None


def list_concepts(
    conn,
    *,
    domain: str | None = None,
    origin: str | None = None,
    status: str = "active",
    limit: int = 100,
    offset: int = 0,
) -> list[Concept]:
    """列出 concepts，支持过滤。"""
    sql = "SELECT * FROM concepts WHERE 1=1"
    params: list = []

    if status:
        sql += " AND status = ?"
        params.append(status)
    if domain:
        sql += " AND domain = ?"
        params.append(domain)
    if origin:
        sql += " AND origin = ?"
        params.append(origin)

    sql += " ORDER BY id LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(sql, params).fetchall()
    return [Concept.from_row(r) for r in rows]


def update_concept(
    conn,
    concept_id: int,
    *,
    domain: str | None = None,
    summary: str | None = None,
    aliases: list[str] | None = None,
    status: str | None = None,
) -> Concept | None:
    """更新 concept metadata（不允许修改 mastery/review/events/links）。

    允许字段：domain, summary, aliases, status
    """
    concept = get_concept(conn, concept_id)
    if not concept:
        return None

    updates = []
    params = []

    if domain is not None:
        updates.append("domain = ?")
        params.append(domain)
    if summary is not None:
        updates.append("summary = ?")
        params.append(summary)
    if aliases is not None:
        updates.append("aliases_json = ?")
        params.append(json.dumps(aliases, ensure_ascii=False))
    if status is not None:
        if status not in VALID_STATUS:
            raise ValueError(f"invalid status: {status}")
        # B7.3-R：方向感知守卫——进入 ignored 需 unconfirmed+ai_suggested，离开免守卫
        if status == "ignored" and concept.status != "ignored":
            if concept.status != "unconfirmed" or concept.origin != "ai_suggested":
                raise ValueError(
                    "只有 ai_suggested/unconfirmed 的建议桩可忽略；"
                    "已确认概念请走 archived 流程")
        updates.append("status = ?")
        params.append(status)

    if not updates:
        return concept

    updates.append("updated_at = datetime('now')")
    params.append(concept_id)

    conn.execute(f"UPDATE concepts SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()

    return get_concept(conn, concept_id)


def get_concept_domains(conn) -> list[str]:
    """获取所有已使用的 domain 列表。"""
    rows = conn.execute(
        "SELECT DISTINCT domain FROM concepts WHERE domain != '' ORDER BY domain"
    ).fetchall()
    return [r["domain"] for r in rows]


# ── B3：AI Suggestion 生命周期 ──────────────────────────────────────

def accept_concept(conn, concept_id: int) -> Concept | None:
    """Accept AI suggestion：status=unconfirmed → active。

    只允许接受 unconfirmed 状态的 concept（origin=ai_suggested）。
    其他状态返回 None（静默失败）。
    """
    concept = get_concept(conn, concept_id)
    if concept is None or concept.status != "unconfirmed":
        return None

    return update_concept(conn, concept_id, status="active")


def ignore_concept(conn, concept_id: int) -> bool:
    """Ignore AI suggestion：status=unconfirmed → ignored（B7.2 软删）。

    只允许忽略 ai_suggested + unconfirmed 的 concept（origin 校验由调用方负责，
    但 core 层做防御深度对齐）。不物理删除，保留桩位以去重。
    返回是否成功忽略。
    """
    concept = get_concept(conn, concept_id)
    if concept is None or concept.status != "unconfirmed":
        return False
    if concept.origin != "ai_suggested":
        return False

    return update_concept(conn, concept_id, status="ignored") is not None


__all__ = [
    "Concept",
    "VALID_ORIGINS", "VALID_STATUS",
    "create_concept",
    "get_concept",
    "get_concept_by_title",
    "list_concepts",
    "update_concept",
    "get_concept_domains",
    "accept_concept",
    "ignore_concept",
]