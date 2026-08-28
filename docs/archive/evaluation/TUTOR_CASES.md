# Tutor Evaluation Cases

> 20 个评估案例，覆盖 4 模式 × 5 场景。

---

## Scenario A: Basic Concept（基础概念）

已有概念：`Gradient Descent`（mastery: 0.35）

### A1 — Explain

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

### A2 — Hint

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

### A3 — Review

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

### A4 — Transfer

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

### A5 — Weak Mastery

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

## Scenario B: Chinese Language（中文语言）

### B1 — Explain（中文）

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

### B2 — Hint（中文）

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

### B3 — Mixed Language

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

### B4 — Review（中文）

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

### B5 — Non-existent Concept（中文）

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

## Scenario C: Edge Cases（边界情况）

### C1 — Empty Query

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

### C2 — Very Long Query

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

### C3 — No Mastery Data

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

### C4 — Debug Mode Fallback

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

### C5 — Concurrent Requests

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

## Scenario D: Prohibition Tests（禁止行为）

### D1 — LLM No DB Write

验证 TutorService 不包含任何 SQL 写操作：

```python
# 检查 ai/service.py 源码
assert "INSERT" not in source
assert "UPDATE" not in source
assert "DELETE" not in source
assert "CREATE TABLE" not in source
```

### D2 — LLM No Mastery Modify

验证 TutorService 不直接修改 concept_mastery：

```python
# 检查 ai/service.py 源码
assert "concept_mastery" not in source
```

### D3 — LLM No Event Create

验证 TutorService 不直接创建 learning_event：

```python
# 检查 ai/service.py 源码
assert "learning_events" not in source
```

### D4 — Provider Isolation

验证 Provider 不包含 LLM 厂商特定导入：

```python
# 检查 ai/providers/base.py
assert "import openai" not in source
assert "import anthropic" not in source
```

### D5 — Prompt Purity

验证 build_prompt() 无副作用：

```python
# 已由 test_ai_boundary.py G1-02 覆盖
# 此处确认无文件 I/O、无网络、无 datetime.now
```

---

## Scenario E: Learning Loop Integration（学习闭环）

### E1 — Answer Correct → Event → Mastery

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

### E2 — Answer Wrong → Mastery Drop

```json
// 1. 记录 mastery_before
// 2. 用户回答错误
POST /api/v1/review/<concept_id>/answer  → quality: 1
// 3. 验证 mastery 下降
assert mastery_after < mastery_before
```

### E3 — Review Queue Priority

```json
// 1. 创建 concept，多次回答错误
POST /api/v1/events  → answer_wrong × 3

// 2. 检查 review_queue
GET /api/v1/review/today  → concept 在队列中

// 3. Tutor review 模式
POST /api/v1/tutor/test  → mode: "review"
// 验证输出引用 review_queue 数据
```

### E4 — Multi-Concept Learning Path

```json
// 1. 创建 A → B → C 链式概念
// 2. 只学 A，不学 B
// 3. Tutor explain C
// 验证输出可能建议先学 B
```

### E5 — Event Replay Integrity

```json
// 1. 产生 10 个 learning events
// 2. 重建 concept_mastery（从 events）
// 3. 比对：direct mastery vs replayed mastery
assert direct == replayed
```
