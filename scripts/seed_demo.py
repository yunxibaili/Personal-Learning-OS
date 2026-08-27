r"""P8-001A · Demo 数据种子（只增不改，幂等可重跑）。

用途：让首次打开 PC 端时有可看的数据面——笔记/图谱/掌握度色彩分布/
复习队列/Universe 域聚类。刻意不预置 MindMap 与同步冲突，留给用户在 Preview 中亲手体验创建流程。

原则：
- 只新增；已存在的同名笔记/概念跳过，绝不覆盖 workspace 内任何现有内容
- 一切走公开 API（TestClient 离线调用），不直改 DB 结构
- 纯概念经 /api/v1/concepts 显式创建（origin=manual），不再依赖 wikilink 索引管线产出 stub
- 笔记与纯概念分层：笔记为 Document，纯概念为 Concept（ADR-009）
- 概念来源唯一事实字段为 origin（manual/markdown/ai_suggested），不使用 source_type

用法：
    cd server && .venv\Scripts\python.exe ..\scripts\seed_demo.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

# 纯概念定义：(标题, domain, summary, aliases)
# 这些不创建同名笔记，直接作为 Concept（origin=manual）
PURE_CONCEPTS = [
    # === Machine Learning 域 ===
    ("机器学习", "Machine Learning", "研究如何让计算机从数据中学习规律的学科。", ["ML"]),
    ("监督学习", "Machine Learning", "从带标签数据中学习映射函数的范式。", []),
    ("无监督学习", "Machine Learning", "从无标签数据中发现结构的范式。", []),
    ("强化学习", "Machine Learning", "智能体通过试错与奖励信号学习策略。", ["RL"]),
    ("迁移学习", "Machine Learning", "将源域知识迁移到目标任务的技术。", []),

    # === Optimization 域 ===
    ("梯度下降", "Optimization", "沿负梯度方向迭代更新参数以最小化损失函数。", ["GD"]),
    ("随机梯度下降", "Optimization", "每步仅用一个样本或小批量估计梯度的变体。", ["SGD"]),
    ("动量法", "Optimization", "引入累积速度项加速收敛、抑制震荡。", ["Momentum"]),
    ("Adam优化器", "Optimization", "结合动量与二阶矩估计的自适应学习率算法。", ["Adam"]),
    ("学习率调度", "Optimization", "训练过程中动态调整学习率的策略。", ["LR Schedule"]),
    ("损失函数", "Optimization", "衡量模型预测与真实值差异的目标函数。", ["Loss", "Cost Function"]),
    ("正则化", "Optimization", "通过约束模型复杂度防止过拟合的技术。", ["L1", "L2", "Dropout"]),

    # === Deep Learning Architectures 域 ===
    ("神经网络", "Deep Learning", "由神经元层级连接构成的可微函数近似器。", ["NN", "MLP"]),
    ("反向传播", "Deep Learning", "利用链式法则逐层计算梯度的核心算法。", ["Backprop"]),
    ("卷积神经网络", "Deep Learning", "利用卷积核提取局部特征的网络结构。", ["CNN"]),
    ("循环神经网络", "Deep Learning", "处理序列数据、具有记忆能力的网络。", ["RNN", "LSTM", "GRU"]),
    ("Transformer", "Deep Learning", "纯注意力架构，彻底取代循环网络。", []),
    ("注意力机制", "Deep Learning", "动态加权聚合序列中相关位置信息的机制。", ["Attention", "Self-Attention"]),
    ("多头注意力", "Deep Learning", "并行多组注意力捕捉不同表示子空间。", ["Multi-Head Attention"]),
    ("位置编码", "Deep Learning", "为序列位置注入顺序信息的编码方案。", ["Positional Encoding"]),
    ("残差连接", "Deep Learning", "恒等映射短路缓解深层网络梯度消失。", ["Residual", "Skip Connection"]),
    ("层归一化", "Deep Learning", "对特征维度归一化稳定训练的技术。", ["LayerNorm"]),

    # === NLP / LLMs 域 ===
    ("大语言模型", "NLP", "大规模预训练、具备涌现能力的语言模型。", ["LLM"]),
    ("预训练", "NLP", "在大规模语料上自监督学习通用表示的阶段。", ["Pre-training"]),
    ("微调", "NLP", "在下游任务数据上继续训练适配特定任务。", ["Fine-tuning", "SFT"]),
    ("指令微调", "NLP", "用指令-响应对齐模型行为的微调范式。", ["IFT"]),
    ("RLHF", "NLP", "基于人类反馈的强化学习对齐人类偏好。", ["Reinforcement Learning from Human Feedback"]),
    ("上下文学习", "NLP", "模型在推理时利用上下文示例泛化新任务。", ["In-Context Learning", "Few-Shot"]),
    ("思维链", "NLP", "引导模型逐步推理提升复杂任务表现。", ["Chain-of-Thought", "CoT"]),

    # === Computer Vision 域 ===
    ("计算机视觉", "Computer Vision", "让机器理解图像与视频内容的学科。", ["CV"]),
    ("图像分类", "Computer Vision", "将输入图像映射到预定义类别标签。", ["Classification"]),
    ("目标检测", "Computer Vision", "定位图像中目标的边界框与类别。", ["Detection"]),
    ("语义分割", "Computer Vision", "为每个像素分配语义类别的密集预测任务。", ["Segmentation"]),
    ("视觉Transformer", "Computer Vision", "将 Transformer 应用于图像块序列的架构。", ["ViT"]),
]

# 笔记定义：(标题, 正文)
# 这些创建为 Note（Document 层），通过 wikilink 引用上述纯概念
NOTES = [
    ("机器学习概览",
     "# 机器学习概览\n\n研究如何让计算机从数据中学习规律。\n\n"
     "核心范式：\n- [[监督学习]]\n- [[无监督学习]]\n- [[强化学习]]\n\n"
     "核心优化方法是[[梯度下降]]，工程上最常用[[Adam优化器]]。\n\n"
     "模型结构：见 [[Transformer]]\n"
     "训练基础：[[反向传播]]\n"
     "关键超参数：[[学习率调度]] · 目标：最小化[[损失函数]]\n"),
    ("深度学习架构",
     "# 深度学习架构\n\n核心组件：\n- [[神经网络]]\n- [[卷积神经网络]]\n- [[循环神经网络]]\n- [[Transformer]]\n\n"
     "关键技术：\n- [[注意力机制]] 与 [[多头注意力]]\n- [[位置编码]] 注入顺序信息\n- [[残差连接]] 与 [[层归一化]] 稳定深层训练\n"),
    ("大语言模型训练",
     "# 大语言模型训练流程\n\n阶段：\n1. [[预训练]] — 大规模语料自监督学习\n2. [[指令微调]] / [[SFT]] — 对齐指令遵循能力\n3. [[RLHF]] — 基于人类偏好对齐\n\n"
     "推理能力增强：\n- [[思维链]] 引导逐步推理\n- [[上下文学习]] 零样本/小样本泛化\n"),
    ("优化算法详解",
     "# 优化算法详解\n\n基本：\n- [[梯度下降]] 与 [[随机梯度下降]]\n- [[动量法]] 加速收敛\n\n进阶：\n- [[Adam优化器]] 自适应学习率\n- [[学习率调度]] 余弦退火/ Warmup\n- [[正则化]] 防止过拟合\n"),
]

# 本脚本创建的笔记/概念允许在重跑时刷新内容（只限白名单标题）
OWNED_CONCEPT_TITLES = {t for t, _, _, _ in PURE_CONCEPTS}
OWNED_NOTE_TITLES = {t for t, _ in NOTES}

# 概念 → 学习事件序列：制造掌握度分布层次（中/弱/未触碰），Universe 才有色彩。
# 仅纯概念可在此挂事件。
EVENT_PLAN = {
    "注意力机制": [("explain", None), ("answer_correct", "knowledge")],
    "损失函数": [("answer_wrong", "knowledge")],   # 弱项：进复习队列前列
    "学习率调度": [],                               # 留作 UNKNOWN 态对照
    "梯度下降": [("answer_correct", "knowledge")],
    "Adam优化器": [("answer_correct", "practice")],
    "Transformer": [("explain", None), ("answer_correct", "transfer")],
    "反向传播": [("answer_correct", "knowledge")],
    "预训练": [("answer_correct", "knowledge")],
    "微调": [("answer_correct", "practice")],
    "RLHF": [("answer_correct", "transfer")],
}


def main() -> int:
    client = TestClient(create_app())

    # 1. 先创建纯概念（不创建同名笔记，origin=manual）
    print("=== 创建纯概念 ===")
    created_concepts = []
    for title, domain, summary, aliases in PURE_CONCEPTS:
        exists = any(c["title"] == title
                     for c in client.get("/api/v1/concepts").json()["concepts"])
        if exists:
            if title in OWNED_CONCEPT_TITLES:
                concept_id = next(c["id"] for c in
                                  client.get("/api/v1/concepts").json()["concepts"]
                                  if c["title"] == title)
                r = client.patch(f"/api/v1/concepts/{concept_id}",
                                 json={"domain": domain, "summary": summary, "aliases": aliases})
                assert r.status_code == 200, f"{title}: {r.text}"
                print(f"concept refreshed: {title} [{domain}]")
            else:
                print(f"skip concept (exists): {title}")
            continue
        r = client.post("/api/v1/concepts", json={
            "title": title, "domain": domain, "summary": summary, "aliases": aliases, "origin": "manual"
        })
        assert r.status_code == 201, f"{title}: {r.status_code} {r.text}"
        created_concepts.append(title)
        print(f"concept created: {title} [{domain}]")

    # 2. 再创建笔记（通过 wikilink 引用纯概念，索引管线会复用现有 concept）
    print("\n=== 创建笔记 ===")
    for title, body in NOTES:
        exists = any(n["title"] == title
                     for n in client.get("/api/v1/notes").json()["notes"])
        if exists:
            if title in OWNED_NOTE_TITLES:
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
        print(f"note created: {title}")

    # 3. 为纯概念播种学习事件
    print("\n=== 播种学习事件 ===")
    graph = client.get("/api/v1/graph").json()
    cid = {n["title"]: n["ref_id"] for n in graph["nodes"] if n["type"] == "concept"}

    for title, events in EVENT_PLAN.items():
        concept_id = cid.get(title)
        if concept_id is None:
            print(f"WARN concept missing: {title}")
            continue
        for event_type, dimension in events:
            r = client.post("/api/v1/events", json={
                "concept_id": concept_id, "event_type": event_type,
                "dimension": dimension})
            assert r.status_code == 201, r.text
        print(f"events seeded: {title} ({len(events)})")

    # 4. 统计
    import sqlite3
    from app.db import db_path
    conn = sqlite3.connect(db_path())
    concepts_count = conn.execute("SELECT count(*) FROM concepts WHERE origin='manual'").fetchone()[0]
    notes_count = conn.execute("SELECT count(*) FROM notes").fetchone()[0]
    due = conn.execute("SELECT count(*) FROM review_queue WHERE status='pending'").fetchone()[0]
    conn.close()
    print(f"\n=== 统计 ===")
    print(f"纯概念: {concepts_count}")
    print(f"笔记: {notes_count}")
    print(f"待复习: {due}")

    print("\n完成。刻意未预置：MindMap（请亲手创建体验）、同步冲突 artifact。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())