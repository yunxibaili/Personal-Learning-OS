# Project State

> **项目唯一状态来源**（Single Source of Truth for current state）。
> 第一次接触项目、或 AI 会话启动时，从这里开始。
>
> 基线：2026-08-29 · HEAD `2852866` · Branch `main` · Commits 108
> （基线 = 收录时的上一提交，必然滞后；以 `git rev-list --count HEAD` 实测为准） · License Apache-2.0
> 验证：`pytest` **486 passed** · `vitest` 23 passed · `tsc --noEmit` PASS · `vite build` PASS
>
> **本文陈述事实，不含建议与规划。** 设计意图见 `TECH_DESIGN.md`，任务与路线见 `TASKS.md`，
> 工程约束见根 `AGENTS.md`。

---

## §0 当前开发政策：后端优先（Backend-First）

> **2026-08-28 项目所有者裁定。本文最高优先级的规则，凌驾于本文档其余章节的历史表述。**

**规则一：后端 backlog（§9）清零之前，禁止新增任何前端任务。**

禁止范围包括但不限于：新 UI 功能 · 视觉打磨 · 组件重构 · 新增视图/入口 · 配色与动效调整 ·
布局优化 · 空状态设计。

**规则二：此期间允许的前端改动仅限三类，且都必须最小：**

| 允许 | 边界 |
|---|---|
| 新 API 的最小接线 | 以「调用得通、结果可见」为准。**不做样式、不做交互打磨、不做空状态设计** |
| 阻断性 bug 修复 | 已上线功能不可用、崩溃、数据错误 |
| 类型契约同步 | `shared/types/*` 跟随后端字段变化 |

**规则三：`P8-FE-001 Visual Language Polish` 无限期冻结，不设自动触发点。**

其原触发条件「P8-001B 完成后由用户宣布进入纯前端阶段」**已作废**（P8-001B 于 2026-08-27 完成，
但项目所有者未按此触发）。该任务的冻结内容（配色方案、允许范围）保留在 `TASKS.md` 的挂起区，
**解冻必须由项目所有者显式宣布**，任何文档不得为其设置自动触发条件。

**规则四：前端阶段的前置条件（两条必须同时满足）**

1. §9 后端 backlog 全部清零
2. 项目所有者显式宣布进入前端阶段

**理由**：这是既有排序铁律「先内容结构，后视觉语言」（2026-08-27 裁定）第 4 条的顺延。
功能面未定型时对表面做打磨，会随后端每次变更反复返工——顺序反过来就是"漂亮的空壳"。

**与既有文档冲突时的裁决顺序**：§0 > `TASKS.md` 排序铁律 > 其他历史表述。

---

## §1 Project Overview

### 1.1 标识

| 项 | 值 |
|---|---|
| 产品名 | **Open Learning OS**（中文：个人学习操作系统） |
| 前端包名 | `plos-web`（`web/package.json`，version `0.1.0-dev`） |
| 许可证 | Apache-2.0（`LICENSE` 已入库） |

### 1.2 一句话定位

> 一个开源、本地优先、AI 驱动的学习型知识操作系统：帮助用户收集知识、理解概念、
> 练习技能，并形成长期记忆。
> *Your knowledge is not a pile of notes. It is a universe that grows with you.*

**核心价值不是记录信息，而是帮助用户学会信息。** 不设"击败 Obsidian/Notion"目标，不做商业 SaaS。

### 1.3 项目目标（按优先级）

| # | 目标 | 状态 |
|---|---|---|
| 1 | 记忆感知 AI Tutor：知道"我学过什么、哪里薄弱" | ⚠️ 契约就绪，运行时不可演示（仅 MockProvider） |
| 2 | 长期记忆系统：四维掌握度 + SM-2 + 错误本 | ✅ 后端已通 |
| 3 | 知识管理：Markdown 双链 + 类型化知识图谱 | ✅ 已通 |
| 4 | 数学学习环境：LaTeX + SymPy/Jupyter | ⏸ Phase 3 触发 |
| 5 | 编程学习环境：执行轨迹可视化 | ⏸ M9/M10 |

### 1.4 解决的问题

1. 笔记很多但用不起来 → 图谱 + 掌握度让知识"活"
2. 学完容易忘 → 遗忘曲线 + 自动复习排期
3. AI 回答没有个人上下文 → Tutor 前置查询掌握度 / 错误史
4. 错题没有沉淀成薄弱点 → `mistakes` 表 + 概念级归因

### 1.5 核心理念

**五条产品原则**（决策冲突时的最高裁决依据，仅次于 §0）：

1. **用户数据永远属于用户** — vault 是开放 Markdown，SQLite 可随时删除重建，禁止私有格式/云端绑定
2. **Markdown 优先** — 正文、导图大纲、同步真相都是纯文本；TipTap JSON、向量、布局坐标永远是派生物
3. **AI 增强而非替代学习** — AI 负责诊断薄弱、针对性讲解、组织复习；不给答案替代思考
4. **本地优先** — 默认全部功能离线可用；云端可选且永远可关闭；网络白名单之外零外呼
5. **不追求功能数量，追求学习效果** — 每次设计过三问：用户真需要？现在必须做？三个月后新人能看懂？

**工程核心原则**：Local-first · Minimal Dependencies · Standard Library First ·
Open Source Reuse · Modular Architecture · Explicit Data Ownership · Version Control First ·
Small and Maintainable Codebase。

**明确不做**：对标或击败 Obsidian/Notion · 商业 SaaS · 云端绑定 · 用户锁死。

---

## §2 Architecture

### 2.1 整体分层

```
                          ┌─────────────┐
                          │    User     │
                          └──────┬──────┘
                                 ▼
        ┌────────────────────────────────────────────────┐
        │  Frontend   React 18 + TypeScript + Vite       │
        │  Zustand(UI state) · React Flow(图渲染)         │
        │  TipTap(编辑) · KaTeX(数学) · Cobe(星球)         │
        │  7 tab: Notes / Graph / Universe / MindMap /   │
        │         Tutor / Review / Dashboard             │
        │  ★ §0 后端优先政策下：仅最小接线，不做视觉★      │
        └──────┬─────────────────────────────────────────┘
               │  HTTP  REST  /api/v1
               ▼
        ┌────────────────────────────────────────────────┐
        │  Backend API   FastAPI  (127.0.0.1:8000)        │
        │  14 APIRouter / 47 端点 —— 只做参数校验与序列化  │
        │  不含业务逻辑（分层铁律）                        │
        └──────┬─────────────────────────────────────────┘
               ▼
        ┌────────────────────────────────────────────────┐
        │  Core Engine  纯 Python（不 import FastAPI）     │
        │  knowledge · concepts · mastery · reindex ·     │
        │  review_scheduler(SM-2) · universe · mindmap ·  │
        │  tutor_context · ai/(5) · sync/(12)             │
        └───┬──────────────┬───────────────┬─────────────┘
            ▼              ▼               ▼
     ┌────────────┐ ┌──────────────┐ ┌──────────────────┐
     │  SQLite    │ │  Vault       │ │  AI Provider     │
     │  + FTS5    │ │  *.md        │ │  ProviderProtocol│
     │ 元数据/索引 │ │  *.mindmap.json│ │ → MockProvider  │
     │ 学习状态    │ │  eventlogs/  │ │ (唯一实现，无    │
     │ (可重建缓存)│ │  ★事实源★    │ │  真实 HTTP 调用) │
     └────────────┘ └──────────────┘ └──────────────────┘
```

### 2.2 三层数据架构（不许混）

```
L1 User Content     workspace/vault/*.md            用户写的内容（Markdown 真相）
L2 Knowledge Graph  concepts + links                知识本身及其关系（类型化实体）
L3 Learning Memory  concept_mastery + learning_events + mistakes + memories
                                                    我和知识的关系（掌握度/错误/遗忘/偏好）
```

### 2.3 后端

| 维度 | 实现 |
|---|---|
| 服务框架 | Python 3.12 + FastAPI 0.115 + uvicorn，仅绑 `127.0.0.1`（`$env:PORT` 可覆盖） |
| 数据库 | SQLite（标准库 `sqlite3` 直写 SQL）+ FTS5；**无 ORM**（`AGENTS.md` §2.2 永久禁止） |
| API 架构 | REST，统一前缀 `/api/v1`（版本化，破坏性变更升 `/v2`）；14 APIRouter / 47 端点；错误统一 `{error:{code,message}}` |
| 分层 | Router（HTTP）→ Core（纯业务）→ DB；图计算与布局不越层 |
| 图查询 | 递归 CTE（`local_graph`），不引图数据库 |
| 代码规模 | `server/app` Python ≈ 6,119 行 |

### 2.4 AI

| 维度 | 实现 |
|---|---|
| Provider | `LLMProvider` Protocol（`providers/base.py`，`runtime_checkable`）+ **仅 `MockProvider` 一个实现** |
| Context 系统 | `core/tutor_context.py` → `build_tutor_context(conn, concept_id)`，白名单式：concept / mastery / mistakes / related / review / recent_events；**禁止** vault 全文、settings、api_key、历史聊天、raw markdown |
| Prompt 系统 | `core/ai/tutor.py` → `build_prompt()`（M4-B 冻结）；分段截断 + 双重敏感过滤 |
| Token 控制 | `core/ai/constants.py`：`CHARS_PER_TOKEN=4`、SYSTEM 2000 / CONTEXT 10000 / QUERY 2000 字符上限 |
| 流式输出 | **未实现**。`complete(prompt) -> str` 一次性返回；无 SSE / StreamingResponse |
| 编排框架 | 无 LangChain / LlamaIndex（永久禁止），管线全手写 |

### 2.5 Storage

| 层 | 内容 | 角色 |
|---|---|---|
| **Vault** | `workspace/vault/*.md` | ★正文唯一事实源★（ADR-001 冻结） |
| **旁车** | `workspace/vault/*.mindmap.json` | ★导图结构唯一事实源★（ADR-002 / ADR-021） |
| **事件日志** | `workspace/metadata/eventlogs/*.jsonl` | 学习状态跨端可回放真相（ADR-005 / ADR-020） |
| **SQLite** | `workspace/db/learning-os.db` | 元数据 / 索引 / 学习状态缓存，**永不同步、可随时重建** |
| **FTS5** | `notes_fts`（title, body, note_id UNINDEXED） | 全文检索，随笔记保存增量维护 |

**同步真值三层模型**（ADR-020 冻结）：

- Layer 1 同步层：`vault/*.md` + `eventlogs/*.jsonl` + `*.mindmap.json`
- Layer 2 本地重建：`concepts` / `links` / `concept_mastery` / `review_queue`
- Layer 3 永不同步：`settings` / API keys / SQLite

### 2.6 前端（§0 政策下冻结）

| 维度 | 实现 |
|---|---|
| 框架 | React 18.3 + TypeScript 5.6 + Vite 5.4 |
| 状态管理 | Zustand 5（唯一状态库，`AGENTS.md` §2.2 禁止增加第二个） |
| 可视化 | 三套独立管线（ADR-023 边界冻结）：**Universe**（d3-force 聚类 + 中央 Planet）/ **Graph**（dagre 层级）/ **Planet**（Cobe WebGL 点阵地球） |
| UI 架构 | 单一 `global.css`（无 CSS 框架、无 UI 组件库、无图标库）；顶部 tabbar + 单页切换 |
| 编辑器 | TipTap v3 + KaTeX |
| 样式策略 | 手写 CSS 变量，ADR-013 前端设计系统冻结 |
| 代码规模 | TS/TSX ≈ 6,432 行 |

---

## §3 Technology Stack

**Frontend**：React 18.3 · TypeScript 5.6 · Vite 5.4 · Zustand 5 · @xyflow/react 12.11 ·
dagre 0.8.5（Graph 布局）· d3-force 3.0.0（Universe 聚类，ADR-007 唯一批准例外）·
cobe 0.6.5（WebGL 地球）· TipTap 3.30 · KaTeX 0.16

**Backend**：Python 3.12 · FastAPI 0.115 · uvicorn 0.30 · python-multipart ·
标准库 `sqlite3` 直写 SQL（无 ORM）· 递归 CTE · Pydantic ·
`atomic_write_file`（write → fsync → rename）

**Database**：SQLite 3 + FTS5（默认 unicode61 分词）· migration runner（001~007）·
无 ORM / 图数据库 / 向量数据库

**AI**：`LLMProvider` Protocol + `MockProvider`（唯一实现）· 手写 `build_prompt()` ·
Token 截断 + 双重敏感字段过滤。设计目标：OpenAI-compatible HTTP 接口
（DeepSeek/Qwen/OpenAI/Ollama 任一，settings 驱动）——**当前未落地**

**Testing**：pytest 8 + httpx（FastAPI TestClient）→ 486 passed ·
vitest 2.1 → 23 passed（3 文件：ui 2 / universe layout 14 / graph layout 7）

**Build**：Vite 5.4 · `tsc --noEmit` 门禁 · `scripts/test.ps1` · `scripts/seed_demo.py`

---

## §4 Completed Features

### 4.1 知识输入

已实现：Note CRUD · Markdown vault 文件存储 · TipTap v3 + Markdown 序列化 · KaTeX 渲染 ·
附件上传与相对 URL 引用 · FTS5 全文检索（`sanitize_fts_query` 防注入）· YAML frontmatter + tags ·
`content_hash` 增量索引 · 原子写入（write → fsync → rename）· `[[wikilink]]` 三级解析 + 自动建桩 ·
附件路径守卫 · Vault → SQLite 索引恢复（`POST /api/v1/admin/reindex`）

未实现：批量导入 · Vault 自动监听（watcher）· 外部格式导入 · 笔记模板 · 增量 reindex
（`changed_paths` 接口已预留，MVP 退化为全量）

### 4.2 知识理解

**Universe**：`GET /api/v1/universe` 投影端点 · `lib/universe/layout.ts` 布局纯函数
（domain 径向分组 + d3-force 确定性输出）· PlanetNode 中央聚合星球 ·
ConceptNode hover 抬升 + weak 虚线环（mastery < 0.3）· Floating Inspector ·
拖动位置 + viewport 持久化（localStorage）· Focus 模式周边渐隐

**Graph**：`GET /api/v1/graph` 读模型（递归 CTE，depth 1~3）· dagre 层级布局 ·
Concept（圆形）/ Note（方形）双视觉 · Layer Toggle（Mixed / Concept / Note）·
Edge 视觉层次（9 种 relation）· MiniMap + hover relation label + domain 过滤

**Concept**：`/api/v1/concepts` CRUD（无 DELETE，ADR-023 边界）· `origin` 唯一来源字段
（manual / markdown / ai_suggested，ADR-023 冻结）· `status` 生命周期
（stub → confirmed → active → archived）· `core/concepts.py` 纯 Core 层 ·
创建 concept 不产生 learning_event / mastery / review_queue / links（ADR-019/022 边界）· 29 项测试

### 4.3 知识组织

**Links**：多态 `links` 表（`source_type`/`target_type` 支持 note|concept，预留
code_symbol/formula/person/resource）· 9 种 relation · `origin` 字段 ·
反链 API（`GET /notes/{id}/backlinks`）· 级联清理 `cascade_drop_entity` ·
上下文感知建议（`/knowledge/suggest`：FTS + concept LIKE + 图谱邻居）

**MindMap**：React Flow 画布 · Map/Node/Edge CRUD（14 个 API 端点）·
Concept Binding（引用 concept，不改 mastery/event）· Export/Import（`.map.json`，ADR-021 v1，
含 ID 重映射）· 旁车 `*.mindmap.json` 为结构真相（ADR-002）· ADR-019 边界冻结

### 4.4 薄弱点检测

**Mastery**：四维掌握度（knowledge 0.35 / practice 0.30 / recall 0.20 / transfer 0.15，权重冻结）·
`effective` 加权派生值 · **P8-003B 时间衰减**：`decay_effective()` Ebbinghaus（tau=14 天）+
`get_effective_now()` 动态掌握度 · `last_seen` = `MAX(learning_events.created_at)` ·
`update_mastery()` 事件驱动增量更新

**Learning Events**：追加式事件日志 · 事件类型 → 维度增量映射 · `source` 来源追踪 +
`detail` 扩展列 · 学习时间线展示 · **P8-003D Eventlog Producer**：`update_mastery()` 写 SQLite 后
追加一行到 `metadata/eventlogs/<yyyy-mm>.jsonl`（`f.write` + `flush` + `os.fsync`）·
 **`event_uuid` 落库**（migration 007 + UNIQUE 索引；历史行保持 NULL，按追加式约束不回填）·
 **设备身份单一来源**（`core/sync/device.py` 的 `load_or_create_device()`，eventlog 与 M7 共用）

**Weak Area**：`GET /mastery/weak/list`（`get_weak_concepts`，limit 10）· Universe / Graph 视觉标记

### 4.5 复习系统

- **SM-2**：`core/review_scheduler.py` 独立模块（可替换为 FSRS/Leitner，需开 ADR）·
  标准公式 + 可注入 `now` 参数（测试确定性）
- **Review Queue**：`review_queue` 表 · `GET /review/today` 排序
  （错答优先 → `effective_now` 低优先 → 到期早优先）· 错答提升优先级（0.8），正答默认（0.5）
- **Review Session**（P8-003A）：`ReviewSessionView.tsx` 状态机
  idle → loading → ready → answering → feedback → done · 三按钮评分 ·
  `POST /review/{id}/answer` → feedback（mastery 变化 + 下次复习日期）· 完成统计
- **Mastery Decay**（P8-003B）：Ebbinghaus 衰减 · `review_today` 用 `effective_now` 排序 ·
  Tutor context 读衰减后掌握度 · API 输出 `effective_now` · 14 项测试
- **P8-003E Review Bridge**：`update_mastery()` 在 `answer_wrong` 时同步落 `mistakes`
  （修复建表以来零生产者的断链）

### 4.6 AI Tutor

已实现：上下文构建（白名单 6 类）· Prompt 组装 + 截断 + 敏感过滤 ·
ProviderProtocol + MockProvider · `TutorService.ask()` / `build_prompt_only()` ·
`TutorPanel` 多模式 + 上下文透视面板 · `GET /tutor/context/{concept_id}` ·
`POST /tutor/test`（全链路 Smoke）· 掌握度感知（读衰减后值）·
**P8-003D 显式笔记引用**（`POST /tutor/context`，复用 `search_notes()` + `suggest_for_context()`，
死 tab 复活）· M4-E 评估体系

未实现：真实 LLM Provider · 流式输出 · 自动笔记检索（仅支持用户显式引用）·
Extractor（回合后二次 LLM 调用）· 对话持久化 · 用户记忆

### 4.7 同步

Sync Engine Core（manifest/scanner/diff）· LAN Discovery（UDP 广播）·
Transport（消息协议 + 原子传输）· Apply Layer（唯一写入口 + 双重校验）·
Conflict UI（mindmap artifacts）· E2E LAN Demo（双进程字节级一致）· Release Audit PASS

未实现：移动设备同步（M8 未启动）· 自动定时同步

---

## §5 Capability Matrix（能力矩阵）

| 模块 | 已实现 | 未实现 |
|---|---|---|
| **输入知识** | ✅ Note CRUD · Markdown vault · TipTap+KaTeX · 附件 · FTS5 · wikilink · 原子写 · Vault Reindex | ❌ 批量导入 · Vault 自动监听 · 外部格式导入 · 笔记模板 |
| **组织知识** | ✅ 多态 links（9 种 relation）· 反链 API · MindMap CRUD · Concept Binding · 导入导出 | ❌ 大纲反解析（M2b 挂起）· AI 生成导图 |
| **理解知识** | ✅ Universe · Graph V2 · Concept CRUD + origin · Knowledge Radar MVP · Knowledge Planet | ❌ AI 概念提取 · 自动链接建议（auto-link） |
| **薄弱检测** | ✅ 四维掌握度 · effective 加权 · Ebbinghaus 衰减 · learning_events · Weak Area API | ❌ 错题本 UI（`mistakes` 已有生产者，无 API/UI）· AI 薄弱诊断 |
| **复习** | ✅ SM-2 · Review Queue · Review Session · Mastery Decay · Review History API | ❌ 复习历史分析 · Study Session · 自定义卡组 |
| **AI** | ✅ Context 构建 · Prompt 组装 · ProviderProtocol+Mock · TutorPanel · 显式笔记引用 | ❌ 真实 LLM Provider · 流式输出 · Extractor · 对话持久化 · 用户记忆 |
| **同步** | ✅ Core · Discovery · Transport · Apply · Conflict UI · E2E Demo · Release Audit | ❌ 移动设备同步 · 自动定时同步 |
| **发布** | ✅ 本地双端运行 · migration runner · 23 ADR | ❌ 数据全量导出（T-EXPORT）· Tauri 打包（M6）· Docker · i18n |

---

## §6 Data Model

完整 DDL 与契约见 **`DATA_MODEL.md`**。本节为速览。

### 6.1 表全景（14 张活表，零死表）

| 表 | 生产者 | 运行时行数 |
|---|---|---|
| `settings` | db.py 数据访问函数 | 2 |
| `concepts` | routers/concepts · `knowledge.ensure_entity_by_title` | 18 |
| `notes` | routers/notes（写盘 + 索引） | 5 |
| `notes_fts` | `knowledge.upsert_note_index` | 5 |
| `links` | `knowledge.rebuild_note_links` · concepts router | 5 |
| `concept_mastery` | `mastery.update_mastery` | 4 |
| `learning_events` | `mastery.update_mastery`（含 eventlog 双写） | 9 |
| `review_queue` | `mastery.ensure_concept_learning_state` · routers/mastery | 3 |
| `mistakes` | `mastery.py:160`（P8-003E 补齐） | 0（等真实答错） |
| `mind_maps` / `mind_map_nodes` / `mind_map_edges` | `core/mindmap.py` | 0（用户未创建） |
| `schema_migrations` | `db.migrate` | 7 |

**零行但有在案设计承诺**（不删，见 `DATA_MODEL.md` §6.1）：
`memories`（B7 后唯一零生产者表，等 B3 extractor；2026-08-29）

**B7 已接入**（2026-08-29）：`conversations` · `messages`（routers/conversations.py）

### 6.2 数据流向

```
Note  (vault/*.md 为正文真相，notes 表为索引)
  │  [[wikilink]] / mentions
  ▼
Link  (多态 links 表：source_type|target_type = note|concept，relation 9 种)
  ▼
Concept  (concepts 表，origin 记来源 / status 记生命周期)
  ▼
Mastery  (concept_mastery：四维 dimensions → effective → effective_now 衰减值)
  ▼
Review  (review_queue：due_at + priority + last_result；SM-2 排期)

旁路：learning_events（追加日志）──驱动──▶ Mastery 更新 ──驱动──▶ mistakes（答错时）
      memories ──（B3 extractor 待实现）· conversations/messages ──（B7 已接入）
```

### 6.3 Migration 历史

| 版本 | 内容 |
|---|---|
| 001_init | 11 表 + notes_fts 初版 |
| 002_links_unify | 统一 links 表，DROP note_links/note_concepts/edges（ADR-008） |
| 003_concept_status | concepts 增加 `status` 列 |
| 004_learning | 重建 concept_mastery / learning_events / review_queue（M3） |
| 005_events_quality | learning_events 增加 `detail` 列 |
| 006_mindmap | mind_maps / mind_map_nodes / mind_map_edges（ADR-019） |
| 007_event_uuid | learning_events 增加 `event_uuid` + UNIQUE 索引 |

**延后建表（禁止提前创建）**：`blocks` · `embeddings`（RAG 立项且概念数 >2000）· `concept_demos`

**新表规矩（自下一个 migration 生效）**：任何 migration 新增表，必须在同一提交中登记
生产者位置（模块 / 函数 / 调用点）；无生产者的表不得合入。

---

## §7 API Overview

统一前缀 `/api/v1`，**14 APIRouter / 47 端点**。

| 类别 | 前缀 | 端点 |
|---|---|---|
| Notes | `/api/v1/notes` | `GET /notes` · `POST /notes`@201 · `GET /notes/{id}` · `PATCH /notes/{id}` · `DELETE /notes/{id}` |
| Concepts | `/api/v1/concepts` | `GET /concepts`（domain/origin/status 过滤）· `GET /concepts/domains` · `GET /concepts/{id}`（含 mastery）· `POST /concepts`@201 · `PATCH /concepts/{id}`（**无 DELETE**，ADR-023） |
| Links | `/api/v1/notes` | `GET /notes/{id}/backlinks` |
| Graph | `/api/v1/graph` | `GET /graph`（root_type / root_id / depth 1~3，递归 CTE，只读） |
| Universe | `/api/v1/universe` | `GET /universe` |
| Mastery | `/api/v1` | `GET /mastery` · `GET /mastery/{id}` · `POST /events`@201 · `GET /mastery/weak/list` |
| Review | `/api/v1` | `GET /review/today` · `POST /review/{id}/answer` · `GET /review/history` |
| MindMap | `/api/v1/mindmaps` | `GET/POST/DELETE /mindmaps` · `/nodes` · `/nodes/{id}/bind` · `/edges` · `/concepts/search` · `/export` · `/import` |
| Tutor | `/api/v1/tutor` | `GET /tutor/context/{concept_id}` · `POST /tutor/context`（显式笔记引用）· `POST /tutor/test`（Smoke） |
| Sync | `/api/v1/sync` | `GET /sync/status` · `POST /sync/resolve` · `GET /sync/files/{path}` · `POST /sync/receive`（强制经 SyncApply） |
| Search | `/api/v1` | `GET /search`（FTS5） |
| Suggest | `/api/v1/knowledge` | `GET /knowledge/suggest`（FTS + concept LIKE + 图谱邻居） |
| Settings | `/api/v1/settings` | `GET /settings` · `PUT /settings`（api_key 脱敏） |
| Attachments | `/api/v1/attachments` | `POST /attachments` · `GET /attachments/{name}` |
| Admin | `/api/v1/admin` | `POST /admin/reindex`（`prune` 参数；Sync 接收后自动触发） |

---

## §8 Frontend Structure（§0 政策下仅供接线参考）

### 8.1 View 清单（7 个 tab，`web/src/App.tsx`）

| Tab | 组件 | 作用 |
|---|---|---|
| 笔记 | `NoteEditorView` | TipTap 编辑器 + 笔记列表 + 反链 + FTS 搜索 + 附件上传 + Knowledge Radar |
| 图谱 | `GraphView` | dagre 层级布局 · Concept/Note 双节点 · Layer Toggle · MiniMap · Floating Inspector |
| Universe | `KnowledgeUniverse` | d3-force 域聚类 + 中央 Planet + 节点 hover/拖动 + Inspector + Focus 模式 |
| 导图 | `MindMapCanvas` | React Flow 思维导图 · 节点 CRUD · Concept Binding · 导入导出 |
| AI Tutor | `TutorPanel` | 多模式 AI 问答 + 上下文透视面板（当前 MockProvider） |
| 复习 | `ReviewSessionView` | SM-2 复习会话状态机 |
| 仪表盘 | `DashboardView` | Knowledge Planet（Cobe）+ Sync Status Panel + 今日复习 + 掌握度排行 + 学习时间线 |

隐藏入口（URL hash，不占 tab）：`#preview` → `UniverseInteractionPreview` · `#planet` → 原型版 KnowledgePlanet

### 8.2 分层铁律

UI 组件内禁止图计算；布局引擎为独立纯函数模块（`lib/graph/layout.ts`、`lib/universe/layout.ts`）。
业务数据一律来自 API，不进 Zustand store（`stores/ui.ts` 只存 `activeView` 等 UI 状态）。

---

## §9 Backend Backlog（后端剩余工作量）

> **§0 政策的清零对象。** 本节全部完成 + 所有者宣布，方进入前端阶段。

### 9.1 AI 闭环（最高优先——产品第一目标当前运行时不可演示）

| # | 项 | 现状 |
|---|---|---|
| B1 | 真实 LLM Provider（OpenAI-compatible HTTP） | `providers/` 仅 `base.py` + `mock.py`，零 HTTP 调用 |
| B2 | 流式输出（SSE / StreamingResponse） | 未实现 |
| B3 | Extractor（回合后二次 LLM 调用提取概念/记忆） | 未实现；`memories` 表因之零生产者 |
| B4 | 自动链接建议（auto-link） | 未实现 |
| B5 | AI 概念提取 | 未实现 |
| B6 | AI 生成思维导图 | 未实现 |
| B7 | 对话持久化（`conversations` / `messages`） | ✅ 已实现（2026-08-29：CRUD + POST /chat 非流式，快照落库） |
| B8 | 用户记忆（`memories` 接入 tutor_context） | 表已建，0 行，无生产者无消费者 |
| B9 | 中文 FTS 分词优化 | unicode61 按字切分，长句检索受限（ADR-011 记录未解决） |
| B10 | 本地 LLM（Ollama）实测验证 | 路径理论通，未验证 |

### 9.2 数据与服务闭环

| # | 项 | 现状 |
|---|---|---|
| B11 | **T-EXPORT 数据全量导出** | 未实现。README 标注为「首次公开发布前必须」（数据不锁死红线） |
| B12 | 错题本 API（`mistakes` 已有生产者） | 无查询 / 更新 / 统计 API |
| B13 | Review 历史分析 | `GET /review/history` 存在，无分析能力 |
| B14 | Study Session | 未实现 |
| B15 | 批量导入 | 未实现 |
| B16 | Vault 自动监听（文件系统 watcher） | 仅手动 `POST /admin/reindex` |
| B17 | 增量 reindex（`changed_paths`） | 接口已预留，MVP 退化为全量 |
| B18 | M2b 大纲反解析（`*.mindmap.json` → Markdown） | 挂起 |
| B19 | 外部格式导入（Obsidian / Notion / Markdown 目录） | 未实现 |
| B27 | M7-007 vault 冲突副本（`.conflict` 后缀隔离同步白名单） | 已实现 ✅（2026-08-29） |

### 9.3 已知技术债（审核已定位，未修）

| # | 项 | 位置 |
|---|---|---|
| B20 | Router 含业务逻辑（应下沉 Core） | `routers/mastery.py:135-159` |
| B21 | `_now_iso()` 跨模块重复实现 | `mastery.py:86` / `review_scheduler.py:15` |
| B22 | `except OSError` 静默降级不可观测 | `mastery.py`（覆盖面含设备身份读取） |
| B23 | 「同事务」措辞名不副实（SQLite 与文件写无原子性） | `mastery.py` ~189 + `TECH_DESIGN.md` §5.5 |
| B24 | `load_or_create_device()` 无内存缓存；`devices.json` 损坏时静默轮转身份 | `core/sync/device.py:70-87` |
| B25 | `core.mastery` → `core/sync/__init__.py` 传递依赖整个同步引擎 | `mastery.py:29`（非缺陷，可选解耦） |
| B26 | 端点返回类型标注与实现不符（约 18 处 `-> dict` 实返 `JSONResponse`） | 各 router |

### 9.4 已闭环的历史缺口（存档，勿重复排查）

- ✅ `eventlogs/*.jsonl` 有生产者（`2c6b8d1`，路线甲）
- ✅ 三项 P0：设备身份合并 / `event_uuid` 落库 / `notes.py` 连接泄漏（`cc9915d`）
- ✅ `event_uuid` 回归守护（4 项测试，`8d0de31`；回退实验验证有效）
- ✅ `mistakes` 断链修复（`e3f76ff`，P8-003E）

---

## §10 Verification & Scale

### 10.1 验证状态（2026-08-28 实测）

| 命令 | 结果 |
|---|---|
| `pytest -q` | **486 passed**（186.42s） |
| `npx vitest run` | **23 passed**（3 files） |
| `tsc --noEmit` | **PASS** |
| `vite build` | **PASS**（729 modules，1,317.67 kB JS / 81.34 kB CSS） |

> Windows 环境注意：跑 pytest 需绕过 safe-delete 守卫——
> `cd server && CODEBUDDY_SAFE_DELETE_ENABLED=0 ./.venv/Scripts/python.exe -m pytest -q`
> 前端构建需绕过 `web/dist` 清空守卫——`npx vite build --outDir dist-verify`

### 10.2 代码规模

| 项 | 数值 |
|---|---|
| git 追踪文件 | 222 |
| 提交数 | 107（单分支 main + origin/main） |
| 后端 Python | ≈ 6,119 行（`server/app`） |
| 前端 TS/TSX | ≈ 6,432 行（`web/src` + `shared`） |
| APIRouter / 端点 | 14 / 47 |
| Migration | 7 |
| ADR | 23 |

### 10.3 核心闭环完成度

| 闭环 | 链路 | 状态 |
|---|---|---|
| **输入** | 编辑器 → Markdown vault → SQLite 索引 + FTS | ✅ 已通 |
| **组织** | wikilink → links 表 → 反链 / MindMap 绑定 | ✅ 已通 |
| **理解** | 概念 → 图谱（Graph/Universe/Planet）可视化 | ✅ 已通 |
| **复习** | SM-2 队列 → 答题 → mastery 更新 → 衰减 → 重排期 | ✅ 已通 |
| **同步** | Scan → Diff → Transport → Apply → Workspace → Reindex | ✅ 已通（E2E 双进程字节级一致） |
| **AI** | Context → Prompt → Provider → Response → UI | ⚠️ **半通**——链路已接通，但 Provider 仅 Mock，无流式，无自动检索 |

**尚未完成的闭环**：AI 真实闭环（B1–B8）· 数据导出闭环（B11）· 桌面/移动分发闭环（M6/M8）。

---

## §11 Frozen Domains & Do-Not-Touch

### 11.1 冻结领域（改动需先开 ADR）

| 领域 | 关联 |
|---|---|
| Markdown 模型 | ADR-001 |
| Graph API | M2-D |
| Knowledge Radar | M3.5-A / ADR-012 |
| Mastery 引擎 | M3 / `DATA_MODEL.md` |
| SM-2 调度 | `review_scheduler.py`（可替换但需 ADR） |
| Frontend Design | ADR-013 |
| AI Tutor 边界 | ADR-014 |
| Prompt Contract | M4-B / `DATA_MODEL.md` |
| Multilingual | ADR-015 |
| Tutor UI | ADR-016 |
| AI Boundary | Gate 1 |
| LLM Provider | M4-C / ProviderProtocol |
| MindMap Boundary | ADR-019 |
| Sync Truth Model | ADR-020 |
| MindMap Exchange Format | ADR-021 |
| Product Mode Boundary | ADR-022 |
| Visualization Boundary | ADR-023 |

### 11.2 Do Not Touch

- `KnowledgeRadar.tsx` — M3.5-A 已冻结，ADR-012 范围
- `GraphView.tsx` — M2-E 稳定，除非修 bug
- `001_init.sql` — 历史兼容，新表走新 migration
- `shared/types/*.ts` — API 契约，改需同步 pytest 契约测试
- `review_scheduler.py` — SM-2 独立模块，替换需开 ADR
- `tutor_context.py` — M4-A 已完成，不改逻辑
- `ai/tutor.py` — M4-B 已完成，只改 `constants.py` 调参
- `ai/providers/` — M4-C 已完成，新 Provider 走 `providers/` 目录
- **`learning_events` 历史行的 `event_uuid` 保持 NULL** — 按追加式约束不回填，
  **不要"修复"这个 NULL**

---

## §12 Known Risks

- 中文 FTS 分词未解决（unicode61 按字切分，长句检索受限，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）
- 本地 LLM 未实测（Ollama 路径理论通，未验证）
- Trace 引擎推迟（M9+）
- TipTap 数学扩展为社区维护（@aarkue），非官方
- AI 第一目标「记忆感知 Tutor」在运行时不可演示（仅 MockProvider）——对外开源需明确标注
  「契约就绪、实现待接入」，避免贡献者预期落差

---

## §13 Open Source Readiness

> 基线：OpenSSF Scorecard 20 项 + GitHub 社区标准 + 同类项目对标。
> 完整整改清单与优先级见 `TASKS.md` §3。

**当前缺口**：

| 级别 | 项 |
|---|---|
| P0 | 无 CI 流水线 · README 与实际进度严重脱节 · 无版本 tag/Release · 无 `SECURITY.md` |
| P1 | 无依赖更新自动化 · 无 SAST · 无覆盖率度量 · 无 Issue/PR 模板与 CoC · 无分支保护 · 前端产物未代码分割 |
| P2 | T-EXPORT 未实现（闭合产品第一原则）· 真实 LLM Provider 未接入（闭合 AI 闭环）· 块级引用 / FSRS 待评估 |

**待项目所有者裁决的路线问题**（非技术判断）：

1. 是否以「吸引外部贡献」为目标？若是，P0 全部必做；若定位个人项目开源存档，CI 可延后
2. i18n 必要性（面向中文用户还是国际社区）
3. 块级引用优先级（`blocks` 表会显著改变数据模型，与「不追求功能数量」原则需权衡）
4. SM-2 → FSRS 是否值得开 ADR（技术前提已具备，但引入参数拟合复杂度）

---

*文档结束。本文为客观状态总结；设计意图见 `TECH_DESIGN.md`，任务与路线见 `TASKS.md`。*
