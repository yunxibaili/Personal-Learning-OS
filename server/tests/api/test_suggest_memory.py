"""M3.5-B Full Omniscience 测试：suggest memory 三字段接真实学习状态。

数据构造全部走正规 Core 函数（不裸 INSERT）：
- mastery ← update_mastery(answer_correct/answer_wrong)（事件驱动）
- review_queue ← ensure_concept_learning_state（concept 首次触达时惰性初始化）
- mistakes ← update_mastery(answer_wrong) 自动落库（P8-003E）
"""
from __future__ import annotations

import json

from fastapi.testclient import TestClient


def _create_note_with_wikilink(client: TestClient, title: str, link: str) -> int:
    """创建含 [[link]] 的笔记 → concept 桩随之建立并惰性初始化学习状态。"""
    r = client.post("/api/v1/notes", json={
        "title": title, "content_md": f"引用[[{link}]]"})
    assert r.status_code in (200, 201), r.text
    return r.json()["note"]["id"]


def _concept_id_by_title(client: TestClient, title: str) -> int:
    """经 core 层按精确标题查 concept id（concepts API 无 search 参数）。"""
    from app.core.concepts import get_concept_by_title
    from app.db import connect

    conn = connect()
    try:
        c = get_concept_by_title(conn, title)
        assert c is not None, f"concept 「{title}」 未找到"
        return int(c.id)
    finally:
        conn.close()


def test_memory_real_data_full(client: TestClient) -> None:
    """concept 首次触达后，memory 至少 review_due 有值（惰性初始化）。"""
    _create_note_with_wikilink(client, "MLBasics", "梯度下降")

    r = client.get("/api/v1/knowledge/suggest?q=梯度下降")
    assert r.status_code == 200, r.text
    mem = r.json()["memory"]
    assert mem["mastery"] is not None or mem["review_due"] is not None, \
        f"memory 全 null，疑似未接入真实数据: {mem}"


def test_memory_mastery_reflects_events(client: TestClient) -> None:
    """mastery 数值应反映学习事件：答对后 effective > 0。"""
    _create_note_with_wikilink(client, "CalcNote", "泰勒展开")
    cid = _concept_id_by_title(client, "泰勒展开")

    # 走 core 层触发真实事件（事件驱动，与生产同一函数）
    from app.core.mastery import update_mastery
    from app.db import connect

    conn = connect()
    try:
        for _ in range(3):
            update_mastery(conn, cid, "answer_correct",
                           dimension="recall", weight=2.0, source="test")
        conn.commit()
    finally:
        conn.close()

    r = client.get("/api/v1/knowledge/suggest?q=泰勒展开")
    assert r.status_code == 200
    mem = r.json()["memory"]
    assert mem["mastery"] is not None, f"mastery 应有值: {mem}"
    assert mem["mastery"] > 0, f"答对三次后 effective 应 > 0: {mem}"
    assert mem["mastery"] <= 1.0


def test_memory_review_due_pending(client: TestClient) -> None:
    """concept 首次触达后 review_queue 有一行 pending → review_due 有值。"""
    _create_note_with_wikilink(client, "LinNote", "矩阵秩")

    r = client.get("/api/v1/knowledge/suggest?q=矩阵秩")
    assert r.status_code == 200
    mem = r.json()["memory"]
    assert mem["review_due"] is not None, \
        f"concept 首次触达应有 review_due: {mem}"


def test_memory_null_when_no_concept(client: TestClient) -> None:
    """查询词定位不到任何 concept 时，memory 三字段全 null（不猜）。"""
    r = client.get("/api/v1/knowledge/suggest?q=不存在的概念xyz")
    assert r.status_code == 200
    mem = r.json()["memory"]
    assert mem == {"mastery": None, "review_due": None, "last_mistake": None}


def test_memory_last_mistake_from_answer_wrong(client: TestClient) -> None:
    """answer_wrong 事件应产生 last_mistake 描述。"""
    _create_note_with_wikilink(client, "ErrNote", "反向传播")
    cid = _concept_id_by_title(client, "反向传播")

    from app.core.mastery import update_mastery
    from app.db import connect

    conn = connect()
    try:
        update_mastery(conn, cid, "answer_wrong", dimension="recall",
                       source="test", detail=json.dumps({"quality": 1}))
        conn.commit()
    finally:
        conn.close()

    r = client.get("/api/v1/knowledge/suggest?q=反向传播")
    assert r.status_code == 200
    mem = r.json()["memory"]
    assert mem["last_mistake"] is not None, \
        f"answer_wrong 后应有 last_mistake: {mem}"
    assert "答错" in mem["last_mistake"] or "quality" in mem["last_mistake"]


def test_memory_latest_mistake_wins(client: TestClient) -> None:
    """多次错题取最近一次（occurred_at DESC）。"""
    _create_note_with_wikilink(client, "ErrNote2", "贝叶斯定理")
    cid = _concept_id_by_title(client, "贝叶斯定理")

    from app.core.mastery import update_mastery
    from app.db import connect
    import time

    conn = connect()
    try:
        update_mastery(conn, cid, "answer_wrong", source="test",
                       detail=json.dumps({"quality": 1}))
        time.sleep(1.1)  # occurred_at 秒级精度，确保第二条更晚
        update_mastery(conn, cid, "answer_wrong", source="test",
                       detail=json.dumps({"quality": 2}))
        conn.commit()
    finally:
        conn.close()

    r = client.get("/api/v1/knowledge/suggest?q=贝叶斯定理")
    mem = r.json()["memory"]
    assert mem["last_mistake"] is not None
    assert "quality=2" in mem["last_mistake"], \
        f"应取最近一次错题（quality=2）: {mem['last_mistake']}"
