"""Review Stats 核心（B13）：复习历史分析。

从 learning_events（answer_correct / answer_wrong）派生复习指标；
纯逻辑层，不 import FastAPI。

生产者为 mastery.update_mastery / routers/mastery submit_answer。
本模块把原始历史「升维」为可决策的统计：准确率、当前连对、按概念归因。
"""
from __future__ import annotations

_REVIEW_EVENTS = ("answer_correct", "answer_wrong")


def review_stats(conn) -> dict:
    """复习统计。

    Returns:
        {
          total_reviews, correct, wrong, accuracy,
          current_streak,            # 从最近一条往前数的连续答对次数
          by_concept: [{concept_id, title, count, correct, wrong}]
        }
    """
    row = conn.execute(
        "SELECT COUNT(*) AS total, "
        "  SUM(CASE WHEN event_type='answer_correct' THEN 1 ELSE 0 END) AS correct, "
        "  SUM(CASE WHEN event_type='answer_wrong' THEN 1 ELSE 0 END) AS wrong "
        "FROM learning_events WHERE event_type IN (?, ?)",
        _REVIEW_EVENTS,
    ).fetchone()
    total = row["total"] or 0
    correct = row["correct"] or 0
    wrong = row["wrong"] or 0
    accuracy = round(correct / total, 4) if total else 0.0

    # 当前连对：从最近一次复习事件往回数连续 answer_correct
    events = conn.execute(
        "SELECT event_type FROM learning_events "
        "WHERE event_type IN (?, ?) ORDER BY created_at DESC, id DESC",
        _REVIEW_EVENTS,
    ).fetchall()
    streak = 0
    for evt in events:
        if evt["event_type"] == "answer_correct":
            streak += 1
        else:
            break

    by_concept = conn.execute(
        "SELECT le.concept_id, c.title, COUNT(*) AS count, "
        "  SUM(CASE WHEN le.event_type='answer_correct' THEN 1 ELSE 0 END) AS correct, "
        "  SUM(CASE WHEN le.event_type='answer_wrong' THEN 1 ELSE 0 END) AS wrong "
        "FROM learning_events le JOIN concepts c ON c.id = le.concept_id "
        "WHERE le.event_type IN (?, ?) "
        "GROUP BY le.concept_id ORDER BY count DESC, le.concept_id ASC LIMIT 10",
        _REVIEW_EVENTS,
    ).fetchall()

    return {
        "total_reviews": total,
        "correct": correct,
        "wrong": wrong,
        "accuracy": accuracy,
        "current_streak": streak,
        "by_concept": [dict(r) for r in by_concept],
    }


__all__ = ["review_stats"]
