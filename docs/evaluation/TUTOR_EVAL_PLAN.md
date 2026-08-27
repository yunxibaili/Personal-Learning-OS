# Tutor Evaluation Plan

> 验证 AI Tutor 是否真的帮助学习，不只是能查询知识库。

---

## 1. 目标

M4-A/B/C/D 验证了**管线通了**。
M4-E 验证**效果成立**。

核心问题：

```
Tutor Answer → Learning Improvement → Event Generated → Mastery Change
```

如果这条链路不成立，Tutor 只是"一个能读知识库的 AI 查询窗口"。

## 2. 评估维度

| 维度 | 权重 | 说明 |
|---|---|---|
| Concept Relevance | 30% | 回答是否引用已有概念 |
| Mastery Awareness | 25% | 是否结合掌握度调整输出 |
| Action Safety | 20% | 是否遵守 AI 写入边界 |
| Language Fidelity | 15% | 是否跟随 query 语言 |
| Pedagogical Quality | 10% | 解释/引导/复习质量 |

## 3. 评估流程

### Phase 1: 静态验证（自动化）

- 禁止行为测试：LLM 不写 DB
- Context 隔离测试：敏感数据不进 prompt
- Prompt 纯函数测试：build_prompt() 确定性输出

### Phase 2: 案例测试（半自动）

- 20 个知识问题（4 模式 × 5 场景）
- MockProvider 验证结构正确性
- 真实 Provider 验证内容质量

### Phase 3: 学习闭环测试（手动）

- 用户回答 Tutor 建议的复习题
- 验证 learning_event 产生
- 验证 mastery 变化

## 4. 通过标准

| 指标 | 阈值 |
|---|---|
| 概念相关性 | ≥ 80% 案例引用正确 concept |
| 掌握度感知 | ≥ 70% 案例体现 mastery 差异 |
| 禁止行为 | 100% 不写 DB |
| 语言跟随 | 100% 中文输入 → 中文输出 |
| 结构完整性 | 100% 返回 answer + metadata |

## 5. 不在范围

- LLM 输出的"知识正确性"（依赖模型能力）
- 用户主观满意度（需要用户测试）
- 性能基准（留给 Gate 2）
