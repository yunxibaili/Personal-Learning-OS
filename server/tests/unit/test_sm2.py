"""SM-2 纯函数单元测试（M4-Preflight Hardening）。"""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.review_scheduler import sm2_schedule

FIXED_NOW = datetime(2026, 8, 27, 12, 0, 0, tzinfo=timezone.utc)


def test_sm2_determinism() -> None:
    """同输入同输出：SM-2 是纯函数。"""
    args = dict(quality=4, ease_factor=2.5, interval=0, review_count=0, now=FIXED_NOW)
    r1 = sm2_schedule(**args)
    r2 = sm2_schedule(**args)
    assert r1 == r2


def test_sm2_time_injection() -> None:
    """注入固定时间验证 next_review 精确值。"""
    r = sm2_schedule(quality=5, ease_factor=2.5, interval=0, review_count=0, now=FIXED_NOW)
    assert r["next_review"] == "2026-08-28 12:00:00"  # 1 day later
    assert r["interval"] == 1


def test_sm2_time_injection_long_interval() -> None:
    """注入固定时间验证多天间隔。"""
    r = sm2_schedule(quality=5, ease_factor=2.5, interval=10, review_count=2, now=FIXED_NOW)
    expected_days = max(1, round(10 * r["ease_factor"]))
    expected_dt = FIXED_NOW.replace(hour=12, minute=0, second=0)
    from datetime import timedelta
    expected = (expected_dt + timedelta(days=expected_days)).strftime("%Y-%m-%d %H:%M:%S")
    assert r["next_review"] == expected


def test_sm2_quality_bounds() -> None:
    """quality 0-5 边界。"""
    r1 = sm2_schedule(quality=-1, now=FIXED_NOW)
    r2 = sm2_schedule(quality=10, now=FIXED_NOW)
    assert r1["interval"] >= 1
    assert r2["interval"] >= 1


def test_sm2_reset_on_wrong() -> None:
    """quality<3 重置 interval 为 1。"""
    r = sm2_schedule(quality=1, ease_factor=2.5, interval=10, review_count=5, now=FIXED_NOW)
    assert r["interval"] == 1


def test_sm2_ease_factor_floor() -> None:
    """ease_factor 不低于 1.3。"""
    r = sm2_schedule(quality=0, ease_factor=1.3, interval=0, review_count=0, now=FIXED_NOW)
    assert r["ease_factor"] >= 1.3
