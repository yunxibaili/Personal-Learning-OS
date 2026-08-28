"""P8-003D 事件日志测试：update_mastery() → eventlog JSONL 写入。

验证 ADR-020 闭合：学习事件同时写入 SQLite 和 eventlog 文件。
"""
from __future__ import annotations

import json
from pathlib import Path

from app.core.mastery import update_mastery, _write_eventlog
from app.core.sync.device import load_or_create_device


# ── Helpers ─────────────────────────────────────────────────────────

def _create_concept(conn, title: str = "EventlogTest") -> int:
    """创建测试概念，返回 concept_id。"""
    conn.execute("INSERT INTO concepts (title, domain) VALUES (?, ?)", (title, "test"))
    conn.commit()
    return conn.execute("SELECT id FROM concepts WHERE title=?", (title,)).fetchone()["id"]


def _read_eventlog_lines(ws: Path, month: str = "2026-08") -> list[dict]:
    """读取指定月份的 eventlog 文件，返回解析后的 JSON 列表。"""
    event_file = ws / "metadata" / "eventlogs" / f"{month}.jsonl"
    if not event_file.exists():
        return []
    lines = event_file.read_text(encoding="utf-8").strip().split("\n")
    return [json.loads(line) for line in lines if line.strip()]


# ── Eventlog Write Tests ───────────────────────────────────────────

def test_write_eventlog_creates_file(core_conn, tmp_workspace: Path) -> None:
    """_write_eventlog() 创建 eventlog 文件。"""
    device = load_or_create_device(tmp_workspace)

    _write_eventlog(
        concept_id=1,
        event_type="explain",
        dimension="knowledge",
        weight=1.0,
        source="manual",
        detail=None,
        event_id="test-uuid-001",
        device_id=device.device_id,
        created_at="2026-08-28 10:00:00",
    )

    lines = _read_eventlog_lines(tmp_workspace)
    assert len(lines) == 1
    assert lines[0]["event_id"] == "test-uuid-001"
    assert lines[0]["concept_id"] == 1
    assert lines[0]["event_type"] == "explain"
    assert lines[0]["device_id"] == device.device_id


def test_write_eventlog_appends(core_conn, tmp_workspace: Path) -> None:
    """_write_eventlog() 追加多行，不覆盖。"""
    device = load_or_create_device(tmp_workspace)

    for i in range(3):
        _write_eventlog(
            concept_id=i,
            event_type="review",
            dimension="recall",
            weight=1.0,
            source="manual",
            detail=None,
            event_id=f"uuid-{i}",
            device_id=device.device_id,
            created_at=f"2026-08-28 10:0{i}:00",
        )

    lines = _read_eventlog_lines(tmp_workspace)
    assert len(lines) == 3
    assert [l["event_id"] for l in lines] == ["uuid-0", "uuid-1", "uuid-2"]


# ── Device Identity Tests ──────────────────────────────────────────

def test_device_identity_shared_with_sync(core_conn, tmp_workspace: Path) -> None:
    """eventlog 的 device_id 与 sync device identity 一致。"""
    device = load_or_create_device(tmp_workspace)

    update_mastery(
        conn=core_conn,
        concept_id=_create_concept(core_conn, "DeviceTest"),
        event_type="explain",
        dimension="knowledge",
        weight=1.0,
        source="manual",
    )

    lines = _read_eventlog_lines(tmp_workspace)
    assert len(lines) >= 1
    assert lines[-1]["device_id"] == device.device_id


# ── Integration: update_mastery → eventlog ─────────────────────────

def test_update_mastery_writes_eventlog(core_conn, tmp_workspace: Path) -> None:
    """update_mastery() 同时写入 SQLite 和 eventlog 文件。"""
    cid = _create_concept(core_conn, "EventlogIntegration")

    # 调用 update_mastery
    update_mastery(
        conn=core_conn,
        concept_id=cid,
        event_type="explain",
        dimension="knowledge",
        weight=1.0,
        source="review_session",
        detail=None,
    )

    # 验证 SQLite
    events = core_conn.execute(
        "SELECT * FROM learning_events WHERE concept_id=?", (cid,)
    ).fetchall()
    assert len(events) == 1
    assert events[0]["event_type"] == "explain"

    # 验证 eventlog 文件
    lines = _read_eventlog_lines(tmp_workspace)
    assert len(lines) >= 1
    latest = lines[-1]
    assert latest["concept_id"] == cid
    assert latest["event_type"] == "explain"
    assert latest["source"] == "review_session"
    assert latest["device_id"]
    assert latest["event_id"]


def test_update_mastery_eventlog_with_detail(core_conn, tmp_workspace: Path) -> None:
    """update_mastery() 的 detail 字段正确写入 eventlog。"""
    cid = _create_concept(core_conn, "DetailTest")

    update_mastery(
        conn=core_conn,
        concept_id=cid,
        event_type="answer_correct",
        dimension="recall",
        weight=1.0,
        source="manual",
        detail='{"quality": 5}',
    )

    lines = _read_eventlog_lines(tmp_workspace)
    assert len(lines) >= 1
    latest = lines[-1]
    assert latest["detail"] == '{"quality": 5}'
    assert latest["dimension"] == "recall"


def test_update_mastery_eventlog_multiple_events(core_conn, tmp_workspace: Path) -> None:
    """多次 update_mastery() 追加多行到 eventlog。"""
    cid = _create_concept(core_conn, "MultiEvent")

    for event_type in ["explain", "answer_correct", "review"]:
        update_mastery(
            conn=core_conn,
            concept_id=cid,
            event_type=event_type,
            dimension="knowledge",
            weight=1.0,
            source="manual",
        )

    lines = _read_eventlog_lines(tmp_workspace)
    assert len(lines) >= 3
    event_types = [l["event_type"] for l in lines[-3:]]
    assert "explain" in event_types
    assert "answer_correct" in event_types
    assert "review" in event_types
