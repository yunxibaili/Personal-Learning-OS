# Learning OS — Full Development Evolution Summary

> 基于 Git history、commit diff、项目文档和当前代码的完整开发演进报告。
> 生成时间：2026-08-29 · HEAD: `14abf86`

---

## 一、Git 历史总览

项目共 **127 个 commit**，时间跨度 **2026-08-26 ~ 2026-08-29**（4天密集开发）。

### 里程碑时间线

| 里程碑 | 时间 | 核心 commit | 状态 |
|--------|------|-------------|------|
| M0 | 08-26 | `eaf668b` `4d93d57` | ✅ |
| M1 | 08-26 | `20dea41` `674ebab` | ✅ |
| M2 | 08-26 | `efd98d8` `a1dbec6` | ✅ |
| M3.5-A | 08-26 | `2143a7d` `0e3da49` | ✅ |
| M3 | 08-26 | `2d5f5d2` | ✅ |
| M5 | 08-27 | `e5a53aa` `1664d84` `c47d86f` | ✅ |
| M4-A~E | 08-27 | `af389f9` ~ `731c3d2` | ✅ |
| M3b | 08-27 | `c519e15` ~ `4a0b330` | ✅ |
| M2b | 08-27 | `24f22ce` `5e45b91` `96e56bf` | ✅ |
| M7 | 08-27 | `dfed663` ~ `e75a16a` | ✅ |
| P8 | 08-27~28 | `3ef5060` ~ `ed1858d` | ✅ |
| P8-003 | 08-28 | `c020e53` ~ `cc9915d` | ✅ |
| B7 | 08-29 | `f6250ea` `5252975` | ✅ |
| B3 | 08-29 | `bdf8ac8` `14abf86` | ✅ |
| B8 | 08-29 | `81b55fa` `4bffb9f` | ✅ |

---

## 二、项目演进时间线

### 阶段 1：项目初始化（M0）
- **时间**：2026-08-26
- **代表 commit**：`eaf668b` `4d93d57`
- **内容**：
  - 后端：FastAPI app package、migration runner、settings API、smoke tests
  - 前端：Vite React-TS shell、Zustand UI store、6 个 placeholder views、API client
- **架构**：Frontend → Router → Database（两层）
- **用户能力**：空壳应用可启动

### 阶段 2：Knowledge CRUD（M1）
- **时间**：2026-08-26
- **代表 commit**：`20dea41` `674ebab`
- **内容**：
  - 后端：notes CRUD + attachments + FTS5 search、core/knowledge indexer、contract tests
  - 前端：TipTap v3 editor（markdown in/out）、note list、debounced autosave、attachment upload
- **架构变化**：引入 `core/` 层（Frontend → Router → Core → Data）
- **数据模型**：`notes`、`notes_fts`、`note_concepts`、`note_links`
- **用户能力**：创建/编辑/搜索笔记

### 阶段 3：Knowledge Graph（M2）
- **时间**：2026-08-26
- **代表 commit**：`efd98d8` `a1dbec6`
- **内容**：
  - 后端：backlinks/graph/promote-stub + test infra
  - 前端：React Flow GraphView + backlinks panel + search
- **数据模型**：`concepts`、`edges`、`links`（ADR-008 统一关系表）
- **用户能力**：知识图谱可视化、概念间关系

### 阶段 4：Knowledge Trigger + Learning Model（M3.5-A + M3）
- **时间**：2026-08-26
- **代表 commit**：`2143a7d` `0e3da49` `2d5f5d2`
- **内容**：
  - M3.5-A：suggest API + Knowledge Trigger Engine + Knowledge Radar component
  - M3：mastery engine、SM-2 scheduler、dashboard
- **数据模型**：`concept_mastery`、`learning_events`、`mistakes`
- **用户能力**：学习状态追踪、SM-2 复习调度

### 阶段 5：Learning Review + Frontend Design（M5）
- **时间**：2026-08-27
- **代表 commit**：`e5a53aa` `1664d84` `c47d86f` `be83ad0`
- **内容**：
  - concept learning state 初始化
  - review API refinement
  - learning timeline in Dashboard
  - ADR-013 Frontend Design System（white-orange theme）
- **架构变化**：确立 Minimal · Clean · Professional · Scientific 设计哲学
- **用户能力**：学习时间线、复习 API

### 阶段 6：AI Tutor 系统（M4）
- **时间**：2026-08-27
- **代表 commit**：`65d7a68` `af389f9` `158aaf2` `66ec822` `731c3d2`
- **内容**：
  - ADR-014 AI Tutor Architecture frozen
  - Tutor Context API（structured learning context for AI）
  - LLM Provider（ProviderProtocol + MockProvider + TutorService）
  - Smoke Test（full pipeline verification endpoint）
  - Tutor Panel（context-aware knowledge assistant）
- **架构变化**：
  - 引入 `core/ai/` 层（AI Boundary）
  - ProviderProtocol 抽象（LLM 厂商无关）
  - TutorService（纯逻辑，无 DB 访问）
- **数据模型**：`conversations`、`messages`
- **用户能力**：AI 辅助学习对话

### 阶段 7：Knowledge Universe（M3b）
- **时间**：2026-08-27
- **代表 commit**：`c519e15` `bcb0ec8` `5336832` `4a0b330`
- **内容**：
  - Universe Projection（GET /api/v1/universe）
  - Universe Layout（React Flow + mastery encoding）
  - Interaction + State Detail（tooltip + detail panel）
  - Navigation Layer（domain tabs + weak area + focus mode）
- **用户能力**：知识宇宙可视化、领域导航

### 阶段 8：MindMap 系统（M2b）
- **时间**：2026-08-27
- **代表 commit**：`24f22ce` `5e45b91` `96e56bf`
- **内容**：
  - MindMap Canvas（CRUD + React Flow + ADR-019 isolation）
  - Concept Binding
  - Export/Import + ADR-021 MindMap Exchange Format v1
- **数据模型**：`mind_maps`、`mind_map_nodes`、`mind_map_edges`
- **用户能力**：思维导图编辑、概念绑定、导入导出

### 阶段 9：Sync 系统（M7）
- **时间**：2026-08-27
- **代表 commit**：`dfed663` `679dc3a` `117fcca` `76caddb` `bb5ff3a` `e75a16a`
- **内容**：
  - M7-001 Sync Engine Core
  - M7-002 LAN Discovery
  - M7-003 Sync Transport
  - M7-004 Sync Apply Layer
  - M7-005 Sync Conflict UI
  - M7-006 E2E LAN Demo
- **架构变化**：引入 Sync Layer（device identity、manifest、diff、apply）
- **用户能力**：多设备同步、局域网发现

### 阶段 10：P8 产品化
- **时间**：2026-08-27~28
- **代表 commit**：`3ef5060` `5b3b09c` `7918d5e` `ed1858d` `c020e53` `23b27ba` `38208ef` `2c6b8d1`
- **内容**：
  - P8-001A Concept Foundation（origin-only concept CRUD）
  - P8-001B Knowledge Universe V2（spatial knowledge planet）
  - P8-001C Knowledge Planet（cobe globe）
  - P8-002 Graph V2（dagre layout + dual nodes + layer toggle + inspector）
  - P8-003A Review Session MVP（connect SM2 learning loop）
  - P8-003B Mastery Decay（Ebbinghaus time-based effectiveness）
  - P8-003C Vault Reindex（Markdown→SQLite index recovery）
  - P8-003D Eventlog Producer（ADR-020 闭合）
- **数据模型**：`event_uuid` column（migration 007）
- **用户能力**：概念 CRUD、知识星球、dagre 布局、复习会话、遗忘曲线、事件日志

### 阶段 11：B7/B3/B8 AI Memory 系统
- **时间**：2026-08-29
- **代表 commit**：`5252975` `f6250ea` `81b55fa` `4bffb9f` `bdf8ac8` `14abf86`
- **内容**：
  - B1a OpenAICompatProvider（settings-driven, no credentials needed）
  - B7 conversation persistence + minimal non-streaming chat endpoint
  - B8 memories into tutor context（composite ordering, sensitive exclusion, hit refresh）
  - B8-R2 segmented memory budget
  - B3 Extractor v1 → v2（memories producer + concept suggestions + update_mastery chain）
- **架构变化**：
  - Extractor 作为独立 LLM 调用（fast_model）
  - Memories 生产者/消费者闭环
  - 敏感内容双层防御（context 层 + prompt 层）
- **用户能力**：对话持久化、用户记忆、AI 自动提取

---

## 三、最重要的 Commit 分组

### M0 — 项目骨架
- `eaf668b` feat(server): FastAPI app package, migration runner, settings API, smoke tests
- `4d93d57` feat(web): Vite React-TS shell, Zustand UI store, 6 placeholder views

### M1 — Knowledge CRUD
- `20dea41` feat(server): notes CRUD + attachments + FTS5 search
- `674ebab` feat(web): TipTap v3 editor with markdown in/out

### M2 — Knowledge Graph
- `efd98d8` feat(server): backlinks/graph/promote-stub + test infra
- `a1dbec6` feat(web): React Flow GraphView + backlinks panel
- `85c6631` ADR-008 graph model freeze（Node=Entity, unified links table）

### M3 — Learning System
- `2d5f5d2` feat(M3): mastery engine, SM-2 scheduler, dashboard

### M4 — AI Tutor
- `65d7a68` ADR-014 AI Tutor Architecture frozen
- `af389f9` feat(M4-A): Tutor Context API
- `158aaf2` feat(M4-C): LLM Provider（ProviderProtocol + MockProvider）
- `731c3d2` feat(M4-D): Tutor Panel

### M5 — Learning Review
- `e5a53aa` feat(M5-001): concept learning state initialization
- `be83ad0` ADR-013 Frontend Design System

### M3b — Knowledge Universe
- `c519e15` feat(M3b-001): Universe Projection
- `bcb0ec8` feat(M3b-002): Universe Layout（React Flow + mastery encoding）

### M2b — MindMap
- `24f22ce` feat(M2b-001): MindMap Canvas（CRUD + React Flow）
- `3c1ecf6` ADR-019 MindMap Boundary

### M7 — Sync System
- `dfed663` feat(M7-001): Sync Engine Core
- `679dc3a` feat(M7-002): LAN Discovery
- `117fcca` feat(M7-003): Sync Transport
- `76caddb` feat(M7-004): Sync Apply Layer
- `bb5ff3a` feat(M7-005): Sync Conflict UI
- `e75a16a` feat(M7-006): E2E LAN Demo
- `0f5436b` ADR-020 Sync Truth Model frozen

### P8 — Product Experience
- `3ef5060` feat(P8-001A): Concept Foundation
- `5b3b09c` feat(P8-001B): Knowledge Universe V2
- `7918d5e` feat(P8-001C): Knowledge Planet（cobe globe）
- `ed1858d` feat(P8-002): Graph V2（dagre layout）
- `c020e53` feat(P8-003A): Review Session MVP
- `23b27ba` feat(P8-003B): Mastery Decay（Ebbinghaus）
- `38208ef` feat(P8-003C): Vault Reindex
- `2c6b8d1` feat(P8-003D): Eventlog Producer

### B7/B3/B8 — AI Memory
- `5252975` feat(9.1/B1a): OpenAICompatProvider
- `f6250ea` feat(B7): conversation persistence + chat endpoint
- `81b55fa` feat(B8): memories into tutor context
- `bdf8ac8` feat(B3 v1): memories producer + concept suggestions
- `14abf86` feat(B3 v2): memories 生产者 + update_mastery 链 + 快照回写

---

## 四、架构演进

### Architecture V0（M0）
```
Frontend → HTTP → Router → SQLite
```
两层架构，Router 直接访问数据库。

### Architecture V1（M1~M2）
```
Frontend → HTTP → Router → Core → Data
```
引入 `core/` 层，业务逻辑与数据访问分离。

### Architecture V2（M4）
```
Frontend → HTTP → Router → Core → Data
                ↓
            AI Boundary
                ↓
            LLM Provider
```
引入 AI Boundary（`core/ai/`），LLM 请求只允许在 `core/ai/*`。

### Architecture V3（M7）
```
Frontend → HTTP → Router → Core → Data
                ↓
            AI Boundary
                ↓
            LLM Provider

            Sync Layer
                ↓
            Device Identity
            Manifest
            Diff
            Apply
```
引入 Sync Layer（多设备同步）。

### Architecture V4（P8 + B3/B7/B8）
```
Frontend → HTTP → Router → Core → Data
                ↓
            AI Boundary
                ↓
            Context Builder → Prompt Builder → LLM Provider
                ↓
            TutorService
                ↓
            Extractor（fast_model）
                ↓
            Memories / Concept Suggestions / Learning Events

            Sync Layer
                ↓
            Device Identity → Manifest → Diff → Apply
```
引入 Extractor（回合后第二次 LLM 调用）、Memories 生产者/消费者闭环。

### 当前架构（HEAD `14abf86`）
```
四层分离：Frontend(web/) → Backend(routers/) → Core(server/core/) → Data(workspace/)

AI Boundary:
  Context Builder → Prompt Builder → LLM Provider
  TutorService（纯逻辑，无 DB 访问）
  Extractor（fast_model，回合后第二次调用）

Sync Layer:
  Device Identity → Manifest → Diff → Transport → Apply

Learning Layer:
  learning_events → mastery → SM-2 → review_queue → Review Session
  Mastery Decay（Ebbinghaus）
  Eventlog Producer（JSONL）

Memory Layer:
  Memories（upsert_memory + 前缀去重 + 敏感排除）
  Conversations（对话持久化）
  Extractor（memories + concept_suggestions + learning_events）
```

---

## 五、数据模型演进

### Migration 001（M0）
初始 schema：
- `settings` — 配置
- `concepts` — 概念节点
- `edges` — 关系边
- `concept_mastery` — 学习状态
- `learning_events` — 学习事件
- `mistakes` — 错误记录
- `memories` — 用户记忆
- `notes` — 笔记元数据
- `note_concepts` — 笔记↔概念
- `note_links` — 双链边
- `conversations` — 对话
- `messages` — 消息
- `notes_fts` — 全文搜索

### Migration 002（M2）
- `links` 统一关系表（ADR-008）

### Migration 003（M4）
- `concepts.status` 字段（active/unconfirmed/archived）

### Migration 004（M3）
- `concept_mastery` 扩展（SM-2 参数）

### Migration 005（M3）
- `learning_events.quality` 字段

### Migration 006（M2b）
- `mind_maps`、`mind_map_nodes`、`mind_map_edges`

### Migration 007（P8-003D）
- `learning_events.event_uuid` 列 + UNIQUE 索引

### 关键表状态

| 表 | 引入 | 作用 | 当前状态 |
|----|------|------|----------|
| `settings` | M0 | 配置 | ✅ 活跃 |
| `concepts` | M0 | 概念节点 | ✅ 活跃（+status, +origin） |
| `edges` | M0 | 关系边 | ✅ 活跃 |
| `concept_mastery` | M0 | 学习状态 | ✅ 活跃（SM-2 + Decay） |
| `learning_events` | M0 | 学习事件 | ✅ 活跃（+event_uuid） |
| `mistakes` | M0 | 错误记录 | ✅ 活跃 |
| `memories` | M0 | 用户记忆 | ✅ 活跃（B3 生产者） |
| `notes` | M0 | 笔记元数据 | ✅ 活跃 |
| `note_concepts` | M0 | 笔记↔概念 | ✅ 活跃 |
| `note_links` | M0 | 双链边 | ✅ 活跃 |
| `conversations` | M0 | 对话 | ✅ 活跃（B7 持久化） |
| `messages` | M0 | 消息 | ✅ 活跃（+context_json） |
| `notes_fts` | M0 | 全文搜索 | ✅ 活跃 |
| `links` | M2 | 统一关系表 | ✅ 活跃 |
| `mind_maps` | M2b | 思维导图 | ✅ 活跃 |
| `mind_map_nodes` | M2b | 导图节点 | ✅ 活跃 |
| `mind_map_edges` | M2b | 导图边 | ✅ 活跃 |

---

## 六、API 演进

### M0~M1 — 基础 CRUD
- `GET/POST /api/v1/notes` — 笔记 CRUD
- `GET/PUT/DELETE /api/v1/notes/{id}`
- `POST /api/v1/notes/{id}/attachments`
- `GET /api/v1/settings` / `PUT /api/v1/settings`

### M2 — Knowledge Graph
- `GET /api/v1/graph` — 图谱数据
- `POST /api/v1/concepts/{id}/promote-stub`
- `GET /api/v1/notes/{id}/backlinks`

### M3 — Learning
- `POST /api/v1/mastery/{concept_id}/events` — 学习事件
- `GET /api/v1/mastery` — 掌握度列表
- `GET /api/v1/mastery/{concept_id}` — 单概念掌握度

### M3.5-A — Knowledge Trigger
- `GET /api/v1/suggest` — 知识触发

### M4 — AI Tutor
- `POST /api/v1/tutor/context` — Tutor 上下文
- `POST /api/v1/chat` — 对话（B7 持久化）

### M5 — Review
- `GET /api/v1/review/queue` — 复习队列
- `POST /api/v1/review/{concept_id}/answer` — 复习回答

### M3b — Universe
- `GET /api/v1/universe` — 知识宇宙

### M2b — MindMap
- `GET/POST /api/v1/mindmaps` — 导图 CRUD
- `POST /api/v1/mindmaps/{id}/nodes`
- `POST /api/v1/mindmaps/{id}/edges`
- `POST /api/v1/mindmaps/import` / `GET /api/v1/mindmaps/{id}/export`

### M7 — Sync
- `GET /api/v1/sync/status` — 同步状态
- `POST /api/v1/sync/resolve` — 冲突解决

### P8 — Product
- `GET /api/v1/concepts` — 概念列表
- `POST /api/v1/concepts` — 创建概念
- `PATCH /api/v1/concepts/{id}` — 更新概念
- `DELETE /api/v1/concepts/{id}` — 删除概念

### B7/B3 — AI Memory
- `POST /api/v1/chat` — 对话（含 extractor）
- `GET /api/v1/export` — 全量导出（T-EXPORT）

---

## 七、技术栈演进

### 初始（M0）
- **Backend**：Python 3.12 + FastAPI + sqlite3
- **Frontend**：React 18 + TypeScript + Vite 5 + Zustand
- **Database**：SQLite + FTS5

### M1 加入
- TipTap v3（rich text editor）

### M2 加入
- React Flow（@xyflow/react v12）（图谱可视化）

### M3 加入
- SM-2 算法（自研，标准库实现）

### M3b 加入
- d3-force v3（物理布局，仅力计算模块）
- dagre v0.8.5（层次布局）

### P8-001C 加入
- cobe v0.6.5（WebGL globe）

### B1a 加入
- httpx（OpenAI-compatible HTTP client）

### 未使用/考虑过
- Three.js（禁止，AGENTS.md）
- PixiJS（禁止）
- Manim（禁止）
- markmap（禁止）
- LangChain / LlamaIndex（禁止）
- 向量数据库（Phase 3 规划中）

---

## 八、AI 系统演进

### 阶段 1：Context Builder（M4-A）
- `core/tutor_context.py` — 组装 AI Tutor 上下文
- 从 concepts、notes、mistakes、mastery 构建结构化上下文

### 阶段 2：Prompt Builder（M4-C）
- `core/ai/tutor.py` — build_prompt()
- 将 TutorContext 转换为 LLM prompt

### 阶段 3：Provider（M4-C）
- `core/ai/providers/base.py` — LLMProvider Protocol
- `core/ai/providers/mock.py` — MockProvider
- `core/ai/providers/openai_compat.py` — OpenAICompatProvider（B1a）

### 阶段 4：TutorService（M4-C）
- `core/ai/service.py` — TutorService.ask()
- 纯逻辑，无 DB 访问

### 阶段 5：Conversation Persistence（B7）
- `core/conversations.py` — append_message、get_messages
- `routers/conversations.py` — POST /api/v1/chat

### 阶段 6：Memories（B8）
- `core/memories.py` — upsert_memory、get_memories
- 复合排序（importance × 新近度）
- 敏感排除（SENSITIVE_CONTENT_PREFIXES）
- 命中刷新（touch_on_hit）

### 阶段 7：Extractor（B3）
- `core/ai/extractor.py` — run_extractor
- 回合后第二次 LLM 调用（fast_model）
- 提取 memories + concept_suggestions + learning_events
- 落库由确定式代码执行（ADR-014 §2.3.1）

### AI Boundary 演进
1. 最初：Router 直连 LLM
2. M4：引入 `core/ai/` 层，LLM 请求只允许在 `core/ai/*`
3. M4-Gate 1：边界审计（prompt 不含 API key、password、SQLite path）
4. B3：Extractor 也遵循 AI Boundary（fast_model，独立 provider）

---

## 九、学习系统演进

### 最初（M0~M2）
```
learning_events → concept_mastery（手动计算）
```

### M3 — SM-2
```
learning_events → concept_mastery → SM-2 scheduler → review_queue
```
引入 SM-2 算法（ease、interval_days、reps、lapse_count）。

### M5 — Review Session
```
review_queue → Review Session → learning_events → concept_mastery
```
复习会话闭环。

### P8-003A — Review Session MVP
- 连接 SM2 learning loop
- 前端 UI 流程

### P8-003B — Mastery Decay
```
concept_mastery → Ebbinghaus decay → effective_now
```
引入遗忘曲线（tau=14 天）。

### P8-003D — Eventlog Producer
```
learning_events → update_mastery() → JSONL eventlog
```
eventlog 双写（SQLite + JSONL）。

### B3 — Extractor
```
conversation → Extractor（fast_model）→ learning_events → update_mastery()
```
AI 自动提取学习事件。

---

## 十、Knowledge / Graph / Universe / MindMap 演进

### Knowledge
- M0：空表
- M1：notes CRUD + FTS5
- M2：concepts + edges + links（ADR-008 统一关系表）
- M4：concepts.status（active/unconfirmed/archived）
- P8-001A：origin-only concept CRUD

### Graph
- M2：React Flow 基础图谱
- M3b：React Flow + mastery encoding
- P8-002：dagre layout + dual nodes + layer toggle + inspector

### Universe
- M3b-001：Universe Projection（GET /api/v1/universe）
- M3b-002：Universe Layout（React Flow + mastery encoding）
- M3b-003：Interaction + State Detail
- M3b-004：Navigation Layer
- P8-001B：Knowledge Universe V2（spatial knowledge planet）
- P8-001C：Knowledge Planet（cobe globe）

### MindMap
- ADR-019：MindMap Boundary（freeze Universe/MindMap distinction）
- M2b-001：MindMap Canvas（CRUD + React Flow）
- M2b-002：Concept Binding
- M2b-003：Export/Import + ADR-021 MindMap Exchange Format v1

---

## 十一、Sync 系统演进

### M7-001 — Sync Engine Core
- manifest 生成、diff 计算、基础同步逻辑

### M7-001.5 — Sync Simulation Environment
- 模拟环境、测试框架

### M7-002 — LAN Discovery
- 设备发现（UDP broadcast）
- device identity（`metadata/devices.json`）

### M7-003 — Sync Transport
- 文件交换层（HTTP）
- 无 apply/conflict 处理

### M7-003.5 — Documentation & Architecture Sync Audit
- 文档同步审计

### M7-004 — Sync Apply Layer
- 单一写入入口
- 防御性深度（defense-in-depth）
- fail-closed apply

### M7-004.5 — Sync Boundary & Recovery Audit
- 边界审计
- 崩溃恢复测试

### M7-005 — Sync Conflict UI
- 冲突 UI（plan a — mindmap artifacts only）
- .conflict 后缀隔离

### M7-006 — E2E LAN Demo
- 真实两进程同步（loopback）

### M7-006.5 — Sync Release Audit
- M7 稳定发布基线（PASS）

### M7-007 — Vault Conflict Preservation
- vault 冲突 .conflict 副本隔离
- 备份保留最新本地编辑

### 开发中发现并修复的问题
- transport endpoint 缺失
- FileData schema mismatch
- receive 绕过 Apply
- path traversal（fail-closed）
- event merge 去重
- recovery 崩溃恢复
- conflict UI 交互
- LAN E2E 端到端验证

---

## 十二、P8 演进

### P8-001A — Concept Foundation
- origin-only concept CRUD
- VALID_STATUS frozen

### P8-001B — Knowledge Universe V2
- spatial knowledge planet
- d3-force 布局

### P8-001C — Knowledge Planet
- cobe globe（WebGL）
- performance contract

### P8-002 — Graph V2
- dagre layout
- dual nodes（concept + note）
- layer toggle
- inspector

### P8-003A — Review Session MVP
- connect SM2 learning loop
- 前端 UI 流程

### P8-003B — Mastery Decay
- Ebbinghaus time-based effectiveness
- tau=14 天
- effective_now

### P8-003C — Vault Reindex
- Markdown→SQLite index recovery
- reindex_vault 纯函数
- POST /admin/reindex

### P8-003D — Eventlog Producer
- ADR-020 闭合
- update_mastery() → JSONL write
- migration 007 event_uuid

### P8-003E — Review Bridge + Auto Notes
- mistakes 断链修复
- 乙路线 auto_notes

### P8-004 — Demo Cleanup
- 移除测试残留
- 同步文档

---

## 十三、曾经发生过的重大方向变化

### Dashboard → Home
- 原方案：Dashboard 作为主界面
- 最终方案：Home 作为主界面
- 对应：ADR-013 Frontend Design System

### Planet → Knowledge Core
- 原方案：Knowledge Planet 作为核心可视化
- 最终方案：Knowledge Universe + Planet 并存
- 对应：ADR-018 Knowledge Universe

### UI polish 暂停
- 原方案：持续 UI polish
- 最终方案：暂停 UI polish，优先后端
- 对应：`docs/PROJECT_STATE.md` §0 后端优先政策

### Mobile 推迟
- 原方案：M8 Mobile 紧随 M7
- 最终方案：M8 Mobile 推迟在 P8 PC 产品化之后
- 对应：`12b9517` docs: roadmap decision

### Universe / MindMap 边界
- 原方案：Universe 和 MindMap 混合
- 最终方案：ADR-019 冻结 Universe/MindMap distinction
- 对应：`3c1ecf6` ADR-019

### origin vs source_type
- 原方案：source_type 作为来源字段
- 最终方案：origin 作为单一来源字段
- 对应：ADR-008、P8-001A

### Sync Truth Model
- 原方案：SQLite 为真相源
- 最终方案：Markdown 是真相源（ADR-001），SQLite 只存元数据
- 对应：ADR-020

### Tutor 不是 ChatGPT clone
- 原方案：Tutor 作为通用聊天机器人
- 最终方案：Tutor 作为知识工具（ADR-016）
- 对应：`6e93ef4` ADR-016

### Knowledge Mode 优先于 Learning Mode
- 原方案：Learning Mode 优先
- 最终方案：Knowledge Mode 优先（先有知识，再有学习）
- 对应：TASKS.md 优先级

---

## 十四、Bug / Architecture Debt 演进

### 已经修复
1. P0 vault conflict data loss（`d31efce`）
2. P0 设备身份合并（`cc9915d`）
3. P0 migration 007 event_uuid（`cc9915d`）
4. P0 notes.py 连接泄漏（`cc9915d`）
5. B8-R memories rendered into prompt（`12d5574`）
6. B8-R2 segmented memory budget（`4bffb9f`）
7. B3-R7 explain weight=0（`4961d40`）
8. mistakes 断链修复（`e3f76ff`）

### 仍存在
1. event_uuid 目前只写不读（同步去重走 jsonl 的 event_id，消费方待 M8）
2. load_or_create_device() 无内存缓存，devices.json 解析失败时静默生成新 device_id
3. 前端任务冻结（后端优先政策）

---

## 十五、测试体系演进

### M0 — 基础
- pytest ~10 tests（smoke tests）

### M1 — 扩展
- pytest ~30 tests（notes CRUD contract tests）

### M2 — 图谱
- pytest ~50 tests（backlinks/graph tests）

### M3 — 学习
- pytest ~80 tests（mastery/SM-2 tests）

### M4 — AI Tutor
- pytest ~120 tests（context/prompt/provider tests）

### M5 — Review
- pytest ~150 tests（review queue tests）

### M7 — Sync
- pytest ~300 tests（sync engine/discovery/transport/apply tests）

### P8 — Product
- pytest ~450 tests（concept/graph/universe/mindmap tests）

### B3/B7/B8 — AI Memory
- pytest 552 tests（extractor/memories/conversations tests）

### 测试类型
- Unit：`tests/unit/`
- API：`tests/api/`
- Integration：`tests/integration/`
- Smoke：`tests/test_smoke.py`、`tests/test_tutor_smoke.py`
- Boundary：`tests/unit/test_ai_boundary.py`、`tests/unit/test_tutor_prohibition.py`
- Recovery：`tests/unit/test_sync_recovery.py`
- E2E：`tests/integration/sync/test_e2e_demo.py`

---

## 十六、当前 HEAD 状态

```
HEAD: 14abf86
Branch: feature/backend-first
Clean: yes
Tests: pytest 552 · tsc PASS · vite build PASS
```

### 已完成
- M0~M7 全部里程碑
- P8-001A~004 全部任务
- B7 对话持久化
- B3 Extractor v2
- B8 Memories 进 Tutor 上下文
- ADR-001~023 全部冻结

### 正在进行
- 后端优先政策（前端任务冻结）

### 尚未实现
- M8 Mobile（推迟在 P8 之后）
- Phase 5 IDE（Monaco、SymPy、Jupyter）
- RAG（sqlite-vec + 云端 embedding API）
- 流式输出
- 真实 LLM Provider 集成（需用户配置 API key）

---

## 十七、项目演进地图

```
                    Learning OS
                        │
         ┌──────────────┼──────────────┐
         ↓              ↓              ↓
     Knowledge       Learning         AI
         │              │              │
         ↓              ↓              ↓
       Graph         Mastery        Tutor
         │              │              │
         ↓              ↓              ↓
     Universe        Review     Conversation
         │                          │
         ↓                          ↓
      MindMap                    Memory
                                    │
                                    ↓
                               Extractor

    Sync ←──── M7 ────→ Device Identity
                         Manifest
                         Diff
                         Apply
                         Conflict UI

    Reindex ←──── P8-003C ────→ Markdown→SQLite
```

---

**报告完毕。** 这是从 Git history 反推的项目完整演进史，不是当前状态表。
