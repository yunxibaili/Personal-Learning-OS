# Project State Summary

> 项目状态客观总结 · 面向第一次接触项目的人
> 生成日期：2026-08-28 · HEAD：`8d0de31` · Branch：`main` · Commits：102
> 最后更新：2026-08-28（补入 `2c6b8d1` / `cc9915d` / `8d0de31`，同步测试数与提交数）
> 本文只陈述事实，不含建议、评价、重构方案或未来规划。

---

# 1. Project Overview

## 1.1 项目名称

| 项 | 值 |
|---|---|
| 产品名 | **Open Learning OS**（中文：个人学习操作系统） |
| 内部代号 | Personal Learning OS |
| 前端包名 | `plos-web`（`web/package.json`，version `0.1.0-dev`） |
| 仓库位置 | `D:\yunxibaili\Obsidian\learning-os` |
| 许可证 | Apache-2.0（`LICENSE` 已入库） |

## 1.2 一句话定位

> 一个开源、本地优先、AI 驱动的学习型知识操作系统：
> 帮助用户收集知识、理解概念、练习技能，并形成长期记忆。
> *Your knowledge is not a pile of notes. It is a universe that grows with you.*

## 1.3 项目目标（按优先级，源自 `PROJECT_BRIEF.md` §1.2）

| # | 目标 | 说明 |
|---|---|---|
| 1 | AI 学习助手 | 记忆感知 Tutor：知道"我学过什么、哪里薄弱"，而非通用聊天 |
| 2 | 长期记忆系统 | 四维掌握度 + SM-2 复习 + 错误本——产品灵魂 |
| 3 | 知识管理 | Markdown vault 双链 + 类型化知识图谱（Node = Entity） |
| 4 | 数学学习环境 | LaTeX 即时渲染 + SymPy/Jupyter（Phase 3 触发） |
| 5 | 编程学习环境 | 执行轨迹可视化 Trace→动画（M9/M10，非 IDE） |

## 1.4 解决的问题（`PROJECT_BRIEF.md` §2.3）

1. 笔记很多但用不起来 → 图谱 + 掌握度让知识"活"
2. 学完容易忘 → 遗忘曲线 + 自动复习排期
3. AI 回答没有个人上下文 → Tutor 前置查询掌握度 / 错误史
4. 错题没有沉淀成薄弱点 → `mistakes` 表 + 概念级归因

## 1.5 用户与使用场景

| 画像 | 说明 |
|---|---|
| P1 项目所有者 | 数学 / 编程 / 备考 |
| P2 学习者 | 大学生 / 自学 / 转行 / 考证 |
| P3 开源贡献者 | 需要文档完善 · 一键运行 · 数据开放 · 可扩展 |

**每日任务场景**：学数学 · 学编程 · 写笔记（双链 + LaTeX）· 复习（SM-2 队列）· 问 AI（带个人上下文）。

## 1.6 核心理念（`PRODUCT_PRINCIPLES.md` + `AGENTS.md` §0）

**五条产品原则**（决策冲突时的最高裁决依据）：

1. **用户数据永远属于用户** — vault 是开放 Markdown，SQLite 可随时删除重建，禁止私有格式/云端绑定
2. **Markdown 优先** — 正文、导图大纲、同步真相都是纯文本；TipTap JSON、向量、布局坐标永远是派生物
3. **AI 增强而非替代学习** — AI 负责诊断薄弱、针对性讲解、组织复习；不给答案替代思考
4. **本地优先** — 默认全部功能离线可用；云端可选且永远可关闭；网络白名单之外零外呼
5. **不追求功能数量，追求学习效果** — 每次设计过三问：用户真需要？现在必须做？三个月后新人能看懂？

**工程核心原则**：Local-first · Minimal Dependencies · Standard Library First · Open Source Reuse · Modular Architecture · Explicit Data Ownership · Version Control First · Small and Maintainable Codebase。

**明确不做**：对标或击败 Obsidian/Notion · 商业 SaaS · 云端绑定 · 用户锁死。

---

# 2. Architecture

## 2.1 整体分层

```
                          ┌─────────────┐
                          │    User     │
                          └──────┬──────┘
                                 ▼
        ┌────────────────────────────────────────────────┐
        │  Frontend   React 18 + TypeScript + Vite       │
        │  Zustand(UI state) · React Flow(图渲染)         │
        │  TipTap(编辑) · KaTeX(数学) · Cobe(星球)         │
        │  7 Views: Notes / Graph / Universe / MindMap /  │
        │           Tutor / Review / Dashboard            │
        └──────┬─────────────────────────────────────────┘
               │  HTTP  REST  /api/v1
               ▼
        ┌────────────────────────────────────────────────┐
        │  Backend API   FastAPI  (127.0.0.1:8000)        │
        │  15 APIRouters —— 只做参数校验与 JSON 序列化      │
        │  不含业务逻辑（separation.md 分层铁律）           │
        └──────┬─────────────────────────────────────────┘
               ▼
        ┌────────────────────────────────────────────────┐
        │  Core Engine  纯 Python 业务层（不 import FastAPI）│
        │  knowledge · concepts · mastery ·               │
        │  review_scheduler(SM-2) · universe · mindmap ·   │
        │  reindex · tutor_context · ai/ · sync/           │
        └───┬──────────────┬───────────────┬─────────────┘
            ▼              ▼               ▼
     ┌────────────┐ ┌──────────────┐ ┌──────────────────┐
     │  SQLite    │ │  Vault       │ │  AI Provider     │
     │  + FTS5    │ │  *.md        │ │  ProviderProtocol│
     │            │ │  *.mindmap.json│ │  → MockProvider │
     │ 元数据/索引 │ │  eventlogs/  │ │  (仅 Mock，无真实 │
     │ 学习状态    │ │              │ │   HTTP Provider) │
     │ (可重建缓存)│ │  ★事实源★    │ │                  │
     └────────────┘ └──────────────┘ └──────────────────┘
```

## 2.2 Frontend

| 维度 | 实现 |
|---|---|
| 框架 | React 18.3 + TypeScript 5.6 + Vite 5.4 |
| 状态管理 | Zustand 5（唯一状态库，`AGENTS.md` §2.2 禁止增加第二个） |
| 可视化 | 三套独立管线（ADR-023 边界冻结）：**Universe**（d3-force 力导向聚类 + 中央 Planet）/ **Graph**（dagre 层级布局）/ **Planet**（Cobe WebGL 点阵地球） |
| UI 架构 | 单一 `global.css`（无 CSS 框架、无 UI 组件库、无图标库——`AGENTS.md` §2.2 永久禁止）；顶部 tabbar + `main.content` 单页切换 |
| 编辑器 | TipTap v3（starter-kit + markdown + image + @aarkue math extension）+ KaTeX |
| 样式策略 | 手写 CSS 变量，`ADR-013` 前端设计系统冻结 |

## 2.3 Backend

| 维度 | 实现 |
|---|---|
| 服务框架 | Python 3.12 + FastAPI 0.115 + uvicorn，仅绑 `127.0.0.1`（`$env:PORT` 可覆盖） |
| 数据库 | SQLite（标准库 `sqlite3` 直写 SQL）+ FTS5；**无 ORM**（`AGENTS.md` §2.2 永久禁止） |
| API 架构 | REST，统一前缀 `/api/v1`（版本化，破坏性变更升 `/v2`）；15 个 APIRouter；错误统一 `{error:{code,message}}` |
| 分层 | Router（HTTP）→ Core（纯业务）→ DB；图计算与布局不越层（`separation.md`） |
| 图查询 | 递归 CTE（`local_graph`），不引图数据库 |
| 代码规模 | `server/app` Python ≈ 5,840 行；10 个 core 模块 + 14 个 router 文件 + `ai/`(5) + `sync/`(12) |

## 2.4 AI

| 维度 | 实现 |
|---|---|
| Provider | `LLMProvider` Protocol（`providers/base.py`，`runtime_checkable`）+ **仅 `MockProvider` 一个实现** |
| Context 系统 | `core/tutor_context.py` → `build_tutor_context(conn, concept_id)`，白名单式：concept / mastery / mistakes / related / review / recent_events；**禁止** vault 全文、settings、api_key、历史聊天、raw markdown（`ADR-010`、`ADR-014`） |
| Prompt 系统 | `core/ai/tutor.py` → `build_prompt()`（M4-B 冻结，`prompt-contract.md`）；分段截断 + 双重敏感过滤（字段名黑名单 + 内容前缀黑名单 `sk-`/`Bearer `/`ghp_`/`xoxb-`） |
| Token 控制 | `core/ai/constants.py`：`CHARS_PER_TOKEN=4`、SYSTEM 2000 / CONTEXT 10000 / QUERY 2000 字符上限 |
| 流式输出 | **未实现**。`complete(prompt) -> str` 一次性返回完整文本；无 SSE / StreamingResponse / EventSource |
| 编排框架 | 无 LangChain / LlamaIndex（永久禁止），管线全手写 |

## 2.5 Storage

| 层 | 内容 | 角色 |
|---|---|---|
| **Vault** | `workspace/vault/*.md` | ★正文唯一事实源★（ADR-001 冻结） |
| **旁车** | `workspace/vault/*.mindmap.json` | ★导图结构唯一事实源★（ADR-002 / ADR-021） |
| **事件日志** | `workspace/metadata/eventlogs/*.jsonl` | 学习状态跨端可回放真相（ADR-005 / ADR-020） |
| **SQLite** | `workspace/db/learning-os.db` | 元数据 / 索引 / 学习状态缓存，**永不同步、可随时重建** |
| **FTS5** | `notes_fts` 虚拟表（title, body, note_id UNINDEXED） | 全文检索，随笔记保存增量维护 |

**索引关系**：Markdown 正文 → `upsert_note_index()` → `notes` 表 + `notes_fts`；`[[wikilink]]` → `rebuild_note_links()` → 多态 `links` 表；反向恢复走 `core/reindex.py` 的 `reindex_vault()`。

**同步真值三层模型**（ADR-020 冻结）：
- Layer 1 同步层：`vault/*.md` + `eventlogs/*.jsonl` + `mind_maps/*.mindmap.json`
- Layer 2 本地重建：`concepts` / `links` / `concept_mastery` / `review_queue`
- Layer 3 永不同步：`settings` / API keys / SQLite

## 2.6 四层空间边界

```
Knowledge Layer  →  Learning Layer  →  Thinking Layer  →  AI Assistance
```
（项目自定的产品空间边界，CURRENT_STATE「架构审查备忘」要求保持）

---

# 3. Technology Stack

## Frontend
- React 18.3 · TypeScript 5.6 · Vite 5.4
- Zustand 5（状态管理，唯一）
- @xyflow/react 12.11（React Flow，仅渲染）
- dagre 0.8.5（Graph 层级布局）
- d3-force 3.0.0（Universe 物理聚类，ADR-007 唯一批准例外）
- cobe 0.6.5（WebGL 点阵地球）
- TipTap 3.30（starter-kit / markdown / extension-image / @aarkue tiptap-math-extension）
- KaTeX 0.16（数学渲染）
- 单一 `global.css`，无 CSS 框架

## Backend
- Python 3.12 · FastAPI 0.115 · uvicorn 0.30 · python-multipart
- 标准库 `sqlite3` 直写 SQL（无 ORM / Query Builder）
- 递归 CTE 图查询
- Pydantic（请求体模型）
- `atomic_write_file`：write → fsync → rename（P2 原子写）

## Database
- SQLite 3 + FTS5（默认 unicode61 分词）
- migration runner（`server/migrations/001`~`006`，`schema_migrations` 记录）
- 无 ORM、无图数据库、无向量数据库

## AI
- `LLMProvider` Protocol + `MockProvider`（唯一实现）
- `build_prompt()` 手写 prompt 组装
- Token 截断与双重敏感字段过滤（`constants.py`）
- 设计目标：OpenAI-compatible HTTP 接口（DeepSeek/Qwen/OpenAI/Ollama 任一，settings 驱动）——**当前未落地**

## Testing
- pytest 8 + httpx（FastAPI TestClient）→ **463 passed**
- vitest 2.1 → **23 passed**（3 个测试文件：ui 2 / universe layout 14 / graph layout 7）
- 单元测试按 `unit/` `api/` `integration/` 分目录

## Build
- Vite 5.4（产物 ≈1.32 MB JS / 81 KB CSS）
- `tsc --noEmit` 类型门禁（`npm run build` = tsc && vite build）
- `scripts/test.ps1`（全量测试入口）
- `scripts/seed_demo.py`（35 个纯概念 demo 种子，幂等）

## Documentation
- 23 份 ADR（ADR-001 ~ ADR-023）
- `AGENTS.md`（工程宪法）、`TECH_DESIGN.md`（§1-§10 唯一技术来源）、`docs/ai/CURRENT_STATE.md`、`docs/tasks/TASKS.md`、`CHANGELOG.md`
- 8 份 HTML 架构图（`docs/diagrams/`）

---

# 4. Completed Features

## Knowledge Input（知识输入）

**说明**：把外部知识写入系统的入口。Markdown 为唯一事实源，SQLite 仅存索引。

**已经实现**：
- Note CRUD（GET/POST/GET-by-id/PATCH/DELETE `/api/v1/notes`）
- Markdown vault 文件存储（`workspace/vault/*.md`）
- TipTap v3 富文本编辑器 + Markdown 序列化
- KaTeX 数学公式渲染
- 附件上传与相对 URL 引用（`/api/v1/attachments/{name}`）
- FTS5 全文检索（`sanitize_fts_query` 防注入，`LOWER` 大小写无关）
- YAML frontmatter 解析 + tags
- `content_hash` 增量索引判断
- 原子写入（write → fsync → rename）
- `[[wikilink]]` 三级解析 + 自动建桩（stub）
- 附件路径守卫（`has_forbidden_media_path`）
- Vault → SQLite 索引恢复（`POST /api/v1/admin/reindex`）

**未实现**：
- 批量导入
- Vault 自动监听（文件系统 watcher）
- 外部格式导入（Obsidian / Notion / Markdown 目录）
- 笔记模板
- 增量 reindex（`changed_paths` 接口已预留，MVP 退化为全量）

## Knowledge Understanding（知识理解）

**说明**：把笔记转化为结构化、可视化的知识结构。

### Universe
- `GET /api/v1/universe` 投影端点（`core/universe.py`）
- `lib/universe/layout.ts` 布局纯函数（domain 径向分组 + d3-force 确定性输出）
- `PlanetNode` 中央聚合星球（concept 数→半径 / mastery→光晕 / 活跃→呼吸动画 / domain→轨道环）
- `ConceptNode` hover 抬升 + weak 状态虚线环（mastery < 0.3）
- Floating Inspector（替换右侧抽屉）
- 拖动位置 + viewport 持久化（localStorage）
- Focus 模式周边渐隐（opacity 0.15）

### Graph
- `GET /api/v1/graph` 读模型（递归 CTE，depth 1~3）
- P8-002 Graph V2：dagre 层级布局
- Concept（圆形）/ Note（方形）双视觉节点
- Layer Toggle（Mixed / Concept / Note）
- Edge 视觉层次（9 种 relation 样式）
- MiniMap 导航 + hover relation label + domain 过滤
- `layout.test.ts` 7 项测试

### Concept
- `/api/v1/concepts` CRUD（GET 列表 / GET 详情 / GET domains / POST @201 / PATCH）
- `origin` 唯一来源字段（manual / markdown / ai_suggested）——ADR-023 冻结，BLOCK 裁决废弃 `source_type` 方案
- `status` 生命周期字段（stub → confirmed → active → archived）
- `core/concepts.py` 纯 Core 业务层，`VALID_ORIGINS` 校验
- 创建 concept 不产生 learning_event / mastery / review_queue / links（ADR-019/022 边界）
- 29 项测试

## Knowledge Organization（知识组织）

### Links
- 多态 `links` 表（`source_type`/`target_type` 支持 note|concept，预留 code_symbol/formula/person/resource）
- 9 种 relation：wikilink / mentions / requires / related / contains / contrasts_with / derived_from / implements
- `origin` 字段：manual / markdown / ai_suggested / accepted
- 反链 API（`GET /notes/{id}/backlinks`）
- 级联清理（`cascade_drop_entity`）
- 上下文感知建议（`/knowledge/suggest`：FTS 匹配 + concept LIKE + 图谱邻居）

### MindMap
- React Flow 画布（`MindMapCanvas`）
- Map / Node / Edge CRUD（14 个 API 端点）
- Concept Binding（引用 concept，不改 mastery/event）
- Export / Import（`.map.json`，ADR-021 交换格式 v1，含 ID 重映射）
- 旁车 `*.mindmap.json` 为结构真相（ADR-002）
- ADR-019 边界冻结（Universe ≠ MindMap）

## Knowledge Gap Detection（薄弱点检测）

### Mastery
- 四维掌握度：knowledge 0.35 / practice 0.30 / recall 0.20 / transfer 0.15（权重冻结）
- `effective` 加权派生值
- **P8-003B 时间衰减**：`decay_effective()` Ebbinghaus 函数（tau=14 天）+ `get_effective_now()` 动态掌握度
- `last_seen` 数据源 = `MAX(learning_events.created_at)`
- `update_mastery()` 事件驱动的增量更新

### Learning Events
- 追加式事件日志（`learning_events` 表）
- 事件类型 → 维度增量映射（answer_correct +0.15 / answer_wrong -0.10 / explain +0.08 等）
- `source` 来源追踪 + `detail` JSON 扩展列
- 学习时间线展示（Dashboard）
- **P8-003D Eventlog Producer**：`update_mastery()` 每次写 SQLite 后追加一行到 `workspace/metadata/eventlogs/<yyyy-mm>.jsonl`（`f.write` + `flush` + `os.fsync`），字段含 `event_id / concept_id / event_type / dimension / weight / source / detail / device_id / created_at`；写文件失败时 `except OSError: pass`，不阻断 SQLite 写入
- **`event_uuid` 落库**（`cc9915d`）：migration 007 加 `learning_events.event_uuid TEXT` 列 + `idx_events_uuid` UNIQUE 索引；`update_mastery()` 生成的 UUID 同时写入该列与 JSONL 的 `event_id`。历史行保持 `NULL`，按 `learning-model.md:219` 追加式约束不回填
- **设备身份单一来源**（`cc9915d`）：`device_id` 统一由 `core/sync/device.py` 的 `load_or_create_device()` 提供（纯 UUID4，存 `metadata/devices.json`），eventlog 与 M7 同步共用同一身份

### Weak Area
- `GET /mastery/weak/list`（`get_weak_concepts`，limit 10）
- Universe / Graph 中 weak 状态视觉标记

## Review System（复习系统）

### SM-2
- `core/review_scheduler.py` 独立模块（可替换为 FSRS/Leitner，需开 ADR）
- 标准 SM-2 公式：ease_factor 更新 + interval 更新 + quality<3 重置
- 可注入 `now` 参数（测试确定性）

### Review Queue
- `review_queue` 表（due_at / priority / status / last_result）
- `GET /review/today` 排序：错答优先 → `effective_now` 低优先 → 到期早优先
- 错答提升优先级（0.8），正答保持默认（0.5）

### Review Session（P8-003A）
- `ReviewSessionView.tsx` 状态机：idle → loading → ready → answering → feedback → done
- 三按钮评分（😵忘记了(1) / 🤔有点模糊(3) / ✨记得很清楚(5)）
- `POST /review/{id}/answer` → feedback（mastery 变化 + 下次复习日期）
- 完成统计（复习数量 + 记忆保持率）
- 不新增后端 / 不改 migration / 不加依赖

### Mastery Decay（P8-003B）
- `decay_effective(base, days, tau=14)` Ebbinghaus 衰减
- `get_effective_now()` 动态计算
- `review_today` 使用 `effective_now` 排序
- Tutor context 使用衰减后掌握度
- API 输出 `effective_now` 字段
- 14 项测试（衰减函数 8 + get_effective_now 4 + 时间真实性 2）

## AI Tutor

**当前能力**：
- 上下文构建：`build_tutor_context()` 白名单 6 类（concept / mastery / mistakes / related / review / recent_events）
- Prompt 组装：`build_prompt()`（M4-B 冻结），分段截断 + 敏感过滤
- Provider 抽象：`LLMProvider` Protocol + `MockProvider`
- Service 层：`TutorService.ask()` / `build_prompt_only()`
- 前端 `TutorPanel`：多模式（explain 等）+ 上下文透视面板
- `GET /tutor/context/{concept_id}`（上下文查询）
- `POST /tutor/test`（全链路 Smoke 端点，使用 MockProvider）
- 掌握度感知（P8-003B 后读取衰减后掌握度）
- ADR-014（Tutor 边界）/ ADR-015（多语言）/ ADR-016（Tutor UI）已冻结
- M4-E 评估体系

**未来未完成**：
- 真实 LLM Provider（当前仅 Mock）
- 流式输出
- Tutor 读取用户笔记内容（P8-003D，RAG 层）
- Tutor 复习桥接（P8-003E，读取 mastery + 错答历史）
- Extractor（回合后二次 LLM 调用）
- 对话持久化（`conversations` / `messages` 表存在但 0 行）
- 用户记忆（`memories` 表存在但未使用）

---

# 5. Current Capabilities（能力矩阵）

| 模块 | 已实现 | 未实现 |
|---|---|---|
| **输入知识** | ✅ Note CRUD<br>✅ Markdown vault 存储<br>✅ TipTap + KaTeX<br>✅ 附件上传<br>✅ FTS5 搜索<br>✅ `[[wikilink]]` 双链<br>✅ 原子写入<br>✅ Vault Reindex | ❌ 批量导入<br>❌ Vault 自动监听<br>❌ 外部格式导入<br>❌ 笔记模板 |
| **组织知识** | ✅ 多态 links 表（9 种 relation）<br>✅ 反链 API<br>✅ MindMap CRUD<br>✅ Concept Binding<br>✅ MindMap 导入导出 | ❌ 大纲反解析（M2b 挂起）<br>❌ AI 生成导图 |
| **理解知识** | ✅ Universe（d3-force + Planet）<br>✅ Graph V2（dagre + 双节点）<br>✅ Concept CRUD + origin<br>✅ Knowledge Radar MVP<br>✅ Knowledge Planet（Cobe） | ❌ AI 概念提取<br>❌ 自动链接建议（auto-link） |
| **薄弱检测** | ✅ 四维掌握度<br>✅ effective 加权<br>✅ Ebbinghaus 衰减<br>✅ learning_events 日志<br>✅ Weak Area API + 视觉标记 | ❌ 错题本（`mistakes` 表 0 行，无 API/UI）<br>❌ AI 薄弱诊断 |
| **复习** | ✅ SM-2 调度<br>✅ Review Queue<br>✅ Review Session UI<br>✅ Mastery Decay<br>✅ Review History API | ❌ 复习历史分析 UI<br>❌ Study Session<br>❌ 自定义复习卡组 |
| **AI** | ✅ Context 构建（白名单 6 类）<br>✅ Prompt 组装 + 截断 + 敏感过滤<br>✅ ProviderProtocol + Mock<br>✅ TutorPanel UI（多模式）<br>✅ /tutor/test 全链路 | ❌ 真实 LLM Provider<br>❌ 流式输出<br>❌ Knowledge Base（RAG）<br>❌ Review Bridge<br>❌ 对话持久化<br>❌ 用户记忆 |
| **同步** | ✅ Sync Engine Core（manifest/scanner/diff）<br>✅ LAN Discovery（UDP 广播）<br>✅ Transport（消息协议 + 原子传输）<br>✅ Apply Layer（唯一写入口 + 双重校验）<br>✅ Conflict UI（mindmap artifacts）<br>✅ E2E LAN Demo（双进程字节级一致）<br>✅ Release Audit PASS | ❌ 移动设备同步（M8 未启动）<br>❌ 自动定时同步 |
| **发布** | ✅ 本地开发双端运行<br>✅ migration runner<br>✅ 23 份 ADR + 完整文档体系 | ❌ 数据全量导出（T-EXPORT）<br>❌ Tauri 桌面打包（M6）<br>❌ Docker<br>❌ i18n |

---

# 6. Database Model

## 6.1 主要表

| 表 | 字段与作用 |
|---|---|
| **notes** | `path`(vault 相对路径，唯一) · `title` · `tags_json` · `content_hash`(sha256，增量索引) · `mtime` · 时间戳。**只存元数据，正文在 `vault/*.md`** |
| **concepts** | `title`(唯一) · `aliases_json` · `summary` · `domain`(自由文本) · `origin`(manual/markdown/ai_suggested，来源唯一事实字段) · `status`(stub→confirmed→active→archived 生命周期) |
| **links** | 多态关系统一表：`source_type`/`source_id` · `target_type`/`target_id` · `relation`(9 种) · `origin` · `weight`。UNIQUE 五元组约束；预留 code_symbol/formula/person/resource |
| **concept_mastery** | `dimensions`(JSON：knowledge/practice/recall/transfer) · `effective`(加权派生) · `next_review` · `ease_factor`(SM-2) · `interval` · `review_count` |
| **review_queue** | `concept_id`(PK) · `due_at` · `priority`(0.5 默认 / 0.8 错答) · `status`(pending) · `last_result`(correct/wrong) |
| **learning_events** | 追加式日志：`concept_id` · `event_type` · `dimension` · `weight` · `source` · `detail`(JSON) · `created_at`。**掌握度的唯一驱动源** |
| **notes_fts** | FTS5 虚拟表：`title` · `body` · `note_id UNINDEXED` |
| **mind_maps / mind_map_nodes / mind_map_edges** | MindMap 三表（ADR-019）；结构真相仍为旁车 `*.mindmap.json`，表为编辑器工作区 |
| **settings** | `key`/`value` JSON，存 LLM base_url/api_key/model；api_key 类读取脱敏为 `******` |
| **mistakes** | `concept_id` · `description` · `resolved`。**表存在，0 行** |
| **memories** | `kind`(fact/preference/goal/mistake_pattern) · `content` · `importance` · `confidence`。**表存在，0 行** |
| **conversations / messages** | 对话与消息，`context_json` 存上下文快照。**表存在，0 行** |

## 6.2 数据关系

```
Note  (vault/*.md 为正文真相，notes 表为索引)
  │
  │  [[wikilink]] / mentions
  ▼
Link  (多态 links 表：source_type|target_type = note|concept，relation 9 种)
  │
  ▼
Concept  (concepts 表，origin 记来源 / status 记生命周期)
  │
  ▼
Mastery  (concept_mastery：四维 dimensions → effective → effective_now 衰减值)
  │
  ▼
Review  (review_queue：due_at + priority + last_result；SM-2 排期)

旁路：learning_events（追加日志）──驱动──▶ Mastery 更新
      mistakes / memories ──（表已建，未接入）
```

## 6.3 Migration 历史

| 版本 | 内容 | 日期 |
|---|---|---|
| 001_init | 11 表 + notes_fts 初版 | 2026-08-26 |
| 002_links_unify | 统一 links 表，DROP note_links/note_concepts/edges（ADR-008） | 2026-08-26 |
| 003_concept_status | concepts 增加 `status` 列（ADR-008/009） | 2026-08-26 |
| 004_learning | 重建 concept_mastery / learning_events / review_queue（M3） | 2026-08-27 |
| 005_events_quality | learning_events 增加 `detail` 列（M4-Preflight） | 2026-08-27 |
| 006_mindmap | mind_maps / mind_map_nodes / mind_map_edges（ADR-019，M2b） | 2026-08-27 |

**延后建表（禁止提前创建）**：`blocks`（块级引用立项）· `embeddings`（RAG 立项且概念数 >2000）· `concept_demos`（M9 后评估）。

## 6.4 当前实际数据量（`workspace/db/learning-os.db`）

| 表 | 行数 |
|---|---|
| concepts | 17 |
| notes | 5 |
| links | 5 |
| concept_mastery | 3 |
| review_queue | 3 |
| learning_events | 7 |
| mistakes / memories / conversations / messages | 0 |
| mind_maps / mind_map_nodes / mind_map_edges | 0 |

---

# 7. API Overview

统一前缀 `/api/v1`，共 **15 个 APIRouter / 14 个 router 文件**。

| 类别 | 端点 | 职责 |
|---|---|---|
| **Notes API** | `GET /notes`<br>`POST /notes` @201<br>`GET /notes/{id}`<br>`PATCH /notes/{id}`<br>`DELETE /notes/{id}` | 笔记元数据 CRUD；正文读写走 vault 文件；创建时解析 wikilink 并建索引 |
| **Concepts API** | `GET /concepts`（domain/origin/status 过滤）<br>`GET /concepts/domains`<br>`GET /concepts/{id}`（含 mastery）<br>`POST /concepts` @201<br>`PATCH /concepts/{id}` | 概念实体 CRUD。**无 DELETE**（ADR-023 边界） |
| **Links API** | `GET /notes/{id}/backlinks` | 反链查询 |
| **Graph API** | `GET /graph`（root_type / root_id / depth 1~3） | 图谱读模型，递归 CTE，只读 |
| **Universe API** | `GET /universe` | Universe 可视化投影（nodes + edges） |
| **Mastery API** | `GET /mastery`<br>`GET /mastery/{id}`<br>`POST /events` @201<br>`GET /mastery/weak/list` | 四维掌握度查询 · 学习事件记录 · 薄弱概念列表 |
| **Review API** | `GET /review/today`<br>`POST /review/{id}/answer`<br>`GET /review/history` | SM-2 复习队列 · 答题提交（更新 mastery + 排期 + 队列）· 复习历史 |
| **MindMap API** | `GET/POST/DELETE /mindmaps` · `/nodes` · `/nodes/{id}/bind` · `/edges` · `/concepts/search` · `/export` · `/import` | 思维导图 CRUD · 概念绑定 · ADR-021 交换格式导入导出（共 14 端点） |
| **Tutor API** | `GET /tutor/context/{concept_id}`<br>`POST /tutor/test` | 结构化学习上下文 · 全链路 Smoke（Context→Prompt→Provider→Response，使用 MockProvider） |
| **Sync API** | `GET /sync/status`<br>`POST /sync/resolve`<br>`GET /sync/files/{path}`<br>`POST /sync/receive` | 冲突列表派生 · 冲突解决（keep_local/keep_remote）· 文件代理 · 接收远端数据（强制经 SyncApply） |
| **Search API** | `GET /search` | FTS5 全文检索 |
| **Suggest API** | `GET /knowledge/suggest` | 上下文感知知识建议（FTS + concept LIKE + 图谱邻居） |
| **Settings API** | `GET /settings`<br>`PUT /settings` | 配置读写（api_key 脱敏） |
| **Attachments API** | `POST /attachments`<br>`GET /attachments/{name}` | 附件上传与读取 |
| **Admin API** | `POST /admin/reindex`（`prune` 参数） | Markdown → SQLite 索引恢复（Sync 接收后自动触发） |

---

# 8. Frontend Structure

## 8.1 View 清单（7 个 tab，`web/src/App.tsx`）

| Tab | 组件 | 作用 |
|---|---|---|
| 笔记 | `NoteEditorView` | TipTap 编辑器 + 笔记列表 + 反链 + FTS 搜索 + 附件上传 + Knowledge Radar |
| 图谱 | `GraphView` | dagre 层级布局关系图 · Concept/Note 双节点 · Layer Toggle · MiniMap · Floating Inspector |
| Universe | `KnowledgeUniverse` | 知识宇宙：d3-force 域聚类 + 中央 Planet + 节点 hover/拖动 + Inspector + Focus 模式 |
| 导图 | `MindMapCanvas` | React Flow 思维导图 · 节点 CRUD · Concept Binding · 导入导出 |
| AI Tutor | `TutorPanel` | 多模式 AI 问答 + 上下文透视面板（当前接 `/tutor/test`，MockProvider） |
| 复习 | `ReviewSessionView` | SM-2 复习会话（idle→loading→ready→answering→feedback→done） |
| 仪表盘 | `DashboardView` | Knowledge Planet（Cobe 地球）+ Sync Status Panel + 今日复习 + 掌握度排行 + 学习时间线 |

**隐藏入口**（URL hash，不占 tab）：`#preview` → `UniverseInteractionPreview` · `#planet` → 原型版 `KnowledgePlanet`。

## 8.2 目录结构

```
web/src/
├── App.tsx                    7-tab 路由 + 隐藏 hash 入口
├── stores/ui.ts               Zustand UI 状态（activeView）
├── lib/
│   ├── api.ts                 HTTP 客户端（apiGet/Post/Patch/Delete/Upload + ApiError）
│   ├── graph/layout.ts        dagre 布局纯函数
│   └── universe/layout.ts     d3-force 布局纯函数
├── components/
│   ├── editor/TiptapEditor.tsx
│   ├── graph/                 GraphConceptNode · GraphNoteNode · GraphEdge
│   ├── mindmap/               MindMapCanvas · MapNode
│   ├── planet/KnowledgePlanet.tsx
│   ├── sync/SyncStatusPanel.tsx
│   ├── tutor/TutorPanel.tsx
│   ├── universe/              KnowledgeUniverse · PlanetNode · ConceptNode
│   ├── universe/prototype/    （未入库的原型实验）
│   └── KnowledgeRadar.tsx     M3.5-A 已冻结（ADR-012）
├── views/                     DashboardView · GraphView · NoteEditor · ReviewSessionView · placeholders
└── global.css                 唯一样式文件
```

**分层铁律**：UI 组件内禁止图计算；布局引擎为独立纯函数模块（`separation.md`、`ADR-008`）。

## 8.3 前端测试

3 个测试文件 / 23 passed：`ui.test.ts`(2) · `universe/layout.test.ts`(14) · `graph/layout.test.ts`(7)。

---

# 9. Remaining Features（未实现能力，仅列事实）

- 真实 LLM Provider（当前仅 `MockProvider`，无 HTTP 实现）
- 流式输出（SSE / StreamingResponse）
- Tutor 读取用户笔记内容（P8-003D 的 RAG 层：FTS5 + concept→notes→context；同名编号下的 Eventlog Producer 已于 `2c6b8d1` 落地）
- Tutor 复习桥接（P8-003E：读取 mastery + 错答历史）
- 批量导入
- Vault 自动监听（当前仅手动 `POST /admin/reindex`）
- AI 概念提取（Extractor）
- 自动链接建议（auto-link）
- AI 生成思维导图
- 错题本（`mistakes` 表 0 行，无 API / 无 UI）
- 用户记忆（`memories` 表未接入）
- 对话持久化（`conversations` / `messages` 0 行）
- Review 历史分析
- Study Session
- M2b 大纲反解析（`*.mindmap.json` → Markdown 大纲，挂起）
- 数据全量导出（T-EXPORT，README 标注为发布前必须项）
- Tauri 桌面打包（M6）
- Mobile MVP（M8，路线决议已延后至 PC 完整化之后）
- Visual Engine V1 / Trace 动画（M9）
- AI 生成可视化（M10）
- Docker / i18n / 插件运行时（仅目录约定）
- 中文 FTS 分词优化（ADR-011 已记录，未解决）
- 本地 LLM（Ollama）实测验证

---

# 10. Current Development Status

## 10.1 项目阶段判定

**当前阶段：MVP 后期 —— 核心学习闭环已打通，处于「P8 PC 产品化」阶段。**

判定依据（事实）：
- 后端 453 测试 + 前端 23 测试全绿，`tsc --noEmit` PASS，`vite build` PASS
- 99 次提交，23 份 ADR，6 个 migration，文档体系完整（README / TECH_DESIGN / AGENTS 宪法 / TASKS / CURRENT_STATE）
- 但尚无正式发布版本（`version 0.1.0-dev`），无 Tauri 打包，无数据导出，AI 环节仅到 Mock

## 10.2 核心闭环完成度

| 闭环 | 链路 | 状态 |
|---|---|---|
| **输入** | 编辑器 → Markdown vault → SQLite 索引 + FTS | ✅ 已通 |
| **组织** | wikilink → links 表 → 反链 / MindMap 绑定 | ✅ 已通 |
| **理解** | 概念 → 图谱（Graph/Universe/Planet）可视化 | ✅ 已通 |
| **复习** | SM-2 队列 → Review Session 答题 → mastery 更新 → 衰减 → 重排期 | ✅ 已通（P8-003A + P8-003B 打通） |
| **AI** | Context → Prompt → Provider → Response → UI | ⚠️ **半通**——全链路已接通，但 Provider 仅 Mock，无真实 LLM；且无 note 内容检索（P8-003D 未做） |
| **同步** | Scan → Diff → Transport → Apply → Workspace → Reindex | ✅ 已通（M7-006 E2E 双进程字节级一致验证） |

**结论**：4 个闭环完全打通（输入 / 组织 / 理解 / 复习），1 个闭环半通（AI，缺真实 Provider 与知识库检索），1 个闭环打通（同步）。

**尚未完成的闭环**：AI 真实闭环（依赖 P8-003D/003E 与真实 LLM Provider）· 数据导出闭环 · 桌面/移动分发闭环。

## 10.3 最近开发状态（7 个 commit，按时间顺序）

### `ed1858d` — P8-002 Graph V2（2026-08-28 15:34）
> feat: P8-002 Graph V2 — dagre layout + dual nodes + layer toggle + inspector

- `lib/graph/layout.ts`（97 行）：dagre 层级布局纯函数，`nodesep`/`edgesep`/`ranksep` 参数化
- `layout.test.ts`（75 行，7 项测试）：空输入 / 单节点 / 层级方向 / 同层 / 确定性 / 混合类型
- `GraphConceptNode.tsx`（66 行，圆形概念节点）/ `GraphNoteNode.tsx`（50 行，方形笔记节点）/ `GraphEdge.tsx`（77 行，9 种 relation 边样式）
- `GraphView.tsx` 完全重写（+233/-92）：Layer Toggle（Mixed/Concept/Note）+ MiniMap + Floating Inspector + hover relation label + domain 过滤
- `global.css` +113 行 Graph 样式
- 依赖 `dagre ^0.8.5`（六连问通过，REGISTRY 登记）
- 15 文件，+771/-92

### `c020e53` — P8-003A Review Session MVP（2026-08-28 17:08）
> feat: P8-003A Review Session MVP — connect SM2 learning loop

- `ReviewSessionView.tsx`（271 行，新建）：SM-2 复习流程接入真实 UI，状态机 idle→loading→ready→answering→feedback→done
- 三按钮评分（😵忘记了(1) / 🤔有点模糊(3) / ✨记得很清楚(5)）→ `POST /review/{id}/answer` → feedback（mastery 变化 + 下次复习日期）
- `App.tsx`：ReviewQueueView → ReviewSessionView
- `global.css` +156 行复习样式
- `shared/types/mastery.ts`：ReviewItem 增加 `effective` 字段
- **不改后端 / 不改 migration / 不加 API / 不加依赖**
- 8 文件，+545/-16

### `38208ef` — P8-003C Vault Reindex（2026-08-28 17:25）
> feat: P8-003C Vault Reindex — Markdown→SQLite index recovery

- `core/reindex.py`（121 行，新建）：`reindex_vault(conn, vault_root, changed_paths=None, prune_missing=False)` 纯函数
- 扫描 `vault/*.md` → `upsert_note_index` + `rebuild_note_links` + 可选 prune
- `routers/notes.py` 新增 `admin_router` + `POST /api/v1/admin/reindex`
- `routers/sync.py`：receive 后自动 reindex（Post-sync consistency hook）
- `main.py` 注册 admin_router
- `test_reindex.py`（159 行，13 项）：基础(4) + 幂等(2) + 删除安全(3) + Links(3) + Sync Hook(1)
- 9 文件，+388/-13

### `23b27ba` — P8-003B Mastery Decay（2026-08-28 17:42）
> feat: P8-003B Mastery Decay — Ebbinghaus time-based effectiveness

- `core/mastery.py`（+64）：`decay_effective()`（Ebbinghaus，tau=14 天）+ `get_effective_now()` + `_get_last_seen()`（UTC-aware）
- `routers/mastery.py`（+38/-…）：`review_today` 改为 Python 侧 `effective_now` 排序（错答优先 → 低衰减掌握度优先 → 早到期优先）；`_format_mastery` 输出 `effective_now`
- `core/tutor_context.py`：Tutor 读取衰减后掌握度
- `test_decay.py`（152 行，14 项）：衰减函数(8) + get_effective_now(4) + 时间真实性(2)
- `shared/types/mastery.ts`：`MasteryDetail` + `ReviewItem` 增加 `effective_now`
- 9 文件，+320/-30

### `2c6b8d1` — P8-003D Eventlog Producer（2026-08-28 17:54）
> feat: P8-003D Eventlog Producer — ADR-020 闭合

- `core/mastery.py`（+81）：`_get_device_id()`（env `PLOS_DEVICE_ID` → `metadata/device_id` 文件 → `hostname-uuid8`）+ `_write_eventlog()`（按月分片 jsonl，含 `event_id` / `device_id` / `created_at`）
- `update_mastery()`：生成 `event_uuid` → 写 `learning_events` → 追加 eventlog（OSError 静默，不阻断）
- `test_eventlog.py`（新建，8 项）：写入格式(3) + 设备标识(2) + 降级(2) + 隔离(1)
- 6 文件，+369/-14
- 作者声明 ADR-020 闭合；审计发现两处未闭合（`event_uuid` 未落库、设备标识与 `core/sync/device.py` 双轨），见 `docs/TECH_DESIGN_REVIEW.md` §6.1 / §6.2

### `cc9915d` — P8-003D-CodeReview P0 修复（2026-08-28 20:32）
> fix: P8-003D-CodeReview P0 修复 — 设备身份合并 + event_uuid 落库 + 连接泄漏

- `core/mastery.py`（−41 行）：删除 `_get_device_id()`，改由 `from .sync.device import load_or_create_device` 提供 `device_id`
- `core/mastery.py:144-146`：INSERT 增加 `event_uuid` 列
- `migrations/007_event_uuid.sql`（新建 5 行）：`ALTER TABLE learning_events ADD COLUMN event_uuid TEXT` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_events_uuid`
- `routers/notes.py:101`：`row = K.get_note_row(conn, note_id)` 移入 try 块，复用原连接（`finally: conn.close()` 不变）
- `test_smoke.py`：migration 计数 6→7；`test_eventlog.py`：删 3 项 `_get_device_id` 测试、增 1 项 `test_device_identity_shared_with_sync`（8→6 项，461→459 算术吻合）
- 7 文件，+73/−112
- 实测确认：真实数据库 `schema_migrations` 七条含 `007_event_uuid`，`learning_events` 含该列且 UNIQUE 索引存在；9 行中 7 行历史数据为 `NULL`（按 `learning-model.md:219` 追加式约束不回填）

### `8d0de31` — event_uuid 管道完整性回归守护（2026-08-28 21:37，HEAD）
> test: guard event_uuid pipeline integrity (N3 regression protection)

- `test_eventlog.py`（+92 行）：新增 4 项守护——`test_event_uuid_lands_in_both_stores`（SQLite.event_uuid ↔ eventlog.event_id 一一对应）、`test_eventlog_device_id_matches_identity_file`（三方身份相等）、`test_eventlog_never_contains_hostname`（Layer 1 不含 hostname）、`test_event_uuid_unique_index_enforced`（UNIQUE 索引真实生效）
- 素材来源：临时脚本 `server/_verify_p0.py` 第 7/8/11/12 项，脚本已删
- 1 文件，+92/−0；测试数 459→463
- 独立复核：回退 `mastery.py` INSERT 中的 `event_uuid` 后，`test_event_uuid_lands_in_both_stores` 与 `test_event_uuid_unique_index_enforced` 立即变红（修复前同一实验为全绿），恢复后 10/10 全绿

## 10.4 验证状态（本次实测，2026-08-28）

| 命令 | 结果 |
|---|---|
| `pytest -q` | **463 passed**（191.93s，复核于 `8d0de31`） |
| `npx vitest run` | **23 passed**（3 files） |
| `tsc --noEmit` | **PASS**（exit 0） |
| `vite build` | **PASS**（729 modules，1,317.67 kB JS / 81.34 kB CSS） |
| `git status` | 1 个未入库目录：`web/src/components/universe/prototype/` |

## 10.5 代码规模

| 项 | 数值 |
|---|---|
| git 追踪文件 | 213 |
| 提交数 | 102（单分支 main + origin/main） |
| 后端 Python | ≈ 5,840 行（`server/app`） |
| 前端 TS/TSX | ≈ 4,821 行（`web/src` + `shared`） |
| Core 模块 | 10（`core/`）+ 5（`core/ai/`）+ 12（`core/sync/`） |
| Router | 15 个 APIRouter / 14 个文件 |
| Migration | 6 |
| ADR | 23 |

## 10.6 冻结领域（改动需开 ADR）

| 领域 | 关联 |
|---|---|
| Markdown 模型 | ADR-001 |
| Graph API | M2-D |
| Knowledge Radar | M3.5-A / ADR-012 |
| Mastery 引擎 | M3 / learning-model.md |
| SM-2 调度 | `review_scheduler.py`（可替换但需 ADR） |
| Frontend Design | ADR-013 |
| AI Tutor 边界 | ADR-014 |
| Prompt Contract | M4-B / prompt-contract.md |
| Multilingual | ADR-015 |
| Tutor UI | ADR-016 |
| AI Boundary | Gate 1 |
| LLM Provider | M4-C / ProviderProtocol |
| MindMap Boundary | ADR-019 |
| MindMap Exchange Format | ADR-021 |
| Sync Truth Model | ADR-020 |
| Product Mode Boundary | ADR-022 |
| Visualization Boundary | ADR-023 |

## 10.7 Known Risks（项目自记录）

- 中文 FTS 分词未解决（unicode61 按字切分，长句检索受限，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）
- 本地 LLM 未实测（Ollama 路径理论通，未验证）
- Trace 引擎推迟（M9+）
- TipTap 数学扩展为社区维护（@aarkue），非官方

---

*文档结束。本文为客观状态总结，不含建议与规划。*
