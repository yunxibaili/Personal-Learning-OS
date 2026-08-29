"""SM-2 复习调度器（M3，独立模块，可替换为 FSRS/Leitner）。

SM-2 核心公式（简化版）：
  interval_new = interval_old * ease_factor
  ease_factor_new = ease_factor_old + (0.1 - (1 - quality) * (0.08 + (1 - quality) * 0.02))
  quality: 0~5（0=完全忘记，5=完美回答）

本模块只负责"排期"，不负责掌握度计算（由 mastery.py 处理）。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def sm2_schedule(
    quality: int,
    ease_factor: float = 2.5,
    interval: int = 0,
    review_count: int = 0,
    now: datetime | None = None,
) -> dict:
    """SM-2 排期：返回 {ease_factor, interval, next_review, review_count}。

    quality: 0-5（0=完全忘记，5=完美回答）
    now: 可注入时间（测试用），默认 UTC now。
    """
    if now is None:
        now = datetime.now(timezone.utc)
    quality = max(0, min(5, quality))

    # ease_factor 更新
    ef_delta = 0.1 - (1 - quality / 5) * (0.08 + (1 - quality / 5) * 0.02)
    new_ef = max(1.3, ease_factor + ef_delta)

    # interval 更新
    if quality < 3:
        # 回答不满意：重置 interval
        new_interval = 1
    elif review_count == 0:
        new_interval = 1
    elif review_count == 1:
        new_interval = 6
    else:
        new_interval = max(1, round(interval * new_ef))

    # next_review
    next_dt = now + timedelta(days=new_interval)
    next_review = next_dt.strftime("%Y-%m-%d %H:%M:%S")

    return {
        "ease_factor": round(new_ef, 4),
        "interval": new_interval,
        "next_review": next_review,
        "review_count": review_count + 1,
    }
