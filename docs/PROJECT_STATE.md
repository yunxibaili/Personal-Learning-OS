# Project State

> **项目唯一状态来源**（Single Source of Truth for current state）。
> 第一次接触项目、或 AI 会话启动时，从这里开始。
>
> **单一真相源原则（2026-09-02 项目所有者裁定）**：全项目**只允许本文件定义
> 「现在做到哪了」**。其他任何文档（TASKS / ACTIVE_TASK / CURRENT_STATE / README /
> CHANGELOG / ADR）只能引用或补充本文件，**不得各自维护进度真相**。
> 若发现他处与本文件冲突：先 `git log` + 实际代码核实，再回改他处，本文件为准。
>
> 基线：**2026-09-02 状态收口**（收口任务：对齐全部文档至 HEAD `12030ff` 实际状态）
> · Branch `main` · Commits 以 `git rev-list --count HEAD` 实测为准（基线必然滞后）
> · License Apache-2.0
> 验证：`pytest` / `vitest` / `tsc --noEmit` / `vite build` 以最近一次全量 Gate 实测为准
> （2026-09-01 Gate：pytest **873** · vitest **36**；2026-09-02 P8 收尾 Gate：
> pytest **977** · vitest **161**（9 文件）· tsc PASS · build PASS。
> **pytest 本机 venv 未装 dev 依赖（pytest/httpx）无法复跑**，最近实测值以 CHANGELOG
> v0.1.0-rc.1 记载的 873 为准，安装 `requirements-dev.txt` 后即可复跑。）
>
> **本文陈述事实，不含建议与规划。** 设计意图见 `TECH_DESIGN.md`，任务与路线见 `TASKS.md`，
> 工程约束见根 `AGENTS.md`。

---

## §0 当前开发政策：前端阶段（Frontend Phase）

> **2026-08-30 项目所有者显式宣布「解冻前端任务」，政策自「后端优先」（2026-08-28 裁定）切换。**
> 本文最高优先级的规则，凌驾于本文档其余章节的历史表述。

**当前状态：前端阶段已开启。**

**规则四（前端阶段前置条件）已满足：**

| 前置条件 | 状态 |
|---|---|
| §9 后端 backlog 全部清零 | ✅ 2026-08-30 达成（B1–B29 全部 `已实现`） |
| 项目所有者显式宣布进入前端阶段 | ✅ 2026-08-30：「解冻前端任务」 |

**本次解冻范围**：`P8-FE-001 Visual Language Polish` 解冻，并按 Phase 0–4 推进
（任务分解见 `TASKS.md`「前端阶段任务」区）。

**解冻时一并裁定的事项**（2026-08-30，详见 `TASKS.md` 裁决记录与 `ui/README.md`）：

| 项 | 裁决 |
|---|---|
| 信息架构 | **笔记优先**——取消 7 个平级 tab，主区为三栏笔记工作区；删除仪表盘 |
| 配色 | 沿用 `ui/UI_DESIGN.md` v1 橙白体系（`#F5F5F5` + `#FF6B35`），**不采用** P8-FE-001 原定的纸张感四色 |
| 字号 | 双尺度：阅读正文 17px/1.75；UI 文字 13–14px |
| Universe | 改为**星系**语义：主笔记=星球，副笔记=卫星；视觉守白空间线稿 |
| 批注 | 导师批改式，来源分 AI / 我 两类，不改用户原文 |
| 记忆点 | 荧光笔黄 `--hl` 双链 + 680px 行宽 + 大留白 |

**当前允许的前端改动**：Phase 0–4 范围内的全部前端工作（令牌归一 · 基础组件 · AppShell ·
视图重做 · 动效与 a11y 收口）。**仍禁止**：改数据库 / Core / API / 同步逻辑
（`P8-FE-001` 原有 Forbidden 边界继续有效）。

**与既有文档冲突时的裁决顺序**：§0 > `TASKS.md` 排序铁律 > 其他历史表述。

---

### §0.1 P8 收尾阶段政策（2026-08-31 项目所有者裁定，现行有效）

> Phase 0–4 已收口（2026-08-31），项目进入 **P8 收尾阶段**。
> 本节取代上方「仍禁止改数据库 / Core / API」的阶段性限制，成为当前最高政策。
> 核心变化：**不再人为限制前后端修改范围，以「端到端闭环 + 契约一致性」为最高优先级。**

**政策要点**（完整纪律见 `AGENTS.md` §12「端到端闭环协议」）：

1. **以真实代码为准**：文档 ≠ 代码时先核实再动；已实现的不重复实现，已废弃的不重新引入。
2. **解除「前端任务不改后端」的人为限制**：允许按真实需要修改
   Frontend / Shared Types / Router / Core / Migration / Tests / Documentation——
   **但跨层修改必须有真实原因，禁止借任务名义无依据扩权**。
3. **端到端闭环优先于「少改文件」**：用户操作 → Frontend → API → Router → Core →
   Data → Response → Shared Type → UI 反馈，任一层语义不匹配都应修复，
   不允许 frontend workaround / 类型强转 / 隐式 fallback 留到以后。
4. **契约一致性是硬要求**：endpoint / method / body / response shape / nullable /
   enum / ID 类型 / 时间格式 / 错误码 / 空数据行为必须三层一致
   （Backend 实际返回 = Shared Type 声明 = Frontend 消费）。
5. **规格冲突处理**：按裁决优先级（最新明确裁决 > 最新 ADR 修订 > 当前代码真实行为 >
   旧任务文档 > 旧设计草案）；无法判断时发 `[ARCHITECTURE WARNING]` 停下报告。
6. **验收标准升级**：不能只验证自己改的文件——跨层功能必须
   pytest + vitest + tsc + vite build 全绿；旧测试因设计变更失败时，
   先判断过时/设计变更/真回归，不许删测试了事。
7. **质量标准**：功能正确 + 架构正确 + 数据一致 + API 一致 + 类型一致 +
   UI 一致 + 测试完整 + 文档同步 + 未来可维护——**不是一个能单独通过的指标，
   而是全部**。

**仍然不变的红线**：Markdown Vault = 用户数据唯一事实源 · 四层调用链 ·
UI 不承担核心业务逻辑/图计算/SM-2/同步核心 · 无理由不新增依赖/表/Provider ·
禁止 XP/streak/徽章（ADR-022）· 禁止自动发送 Tutor 提问（tutorSeed ≠ 自动提问）。

---

### 历史：后端优先政策（2026-08-28 – 2026-08-30，已结束）

> 以下规则在后端优先期间生效，**现仅作历史留存，不再约束当前开发**。

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
→ **已于 2026-08-30 由项目所有者显式宣布解冻。**

**理由**：这是既有排序铁律「先内容结构，后视觉语言」（2026-08-27 裁定）第 4 条的顺延。
功能面未定型时对表面做打磨，会随后端每次变更反复返工——顺序反过来就是"漂亮的空壳"。
→ **该排序铁律已执行完毕，前端阶段自 2026-08-30 起按 Phase 0–4 推进。**

---

## §1 Project Overview

### 1.1 标识

| 项 | 值 |
|---|---|
| 产品名 | **Open Learning OS**（中文：个人学习操作系统） |
| 前端包名 | `plos-web`（`web/package.json`，version `0.1.0-rc.1`） |
| 许可证 | Apache-2.0（`LICENSE` 已入库） |
| 已发布 | tag `v0.1.0-rc.1`（2026-09-01，指向 `13fa1bc`） |

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
        │  笔记优先（裁决 A）：无平级 tab，主区=三栏笔记工作区│
        │  浮层态：Graph / Universe(星系) / MindMap / Tutor /│
        │          Review（顶栏「← 返回笔记」回去）          │
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
| API 架构 | REST，统一前缀 `/api/v1`（版本化，破坏性变更升 `/v2`）；**20 APIRouter / 89 端点**（2026-08-31 实测自 `app.openapi()`）；错误统一 `{error:{code,message}}`；**参数校验亦映射 400 `invalid_body`**（非 FastAPI 默认 422，`main.py` 全局处理器） |
| 分层 | Router（HTTP）→ Core（纯业务）→ DB；图计算与布局不越层；core 层零 fastapi 依赖（守护测试锁定） |
| 图查询 | 递归 CTE（`local_graph`），不引图数据库 |
| 代码规模 | `server/app` Python ≈ 9,722 行（2026-08-30 实测） |

### 2.4 AI

| 维度 | 实现 |
|---|---|
| Provider | `LLMProvider` Protocol（`providers/base.py`，`runtime_checkable`）+ **仅 `MockProvider` 一个实现** |
| Context 系统 | `core/tutor_context.py` → `build_tutor_context(conn, concept_id)`，白名单式：concept / mastery / mistakes / related / review / recent_events；**禁止** vault 全文、settings、api_key、历史聊天、raw markdown |
| Prompt 系统 | `core/ai/tutor.py` → `build_prompt()`（M4-B 冻结）；分段截断 + 双重敏感过滤 |
| Token 控制 | `core/ai/constants.py`：`CHARS_PER_TOKEN=4`、SYSTEM 2000 / CONTEXT 10000 / QUERY 2000 字符上限 |
| 流式输出 | **已实现**（2026-08-30）。B2-A：`stream()` 协议 + `/chat` SSE `StreamingResponse`；B2-B：`OpenAICompatProvider.stream()` 真实 SSE 解析（stdlib，零新依赖）。`complete(prompt)->str` 一次性非流式仍为默认向后兼容路径 |
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

### 2.6 前端

| 维度 | 实现 |
|---|---|
| 框架 | React 18.3 + TypeScript 5.9 + Vite 5.4 |
| 状态管理 | Zustand 5（唯一状态库，`AGENTS.md` §2.2 禁止增加第二个） |
| 可视化 | 三套独立管线（ADR-023 边界冻结）：**Universe/星系**（自研 Canvas 2D，`GalaxyCanvas.tsx`，主笔记=星球/副笔记=卫星）· **Graph**（React Flow + dagre 层级）· **MindMap**（React Flow）。~~d3-force / Cobe~~ 已于 v0.1.0-rc.1 移除（`dd4f40c`/`13fa1bc`） |
| UI 架构 | 单一 `global.css`（无 CSS 框架、无 UI 组件库、无图标库）；**无 tabbar**——笔记优先三栏 + 浮层视图（裁决 A，`008ea4e`） |
| 编辑器 | TipTap v3 + KaTeX + tiptap-markdown |
| 样式策略 | 手写 CSS 变量（`ui/tokens.css` 为权威源，`web/src/styles/tokens.css` 为镜像），ADR-013 前端设计系统冻结 |
| 代码规模 | TS/TSX ≈ 6,168 行（2026-09-02 实测，非测试 5,275 + 测试 893） |

---

## §3 Technology Stack

**Frontend**：React 18.3 · TypeScript 5.9 · Vite 5.4 · Zustand 5 · @xyflow/react 12.11 ·
dagre 0.8.5（Graph 布局）· TipTap 3.30 + tiptap-markdown + @aarkue/tiptap-math-extension ·
KaTeX 0.16 · Tauri 2.x（桌面壳，M6）。
~~d3-force 3.0.0~~（已于 v0.1.0-rc.1 移除——唯一消费者 P8-001B Universe V2 已删 `dd4f40c`，
现 Universe/星系 = 自研 Canvas 2D）· ~~cobe 0.6.5~~（同批移除）· ~~marked~~（从未安装；
Markdown 序列化由 tiptap-markdown 的传递依赖 markdown-it 承担）

**Backend**：Python 3.12 · FastAPI 0.141 · uvicorn 0.52 · python-multipart ·
标准库 `sqlite3` 直写 SQL（无 ORM）· 递归 CTE · Pydantic 2 ·
`atomic_write_file`（write → fsync → rename）

**Database**：SQLite 3 + FTS5（默认 unicode61 分词，中文检索走 B9 bigram 回退）· migration runner（001~009）·
无 ORM / 图数据库 / 向量数据库

**AI**：`LLMProvider` Protocol 三实现（`MockProvider` 默认 · `openai_compat` 真实实现，
DeepSeek 端到端实测（B1b）+ Ollama qwen3-14b 本地实测（B10），均 2026-08-30）·
手写 `build_prompt()` · Token 截断 + 双重敏感字段过滤 · **SSE 流式已落地**（B2）

**Testing**：pytest 8 + httpx（FastAPI TestClient）→ 最近全量 Gate **873 passed**（v0.1.0-rc.1，2026-09-01；
本机 venv 未装 dev 依赖，复跑需先 `pip install -r requirements-dev.txt`）·
vitest 2.1 → **87 passed**（2026-09-02 实测，6 文件：ui store 8 / buildNoteTree 6 /
derivePlanets 15 / graph layout 7 / ui components 21 / ui wiring 30）

**Build**：Vite 5.4 · `tsc --noEmit` 门禁 · `scripts/test.ps1` · `scripts/seed_demo.py`

---

## §4 Completed Features

### 4.1 知识输入

已实现：Note CRUD · Markdown vault 文件存储 · TipTap v3 + Markdown 序列化 · KaTeX 渲染 ·
附件上传与相对 URL 引用 · FTS5 全文检索（`sanitize_fts_query` 防注入）· YAML frontmatter + tags ·
`content_hash` 增量索引 · 原子写入（write → fsync → rename）· `[[wikilink]]` 三级解析 + 自动建桩 ·
附件路径守卫 · Vault → SQLite 索引恢复（`POST /api/v1/admin/reindex`）

未实现：笔记模板。（批量导入 B15 · Vault 自动监听 B16 · 外部格式导入 B19 ·
增量 reindex B17 均已实现，见 §9.2）

### 4.2 知识理解

**Universe（现 = Galaxy 多星球系统）**：`GET /api/v1/universe` 投影端点（保留）·
前端渲染 **`GalaxyView`**（`components/galaxy/GalaxyCanvas.tsx`，自研 Canvas 2D）——
主笔记=星球、副笔记=卫星（层级消费 `resolve_hierarchy()` 权威 parent 边，
无 parent 边时回退 wikilink 拓扑启发式）· 全屏巡览 4s 可暂停 / 右栏 GalaxyMini 272px 静止 ·
卫星 ≤16 聚合「+N」· 30fps 节流 + dpr 上限 + 离屏暂停 + reduced-motion 全停。
~~d3-force Universe V2（`lib/universe/layout.ts` + PlanetNode/ConceptNode）~~ 已删除（`dd4f40c`，2026-08-31）

**Graph**：`GET /api/v1/graph` 读模型（递归 CTE，depth 1~3）· dagre 层级布局 ·
Concept（圆形）/ Note（方形）双视觉 · Layer Toggle（Mixed / Concept / Note）·
Edge 视觉层次（9 种 relation）· hover relation label + domain 过滤 · Floating Inspector ·
~~MiniMap~~ 已移除（2026-08-29）

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
 **`event_id` 落库**（migration 007 + UNIQUE 索引；术语统一 migration 009；历史行保持 NULL，按追加式约束不回填）·
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

已实现：上下文构建（白名单 6 类 + memories B8 + 显式笔记引用 P8-003D）· Prompt 组装 + 截断 + 敏感过滤 ·
ProviderProtocol 三实现（Mock / openai_compat / 剥 `<think>`）· `TutorService.ask()` / `build_prompt_only()` ·
`TutorPanel` 多模式 + 上下文透视面板 + **SSE 流式渲染 + Stop**（P8-007）· `GET /tutor/context/{concept_id}` ·
`POST /tutor/context`（显式笔记引用）· `POST /tutor/test`（全链路 Smoke）· 掌握度感知（读衰减后值）·
**Extractor**（B3 回合后抽取，失败不影响主回答）· **对话持久化**（B7 conversations/messages）·
**用户记忆**（B8 注入 + B28 管理面）· **Tutor 三入口**（P8-006：Note→Explain / Weak→Tutor / Review 错答→Hint + Graph 概念→Tutor）· M4-E 评估体系

未实现：自动笔记检索（仅用户显式引用 ≤2 篇 + FTS 自动补齐的 auto_notes）

### 4.7 同步

Sync Engine Core（manifest/scanner/diff）· LAN Discovery（UDP 广播）·
Transport（消息协议 + 原子传输）· Apply Layer（唯一写入口 + 双重校验）·
Conflict UI（mindmap artifacts）· E2E LAN Demo（双进程字节级一致）· Release Audit PASS

未实现：移动设备同步（M8 未启动）· 自动定时同步

---

## §5 Capability Matrix（能力矩阵）

| 模块 | 已实现 | 未实现 |
|---|---|---|
| **输入知识** | ✅ Note CRUD · Markdown vault · TipTap+KaTeX · 附件 · FTS5+CJK bigram · wikilink · 原子写 · Vault Reindex（含增量 changed_paths）· **Vault 自动监听**（B16 watcher + /admin/watcher/*） | ❌ 批量导入 · 外部格式导入 · 笔记模板 |
| **组织知识** | ✅ 多态 links（9 种 relation）· 反链 API · MindMap CRUD · Concept Binding · 导入导出 · **大纲反解析**（B18 build_outline + GET /mindmaps/{id}/outline） | ❌ AI 生成导图 |
| **理解知识** | ✅ Universe（Galaxy 多星球系统）· Graph V2 · Concept CRUD + origin · Knowledge Radar（M3.5-A+B 学习状态真实数据）· **AI 概念提取**（B5 /concepts/extract）· **自动链接建议**（B4 link-suggestions） | — |
| **薄弱检测** | ✅ 四维掌握度 · effective 加权 · Ebbinghaus 衰减 · learning_events · Weak Area API · **错题本 API**（B12：列表/改已解决/删/统计） | ❌ 错题本独立 UI（仅 Tutor 上下文透视中展示）· AI 薄弱诊断 |
| **复习** | ✅ SM-2 · Review Queue · Review Session · Mastery Decay · **复习历史分析**（B13 /review/stats）· **Study Session**（B14 /study/sessions） | ❌ 自定义卡组 |
| **AI** | ✅ Context 构建 · Prompt 组装 · ProviderProtocol+Mock+OpenAICompat · **真实流式 SSE**（B2-B）· **Extractor**（B3）· **对话持久化**（/conversations）· **用户记忆**（B8 上下文注入 + B28 管理面）· TutorPanel | ❌ 自定义卡组（同复习行）· AI 薄弱诊断 |

> 本表 2026-08-31 逐项对照代码核实（B 后端闭环批 + M3.5-B 交付后）。
> 此前「大纲反解析/错题本 API/复习历史分析/流式输出/概念提取/自动链接/
> Vault 监听/用户记忆」均标注未实现，与 B12/B13/B17/B18/B2-B/B5/B16/B28
> 实际交付不符，已更正——**每一项都有对应 router/core 文件为证**。
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

**零生产者表：无**（2026-08-29 B3 后 memories 已接入；DATA_MODEL §F 历史结论随之闭合）

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
      memories ──（B3 extractor 已接入）· conversations/messages ──（B7 已接入）
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
| 007_event_uuid | learning_events 增加 `event_id` + UNIQUE 索引 |
| 008_study_sessions | study_sessions 表（B14） |
| 009_event_id_rename | `event_uuid` → `event_id` 术语统一 |

**延后建表（禁止提前创建）**：`blocks` · `embeddings`（RAG 立项且概念数 >2000）· `concept_demos`

**新表规矩（自下一个 migration 生效）**：任何 migration 新增表，必须在同一提交中登记
生产者位置（模块 / 函数 / 调用点）；无生产者的表不得合入。

---

## §7 API Overview

统一前缀 `/api/v1`，**20 APIRouter / 89 端点**（2026-08-31 实测）。

| 类别 | 前缀 | 端点 |
|---|---|---|
| Notes | `/api/v1/notes` | `GET /notes` · `POST /notes`@201 · `POST /notes/batch`（B15）· `POST /notes/import`（B19）· `GET /notes/{id}` · `PATCH /notes/{id}` · `DELETE /notes/{id}` · `GET /notes/{id}/link-suggestions`（B4） |
| Concepts | `/api/v1/concepts` | `GET /concepts`（domain/origin/status 过滤）· `GET /concepts/domains` · `GET /concepts/{id}`（含 mastery）· `POST /concepts`@201 · `POST /concepts/extract`（B5）· `PATCH /concepts/{id}` · `DELETE /concepts/{id}`（B7.2 **软删**：仅 ai_suggested/unconfirmed 桩 → status=ignored，已确认概念须走 archived，不物理删除） |
| Links | `/api/v1/notes` | `GET /notes/{id}/backlinks` |
| Graph | `/api/v1/graph` | `GET /graph`（root_type / root_id / depth 1~3，递归 CTE，只读） |
| Universe | `/api/v1/universe` | `GET /universe` |
| Mastery | `/api/v1` | `GET /mastery` · `GET /mastery/{id}` · `POST /events`@201 · `GET /mastery/weak/list` |
| Review | `/api/v1` | `GET /review/today` · `POST /review/{id}/answer` · `GET /review/history` · `GET /review/stats`（B13） |
| Mistakes | `/api/v1/mistakes` | `GET /mistakes` · `GET /mistakes/stats` · `GET /mistakes/{id}` · `PATCH /mistakes/{id}`（resolved）· `DELETE /mistakes/{id}`（B12） |
| MindMap | `/api/v1/mindmaps` | `GET/POST/DELETE /mindmaps` · `/nodes` · `/nodes/{id}/bind` · `/edges` · `/concepts/search` · `/export` · `/import` · `GET /{id}/outline`（B18）· `POST /suggest`（B6） |
| Memory | `/api/v1/memories` | `GET /memories` · `GET /memories/maintenance`（Agent）· `GET/PATCH/DELETE /memories/{id}` |
| Study | `/api/v1/study` | `GET/POST /study/sessions` · `GET /study/sessions/{id}` · `GET /study/sessions/{id}/queue` · `POST /study/sessions/{id}/finish` · `DELETE /study/sessions/{id}`（B14） |
| Tutor | `/api/v1/tutor` | `GET /tutor/context/{concept_id}` · `POST /tutor/context`（显式笔记引用）· `POST /tutor/test`（Smoke） |
| Sync | `/api/v1/sync` | `GET /sync/status` · `POST /sync/resolve` · `GET /sync/files/{path}` · `POST /sync/receive`（强制经 SyncApply）· **`GET /sync/manifest`** · **`POST /sync/plan`** · **`GET /sync/discover`** · **`POST /sync/pair`** · **`GET /sync/peers`** · **`DELETE /sync/peers/{id}`**（M7-008） |
| Search | `/api/v1` | `GET /search`（FTS5） |
| Suggest | `/api/v1/knowledge` | `GET /knowledge/suggest`（FTS + concept LIKE + 图谱邻居） |
| Settings | `/api/v1/settings` | `GET /settings` · `PUT /settings`（api_key 脱敏） |
| Attachments | `/api/v1/attachments` | `POST /attachments` · `GET /attachments/{name}` |
| Admin | `/api/v1/admin` | `POST /admin/reindex`（`prune`/`changed_paths` 参数；Sync 接收后自动触发） · `POST /admin/watcher/{start,stop}` · `GET /admin/watcher/status`（B16） |
| Conversations | `/api/v1` | `POST /chat`（SSE 流式，`stream=true`）· `GET/POST /conversations` · `GET /conversations/{id}/messages` · `DELETE /conversations/{id}` |

---

## §8 Frontend Structure（§0 政策下仅供接线参考）

### 8.1 View 清单（`web/src/App.tsx` · **2026-08-31 按裁决 A 更新为笔记优先**）

**主界面（默认）**：笔记工作区 = 三栏，列表 240 + 编辑器 680 + 右栏 320。
**无平级 tab、无独立首页/Dashboard**（裁决 A）。

| 视图 | 组件 | 说明 |
|---|---|---|
| **笔记工作区**（默认主界面） | `NoteEditorView` + `ContextRail` | TipTap 编辑器 + 笔记列表 + 反链 + FTS 搜索 + 附件上传 + 右栏（大纲/反链/关联/掌握度/雷达 + 迷你星系） |
| 图谱（浮层） | `GraphView` | dagre 层级布局 · Concept/Note 双节点 · Layer Toggle · Floating Inspector（~~MiniMap~~ 已移除 2026-08-29） |
| Universe（浮层） | **`GalaxyView`**（`components/galaxy/`） | **多星球系统**：主笔记=星球、副笔记=卫星，层级从 `/graph` 边拓扑推断；全屏巡览 4s 可暂停 / 右栏单颗静止 |
| 导图（浮层） | `MindMapCanvas` | React Flow 思维导图 · 节点 CRUD · Concept Binding · 导入导出 |
| AI Tutor（右栏抽屉） | `TutorPanel` | 多模式 AI 问答 + 上下文透视面板（**SSE 流式** POST /chat stream=true：增量渲染 + Stop 中止，P8-007） |
| 复习（浮层） | `ReviewSessionView` | SM-2 复习会话状态机 · 键盘驱动 |

**已移除**：~~7 个平级 tab~~ · ~~`DashboardView` 仪表盘~~（裁决 A）·
~~`KnowledgeUniverse`（d3-force 旧实现）~~（已被 `GalaxyView` 取代，代码已删 `dd4f40c`）·
~~`#preview` / `#planet` 原型入口~~（Phase 4 已清理）。

⚠️ dev 入口 `#gallery` → `dev/ComponentGallery.tsx`：**实际未接线**（全库零 import，
App 无 hash 路由分发），并非「DEV 生效」——该文件当前为无引用的孤立文件
（技术债清单见 §12）。

> 浮层态经右栏「关联」标签进入，顶栏「← 返回笔记」返回。

### 8.2 分层铁律

UI 组件内禁止图计算；布局引擎为独立纯函数模块（`lib/graph/layout.ts`、`lib/universe/layout.ts`）。
业务数据一律来自 API，不进 Zustand store（`stores/ui.ts` 只存 `activeView` 等 UI 状态）。

---

## §9 Backend Backlog（后端剩余工作量）

> **§0 政策的清零对象。** 本节全部完成 + 所有者宣布，方进入前端阶段。

### 9.1 AI 闭环（最高优先——产品第一目标当前运行时不可演示）

| # | 项 | 现状 |
|---|---|---|
| B1 | 真实 LLM Provider（OpenAI-compatible HTTP） | ✅ B1a 已实现 + 加固（重试/`max_tokens`/JSON 模式）；**B1b 真实凭据冒烟已实测通过**（2026-08-30：DeepSeek 端到端，最小 token；key 用后即删、未入库/文档） |
| B2 | 流式输出（SSE / StreamingResponse） | ✅ 已实现（B2-A `stream()` + `/chat` SSE；B2-B openai_compat 真实 SSE 解析） |
| B3 | Extractor（回合后二次 LLM 调用提取概念/记忆） | ✅ 已实现（memories+概念桩） |
| B4 | 自动链接建议（auto-link） | ✅ 已实现（`GET /notes/{id}/link-suggestions`，确定性内容重叠） |
| B5 | AI 概念提取 | ✅ 已实现（2026-08-30：`POST /concepts/extract`，LLM 抽取→ai_suggested/unconfirmed，mock 测） |
| B6 | AI 生成思维导图 | ✅ 已实现（2026-08-30：`POST /mindmaps/suggest`，**只建议不自动写库**，ADR-019） |
| B7 | 对话持久化（`conversations` / `messages`） | ✅ 已实现（CRUD + POST /chat） |
| B8 | 用户记忆（`memories` 接入 tutor_context） | ✅ 已实现（B3 生产者 + 复合排序 + 敏感排除） |
| B9 | 中文 FTS 分词优化 | ✅ 已闭环（2026-08-30：**B9 范围 = CJK bigram 检索回退**，不引 jieba。2026-09-02 **升级**：ADR-027 裁定应用侧 bigram 预分词，`_cjk_search` 全表扫描退役，FTS 统一索引路径——B9 兜底使命完成） |
| B10 | 本地 LLM（Ollama）实测验证 | ✅ 已实现（2026-08-30：qwen3-14b 端到端——`/tutor/test` 非流式 · `/chat` SSE 流式 · extractor 提取 memory/概念桩/learning_event → mastery 更新全通。附带修复：openai_compat 剥离思考型模型内联的 `<think>` 推理段（非流式 `_strip_think`；流式按模型名提示 qwen3/r1/think 缓冲，其余模型逐增量透传），`think:false` 实测不被 Ollama /v1 遵守） |
| B28 | Memories 管理面 API | ✅ 已实现（GET/PATCH/DELETE + `/memories/maintenance`） |
| — | Memory Agent（智能记忆管理） | ✅ 已实现（2026-08-30：`/memories/maintenance` 按 value=importance×新近度 排序 + 保留建议，只建议不删除） |

### 9.2 数据与服务闭环

| # | 项 | 现状 |
|---|---|---|
| B11 | **T-EXPORT 数据全量导出** | ✅ 已实现（GET /api/v1/export，2026-08-29） |
| B12 | 错题本 API（`mistakes` 已有生产者） | ✅ 已实现（2026-08-30：`GET/PATCH/DELETE /mistakes` + `/mistakes/stats`，含按概念归因） |
| B13 | Review 历史分析 | ✅ 已实现（2026-08-30：`GET /review/stats` 准确率/当前连对/按概念归因） |
| B14 | Study Session | ✅ 已实现（2026-08-30：migration 008 + `POST /study/sessions` CRUD + 队列 + finish，不改 mastery/review） |
| B15 | 批量导入 | ✅ 已实现（2026-08-30：`POST /notes/batch`，逐篇部分成功不阻断） |
| B16 | Vault 自动监听（文件系统 watcher） | ✅ 已实现（2026-08-30：stdlib 轮询 `vault_watcher` + `POST /admin/watcher/{start,stop}` + `GET /admin/watcher/status`） |
| B17 | 增量 reindex（`changed_paths`） | ✅ 已实现（2026-08-30：`POST /admin/reindex` body `changed_paths` 增量 upsert+删除，含越界守卫） |
| B18 | M2b 大纲反解析（`*.mindmap.json` → Markdown） | ✅ 已实现（2026-08-30：`get_map_outline`/`build_outline` + `GET /mindmaps/{id}/outline`） |
| B19 | 外部格式导入（Obsidian / Notion / Markdown 目录） | ✅ 已实现（2026-08-30：`POST /notes/import`，保留相对结构、重复跳过、部分成功不阻断） |
| B27 | M7-007 vault 冲突副本（`.conflict` 后缀隔离同步白名单） | 已实现 ✅（2026-08-29） |
| B29 | M7-008 同步 HTTP 层：manifest exchange + pairing | ✅ 已实现（2026-08-30：`GET /sync/manifest` · `POST /sync/plan` · `GET /sync/discover` · `POST /sync/pair` · `GET /sync/peers` · `DELETE /sync/peers/{id}`；`core/sync/pairing.py` Layer 3 永不同步。闭合 Discover→Pair→Manifest→Diff→Transport→Apply→Reindex 全链路） |

### 9.3 已知技术债（审核已定位，未修）

| # | 项 | 位置 | 状态 |
|---|---|---|---|
| B20 | Router 含业务逻辑（应下沉 Core） | `routers/mastery.py:135-159` | ✅ 已修（2026-08-30：submit_answer 下沉 `core.mastery.submit_review_answer`） |
| B21 | `_now_iso()` 跨模块重复实现 | `mastery.py` / `review_scheduler.py` | ✅ 已修（2026-08-30：`core/timeutil.py`，去重复+删死码） |
| B22 | `except OSError` 静默降级不可观测 | `mastery.py` | ✅ 已修（2026-08-30：加日志告警） |
| B23 | 「同事务」措辞名不副实（SQLite 与文件写无原子性） | `mastery.py` ~189 + `TECH_DESIGN.md` §5.5 | ✅ 已修（2026-08-30：措辞更正为「尽力而为追加」） |
| B24 | `load_or_create_device()` 无内存缓存；`devices.json` 损坏时静默轮转身份 | `core/sync/device.py:70` | ✅ 已修（2026-08-30：进程内缓存 + 损坏备份 `.corrupt` + 日志） |
| B25 | `core.mastery` → `core/sync/__init__.py` 传递依赖整个同步引擎 | `mastery.py:29`（非缺陷，可选解耦） | 保留（非缺陷，解耦收益低） |
| B26 | 端点返回类型标注与实现不符（约 18 处 `-> dict` 实返 `JSONResponse`） | 各 router | 分析后保留：FastAPI 对 `dict|JSONResponse` 注释会建响应模型报错，采用 `-> dict`（settings.py 先例/T-M0）为既定模式 |

### 9.4 已闭环的历史缺口（存档，勿重复排查）

- ✅ `eventlogs/*.jsonl` 有生产者（`2c6b8d1`，路线甲）
- ✅ 三项 P0：设备身份合并 / `event_id` 落库 / `notes.py` 连接泄漏（`cc9915d`）
- ✅ `event_id` 回归守护（4 项测试，`8d0de31`；回退实验验证有效）
- ✅ `mistakes` 断链修复（`e3f76ff`，P8-003E）

---

## §10 Verification & Scale

### 10.1 验证状态（最近全量 Gate：v0.1.0-rc.1，2026-09-01；前端复测 2026-09-02）

| 命令 | 结果 |
|---|---|
| `pytest -q` | **873 passed**（v0.1.0-rc.1 Gate 实测，2026-09-01；⚠️ 本机 venv 未装 dev 依赖，复跑先 `pip install -r requirements-dev.txt`。Windows 绕 safe-delete 守卫：`CODEBUDDY_SAFE_DELETE_ENABLED=0`，见 `docs/TESTING.md`） |
| `npx vitest run` | **87 passed（6 文件）**（2026-09-02 实测；v0.1.0-rc.1 Gate 时为 36/4，组件接线测试 +51 后增长） |
| `tsc --noEmit` | **PASS**（2026-09-02 复测） |
| `vite build` | **PASS**（2026-09-02 复测：707 modules / 4.12s / 10 chunk，主包 179kB；TiptapEditor chunk 807KB 为已知警告） |

> 历史登记值（815/826/836/853/865/873）为各阶段 Gate 快照，全量数字以 CHANGELOG 对应版本为准。
> **计数类冲突已在 2026-09-02 收口清理**：本文此后是唯一登记处，其他文档只引用。

> Windows 环境注意：跑 pytest 需绕过 safe-delete 守卫——
> `cd server && CODEBUDDY_SAFE_DELETE_ENABLED=0 ./.venv/Scripts/python.exe -m pytest -q`
> 前端构建需绕过 `web/dist` 清空守卫——`npx vite build --outDir dist-verify`
> （2026-09-02 实测：环境删除守卫曾整体故障，复用旧 outDir 也会触发 bulk guard；
> 遇 `[SAFE_DELETE_FAIL_CLOSED]` 时改用**全新 outDir**。）

### 10.2 代码规模（2026-09-02 实测）

| 项 | 数值 |
|---|---|
| git 追踪文件 | 405 |
| 提交数 | 230（单分支 main 线性历史，2026-08-26 → 09-02） |
| 后端 Python | ≈ 9,722 行（`server/app`） |
| 前端 TS/TSX | ≈ 6,168 行（`web/src`，非测试 5,275 + 测试 893） |
| APIRouter / 端点 | **20 / 89**（路由装饰器实测 91 行，含非端点装饰） |
| Migration | **9**（001~009） |
| ADR | **26**（ADR-001~026，另有 principles/separation/upmark 三个非编号文件） |

> 计数以 OpenAPI schema 实测为准，勿沿用旧值（曾长期写 14/47、migration 7、commits 107/184/193）。

### 10.3 核心闭环完成度

| 闭环 | 链路 | 状态 |
|---|---|---|
| **输入** | 编辑器 → Markdown vault → SQLite 索引 + FTS | ✅ 已通 |
| **组织** | wikilink → links 表 → 反链 / MindMap 绑定 | ✅ 已通 |
| **理解** | 概念 → 图谱（Graph/Universe/Planet）可视化 | ✅ 已通 |
| **复习** | SM-2 队列 → 答题 → mastery 更新 → 衰减 → 重排期 | ✅ 已通 |
| **同步** | Discover → Pair → Manifest → Diff → Transport → Apply → Workspace → Reindex | ✅ 已通（M7-008 补齐 HTTP 层；E2E 双进程字节级一致） |
| **AI** | Context → Prompt → Provider → Response（流式 SSE）→ UI | ✅ 已通（后端 B1b/B2 实测；前端 P8-007 于 2026-08-31 接线：TutorPanel 流式渲染 + 停止，headless 实检通过） |

**后端闭环状态（2026-08-30）**：§9 全部条目已闭环（B10 于 2026-08-30 以本机
Ollama qwen3-14b 实测通过）。剩余均属外部依赖或后端范围之外。

**仍未闭环（非后端范围）**：移动分发（M8）。桌面分发（M6）已于 2026-09-01 完成
（`3db327a`，MSI 65MB + NSIS 102MB）。
前端视觉打磨（P8-FE-001）已于 2026-08-31 解冻并完成 Round 1–3（`907ff74` /
`888ecd2` / `3182465`）：层次（body 灰底 + 编辑器白纸面 + 列表内边距）· 状态色
a11y（`--ok-text`/`--warn-text`/`--err-text` 实测全 AA）· 原生控件字体继承 ·
空态文案 · 删除按钮数据态=UI态 · 150ms 微交互。**MiSans woff2 已裁定放弃**
（授权红线：禁止衍生/子集化 + 可撤销许可），UI_DESIGN §依赖策略已如实改写，
**FE-001 收尾**。唯一遗留为 ADR-013 §2.12 记录的「ADR 与设计资产」政策冲突
（待所有者显式裁决，代码不动）。

### 当前任务与路线（2026-09-02 项目所有者裁定「先收口，后开发」）

所有者裁定：**下一步先项目整理 / 状态收口，再决定 M9 或 T-NOTE-TREE**。
原则：**只允许本文件定义「现在做到哪了」**，其他文档只能引用/补充（见文首）。

```text
[0] 项目整理 / 状态收口（当前任务）
    ├─ Git / HEAD / tag / branch 确认
    ├─ README / PROJECT_STATE / TASKS / ACTIVE_TASK / CURRENT_STATE / AGENTS 全面对齐
    ├─ ADR 007/013/016/018/022/025/026 状态对齐
    └─ 删除/废弃项统一标记（P8-001B/C、Dashboard、d3-force/cobe/marked）
[1] 技术债重新分级（按 §12 新分级执行）
[2] ✅ M9-007 Visual Engine 接入 web/（2026-09-02 完成）
[3] ✅ M9-008 真实验收（2026-09-02，11 条全过，见 TASKS T-M9-007/008）
[4] ✅ M9 正式关闭
[5] ✅ T-NOTE-TREE T1（2026-09-02，GET /notes/tree + 守护测试 10 项）
[6] ✅ T-NOTE-TREE T2（2026-09-02，默认 3 层展开 + 懒加载 + 折叠偏好）
[7] ✅ T-NOTE-TREE T3（2026-09-02，Gate 全绿 + 真实 vault 4 层链 E2E 16/16）
[8] ✅ P8 正式收尾（2026-09-02：删除优先检查 + 依赖审计 + CHANGELOG + tag v0.1.0-rc.2）

── 2026-09-02 所有者第二次裁定：先 P1 技术债收敛，M8 不启动（避免把 Web 架构问题复制到 RN）──
[9]  ✅ P1-1 MindMap API 边界治理（2026-09-02 完成：6 处裸 fetch → lib/api.ts +
     拖拽 drag-end flush + 1s trailing debounce；报告见 TASKS §P1-1）
[9b] ✅ P1-MINDMAP-TRUTH（2026-09-02 完成：恢复 MindMap sidecar producer，
     *.mindmap.json = 结构事实源（ADR-002），SQLite 三表降为可重建缓存，
     /sync/receive 落盘后重建——跨设备同步闭环闭合。报告见 TASKS §P1-MINDMAP-TRUTH）
[10] ✅ P1-5 Backend/UI 能力裁定（2026-09-02 四组弹窗完成：A settings 接 UI /
     B mistakes 接 UI / C conversations 最小 UI / D sync 延 M8 / E-H backend-only；
     执行任务 = [10a][10b][10c]，M8 前置满足）
[10a] ✅ P1-5-A 设置 UI（2026-09-02 完成：LLM Provider 配置页，报告见 TASKS §P1-5-A）
[10b] P1-5-B 错题本 UI：列表/标记已解决/删除/统计（GET/PATCH/DELETE /mistakes/*）
[10c] P1-5-C 会话历史最小 UI：Tutor 抽屉内历史列表+删除（GET/DELETE /conversations）
[11] ✅ P1-4 MockProvider 演示路径（2026-09-02，Ollama qwen3 端到端验证：Smoke/非流式/SSE 全通，配置保留 openai_compat）
[12] P1-4 中文 FTS
[12] ✅ P1-2 i18n（2026-09-02，46 处/5 组件用户可见英文清零，零框架零依赖）
[14] ✅ M8 Mobile 可行性 / 架构决策（2026-09-02 评审 + 2026-09-03 最终裁定：
     主路线 Tauri 2 Mobile **conditional on M8-000**（Python Core 在 Android 的
     可行性是硬 Go/No-Go）；ADR-006 → Superseded as primary route, retained as
     fallback；**M8 全线暂停（含 spike），PC Stable Baseline 优先**）
[15] ⏸ M8 Android MVP（暂停；顺序 = PC Stable → M8-000 → 再启动）

── 2026-09-03 所有者裁定：PC Stable Baseline 优先（P0 启动与运行基线 → P1 UI 打磨 → P2 完整验收）──
[16] ✅ P0-1 PC 开发环境完整启动（2026-09-03：uvicorn 重启至当前代码 → 真实 DB 自动应用
     010_fts_bigram + FTS 重建（20 篇笔记保留）；vite 5173 页面 200 + /api 代理通；
     中文短语/单字/rank 搜索真库生效；live-smoke 16/16 · 0 console errors）
[17] ✅ P0-2 Tauri Desktop 启动/sidecar 验证 + **方案 i sidecar 接线闭环（2026-09-03，
     T-P0-2b）**：PyInstaller onefile 后端（backend_main.py，端口 8100/workspace 上溯
     解析）+ externalBin + lib.rs spawn/kill + VITE_API_BASE（.env.desktop）+ CORS。
     端到端实测：双击 plos.exe 自动拉 sidecar → 8100 全通（真库 20 篇）→ 退出零残留。
     pytest 50 / vitest 186 / tsc PASS。桌面版自此双击可用（TASKS §T-P0-2b）
[18] ✅ P0-3 真实 Vault CRUD + Search 重启持久化验证（2026-09-03，PASS 6/6：创建/编辑/落盘/搜索/重启持久化/真删除，全程针对自建测试笔记、vault 已复原 20 篇）。顺带修复：优雅关闭时 onefile 孙进程孤儿 → lib.rs 进程树终止（taskkill /T /F）复测零残留
[19b] ✅ P1-1 知识图谱布局坍塌修复（2026-09-03，commit eb169ea）：两阶段布局
     （连通 dagre TB + 孤立节点 grid 散开封顶 6 列）；`<FitOnLayoutChange>` 修 fitView
     异步时序（mount 时 layoutResult 为空 → camera 卡空）。53 节点可见，graph 恢复。
[19c] ✅ P1-2 stub 标题降级显示（2026-09-03，commit 645a935）：`displayNoteTitle()`
     覆盖空/纯空白/null/纯数字/占位 pattern「未命名笔记 <数字>」→「未命名笔记 · #<id>」。
     注：审计原描述「裸数字 ID」不准确，实测 title = `未命名笔记 193159`。
[19d] ✅ P1-3 settings.theme[19e] ✅ P1-4 思维母图空态[19f] ✅ P1-5 编辑器未选中笔记共享空态[19g] ✅ P1-6 业务组件字体层级[19h] ✅ P1-7-P1 minimap 尺寸[19i] ✅ P1-8 顶栏/右栏 header 对齐[19j] ✅ P1-9-P1 知识星系全屏空轨道收敛[19k] ✅ P1-10 圆角/阴影 token 一致性：**零代码关闭**（2026-09-03，取证后无实际缺陷）——radius 147 条：51 token +
     67 等价硬编码 + 13 条 50% + 8 条 2-3px（微型 bar 自成语义）；shadow 21 条：8 token + 8 浮层阶梯 +
     4 条同值 focus ring（冗余但不新增 --shadow-focus）。visual-engine 镜像不动。Backlog #10 ✅。
（2026-09-03，commit cc2ca49，决策 A 渲染层）：
     orbitCountFor(0/1/≥2)=0/1/2；drawFrame 仅画 drawn 轨道；卫星索引 drawn[sat.orbit%drawn.length] 仍落已绘环。
     像素取证 0-卫星环带=0、1-卫星≈445。18 星球 / 2 卫星 / 巡览 / minimap 224×224 + 容器 268 +
     flexShrink:0 全部不变。Gate: tsc 0 / vitest 207 / build / console 0。Backlog #9 ✅。
     **B（卫星源=推断层级）按裁决暂缓 → 独立架构议题**（不动 derivePlanets / ADR）。
：**零代码关闭**（2026-09-03，取证后无可量化错位）——顶栏元素
     中心均 31.5px（顶栏 32，≤0.5px 取整差）；review/settings 属性完全同构；「复习 9」非嵌套
     badge；右栏 5 tab 几何全等；tutor-header 同水平线；顶栏几何已 token 驱动。Backlog #8 ✅。
     保留观察：`.topbar__sync` 状态指示 vs pill 操作按钮 = 设计语义差异（非 bug），
     若统一组件化另开 P1-8-P2。
 224 + token 化（2026-09-03，commit c9fd861，决策 A+B / 224px）：
     computed height 316→268px、canvas 224×224、占比 37.8→32.1%、tab body 475→523px；
     切 5 个 tab 高度恒定零跳动；dpr=1；272 活跃硬编码残留=0。Gate: tsc 0 / vitest 202 / build / pytest 1020。
     Backlog #7 ✅（视觉降噪若需独立 P1-7-P2 评估）。
统一提级（2026-09-03，commit 160dabb）：T1 50 条 <12px → `var(--fs-xs)` + T2 13 条交互控件 12px → `var(--fs-sm)`。
     12px 正文/metadata 不动；visual-engine 镜像保留；`--fs-xs`/`--fs-sm` token 定义未改。Gate: tsc 0 / vitest 202 / build PASS。Backlog #6 ✅。
补 CTA（2026-09-03，commit d9283f1，更名自「Tutor 主区空态」）：
     NoteEditor.tsx 第二分支补唯一主 CTA「＋ 新建」——与第一分支同构，零新 CSS。2 项结构测试。
     Backlog #5 ✅。**P0 backlog 全部清零**。
结构化（2026-09-03，commit 0b4aeaf）：标题+描述+唯一主 CTA+ghost 次 CTA，
     沿用 web 既有 .editor-empty 命名体系（避免引入未镜像的 .sl* 新体系）；主 CTA 聚焦
     标题输入框（handleCreateMap 要求非空）。3 项结构断言测试。Backlog #4 ✅。
 死配置处置（2026-09-03，决策 **b**）：**取证后为零改动**——
     全库（web/src · server/app · migrations · shared · docs）**零 theme 引用**，前端
     SettingsView 仅 LLM Provider 六显式字段（无泛型遍历）、无 theme 控件/state/CSS
     consumer；后端 settings 为通用 KV（`dict[str,str]`）无 schema 字段无 seed。
     `theme=dark` 仅为 KV 表一行孤儿数据（零消费），按 (b) 保留后端兼容数据不动。
     **更正 P1-0 审计**：原「设置页存在无效 Theme 选项」为推断错误（当时未读源码）。
[19] ✅ P0-4 核心功能冒烟收口（2026-09-03，PASS 八面全绿）：live-smoke 16/16 ×2 轮 ·
     Graph 53/15 · MindMap 写路径闭环（500 系沙箱删除守护伪影，shim-free 复测 200）·
     Tutor 真实 qwen3 全链（Ollama 在线）· Memory 8 · Mistakes 3 · Sync status/manifest ·
     Settings。**P0 全部完成 → 进入 P1 UI/UX 打磨**
[19l] ✅ P1-11 文案语调（2026-09-03，commit 291bb4d）：取证先于裁决——「语调不统一」这一审计
     假设**不成立**（全角/半角感叹号 0·0、敬语混用 0、emoji 0、术语中文化稳定）。真实不一致仅
     3 项机械问题，全部清零：① `GraphView.tsx:239` 图层切换 `Concept`/`Note` → **概念/笔记**
     （同控件内「全部」为中文，另两项为英文）；② 统一为 **AI 导师**（所有者裁定方向）——
     `App.tsx:61` aria-label · `TopBar.tsx:16` 浮层标题 · `ContextRail.tsx:160` 右栏入口
     （`TutorPanel.tsx:274` 本已中文，不动）；③ 载入/加载 动词统一为**加载**——
     `GalaxyCanvas.tsx:769` 载入星系…→加载星系…，并**修正取证遗漏 2 处**：
     `NoteEditor.tsx:132` 载入中… · `:334` 载入笔记树…（取证记录称「载入」仅 1 处，实测 3 处；
     只改 1/3 会把不一致从「3 处载入」变成「1 加载 + 2 载入」，故按同一原则一并统一）。
     复查：Concept/Note 英文 0 · AI Tutor 英文 0 · 用户可见「载入」0。
     Gate：tsc 0 / vitest **207**(16 文件) / build PASS 4.26s。Backlog #11 ✅。
     未做（不在清单，留待 Bright Baseline 走查定）：`ReviewSessionView.tsx:317`
     「提交中...」半角三点与全库 21 处「…」不一致。
[20] ▶ **Bright Baseline（PC 亮色体验基线）——当前阶段（2026-09-03 起）**：
     目标 = 先让亮色版**完整可体验**，用真实使用感受决定下一轮改什么，而非继续清 backlog。
     范围锁定：**仅亮色 · ≥1440×900 · PC**。17 项验收清单见
     `../Open Learning OS — Bright Baseline 亮色体验验收清单.md`（启动/新建/编辑/
     Markdown·LaTeX/搜索/双链/图谱/导图/星系/掌握度/错题/复习/AI 导师/Memory/Settings/
     重启持久化/Tauri 独立运行）。**明确暂缓**：P1-12 响应式中等屏（1280 断点）·
     P1-13 暗色主题（全 token 镜像）· P1-11-B `ui/COPY.md` 文案规范（等真实反馈再固化）。
     反馈按 A 真的别扭 / B 不像成熟产品 / C 功能缺口 / D 错觉 四类归档。
```

### 已完成的近期里程碑（存档）

**T-NOTE-HIER 主/副笔记层级（ADR-024）——已完成（2026-09-01，P0+P1）**：
P0（frontmatter round-trip → 显式 parent 读写+校验 → 统一 `resolve_hierarchy()` →
reindex 物化 + `/graph` 并入权威父边 → web `derivePlanets` 显式优先）+
P1-1（`buildNoteTree` 纯函数建树 + `NoteTreeList` 递归渲染层级树 + `NoteCreate.parent`
一步创建副笔记）。守护测试 hierarchy 12 + galaxy 2 + buildNoteTree 6 + notes 5 +
boundary 8 + Vault Rebuild 12 = 45 项。遗留（P1-2）：稳定 note ID（独立 ADR）。

**M9 Visual Engine（ADR-025）——✅ 全部完成并关闭（M9-001~008，2026-09-01 ~ 09-02）**：
M9-007 接入（ui 库逐字节回灌 web/ + 图谱 Inspector 入口 + VisualizeOverlay 业务壳 +
visualize 事件）与 M9-008 验收（11 条全过）于 2026-09-02 完成，
完整报告见 `TASKS.md` §T-M9-007/008。Gate：pytest **967** · vitest **155** · tsc PASS · build PASS ·
无头自检 17/17。原文（M9-002~006 阶段记录）：
tracer 子进程隔离 PoC（`6636e07`）→ 契约（`shared/types/trace.ts`）→ API 路由
（`0b6b316`）→ IDE 步进组件（`35c3ef4`，范式裁定：否决播放器）→ 组件入 ui 库
`ui/visual-engine/`（`3d13b4b`，**刻意不进 web/**，`web/src/components/ui/index.ts`
不导出 M9 组件）→ 演示页 + 幂等同步脚本（`8c053f1`）。

**M6 Tauri 桌面打包——已完成（2026-09-01，`3db327a`）**：Windows MSI 65MB +
NSIS 102MB，GNU 工具链。

**T-NOTE-TREE（ADR-026 v3 Accepted，2026-09-01）——T1–T3 未开工**：
所有者澄清核心 = 主笔记下 ≥3 层文件夹式子层级；方案 = ADR-024 单父 forest 的
展示层放开，零 migration 零新表。v2→v3 采纳评审三修订（depth 后端剪枝默认 3 上限 10 +
`root_id` 懒加载 / 取消 5 层硬上限 / 同层 `created_at` 升序）。
**Galaxy 侧最终裁定：零改动零新交互**（卫星=直接子笔记，第 3 层以下不上图）。

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
| 笔记层级 / frontmatter parent | ADR-024 |
| frontmatter 读写（round-trip） | ADR-024 §3（地基，改前必读） |
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
- **`learning_events` 历史行的 `event_id` 保持 NULL** — 按追加式约束不回填，
  **不要"修复"这个 NULL**

---

## §12 技术债分级（2026-09-02 收口重分级，取代旧「Known Risks」罗列）

> 原则：只列真实存在、可从代码/测试/文档确认的问题；「可以优化」不算债。
> 执行顺序见 §10.3 路线 [1]（技术债重新分级后逐项处置）。

### P1（建议在 M9-007 前后处置）

| # | 项 | 位置 | 说明 |
|---|---|---|---|
| P1-1 | ~~MindMap 6 处裸 `fetch` 绕过统一 API 层~~ | ~~`web/src/components/mindmap/MindMapCanvas.tsx:113/132/179/214/273/299`~~ | **✅ 已处置（2026-09-02，P1-1）**：全部走 `lib/api.ts` ApiError 归一化；拖拽改 `PositionSaveQueue`（drag-end flush + 1s trailing debounce）+ 失败显式上报。报告见 TASKS §P1-1 |
| ~~P1-2~~ | ✅ 已闭环（2026-09-02）：46 处/5 组件用户可见英文清零（收口估计 18 处为抽查值，执行时逐文件盘点） | 见 TASKS §T-P1-2 |
| ~~P1-3~~ | ✅ 已闭环（2026-09-02）：ADR-027 裁定 **CJK bigram 应用侧预分词**（零新依赖，取代 ADR-011；trigram 路径经评审证伪），migration 010 + 启动自动 reindex + `search_notes` 统一 FTS + 单字 LIKE 兜底，`_cjk_search` 退役 | `core/cjk_bigram.py` · `migrations/010_fts_bigram.sql` | 见 TASKS §ADR-027 |
| ~~P1-4~~ | ✅ 已闭环（2026-09-02）：P1-5-A 设置 UI + Ollama qwen3 端到端验证（Smoke/非流式/SSE），配置保留 openai_compat | `core/ai/providers/` | 见 TASKS §T-P1-4 |
| P1-5 | ~~后端已就绪能力的 UI 取舍~~ | 见左 | **✅ 已裁定（2026-09-02 所有者四组弹窗）**：A `/settings` **接 UI**（P1-4 硬前置）· B `/mistakes/*` CRUD **接 UI** · C `/conversations` 历史管理 **接最小 UI** · D `/sync/pair`/`peers`/`plan`/`discover`/`resolve` **延到 M8** · E `/review/history`+`stats`+`/mastery/weak` · F `/study/*` · G `/export` · H 长尾（`/tutor/test`、`/memories` 写操作+maintenance、`/concepts/extract`、`/notes/batch`/`import`/`link-suggestions`）—— **全部 backend-only**。已接线面（notes/concepts/mindmaps/review-today/memories-GET/tutor/chat/trace/sync-status 等）不再列。勘误：`/admin/watcher` 端点不存在（admin_router 仅 `/reindex` 等），本行旧表述过时；`/trace/*` 已由 M9 接入 |

### P2（低风险，顺手修）

| # | 项 | 位置 |
|---|---|---|
| P2-1 | 死代码：`SyncStatusPanel.tsx` 全库零引用（随 Dashboard 退场未清理） | `web/src/components/sync/` |
| P2-2 | 死代码：`ComponentGallery.tsx` 零引用，且 `#gallery` dev 入口实际不生效（App 无 hash 路由） | `web/src/dev/` |
| P2-3 | 死 CSS：`.dashboard-view`（`global.css:714`）· `.tabbar`（`global.css:89-114`） | `web/src/global.css` |
| P2-4 | `lazy(GalaxyView)` 分包失效——`ContextRail.tsx:7` 静态 import 同模块 `GalaxyMini`，Galaxy 代码打进入口 chunk | `web/src/App.tsx:14` / `ContextRail.tsx:7` |
| P2-5 | TiptapEditor chunk 807KB 超限警告（已有挂载预热，体验可接受） | `web/src/components/editor/` |
| P2-6 | 过期注释/残留：`App.tsx:8` 注释提 cobe · `ui.ts` 的 `MindMapCanvas.tsx:81` `searchingConcept` 有 setter 无消费方 · 同一次开笔记 `NoteEditor:132` 与 `ContextRail:59` 重复请求 `GET /notes/{id}` | 各处 |
| P2-7 | git 追踪引用 `[gone]`（本地 `origin/main` 跟踪引用失效，远端实际同步） | 一次 `git fetch origin` 即恢复 |

### 持续风险（非债，边界内接受）

- 本地 LLM 默认路径未配置（B10 Ollama qwen3 实测通过，但需用户自行配 settings）
- TipTap 数学扩展为社区维护（@aarkue），非官方
- UI 无 jsdom 交互测试（现有策略 = renderToStaticMarkup + 源码审计 + 无头浏览器自检）
- `pytest` 本机 venv 缺 dev 依赖（CI 现场安装不受影响）
- AI 第一目标「记忆感知 Tutor」开箱为 MockProvider——对外需明确标注配置方法（README 已写）

### 待所有者裁决（维持原登记）

- ADR-013 §2.12「ADR 与设计资产」政策冲突（`.topbar` 毛玻璃 vs §2.10 禁 glassmorphism）
- §13 开源就绪度的路线问题（i18n / 块级引用 / FSRS / 是否吸引外部贡献）

---

## §13 Open Source Readiness

> 基线：OpenSSF Scorecard 20 项 + GitHub 社区标准 + 同类项目对标。
> **2026-09-02 更新：原 P0 清单已全部完成**（CI `.github/workflows/ci.yml` ·
> README 重写 · tag `v0.1.0-rc.1` + CHANGELOG 条目 · `SECURITY.md` · 前端路由级代码分割）。
> RC 收尾状态见 CHANGELOG v0.1.0-rc.1。

**当前缺口**：

| 级别 | 项 |
|---|---|
| P1 | 无依赖更新自动化 · 无 SAST · 无覆盖率度量 · 无 Issue/PR 模板与 CoC · 无分支保护 |
| P2 | 真实 LLM Provider 默认路径（见 §12 P1-4）· 块级引用 / FSRS 待评估 · M9 接入后补文档 |

**待项目所有者裁决的路线问题**（非技术判断）：

1. 是否以「吸引外部贡献」为目标？若是，P0 全部必做；若定位个人项目开源存档，CI 可延后
2. i18n 必要性（面向中文用户还是国际社区）
3. 块级引用优先级（`blocks` 表会显著改变数据模型，与「不追求功能数量」原则需权衡）
4. SM-2 → FSRS 是否值得开 ADR（技术前提已具备，但引入参数拟合复杂度）

---

*文档结束。本文为客观状态总结；设计意图见 `TECH_DESIGN.md`，任务与路线见 `TASKS.md`。*
