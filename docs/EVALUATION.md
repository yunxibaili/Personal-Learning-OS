# Evaluation — Tutor 评估体系

> AI Tutor 的评估方法、指标与用例集。合并自原 `docs/evaluation/` 下的多份文档。

---

## 目录

1. [Tutor Evaluation Plan](#1-tutor-evaluation-plan)
2. [Tutor Evaluation Metrics](#2-tutor-evaluation-metrics)
3. [Tutor Evaluation Cases](#3-tutor-evaluation-cases)

---

## 1. Tutor Evaluation Plan

> 验证 AI Tutor 是否真的帮助学习，不只是能查询知识库。

---

### 1. 目标

M4-A/B/C/D 验证了**管线通了**。
M4-E 验证**效果成立**。

核心问题：

```
Tutor Answer → Learning Improvement → Event Generated → Mastery Change
```

如果这条链路不成立，Tutor 只是"一个能读知识库的 AI 查询窗口"。

### 2. 评估维度

| 维度 | 权重 | 说明 |
|---|---|---|
| Concept Relevance | 30% | 回答是否引用已有概念 |
| Mastery Awareness | 25% | 是否结合掌握度调整输出 |
| Action Safety | 20% | 是否遵守 AI 写入边界 |
| Language Fidelity | 15% | 是否跟随 query 语言 |
| Pedagogical Quality | 10% | 解释/引导/复习质量 |

### 3. 评估流程

#### Phase 1: 静态验证（自动化）

- 禁止行为测试：LLM 不写 DB
- Context 隔离测试：敏感数据不进 prompt
- Prompt 纯函数测试：build_prompt() 确定性输出

#### Phase 2: 案例测试（半自动）

- 20 个知识问题（4 模式 × 5 场景）
- MockProvider 验证结构正确性
- 真实 Provider 验证内容质量

#### Phase 3: 学习闭环测试（手动）

- 用户回答 Tutor 建议的复习题
- 验证 learning_event 产生
- 验证 mastery 变化

### 4. 通过标准

| 指标 | 阈值 |
|---|---|
| 概念相关性 | ≥ 80% 案例引用正确 concept |
| 掌握度感知 | ≥ 70% 案例体现 mastery 差异 |
| 禁止行为 | 100% 不写 DB |
| 语言跟随 | 100% 中文输入 → 中文输出 |
| 结构完整性 | 100% 返回 answer + metadata |

### 5. 不在范围

- LLM 输出的"知识正确性"（依赖模型能力）
- 用户主观满意度（需要用户测试）
- 性能基准（留给 Gate 2）

---

## 2. Tutor Evaluation Metrics

> 量化 Tutor 效果的指标体系。

---

### 1. 结构指标（可自动化）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| response_complete | 返回 answer + metadata | 100% | API 测试 |
| concept_relevance | answer 引用 concept title | ≥ 80% | 字符串匹配 |
| mode_correctness | metadata.mode == 请求 mode | 100% | API 测试 |
| provider_swap | 切换 provider 不影响结构 | 100% | Mock vs Real |

### 2. 安全指标（可自动化）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| no_db_write | LLM 不写 SQLite | 100% | 源码扫描 |
| no_mastery_modify | LLM 不改 concept_mastery | 100% | 源码扫描 |
| no_event_create | LLM 不建 learning_event | 100% | 源码扫描 |
| no_secret_leak | api_key/password 不进 prompt | 100% | Gate 1 测试 |
| timeout_enforced | 30s 超时生效 | 100% | Mock 超时测试 |

### 3. 语言指标（可半自动）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| zh跟随 | 中文 query → 中文输出 | 100% | 关键词检测 |
| en跟随 | 英文 query → 英文输出 | ≥ 90% | 关键词检测 |
| mixed跟随 | 混合 query → 跟随主语言 | ≥ 80% | 人工判断 |

### 4. 学习指标（需人工/半自动）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| mastery_aware | 低掌握度 → 更详细解释 | ≥ 70% | A/B 对比 |
| weakness_exposed | 输出提及用户错误点 | ≥ 60% | 案例审查 |
| related_suggested | 建议复习相关概念 | ≥ 50% | 案例审查 |
| review_prompted | review 模式引用复习队列 | ≥ 80% | 案例审查 |

### 5. 反模式检测

| 反模式 | 检测方法 | 阈值 |
|---|---|---|
| 幻觉 | 回答不存在的概念 | 0% |
| 万能回答 | 所有 query 返回相同内容 | 0% |
| 废话 | 回答无实质信息 | < 10% |
| 越界 | LLM 尝试修改数据 | 0% |

### 6. 综合评分

```
Score = 0.30 × Structure
      + 0.25 × Safety
      + 0.20 × Learning
      + 0.15 × Language
      + 0.10 × Pedagogy
```

**通过阈值：** Score ≥ 0.75

### 7. 持续评估

- 每个里程碑后运行 20 案例
- Gate 1 安全测试每次必跑
- 新增 Provider 时重新评估语言指标
- 真实 Provider 接入后增加人工审查

---

## 3. Tutor Evaluation Cases

> 20 个评估案例，覆盖 4 模式 × 5 场景。

---

### Scenario A: Basic Concept（基础概念）

已有概念：`Gradient Descent`（mastery: 0.35）

#### A1 — Explain

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "Explain gradient descent",
  "mode": "explain"
}
```

**检查项：**
- 回答包含 concept title
- 提及相关概念（learning rate, optimization）
- 不重新发明已有知识

#### A2 — Hint

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "I don't understand gradient descent",
  "mode": "hint"
}
```

**检查项：**
- 不直接给完整解释
- 给出引导性问题
- 例如 "What happens if learning rate is too large?"

#### A3 — Review

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "Review gradient descent",
  "mode": "review"
}
```

**检查项：**
- 读取 review_queue 数据
- 输出包含复习提示
- 可能建议 review 相关概念

#### A4 — Transfer

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "How is gradient descent similar to binary search?",
  "mode": "explain"
}
```

**检查项：**
- 调用 related concepts
- 产生类比解释
- 不只是独立解释

#### A5 — Weak Mastery

已有概念：`Backpropagation`（mastery: 0.10，低掌握度）

```json
{
  "concept_id": "<backpropagation_id>",
  "query": "Explain backpropagation",
  "mode": "explain"
}
```

**检查项：**
- Context 中 mastery.effective < 0.3
- 回答是否更详细/更基础
- 是否建议先复习前置概念

---

### Scenario B: Chinese Language（中文语言）

#### B1 — Explain（中文）

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "解释梯度下降",
  "mode": "explain"
}
```

**检查项：**
- 输出为中文
- 不重新创造概念
- 引用已有 concept title（可保留英文）

#### B2 — Hint（中文）

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "我不理解梯度下降",
  "mode": "hint"
}
```

**检查项：**
- 中文引导
- 不给答案

#### B3 — Mixed Language

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "Explain 梯度下降",
  "mode": "explain"
}
```

**检查项：**
- 跟随 query 语言（中英混合时以主要语言为准）
- 不强制英文

#### B4 — Review（中文）

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "复习梯度下降",
  "mode": "review"
}
```

**检查项：**
- 中文复习提示
- 读取 review_queue

#### B5 — Non-existent Concept（中文）

```json
{
  "concept_id": 99999,
  "query": "解释量子计算",
  "mode": "explain"
}
```

**检查项：**
- 返回 404
- 不幻觉出不存在的概念

---

### Scenario C: Edge Cases（边界情况）

#### C1 — Empty Query

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "",
  "mode": "explain"
}
```

**检查项：**
- 返回错误或默认行为
- 不崩溃

#### C2 — Very Long Query

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "<10000 chars of text>",
  "mode": "explain"
}
```

**检查项：**
- 截断到 token 限制
- 不崩溃
- 返回有效 response

#### C3 — No Mastery Data

已有概念：`NewConcept`（无 learning_events）

```json
{
  "concept_id": "<new_concept_id>",
  "query": "Explain this",
  "mode": "explain"
}
```

**检查项：**
- Context 中 mastery 为 null 或默认值
- 回答不过度依赖 mastery 信息
- 不崩溃

#### C4 — Debug Mode Fallback

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "Explain this",
  "mode": "debug"
}
```

**检查项：**
- debug 模式 fallback 到 explain
- metadata 中标记 fallback
- 不崩溃

#### C5 — Concurrent Requests

同时发送 5 个相同 concept 的请求：

```json
{
  "concept_id": "<gradient_descent_id>",
  "query": "Explain",
  "mode": "explain"
}
```

**检查项：**
- 全部返回 200
- 无数据库锁冲突
- 响应时间 < 5s（MockProvider）

---

### Scenario D: Prohibition Tests（禁止行为）

#### D1 — LLM No DB Write

验证 TutorService 不包含任何 SQL 写操作：

```python
# 检查 ai/service.py 源码
assert "INSERT" not in source
assert "UPDATE" not in source
assert "DELETE" not in source
assert "CREATE TABLE" not in source
```

#### D2 — LLM No Mastery Modify

验证 TutorService 不直接修改 concept_mastery：

```python
# 检查 ai/service.py 源码
assert "concept_mastery" not in source
```

#### D3 — LLM No Event Create

验证 TutorService 不直接创建 learning_event：

```python
# 检查 ai/service.py 源码
assert "learning_events" not in source
```

#### D4 — Provider Isolation

验证 Provider 不包含 LLM 厂商特定导入：

```python
# 检查 ai/providers/base.py
assert "import openai" not in source
assert "import anthropic" not in source
```

#### D5 — Prompt Purity

验证 build_prompt() 无副作用：

```python
# 已由 test_ai_boundary.py G1-02 覆盖
# 此处确认无文件 I/O、无网络、无 datetime.now
```

---

### Scenario E: Learning Loop Integration（学习闭环）

#### E1 — Answer Correct → Event → Mastery

```json
// 1. 记录当前 mastery
GET /api/v1/tutor/context/<concept_id>  → mastery_before

// 2. 用户回答正确
POST /api/v1/review/<concept_id>/answer  → quality: 5

// 3. 验证 event 产生
GET /api/v1/review/history  → last_event = answer_correct

// 4. 验证 mastery 变化
GET /api/v1/tutor/context/<concept_id>  → mastery_after
assert mastery_after > mastery_before
```

#### E2 — Answer Wrong → Mastery Drop

```json
// 1. 记录 mastery_before
// 2. 用户回答错误
POST /api/v1/review/<concept_id>/answer  → quality: 1
// 3. 验证 mastery 下降
assert mastery_after < mastery_before
```

#### E3 — Review Queue Priority

```json
// 1. 创建 concept，多次回答错误
POST /api/v1/events  → answer_wrong × 3

// 2. 检查 review_queue
GET /api/v1/review/today  → concept 在队列中

// 3. Tutor review 模式
POST /api/v1/tutor/test  → mode: "review"
// 验证输出引用 review_queue 数据
```

#### E4 — Multi-Concept Learning Path

```json
// 1. 创建 A → B → C 链式概念
// 2. 只学 A，不学 B
// 3. Tutor explain C
// 验证输出可能建议先学 B
```

#### E5 — Event Replay Integrity

```json
// 1. 产生 10 个 learning events
// 2. 重建 concept_mastery（从 events）
// 3. 比对：direct mastery vs replayed mastery
assert direct == replayed
```

