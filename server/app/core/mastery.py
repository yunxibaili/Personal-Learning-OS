"""Learning Graph 核心：四维掌握度引擎（M3）。

四维定义（ADR-013 候选，当前冻结）：
  knowledge  知识理解（概念认知、定义记忆）
  practice   应用能力（解题、代码实现）
  recall     主动回忆（不提示下能否想起）
  transfer   迁移能力（跨领域应用、类比）

effective = 0.35*knowledge + 0.30*practice + 0.20*recall + 0.15*transfer
（权重可在 M4 根据用户行为调整，当前冻结）

纯逻辑层：不 import FastAPI，可被 pytest 直接测试。
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from ..db import connect

# 四维权重（冻结常量，M3 评审批准）
DIMENSION_WEIGHTS = {
    "knowledge": 0.35,
    "practice": 0.30,
    "recall": 0.20,
    "transfer": 0.15,
}

DEFAULT_DIMENSIONS = {"knowledge": 0.0, "practice": 0.0, "recall": 0.0, "transfer": 0.0}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def compute_effective(dimensions: dict[str, float]) -> float:
    """四维 → effective 加权值。"""
    return round(
        sum(DIMENSION_WEIGHTS.get(d, 0) * v for d, v in dimensions.items()),
        4,
    )


def get_or_create_mastery(conn, concept_id: int) -> dict:
    """获取或初始化 concept_mastery 行。"""
    row = conn.execute(
        "SELECT * FROM concept_mastery WHERE concept_id=?", (concept_id,)
    ).fetchone()
    if row:
        return dict(row)
    dims = json.dumps(DEFAULT_DIMENSIONS, ensure_ascii=False)
    conn.execute(
        "INSERT INTO concept_mastery (concept_id, dimensions, effective) "
        "VALUES (?, ?, 0.0)",
        (concept_id, dims),
    )
    return conn.execute(
        "SELECT * FROM concept_mastery WHERE concept_id=?", (concept_id,)
    ).fetchone()


def update_mastery(
    conn,
    concept_id: int,
    event_type: str,
    dimension: str | None = None,
    weight: float = 1.0,
    source: str = "manual",
    detail: str | None = None,
) -> dict:
    """学习事件 → 更新掌握度。

    event_type 映射：
      answer_correct  → 目标维度 +0.15*weight
      answer_wrong    → 目标维度 -0.10*weight（不低于 0）
      explain         → knowledge +0.08*weight
      visualize       → practice +0.05*weight
      review          → recall +0.10*weight
      code_run        → practice +0.08*weight

    detail: 事件特定数据 JSON（如 review_answer 的 quality）。

    返回更新后的 mastery 行。
    """
    # 写入事件
    conn.execute(
        "INSERT INTO learning_events (concept_id, event_type, dimension, weight, source, detail) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (concept_id, event_type, dimension, weight, source, detail),
    )

    m = get_or_create_mastery(conn, concept_id)
    dims = json.loads(m["dimensions"])

    # 事件 → 维度增量
    increments = {
        "answer_correct": {dimension or "knowledge": 0.15 * weight},
        "answer_wrong": {dimension or "knowledge": -0.10 * weight},
        "explain": {"knowledge": 0.08 * weight},
        "visualize": {"practice": 0.05 * weight},
        "review": {"recall": 0.10 * weight},
        "code_run": {"practice": 0.08 * weight},
    }

    for dim, delta in increments.get(event_type, {}).items():
        if dim in dims:
            dims[dim] = round(max(0.0, min(1.0, dims[dim] + delta)), 4)

    effective = compute_effective(dims)
    now = _now_iso()

    conn.execute(
        "UPDATE concept_mastery SET dimensions=?, effective=?, updated_at=? "
        "WHERE concept_id=?",
        (json.dumps(dims, ensure_ascii=False), effective, now, concept_id),
    )

    return conn.execute(
        "SELECT * FROM concept_mastery WHERE concept_id=?", (concept_id,)
    ).fetchone()


def get_mastery(conn, concept_id: int) -> dict | None:
    row = conn.execute(
        "SELECT * FROM concept_mastery WHERE concept_id=?", (concept_id,)
    ).fetchone()
    return dict(row) if row else None


def get_all_mastery(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT cm.*, c.title FROM concept_mastery cm "
        "JOIN concepts c ON c.id = cm.concept_id "
        "ORDER BY cm.effective DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def get_weak_concepts(conn, limit: int = 10) -> list[dict]:
    """effective 最低的概念（薄弱环节）。"""
    rows = conn.execute(
        "SELECT cm.*, c.title FROM concept_mastery cm "
        "JOIN concepts c ON c.id = cm.concept_id "
        "WHERE cm.effective > 0 "
        "ORDER BY cm.effective ASC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def ensure_concept_learning_state(conn, concept_id: int) -> None:
    """概念首次触达时惰性初始化完整学习状态：mastery + review_queue。

    触发时机（不绑定笔记）：
    - 笔记创建时 [[新概念]] 解析创建 stub
    - AI Tutor extractor 建议新概念
    - Import（UpMark 等）
    - Code Trace 产生新概念
    """
    # 1. 确保 mastery 行存在
    get_or_create_mastery(conn, concept_id)
    # 2. 确保 review_queue 行存在（due_at = now，首日可复习）
    existing = conn.execute(
        "SELECT 1 FROM review_queue WHERE concept_id=?", (concept_id,)
    ).fetchone()
    if existing is None:
        now = _now_iso()
        conn.execute(
            "INSERT INTO review_queue (concept_id, due_at, priority, status) "
            "VALUES (?, ?, 0.5, 'pending')",
            (concept_id, now),
        )
