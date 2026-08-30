"""P8-003D 事件日志测试：update_mastery() → eventlog JSONL 写入。

验证 ADR-020 闭合：学习事件同时写入 SQLite 和 eventlog 文件。
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

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


# ── Integrity: SQLite ↔ eventlog 两端连通（P0-2 回归守护）───────────
# 背景（TECH_DESIGN_REVIEW §6.7.6 N3）：本套件曾出现"管道测试盲区"——
# 分别断言两端各有行，却从不断言两端标识符相等；回退 INSERT 中的
# event_id 后测试依然全绿。以下四条断言来自 _verify_p0.py 第 7/8/11/12 项。

def test_event_id_lands_in_both_stores(core_conn, tmp_workspace: Path) -> None:
    """SQLite.event_id 与 eventlog.event_id 必须一一对应（两端连通）。"""
    cid = _create_concept(core_conn, "UuidIntegrity")

    update_mastery(conn=core_conn, concept_id=cid,
                   event_type="answer_correct", dimension="knowledge",
                   weight=1.0, source="manual")

    db_ids = [
        r["event_id"]
        for r in core_conn.execute(
            "SELECT event_id FROM learning_events WHERE concept_id=?", (cid,)
        ).fetchall()
    ]
    assert db_ids and all(db_ids), "event_id 存在 NULL 行"

    jl_ids = [l["event_id"] for l in _read_eventlog_lines(tmp_workspace)]
    assert jl_ids, "eventlog 未生成"
    assert sorted(db_ids) == sorted(jl_ids), (
        "SQLite 与 eventlog 的标识符不一致——event_id 落库链路已断"
    )


def test_eventlog_device_id_matches_identity_file(
    core_conn, tmp_workspace: Path,
) -> None:
    """eventlog.device_id == devices.json.device_id == sync 侧读到的身份。"""
    cid = _create_concept(core_conn, "DeviceIntegrity")
    update_mastery(conn=core_conn, concept_id=cid,
                   event_type="explain", dimension="knowledge",
                   weight=1.0, source="manual")

    dev_file = tmp_workspace / "metadata" / "devices.json"
    assert dev_file.exists(), "devices.json 未生成"
    identity = json.loads(dev_file.read_text(encoding="utf-8"))

    lines = _read_eventlog_lines(tmp_workspace)
    assert lines
    assert all(l["device_id"] == identity["device_id"] for l in lines), (
        "eventlog device_id 与设备身份文件不一致"
    )

    # sync 侧 load_or_create_device 必须读到同一身份（合并后单一来源）
    from app.core.sync.device import load_or_create_device
    assert load_or_create_device(tmp_workspace).device_id == identity["device_id"]


def test_eventlog_never_contains_hostname(
    core_conn, tmp_workspace: Path,
) -> None:
    """hostname 不得进入 Layer 1 同步内容（只允许存在于 Layer 3）。"""
    import socket

    cid = _create_concept(core_conn, "HostnameLeak")
    update_mastery(conn=core_conn, concept_id=cid,
                   event_type="explain", dimension="knowledge",
                   weight=1.0, source="manual")

    event_dir = tmp_workspace / "metadata" / "eventlogs"
    for f in event_dir.glob("*.jsonl"):
        assert socket.gethostname() not in f.read_text(encoding="utf-8"), (
            "hostname 泄漏进 eventlog（Layer 1 同步内容）"
        )


def test_event_id_unique_index_enforced(core_conn) -> None:
    """idx_events_id UNIQUE 索引必须真的生效（重复 id 被拒）。"""
    cid = _create_concept(core_conn, "UniqueIndexTest")
    update_mastery(conn=core_conn, concept_id=cid,
                   event_type="explain", dimension="knowledge",
                   weight=1.0, source="manual")
    existing = core_conn.execute(
        "SELECT event_id FROM learning_events LIMIT 1"
    ).fetchone()[0]

    with pytest.raises(sqlite3.IntegrityError):
        core_conn.execute(
            "INSERT INTO learning_events "
            "(concept_id, event_type, dimension, weight, source, event_id) "
            "VALUES (?, 'explain', 'knowledge', 1.0, 'test', ?)",
            (cid, existing),
        )
