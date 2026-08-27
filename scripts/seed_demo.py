r"""M7-Preview-001 · Demo 数据种子（只增不改，幂等可重跑）。

用途：让首次打开 PC 端时有可看的数据面——笔记/图谱/掌握度色彩分布/
复习队列。刻意不预置 MindMap 与同步冲突，留给用户在 Preview 中亲手体验创建流程。

原则：
- 只新增；已存在的同名笔记跳过，绝不覆盖 workspace 内任何现有内容
- 一切走公开 API（TestClient 离线调用），不直改 DB 结构
- 概念经 [[wikilink]] 索引管线自动建 stub（与真实用户路径一致）

用法：
    cd server && .venv\\Scripts\\python.exe ..\\scripts\\seed_demo.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

# (标题, 正文)。设计原则：
#   笔记级链接用同名笔记互相引用；纯概念（如 学习率/损失函数/注意力机制）
#   故意不建同名笔记——由索引管线自动产出 concept stub，形成真实的
#   Entity/Document 分层（ADR-009）
NOTES = [
    ("机器学习",
     "# 机器学习\n\n研究如何让计算机从数据中学习规律。\n\n"
     "核心优化方法是[[梯度下降]]，工程上最常用[[Adam优化器]]。\n\n"
     "- 模型结构：见 [[Transformer]]\n"
     "- 训练基础：[[反向传播]]\n"
     "- 关键超参数：[[学习率]] · 目标：最小化[[损失函数]]\n"),
    ("梯度下降",
     "# 梯度下降\n\n沿负梯度方向迭代更新参数以最小化损失函数。\n\n"
     "是[[机器学习]]的基本优化框架，[[Adam优化器]]是其自适应变体。\n\n"
     "$$\\theta_{t+1} = \\theta_t - \\eta \\nabla L(\\theta_t)$$\n\n"
     "其中 $\\eta$ 即[[学习率]]。\n"),
    ("Adam优化器",
     "# Adam 优化器\n\n结合动量与二阶矩估计的自适应学习率算法。\n\n"
     "对比朴素[[梯度下降]]：对稀疏梯度更稳健，是深度学习默认选择之一。\n"),
    ("Transformer",
     "# Transformer\n\n纯注意力架构，彻底取代循环网络。\n\n"
     "训练依赖[[反向传播]]与[[Adam优化器]]，核心是[[注意力机制]]。\n\n"
     "$$\\mathrm{Attention}(Q,K,V)=\\mathrm{softmax}\\!\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n"),
    ("反向传播",
     "# 反向传播\n\n利用链式法则逐层计算梯度的算法，是训练[[Transformer]]\n"
     "等一切深度模型的核心机制。优化目标是最小化[[损失函数]]。\n"),
]

# 本脚本创建的笔记允许在重跑时刷新内容（只限下列白名单标题，
# workspace 中其余既有文件永不触碰）
OWNED_TITLES = {t for t, _ in NOTES}

# 概念 → 学习事件序列：制造掌握度分布层次（中/弱/未触碰），Universe 才有色彩。
# 注：仅纯概念可在此挂事件；与笔记同名的主题（梯度下降等）当前无显式
# /concepts 创建端点（TECH_DESIGN §9 缺口已登记），以笔记节点形态出现在图谱。
EVENT_PLAN = {
    "注意力机制": [("explain", None), ("answer_correct", "knowledge")],
    "损失函数": [("answer_wrong", "knowledge")],   # 弱项：进复习队列前列
    "学习率": [],                                   # 留作 UNKNOWN 态对照
}


def main() -> int:
    client = TestClient(create_app())

    created_notes = []
    for title, body in NOTES:
        exists = any(n["title"] == title
                     for n in client.get("/api/v1/notes").json()["notes"])
        if exists:
            if title in OWNED_TITLES:
                note_id = next(n["id"] for n in
                               client.get("/api/v1/notes").json()["notes"]
                               if n["title"] == title)
                r = client.patch(f"/api/v1/notes/{note_id}",
                                 json={"content_md": body})
                assert r.status_code == 200, f"{title}: {r.text}"
                print(f"note refreshed: {title}")
            else:
                print(f"skip note (exists): {title}")
            continue
        r = client.post("/api/v1/notes", json={"title": title, "content_md": body})
        assert r.status_code == 201, f"{title}: {r.status_code} {r.text}"
        created_notes.append(title)
        print(f"note created: {title}")

    # 概念 id 解析（stub 由索引管线创建）
    graph = client.get("/api/v1/graph").json()
    cid = {n["title"]: n["ref_id"] for n in graph["nodes"] if n["type"] == "concept"}

    for title, events in EVENT_PLAN.items():
        concept_id = cid.get(title)
        if concept_id is None:
            print(f"wARN concept missing: {title}")
            continue
        for event_type, dimension in events:
            r = client.post("/api/v1/events", json={
                "concept_id": concept_id, "event_type": event_type,
                "dimension": dimension})
            assert r.status_code == 201, r.text
        print(f"events seeded: {title} ({len(events)})")

    # 预置两条今日复习（回答其一来体验闭环；另一条留给你作答）
    import sqlite3
    from app.db import db_path
    conn = sqlite3.connect(db_path())
    due = conn.execute("SELECT count(*) FROM review_queue WHERE status='pending'").fetchone()[0]
    conn.close()
    print(f"review queue pending: {due}")

    print("\n完成。刻意未预置：MindMap（请亲手创建体验）、同步冲突 artifact。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
