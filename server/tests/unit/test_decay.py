"""P8-003B Mastery Decay 单元测试。"""
from __future__ import annotations

import math
import sqlite3
from datetime import datetime, timedelta, timezone

import pytest

from app.core.mastery import (
    decay_effective,
    get_effective_now,
    update_mastery,
)


@pytest.fixture()
def conn(core_conn: sqlite3.Connection):
    yield core_conn


class TestDecayFunction:
    def test_zero_days(self):
        """当天不衰减。"""
        assert decay_effective(0.8, 0) == 0.8

    def test_negative_days(self):
        """负数天数不衰减。"""
        assert decay_effective(0.8, -1) == 0.8

    def test_zero_base(self):
        """base=0 → 0。"""
        assert decay_effective(0.0, 14) == 0.0

    def test_half_life(self):
        """14 天 → ~37% of base（e^-1 ≈ 0.3679）。"""
        result = decay_effective(1.0, 14)
        assert abs(result - 0.3679) < 0.01

    def test_seven_days(self):
        """7 天 → ~61%。"""
        result = decay_effective(1.0, 7)
        assert abs(result - 0.6065) < 0.01

    def test_thirty_days(self):
        """30 天 → ~12%。"""
        result = decay_effective(1.0, 30)
        assert abs(result - 0.1175) < 0.01

    def test_custom_tau(self):
        """自定义 tau。"""
        result = decay_effective(1.0, 5, tau=5.0)
        assert abs(result - 0.3679) < 0.01

    def test_partial_mastery(self):
        """部分掌握度衰减。"""
        result = decay_effective(0.5, 14)
        assert abs(result - 0.5 * 0.3679) < 0.01


class TestGetEffectiveNow:
    def _setup_concept(self, conn, concept_id: int, effective: float) -> None:
        """创建 concept + mastery 行。"""
        conn.execute(
            "INSERT INTO concepts (id, title, origin, status) VALUES (?, ?, 'manual', 'active')",
            (concept_id, f"Concept {concept_id}"),
        )
        dims = '{"knowledge":0.8,"practice":0.6,"recall":0.4,"transfer":0.2}'
        conn.execute(
            "INSERT INTO concept_mastery (concept_id, dimensions, effective) "
            "VALUES (?, ?, ?)",
            (concept_id, dims, effective),
        )

    def test_no_events_returns_base(self, conn):
        """无学习事件 → 返回 base。"""
        self._setup_concept(conn, 1, 0.8)
        result = get_effective_now(conn, 1)
        assert result == 0.8

    def test_recent_event_minimal_decay(self, conn):
        """刚学习 → 几乎不衰减。"""
        self._setup_concept(conn, 2, 0.8)
        now = datetime.now(timezone.utc)
        conn.execute(
            "INSERT INTO learning_events (concept_id, event_type, created_at) "
            "VALUES (?, 'answer_correct', ?)",
            (2, (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")),
        )
        result = get_effective_now(conn, 2, now=now)
        assert result > 0.79

    def test_old_event_significant_decay(self, conn):
        """60 天前学习 → 大幅衰减。"""
        self._setup_concept(conn, 3, 0.8)
        now = datetime.now(timezone.utc)
        conn.execute(
            "INSERT INTO learning_events (concept_id, event_type, created_at) "
            "VALUES (?, 'answer_correct', ?)",
            (3, (now - timedelta(days=60)).strftime("%Y-%m-%d %H:%M:%S")),
        )
        result = get_effective_now(conn, 3, now=now)
        assert result < 0.1

    def test_no_mastery_returns_zero(self, conn):
        """概念不存在 → 0。"""
        assert get_effective_now(conn, 999) == 0.0


class TestTimeRealism:
    """时间真实性测试：不同复习时间 → 不同 effective_now。"""

    def _setup_with_last_event(self, conn, concept_id: int, days_ago: float) -> None:
        conn.execute(
            "INSERT INTO concepts (id, title, origin, status) VALUES (?, ?, 'manual', 'active')",
            (concept_id, f"Concept {concept_id}"),
        )
        dims = '{"knowledge":0.8,"practice":0.6,"recall":0.4,"transfer":0.2}'
        conn.execute(
            "INSERT INTO concept_mastery (concept_id, dimensions, effective) "
            "VALUES (?, ?, 0.8)",
            (concept_id, dims),
        )
        now = datetime.now(timezone.utc)
        event_time = now - timedelta(days=days_ago)
        conn.execute(
            "INSERT INTO learning_events (concept_id, event_type, created_at) "
            "VALUES (?, 'answer_correct', ?)",
            (concept_id, event_time.strftime("%Y-%m-%d %H:%M:%S")),
        )

    def test_today_vs_60_days(self, conn):
        """今天复习 vs 60 天前复习 → 有效差异。"""
        self._setup_with_last_event(conn, 10, days_ago=0)
        self._setup_with_last_event(conn, 11, days_ago=60)
        now = datetime.now(timezone.utc)
        eff_today = get_effective_now(conn, 10, now=now)
        eff_old = get_effective_now(conn, 11, now=now)
        assert eff_today > 0.79
        assert eff_old < 0.1
        assert eff_today > eff_old * 5

    def test_7_days_vs_30_days(self, conn):
        """7 天 vs 30 天 → 有效差异。"""
        self._setup_with_last_event(conn, 20, days_ago=7)
        self._setup_with_last_event(conn, 21, days_ago=30)
        now = datetime.now(timezone.utc)
        eff_7 = get_effective_now(conn, 20, now=now)
        eff_30 = get_effective_now(conn, 21, now=now)
        assert eff_7 > eff_30
        assert eff_7 > 0.45  # 0.8 × e^(-7/14) ≈ 0.485
        assert eff_30 < 0.15  # 0.8 × e^(-30/14) ≈ 0.094
