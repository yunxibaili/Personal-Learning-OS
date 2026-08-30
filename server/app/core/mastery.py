"""Learning Graph 核心：四维掌握度引擎（M3）+ 时间衰减（P8-003B）+ 事件日志（P8-003D）。

四维定义（ADR-013 候选，当前冻结）：
  knowledge  知识理解（概念认知、定义记忆）
  practice   应用能力（解题、代码实现）
  recall     主动回忆（不提示下能否想起）
  transfer   迁移能力（跨领域应用、类比）

effective = 0.35*knowledge + 0.30*practice + 0.20*recall + 0.15*transfer
（权重可在 M4 根据用户行为调整，当前冻结）

effective_now = effective × exp(-days_since_last_review / tau)
（P8-003B：Ebbinghaus 时间衰减，tau=14 天半衰期）

事件日志（P8-003D / ADR-020）：
  learning_events 写入 SQLite 之后，紧接追加一行 JSON 到
  metadata/eventlogs/<yyyy-mm>.jsonl —— 注意与 SQLite **不是**同一原子事务
  （文件写失败会回滚 SQLite 事务吗？不会。故为「尽力而为」的追加，B23 措辞更正）。

纯逻辑层：不 import FastAPI，可被 pytest 直接测试。
"""
from __future__ import annotations

import json
import logging
import math
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from ..db import connect, workspace_root
from .review_scheduler import sm2_schedule
from .sync.device import load_or_create_device
from .timeutil import now_iso as _now_iso

logger = logging.getLogger(__name__)

# 四维权重（冻结常量，M3 评审批准）
DIMENSION_WEIGHTS = {
    "knowledge": 0.35,
    "practice": 0.30,
    "recall": 0.20,
    "transfer": 0.15,
}

DEFAULT_DIMENSIONS = {"knowledge": 0.0, "practice": 0.0, "recall": 0.0, "transfer": 0.0}


# ── 事件日志（P8-003D / ADR-020）──────────────────────────────────

def _write_eventlog(
    concept_id: int,
    event_type: str,
    dimension: str | None,
    weight: float,
    source: str,
    detail: str | None,
    event_id: str,
    device_id: str,
    created_at: str,
) -> None:
    """追加一行 JSON 到 metadata/eventlogs/<yyyy-mm>.jsonl（ADR-020）。

    调用时机：learning_events INSERT 成功后，同事务上下文内。
    文件操作：append-only + fsync，POSIX 保证 append 原子性。
    """
    eventlog_dir = workspace_root() / "metadata" / "eventlogs"
    eventlog_dir.mkdir(parents=True, exist_ok=True)

    month = created_at[:7]  # "2026-08"
    event_file = eventlog_dir / f"{month}.jsonl"

    event_line = json.dumps({
        "event_id": event_id,
        "concept_id": concept_id,
        "event_type": event_type,
        "dimension": dimension,
        "weight": weight,
        "source": source,
        "detail": detail,
        "device_id": device_id,
        "created_at": created_at,
    }, ensure_ascii=False) + "\n"

    with open(event_file, "a", encoding="utf-8") as f:
        f.write(event_line)
        f.flush()
        os.fsync(f.fileno())


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
    event_id = str(uuid.uuid4())
    now = _now_iso()

    conn.execute(
        "INSERT INTO learning_events (concept_id, event_type, dimension, weight, source, detail, event_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (concept_id, event_type, dimension, weight, source, detail, event_id),
    )

    # 答错同步落 mistakes（P8-003E Review Bridge：修复建表以来零生产者的断链）
    if event_type == "answer_wrong":
        desc = f"答错（source={source}）"
        if detail:
            try:
                q = json.loads(detail).get("quality")
                if q is not None:
                    desc = f"复习答错（quality={q}）"
            except (json.JSONDecodeError, AttributeError):
                pass
        conn.execute(
            "INSERT INTO mistakes (concept_id, description) VALUES (?, ?)",
            (concept_id, desc),
        )

    # 追加到 eventlog 文件（ADR-020：learning_events 之后的尽力而为追加；
    # 与 SQLite 非同一原子事务——文件失败不阻断学习事件，B23）
    try:
        device = load_or_create_device(workspace_root())
        _write_eventlog(
            concept_id=concept_id,
            event_type=event_type,
            dimension=dimension,
            weight=weight,
            source=source,
            detail=detail,
            event_id=event_id,
            device_id=device.device_id,
            created_at=now,
        )
    except OSError as exc:
        # B22：不再静默降级——文件写入失败不阻断学习事件（SQLite 已写入），但要可观测
        logger.warning("eventlog write skipped for concept %s: %s", concept_id, exc)

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


# ── 时间衰减（P8-003B）────────────────────────────────────────────

# Ebbinghaus 半衰期（天）：14 天不复习 → effective 降至 ~37%
DEFAULT_TAU = 14.0


def decay_effective(base: float, days: float, tau: float = DEFAULT_TAU) -> float:
    """Ebbinghaus 遗忘曲线衰减。

    base: 基础掌握度（concept_mastery.effective）
    days: 距上次复习的天数（≥0）
    tau:  半衰期（天），默认 14

    返回: 衰减后的 effective（0~base）
    """
    if days <= 0 or base <= 0:
        return base
    return round(base * math.exp(-days / tau), 4)


def _get_last_seen(conn, concept_id: int) -> datetime | None:
    """从 learning_events 取最近一次学习事件时间（UTC-aware）。"""
    row = conn.execute(
        "SELECT MAX(created_at) AS last_seen "
        "FROM learning_events WHERE concept_id=?",
        (concept_id,),
    ).fetchone()
    if row is None or row["last_seen"] is None:
        return None
    dt = datetime.fromisoformat(row["last_seen"])
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def get_effective_now(conn, concept_id: int, *, now: datetime | None = None) -> float:
    """动态计算当前 effective（含时间衰减）。

    读取 base_mastery + last_seen，返回衰减后的掌握度。
    从未学习的概念返回 0.0。
    """
    m = get_mastery(conn, concept_id)
    if m is None:
        return 0.0
    base = m["effective"]
    if base <= 0:
        return 0.0

    last_seen = _get_last_seen(conn, concept_id)
    if last_seen is None:
        return base

    if now is None:
        now = datetime.now(timezone.utc)
    days = max(0.0, (now - last_seen).total_seconds() / 86400)
    return decay_effective(base, days)


def submit_review_answer(conn, concept_id: int, quality: int) -> dict:
    """复习答题：SM-2 排期 + 掌握度更新 + review_queue upsert（B20 下沉）。

    原实现位于 routers/mastery.py（业务逻辑留在了 Router 层）；本函数把
    SM-2 排期 / 事件更新 / 队列维护聚合到 Core，Router 只做校验与序列化。

    返回：{mastery, next_review, ease_factor, interval}（mastery 为更新后的行）。
    调用方负责 conn 生命周期；本函数在成功时 commit。
    """
    m = get_or_create_mastery(conn, concept_id)

    schedule = sm2_schedule(
        quality=quality,
        ease_factor=m["ease_factor"],
        interval=m["interval"],
        review_count=m["review_count"],
    )

    event_type = "answer_correct" if quality >= 3 else "answer_wrong"
    detail = json.dumps({"quality": quality})
    updated = update_mastery(conn, concept_id, event_type, source="review", detail=detail)

    now = _now_iso()
    conn.execute(
        "UPDATE concept_mastery SET "
        "ease_factor=?, interval=?, next_review=?, review_count=?, updated_at=? "
        "WHERE concept_id=?",
        (schedule["ease_factor"], schedule["interval"],
         schedule["next_review"], schedule["review_count"], now, concept_id),
    )

    result = "correct" if quality >= 3 else "wrong"
    new_priority = 0.8 if result == "wrong" else 0.5
    conn.execute(
        "INSERT INTO review_queue (concept_id, due_at, priority, status, last_result) "
        "VALUES (?, ?, ?, 'pending', ?) "
        "ON CONFLICT(concept_id) DO UPDATE SET "
        "due_at=excluded.due_at, priority=excluded.priority, "
        "status='pending', last_result=excluded.last_result, "
        "updated_at=?",
        (concept_id, schedule["next_review"], new_priority, result, now),
    )

    conn.commit()
    return {
        "mastery": updated,
        "next_review": schedule["next_review"],
        "ease_factor": schedule["ease_factor"],
        "interval": schedule["interval"],
    }


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
