# Tutor Context Data Model

> AI Tutor 可见的数据契约。冻结 AI 看到什么、看不到什么。
> 配合 `ADR-014`（AI Tutor Architecture）使用。

---

## 1. Context API

```
GET /api/v1/tutor/context/{concept_id}
```

返回：
```json
{
  "concept": {
    "id": 1,
    "title": "特征值",
    "definition": "矩阵 A 的特征值 λ 满足 det(A-λI)=0"
  },
  "mastery": {
    "knowledge": 0.35,
    "practice": 0.20,
    "recall": 0.50,
    "transfer": 0.10,
    "effective": 0.305
  },
  "mistakes": [
    {
      "id": 1,
      "question": "矩阵乘法维度",
      "wrong_answer": "2x2 * 2x2 = 2x2",
      "created_at": "2026-08-25T10:00:00"
    }
  ],
  "review": {
    "next_review": "2026-09-01",
    "last_result": "wrong",
    "ease_factor": 1.8,
    "interval": 3
  },
  "related": [
    {"id": 2, "title": "矩阵", "type": "concept"},
    {"id": 3, "title": "线性变换", "type": "concept"}
  ],
  "recent_events": [
    {"event_type": "answer_wrong", "source": "review", "created_at": "2026-08-27T09:00:00"},
    {"event_type": "explain", "source": "tutor", "created_at": "2026-08-26T14:00:00"}
  ]
}
```

## 2. AI 可见字段

| 层 | 字段 | 用途 |
|---|---|---|
| Concept | id, title, definition | 理解用户在学什么 |
| Mastery | 四维 + effective | 判断薄弱维度 |
| Mistakes | question, wrong_answer | 针对性讲解 |
| Review | next_review, last_result, ease, interval | 判断复习紧迫性 |
| Related | title, type (1-hop) | 关联知识引导 |
| Events | event_type, source, created_at | 学习轨迹 |

## 3. AI 不可见字段（黑名单）

| 数据 | 原因 |
|---|---|
| vault 全文 | 隐私 + token 预算 |
| 全部聊天记录 | 隐私 + 上下文过长 |
| .env / API key | 安全 |
| 其他用户数据 | 隐私 |
| SQLite 结构 | 防注入 |
| settings 表 | 含 API key |

## 4. Context Snapshot

每次 AI 调用产出 `context_json` 快照，随消息落库：

```json
{
  "concept_id": 1,
  "question": "为什么我不会特征值？",
  "context": { ... 上面的 context ... },
  "model": "deepseek-chat",
  "created_at": "2026-08-27T10:00:00"
}
```

用途：
- 上下文透视 UI（用户看到 AI 看到了什么）
- 审计（为什么 AI 给了这个回答）
- 调试（context 质量评估）

## 5. Token 预算

| 组成 | 预算 |
|---|---|
| System prompt | ~500 tokens |
| Context snapshot | ~1000 tokens |
| User question | ~200 tokens |
| **Total input** | **~1700 tokens** |
| Response | ~1000 tokens |

总计 < 3000 tokens/次，兼容所有模型。

## 6. 错误处理

| 场景 | 处理 |
|---|---|
| Concept 不存在 | 返回 404 + 错误信息 |
| LLM 超时 | 重试 1 次，失败返回错误 |
| LLM 返回空 | 返回兜底提示 |
| Context 过大 | 截断 recent_events |
| API key 无效 | 返回 settings 错误 |
