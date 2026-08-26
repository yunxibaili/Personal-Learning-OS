# ADR-010: AI Context Architecture（提示词组装唯一管线）

日期：2026-08-26 · 状态：Accepted（自 M4 起强制）

## Context

AI 功能将持续增加：记忆感知问答(M4)、自动链接(M4)、导图生成(M4)、
错题分析(extractor)、未来 RAG、UpMark 错题流、trace 示例生成(M10)。
若无统一管线，每个功能各拼 prompt → 上下文不可审计、重复实现、安全规则漂移。

## Decision

**Router 永不直连 LLM。** 一切 AI 调用经过唯一管线：

```
Request
  ↓
Context Builder (core/ai/context.py)      ← 唯一的提示词组装点
  ├─ 图谱查询（相关实体 + 前置链，递归 CTE）
  ├─ 掌握度 effective + 近期 events
  ├─ 未解决 mistakes
  ├─ memories（importance × 新近度）
  └─ [未来] RAG 检索片段 —— 只是给 Builder 增加一个数据源，不是新管线
  ↓
Prompt Assembly（预算控制、system 人设、上下文快照 context_json）
  ↓
llm.py（OpenAI-compatible SSE）
  ↓
Response Post-Processor（extractor 等，同样经 Builder 组装）
```

## Rules

1. `routers/*` 只允许 import `core/ai/tutor.py` 或显式的 builder 入口，**禁止 import llm.py**
2. 每次组装产出 context_json 快照（上下文透视 UI 与审计依据），随消息落库
3. 敏感过滤（network-boundary 黑名单）在 Builder 内集中执行，禁止散落各处
4. 未来所有 AI 功能（含插件形态）复用本管线；确需旁路必须先开 ADR

## Alternatives Considered

- 各功能自带 prompt 组装：上下文黑盒、无法透视、安全规则易漏
- LangChain 式框架：AGENTS 永久禁令（黑盒编排）

## Consequences

- context.py 成为高价值单点：改动需测试覆盖（快照结构契约测试）
- 新 AI 功能的边际成本趋近于"声明需要哪些数据源"
