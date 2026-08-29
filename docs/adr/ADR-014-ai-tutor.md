# ADR-014: AI Tutor Architecture

**状态**：已批准（2026-08-27）
**决策者**：项目负责人
**关联**：ADR-003（LLM 接入）· ADR-009（Entity vs Document）· ADR-010（AI Context Architecture）· ADR-012（Omniscience Mode）· M4

---

## 1. Problem

M4 引入 LLM，是项目从确定性系统进入概率性系统的关键节点。

核心风险：
- AI 变成套 API 的聊天机器人，破坏产品定位
- LLM 直接修改数据库，绕过 event 系统
- Prompt 组装散落各处，不可审计
- 上下文黑盒，无法透视 AI 看到了什么

需要一份架构级约束，冻结 AI Tutor 的边界。

## 2. Decision

### 2.1 定位

```
Tutor is a context-aware learning assistant, not a general chatbot.
```

AI Tutor 是理解用户学习状态的教学助手，不是万能聊天机器人。

### 2.2 架构边界

```
         User
          |
          v
      AI Tutor
          |
    -----------------
    |               |
Context Builder    LLM
    |
    |
Knowledge Layer
    |
    +-- Notes (Markdown)
    +-- Concepts
    +-- Mastery (四维掌握度)
    +-- Mistakes (错误记录)
    +-- Review Queue
    +-- Learning Events
```

### 2.3 读写边界（铁律）

**LLM 永远不能：**
- 写数据库
- 修改 mastery
- 创建 concept
- 改 review_queue
- 直接调用 SQLite

**LLM 只能：**
- 读取 Context（由 Context Builder 提供）
- 生成 Response（文本）
- 提出 Action Suggestion（建议，不执行）

**所有写入必须经过 event 系统：**
```
用户行为 → learning_event → mastery calculation → state update
```

### 2.4 数据流

```
用户提问
  ↓
Router (/api/v1/tutor/ask)
  ↓
Context Builder (core/ai/context.py)
  ├─ 查询 concept + mastery
  ├─ 查询 mistakes
  ├─ 查询 review status
  ├─ 查询 related concepts (graph)
  ├─ 查询 recent events
  └─ 组装 context snapshot
  ↓
Prompt Assembly (core/ai/tutor.py)
  ├─ System prompt (教学规则)
  ├─ Context snapshot
  └─ User question
  ↓
LLM Provider (core/ai/llm.py)
  ├─ OpenAI-compatible HTTP
  ├─ SSE streaming
  └─ 重试 + 超时
  ↓
Response
  ├─ 直接返回给用户
  └─ context_json 落库（审计）
```

### 2.5 Context 可见性

AI 看到什么（白名单）：
- concept: title, definition
- mastery: 四维分数 + effective
- mistakes: 最近 N 条
- review: next_review, last_result
- related: 图谱邻居（1-hop）
- recent_events: 最近 5 条

AI 看不到什么（黑名单）：
- vault 全文（除非用户明确引用）
- 所有历史聊天记录
- 隐私数据
- .env / API key
- 其他用户数据

### 2.6 Provider 策略

复用 ADR-003：
- 唯一协议：`POST {base_url}/v1/chat/completions`，SSE 流式
- 配置存 settings 表（base_url/api_key/model）
- Python 标准库 `urllib.request` 手写 SSE
- 不绑定模型，用户可切换

### 2.7 M4 子阶段

| 阶段 | 内容 | 依赖 |
|---|---|---|
| M4-A | Tutor Context API | 无 LLM，纯数据层 |
| M4-B | Prompt Assembly Layer | M4-A |
| M4-C | LLM Provider | M4-B |
| M4-D | Tutor UI | M4-C |

### 2.8 Forbidden（M4 阶段）

- RAG / Vector DB / Embedding
- Agent 框架 / Function Calling
- 自动修改知识库
- 自动生成学习计划
- 多 AI 角色
- LangChain / LlamaIndex

理由：先验证核心价值——AI 是否因为知道用户状态而更有帮助。

---

## 附录 §2.8.1：RAG 禁令的 P8 部分解除（2026-08-28）

§2.8 的 Forbidden 限定于「M4 阶段」，属延后型禁止而非自动过期。自 P8 起：

1. **即日生效**：用户显式引用的笔记（≤2 篇确定性片段 ≤600 字符）可进入
   Tutor 上下文——本文 §2.5 既有条款「vault 全文（除非用户明确引用）」的实现。
   实现：POST /api/v1/tutor/context 的 note_ids 参数（TutorPanel 选择器，
   无自动检索）。
2. **本附录解除（已于 2026-08-28 P8-003E 实施）**：FTS5 关键词自动检索
   （core 内手写，复用既有 search_notes + concept 标题/别名检索词）。
   默认关闭（`auto_notes=false`），显式开启时只补显式引用之外的剩余名额。
3. **维持永久禁止**：向量数据库 / Embedding 服务 / LangChain 及一切
   AI 编排框架（AGENTS §2.3），无论任何阶段。

Concept identity source is defined by origin. Visualization layers must
consume origin only. No derived source classification field may become
persistent state.（P8-001A 冻结，此处一并重申）

## 3. Consequences

### 代码结构

```
server/app/core/ai/
├── __init__.py
├── context.py      ← Context Builder（唯一组装点）
├── tutor.py        ← Prompt Assembly + 教学规则
└── llm.py          ← OpenAI-compatible HTTP + SSE
```

### 对现有模块的影响

- `mastery.py` — 只读，不改
- `knowledge.py` — 只读，不改
- `review_scheduler.py` — 只读，不改
- 新增 `routers/tutor.py` — 调用 `core/ai/tutor.py`

### 测试要求

- M4-A：pytest 测试 context API（纯数据，无 LLM 调用）
- M4-B：pytest 测试 prompt assembly（mock context）
- M4-C：集成测试（mock LLM response）
- M4-D：build 验证

### 对 AI 开发的约束

AGENTS §16 已有前端规则。本 ADR 补充后端 AI 规则：
- Router 禁止 import llm.py
- Context Builder 是唯一提示词组装点
- 每次 AI 调用产出 context_json 快照
- 敏感过滤在 Builder 内集中执行

---

## 附录 §2.3.1：LLM 输出 = Action Suggestion 追认（2026-08-29）

§2.3「LLM 永不能写数据库」与 B3 Extractor（LLM 输出落库）的唯一自洽解读，
自 B3 起为本 ADR 的正式解释：

**LLM 输出一律视为 Action Suggestion（本文 §2.3 已允许的形态）；一切落库
动作由确定式代码执行**——代码校验 LLM 输出的结构/枚举/范围后，以自身名义
调用既有 core 写路径（update_mastery / create_concept / memories 写入）。
LLM 从未持有任何写能力，校验失败的建议被丢弃（静默），不影响主对话。

## 附录 §2.6.1：fast_model 对齐（2026-08-29）

§2.6 未列 `llm.fast_model`，而 ADR-003/TECH_DESIGN §6.1 均有——本附录补齐：
`llm.fast_model`（可空，空则回退 `llm.model`）用于 extractor 等辅助调用。
实现于 `core/ai/config.py LLMConfig.fast_model`（B3 前置）。

---

## 附录 §2.5.1：memories 进入上下文白名单（2026-08-29 · B8）

§2.5 白名单新增第 7 类：**memories**（top-N ≤5，importance × 新近度复合排序，
`core/memories.get_memories` 产出）。

- 隐私面处置（保守默认，项目所有者可改判）：content 以
  `SENSITIVE_CONTENT_PREFIXES` 开头的条目**排除出上下文**（保留在库）；
  出口另有 prompt assembly 的双重 sanitize 兜底
- 命中更新：进入 context 的记忆刷新 `last_used_at`（裁决 3 的 B8 侧兑现），
  排序随之从"importance 主导退化态"升级为 importance × recency 复合
- **方案 C 分段预算（B8-R2 裁决）**：memories 段独立 2000 字符预算
  （`constants.MEMORIES_CHAR_BUDGET`），段内超限截断并计入 `truncated`
  上报。方案 B"前置 memories"被实测否决——/chat 场景尾段
  （recent_events ≤3 条 + notes 可空 ≈ 150 字符）不足以吸收全局截断量
  （超预算 ~2500+ 字符），前置后 memories 仍被切
- 去重扫描 `LIMIT 500`（最近 500 条参与去重）：未登记的取舍——超 500 条后
  旧记忆不参与去重，个人规模下可接受，如实登记
- 白名单同步：`docs/DATA_MODEL.md` §C 增列（tutor-context.md 已归档，活契约在 DATA_MODEL）；`shared/types/tutor.ts` 契约同步