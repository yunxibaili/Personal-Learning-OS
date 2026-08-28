# 全量代码审核与技术大纲审阅报告

> **审阅范围（两部分）**
> ① 技术大纲 `docs/TECH_DESIGN.md`（§1–§10，673 行，自称"项目唯一技术设计来源"）
> ② **全量代码**：`server/app/*`（core 10 + ai 5+3 + sync 12 + routers 14）、`web/src/*`、`shared/types/*`、`migrations/*`
>
> 审阅日期：2026-08-28 · 对照基准：HEAD `2c6b8d1`（P8-003D Eventlog Producer）
> **复核日期：2026-08-28 · 复核基准：HEAD `cc9915d`（P8-003D-CodeReview P0 修复）——见 §6.7**
> 审阅方法：逐项比对文档契约与实际代码，结论均附可回溯证据（文件 + 行号 / 实测输出）
>
> 本文为**合并版**：原「技术大纲审阅」内容保留在 §1–§5，新增「全量代码审核」在 §6–§8。
> 原 `docs/P8-003D_CODE_REVIEW.md` 已并入本文 §6.1，该文件已删除。

---

## 0. 总体结论

**TECH_DESIGN.md 的设计质量本身很高**——§1 定位、§3.2 否决备选表、§2.3 关键原则、§8 动效治理，这些章节的判断力与克制感在同类项目中属上乘，且大部分架构决策经 ADR 冻结后被执行得相当忠实。

**但它已不再是一份可用的技术设计文档。** 核心问题不是"写得不好"，而是**停更于 M3 前后，而代码已推进到 P8**。文档与实现之间出现了三类落差：

| 类别 | 数量 | 严重度 |
|---|---|---|
| **A. 架构级断裂**（承诺的机制不存在，且被测试掩盖） | 1 | 🔴 最高 |
| **B. 文档与实现漂移**（按文档写代码会直接报错） | 约 30 处 | 🟠 高 |
| **C. 文档内部矛盾**（同文件前后不一致） | 3 处 | 🟡 中 |

**全量代码审核结论**（§6 详述）：代码整体质量**高于同星段开源项目平均水平**——分层铁律无违规、无 SQL 注入、同步层 fail-closed 校验实现正确、前端资源清理完整。发现 **3 项 P0**（设备身份重复实现、`event_uuid` 未落库、文件描述符泄漏）与 4 项 P1。

> **✅ §6.7 复核更新（HEAD `cc9915d`）**：3 项 P0 已全部修复并经实测验证通过，
> 其中 1 项 P1（hostname 泄露到同步层）被一并消除。剩余 3 项 P1 未动，另发现 2 项新问题
> （`CURRENT_STATE.md` 声称的回填不存在、`load_or_create_device` 无缓存且会静默轮转身份）。
> 当前**未闭合问题以 §6.7.3 为准，不再以 §6.1–§6.3 为准**。
>
> **🔁 §6.7.6 二次独立复核（同 HEAD）**：三项 P0 的修复结论全部复核无误；
> 但新增 2 项发现，其中 **N3 为本次复核的最高优先项**——`event_uuid` 的回归保护为零，
> 回退实验证明「把 P0-2 完全改回去，6 项测试依然全绿」。建议立即处理。

**当前最需要先看的四个问题**：

1. 🟠 **`event_uuid` 没有任何测试保护**——回退实验证明，把 P0-2 的修复完全改回去，`pytest tests/unit/test_eventlog.py` 仍是 **6 passed**（§6.7.6 N3）。修复素材已在未入库的 `server/_verify_p0.py:第7项` 里，搬进测试即可
2. 🟠 **`docs/ai/CURRENT_STATE.md` 声称的「UPDATE 回填」不存在**——注意**不要去补回填**，它会违反 `learning-model.md:219` 追加式约束；正确做法是改文档（§6.7.3 N1，已在工作区待提交）
3. 🟠 **`load_or_create_device()` 无内存缓存**——每个学习事件读一次磁盘；且 `devices.json` 损坏时会**静默生成新 device_id 并覆盖原文件**，导致已配对设备失联（§6.7.3 N2）
4. 🟠 **§4.1 的 DDL 是已被 migration 004 废弃的旧 schema**——新人照文档写 SQL 必然报错（§2.1）

---

## 1. A 类：架构级断裂

### 1.1 🔴 `eventlogs/*.jsonl` 真相源没有生产者

**文档声明**（§5.4，以及 §2.3、§4.2、ADR-005、ADR-020）：

> 写入 `learning_events` 表的**同一事务内**，追加一行 JSON 到 `metadata/eventlogs/<yyyy-mm>.jsonl`
> 各端同步后按序回放 delta 重建掌握度；回放以 event id 幂等去重

> ADR-020 三层真值模型 · Layer 1 同步层 = `vault/*.md` + `eventlogs/*.jsonl` + `mind_maps/*.mindmap.json`

**实际状态**：

| 证据 | 结果 |
|---|---|
| 全仓库搜索 `.jsonl` 写入代码（`server/`、`scripts/`） | **0 处**（排除 `.venv` 第三方库） |
| `eventlogs` 在代码中的全部引用 | 均在 `core/sync/` 下，且**全是读侧**：`scanner.py`(扫描) · `manifest.py`(白名单) · `transfer.py`(传输) · `apply.py`(追加合并) |
| `core/mastery.py` 的 `update_mastery()` | 只 `INSERT INTO learning_events`（SQLite），**不写 jsonl** |
| `workspace/metadata/eventlogs/` 目录 | **自 2026-08-26 创建以来始终为空**（0 文件），而同期 DB 内已有 7 条 learning_events |

**后果链条**：

```
学习事件发生 → 只写 SQLite → 无 jsonl 产出
                              ↓
        Layer 1 同步真相的「学习状态」部分无数据源
                              ↓
        scanner/transfer/apply 的 eventlog 能力永远不会被真实触发
                              ↓
        掌握度 / SM-2 排期实际不参与跨端同步
                              ↓
        ADR-020 声称的「学习状态可由事件流回放重建」在当前代码下不成立
```

**为何 453 个测试没有发现**：M7 的 E2E 测试（`server/tests/integration/sync/test_e2e_demo.py:134`）是这样产生 eventlog 的：

```python
pair.write(pair.a, "metadata/eventlogs/2026-08.jsonl", ev("e1"))
pair.write(pair.b, "metadata/eventlogs/2026-08.jsonl", ev("e2"))
```

即**测试夹具手工写死的文件**。测试验证的是"同步系统能正确合并 eventlog"，而非"系统会产生 eventlog"。这是一处典型的**测试覆盖盲区**——被验证的是管道，管道的上游水源不存在。

**判断**：这是本次审阅发现的**唯一架构级缺陷**，也是唯一被测试体系掩盖的问题。其余所有问题都属于文档失修范畴。它不是设计错误（设计本身正确且严谨），而是**实现未闭合设计**。

---

## 2. B 类：文档与实现漂移

### 2.1 🔴 §4.1 DDL 是已废弃的旧 schema

文档自称「本项目唯一技术设计来源」，§4.1 的 DDL 因此具有规范效力。但其中两张核心表**是 migration 004 已 DROP 重建前的旧结构**：

#### `concept_mastery`

| 文档 §4.1 声明（第 203–218 行） | 实际（`migrations/004_learning.sql`） |
|---|---|
| `understanding` / `computation` / `proof` / `application` | ❌ 无此四列 |
| `overall` / `state` | ❌ 无此二列 |
| `ease` / `interval_days` / `reps` / `lapse_count` / `mistake_count` | ❌ 均无 |
| `last_reviewed_at` / `next_review_at` | ❌ 均无 |
| — | ✅ `dimensions`（JSON 四维） |
| — | ✅ `effective` / `next_review` / `ease_factor` / `interval` / `review_count` |

#### `learning_events`

| 文档 §4.1 声明（第 221–230 行） | 实际（`004_learning.sql` + `005_events_quality.sql`） |
|---|---|
| `delta` / `score` / `detail_json` / `occurred_at` | ❌ 均无 |
| — | ✅ `weight` / `source` / `created_at` / `detail` |

**后果**：新人按 §4.1 写的任何涉及掌握度或事件的 SQL 都会直接报 `no such column`。这是"唯一来源"定位下最不该出现的错误类型。

#### 缺失的表

`migration 006` 建立的 `mind_maps` / `mind_map_nodes` / `mind_map_edges` 三表**完全未出现在文档 DDL 中**，§7.2 仍在描述"旁车 json 承载结构、零新表"的方案（ADR-002 的旧决策）。

### 2.2 🔴 §5 Learning Graph 引擎：四维、权重、衰减、状态机全部不符

§5 是文档的核心章节（Learning Graph 被 §1 列为差异化壁垒之首）。逐项对照：

| 项 | 文档声明 | 实际实现（`core/mastery.py`） |
|---|---|---|
| **维度名** | `understanding`/`computation`/`proof`/`application` | `knowledge`/`practice`/`recall`/`transfer` |
| **权重** | 0.35 / 0.25 / 0.20 / 0.20 | 0.35 / 0.30 / 0.20 / 0.15 |
| **衰减机制** | `delta = w × (1 − current)`，**渐近逼近 1** | **固定增量** `dims[dim] + delta`，再 clamp [0,1]（第 111–112 行） |
| **遗忘曲线** | `effective = score × exp(−Δdays/τ)`，`τ = 30 × ease / 2.5` | `decay_effective(base, days, tau=14)`，**τ 固定 14 天，与 ease 无关**（P8-003B） |
| **状态机** | 六态 UNKNOWN/INTRODUCED/UNDERSTOOD/PRACTICED/MASTERED/FORGOTTEN（§5.2） | `concept_mastery` 表 **004 重建后已无 `state` 列**，六态无处存储 |
| **事件类型** | `study`/`explain`/`visualize`/`code_run`/`quiz_correct`/`quiz_wrong`/`review` | `answer_correct`/`answer_wrong`/`explain`/`visualize`/`review`/`code_run`——**`quiz_*` 不存在，`study` 不存在** |
| **quiz 增量** | correct +0.18 / wrong −0.10 | correct **+0.15** / wrong −0.10 |
| **explain 增量** | +0.04 understanding | **+0.08** knowledge |

**判断**：§5 整章描述的是一个**从未被实现的掌握度模型**。其中「渐近衰减」与「六态状态机」两项并非文档写错，而是**设计特性未实现**——这与 §1.1 属同一类型（设计正确、实现未闭合），但影响面更大，因为 §10 的 M3 验收标准正是按此模型写的。

### 2.3 §2.2 模块图：约半数条目不存在

| 文档声明 | 实际 |
|---|---|
| `core/llm.py` OpenAI-compatible HTTP client（标准库 urllib） | ❌ **不存在**（这正是 A 类之外最关键的缺失，见 §2.5） |
| `core/tutor.py` 上下文组装 + 对话编排 + extractor | ⚠️ 实际在 `core/ai/tutor.py`，职责**仅** `build_prompt()`；无对话编排、无 extractor |
| `core/syncengine.py` | ❌ 不存在，实际为 `core/sync/` 包（12 个模块） |
| `core/mastery.py` 掌握度 + 状态机 + SM-2 | ⚠️ SM-2 已独立为 `core/review_scheduler.py` |
| `web/views`: MindMapView / ReviewQueue / MemoryDashboard | ❌ 均不存在（实际为 `components/mindmap/MindMapCanvas`、`views/ReviewSessionView`、`views/DashboardView`） |
| `routers/`: chat / review | ❌ 无独立 chat router；review 端点在 `routers/mastery.py` |

**文档未列出但实际存在的模块**：`core/concepts.py`、`core/mindmap.py`、`core/reindex.py`、`core/review_scheduler.py`、`core/universe.py`、`core/ai/`（5 文件）、`core/sync/`（12 文件）；`routers/` 中的 `universe`、`mindmap`、`search`、`suggest`、`links`、`attachments`、`admin`。

### 2.4 §6 AI Tutor：管线仅实现约 1/3

| 文档 §6 | 实际 |
|---|---|
| §6.1 `llm.py` 手写 SSE 解析（~40 行 urllib） | ❌ 无实现；仅有 `LLMProvider` Protocol + `MockProvider` |
| §6.1 流式输出 | ❌ 无（`complete() -> str` 一次性返回） |
| §6.2 ①a FTS/子串概念匹配 | ❌ 无（`concept_id` 由调用方显式传入） |
| §6.2 ①b fast_model 概念匹配 | ❌ 无 |
| §6.2 ③ 前置链：递归 CTE 沿 requires 上溯 2 层 | ⚠️ `tutor_context` 的 `related` 取 1-hop 邻居，非 requires 上溯 2 层 |
| §6.2 ④ memories top 5 | ❌ 无（`memories` 表 0 行，未接入） |
| §6.2 ⑥ 流式回答 + `context_json` 存入 messages | ❌ 无（`conversations`/`messages` 表 0 行，无 API） |
| §6.3 extractor（回合后二次 LLM 调用） | ❌ 完全未实现 |

**已正确实现**：白名单式上下文（concept/mastery/mistakes/related/review/recent_events）、`build_prompt()`、token 截断、双重敏感过滤、`TutorPanel` 多模式 UI。

### 2.5 §7 Mind Map：存储路线已整体变更

§7 描述的是「旁车 json 三角色分工」方案，实际实现已转向**三张数据库表 + 独立 router**：

| 文档 §7 | 实际 |
|---|---|
| `PUT /notes/{id}/mindmap` | ❌ 不存在（实际 `/api/v1/mindmaps/*` 共 14 个端点） |
| 大纲段 `<!-- generated:mindmap -->` 派生视图 | ❌ **零实现**（全仓库 grep 无匹配） |
| §7.3 手写 tidy-tree 自动重排（~100 行） | ❌ 未实现 |
| §7.4 节点「提升为概念」建 contains 边 | ⚠️ 改为 Concept Binding（引用语义，ADR-019） |
| §7.5 `POST /ai/mindmap` AI 生成 | ❌ 不存在 |
| 结构真相 = 旁车 json | ⚠️ ADR-021 仍称旁车为真相，但 006 已建三表；两者关系未在任何文档说明 |

### 2.6 §8.1 Universe：三模式与布局持久化均已改道

| 文档 §8.1 | 实际 |
|---|---|
| 三模式 Galaxy / Explorer / Memory Map | ❌ 全仓库 grep **零匹配**；P8-001B 改为「Planet 中央聚合星球 + d3-force 域聚类」 |
| 位置缓存 `metadata/universe-layout.json` | ❌ 实际为 **localStorage**（`KnowledgeUniverse.tsx:134/148`） |
| 模块目录 `web/src/features/universe/` | ❌ 实际为 `components/universe/` + `lib/universe/` |

### 2.7 §3.1 依赖表

| 问题 | 说明 |
|---|---|
| 列出 `marked`（Chat 消息 Markdown 渲染） | ❌ **`web/package.json` 中未安装** |
| 未列 `dagre` ^0.8.5 | ✅ 已安装（P8-002） |
| 未列 `d3-force` ^3.0.0 | ✅ 已安装（ADR-007 唯一批准例外） |
| 未列 `cobe` ^0.6.5 | ✅ 已安装（P8-001C） |

### 2.8 §9 API 设计表：约 1/3 端点不存在，30+ 已实现端点未登记

**文档列出但代码中不存在的端点**（12 个）：

```
POST /notes/{id}/links/suggest          GET/PUT /notes/{id}/mindmap
POST /ai/mindmap                        POST /index/rebuild
GET/POST /concepts/{id}/edges           DELETE /edges/{id}
GET /suggestions/edges                  POST /suggestions/edges/{id}/accept|ignore
GET/POST /conversations                 GET /conversations/{id}/messages
POST /chat/stream (SSE)                 GET /sync/pair
POST /sync/manifest                     POST /sync/fetch · /sync/push
```

**参数不符**：§9 声明 `GET /graph?scope=global|local&root={id}&depth=n`；实际签名（`routers/graph.py:16-17`）为 `root_type` / `root_id` / `depth`，**无 `scope` 参数**。`POST /index/rebuild` 的实际对应物是 `POST /admin/reindex`。

**已实现但文档未登记**（30+ 个）：`/universe`、`/mindmaps/*`（14 个）、`/admin/reindex`、`/attachments/*`、`/mastery/weak/list`、`/review/history`、`/concepts/domains`、`/sync/files/{path}`、`/sync/receive`、`/tutor/context/{id}`、`/tutor/test`。

### 2.9 §4.2 数据目录约定

| 文档声明 | 实际（`workspace/metadata/`） |
|---|---|
| `metadata/devices.json`（已配对设备注册表） | ❌ 不存在 |
| `metadata/manifest.json`（本机文件指纹缓存） | ❌ 不存在（`manifest.py` 是代码模块 `SYNC_PATTERNS`，非文件） |
| `metadata/eventlogs/*.jsonl` | ⚠️ 目录存在但为空（见 §1.1） |

---

## 3. C 类：文档内部矛盾

### 3.1 视觉编码「颜色」自相矛盾

- **§8.1 视觉编码表（第 521 行）**：「颜色 = **掌握三色**：绿=掌握 / 黄=学习中 / 红=薄弱」，并在紧随其后的引述中明确「**领域(domain)不再用颜色区分**，改由力导向聚簇自然分组表达」
- **§10 M3b 验收标准（第 633 行）**：「颜色=**domain**」

两处对同一视觉通道给出互斥定义，且 §8.1 已显式否定了 domain 着色。

### 3.2 SM-2 ease 更新公式不一致

- **§5.3（第 363 行）**：`q < 3` → `ease − 0.2`（下限 1.3）
- **实际 `core/review_scheduler.py:36-37`**：标准 SM-2 公式
  `ef_delta = 0.1 − (1 − q/5)·(0.08 + (1 − q/5)·0.02)`，`new_ef = max(1.3, ease + ef_delta)`

两者在 q<3 时结果不同（文档为线性 −0.2，实现为非线性衰减）。

另：§5.3 声明 quality 由得分映射 `q = clamp(round(1 + s×4), 0, 5)`；实际前端 `ReviewSessionView` 直接传离散值 1 / 3 / 5，无 score→quality 映射环节。

### 3.3 「掌握度是缓存值」与「无回放数据源」矛盾

- **§2.3（第 98 行）**：「学习事件追加式：**掌握度永远可由事件流重放推导**，表里存的是缓存值」
- 但 eventlogs 无生产者（§1.1），`concept_mastery` 实际是**唯一**存储
- 结论：重放推导的前提（事件流文件）不存在，该表述在当前实现下不成立

---

## 4. 定位与结构问题

### 4.1 「唯一来源」定位失守

文档首行声明「本文档是项目唯一技术设计来源」，`docs/data-model/INDEX.md` 亦声明「完整 DDL、字段语义统一维护在 `TECH_DESIGN.md` §4，本文件只做变更追踪，避免两处 DDL 漂移」。

**实际 DDL 真相在 `server/migrations/`**，且已与文档分叉。三处维护（文档 / INDEX / migrations）中，只有 migrations 是准确的。这个"避免漂移"的设计意图，恰恰在它唯一想保护的字段上失败了。

### 4.2 §10 里程碑表无状态列

§10 表格只有 M0 标注 ✅，M1–M10 全部无状态标记。实际状态维护在 `docs/tasks/TASKS.md`，两份并行维护且已分叉（TASKS 中 M3/M4/M5/M3b 均已完成，P8 系列 8 项已完成，§10 中完全未出现 P8）。

### 4.3 缺少的章节

| 缺失内容 | 说明 |
|---|---|
| **P8 阶段设计** | Graph V2（dagre）、Review Session（SM-2 UI）、Mastery Decay（Ebbinghaus）、Vault Reindex 四项均已实现，大纲中无任何设计描述 |
| **Reindex 机制** | §2.3 提到「启动时全量扫描校验一致性（hash 不符则重索引）」，实际未实现启动扫描，改为手动 `POST /admin/reindex` |
| **Sync 系统** | M7 的 12 模块设计（manifest/scanner/diff/discovery/transport/apply/status）在文档中只有 §9 的 5 行 API，无架构描述 |
| **已实现能力快照** | 读者无法从文档判断哪些能力可用 |

---

## 5. 文档中经核实为正确的部分

为免以偏概全，以下条目经代码比对确认**准确无误**：

| 章节 | 内容 | 验证 |
|---|---|---|
| §2.2 | `main.py` 绑定 127.0.0.1 + 静态托管前端产物 | ✅ `main.py:16,92` 确有 `StaticFiles` mount |
| §2.2 | 分层映射（web / routers / core / workspace） | ✅ 代码严格执行，无越层 |
| §2.3 | Markdown 是正文唯一事实源 | ✅ `knowledge.py` 与 vault 一致 |
| §4.2 | 附件路径策略（禁绝对盘符 / `file://`） | ✅ `has_forbidden_media_path()` 实现 |
| §9 | 错误约定 `{error:{code,message}}` | ✅ 全 router 统一 |
| §3.2 | 已否决备选表 | ✅ 高质量，且代码确实未引入任何被否决项 |
| §4.1 | `concepts` 表含 `status` 列（migration 003） | ✅ 文档已同步 |
| §4.2 | workspace 与源码分离、`.gitignore` | ✅ 严格执行 |

**§3.2「已否决备选表」尤其值得肯定**——它记录了每条否决理由与回潮禁令，且 23 份 ADR + 全部代码中**无任何一项被违反**。这是本文档最有价值的部分。

---

## 6. 全量代码审核

> 审核范围：`server/app/`（core 10 + ai 8 + sync 12 + routers 14）、`server/migrations/`（审核时 6，`cc9915d` 后为 7）、`web/src/`（23 useEffect / 7 view）、`shared/types/`（7）
> HEAD：`2c6b8d1` · 测试基线：pytest 461 / vitest 23 / tsc / vite build 全绿
> **复核 HEAD：`cc9915d` · pytest 459 / tsc PASS**（3 项 P0 已修，详见 §6.7）

### 6.0 审核结果概览

> 表中 ✅/🔴 列记录**复核后（`cc9915d`）**的状态；原始分析保留在 §6.1–§6.6。

| 审核维度 | 结果 | 说明 |
|---|---|---|
| 分层铁律（`core/` 不依赖 FastAPI） | ✅ **0 违规** | 全量 grep 无命中 |
| SQL 注入 | ✅ **0 风险** | 全部参数化查询 |
| 同步层 fail-closed 校验 | ✅ **实现正确** | 路径白名单 + 字节重算哈希 |
| 前端资源清理 | ✅ **完整** | rAF / Observer / 监听器 / globe 全部释放 |
| 前端调试残留 | ✅ **0 处** | 无 `console.log` / `TODO` / `FIXME` / `debugger` |
| 冻结契约一致性 | ✅ **已闭合** | `cc9915d` migration 007 补列（§6.7.1） |
| 能力复用（`AGENTS.md` §1 L2） | ✅ **已闭合** | `cc9915d` 删除重复实现（§6.7.1） |
| 资源管理（文件描述符） | ✅ **已闭合** | `cc9915d` 修 `notes.py`（§6.7.1） |
| 分层（Router 不含业务逻辑） | 🟠 **1 项违规** | `routers/mastery.py`，未修 |
| 重复实现 | 🟠 **1 项** | `_now_iso()` 两份，未修 |
| 类型标注准确性 | 🟡 **1 项** | 端点标注 `-> dict` 但返回 `JSONResponse`，未修 |
| 文档与实现一致（新增） | 🟠 **1 项违规** | `CURRENT_STATE.md:15` 声称的回填不存在（§6.7.3） |
| 设备身份健壮性（新增） | 🟡 **1 项** | 无缓存 + 损坏时静默轮转身份（§6.7.3） |

**整体判断**：代码质量**高于同星段开源项目的平均水平**。安全基线（注入、路径穿越、fail-closed）处理得相当扎实，前端资源管理甚至优于多数项目。问题集中在**契约遵守**与**资源管理**两处，均为局部问题，不涉及架构。

---

### 6.1 🔴 P0-1 设备身份被重复实现（违反 `AGENTS.md` §1 + §2.3 + ADR-020）

**既有实现**（`core/sync/device.py`，M7 已建）：

```python
def load_or_create_device(workspace: Path) -> DeviceInfo:
    """从 workspace/metadata/devices.json 加载设备身份，不存在则创建。
    这是设备身份的唯一读写路径。"""          # ← 模块自述
```

`device.py` 文件头明确标注 ADR-020 冻结：**设备身份存储在 `metadata/devices.json`（Layer 3，永不同步）**，`generate_device_id()` 返回纯 UUID4。

**重复实现**（`core/mastery.py:49-82`，P8-003D 新增）：

```python
def _get_device_id() -> str:
    """1. 环境变量  2. metadata/device_id 文件  3. hostname-uuid8"""
    hostname = socket.gethostname()
    _DEVICE_ID = f"{hostname}-{uuid.uuid4().hex[:8]}"
```

**冲突证据**：`core/sync/diff.py:112-113` 使用的正是既有那套：

```python
plan = SyncPlan(local_device=local.device_id, remote_device=remote.device_id)
```

于是系统内存在**两套值不相等的 device_id**：

| | 存储位置 | 格式 | 使用者 |
|---|---|---|---|
| 既有 | `metadata/devices.json` | 纯 UUID4 | `discovery.py`（配对）、`diff.py`（差异比对） |
| 新增 | `metadata/device_id` | `hostname-uuid8` | eventlog 写入 |

**后果**：eventlog 中记录的 `device_id` 与配对注册表中的 `device_id` 永远不相等。对端收到 eventlog 后**无法将事件归属到具体设备**——ADR-020「按 device_id 识别事件来源」的设计目标落空。

**违反条款**：
- `AGENTS.md` §1 能力复用阶梯第 2 级：**「代码库里已有？→ 复用，不重写」**
- `AGENTS.md` §2.3：「禁止 Dependency Creep / Duplication」
- ADR-020 冻结的设备身份存储位置

**附带问题**：`hostname`（如 `DESKTOP-A1B2C3D4`）被写入 eventlog，而 eventlog 属 Layer 1 **同步内容**，桌面主机名将同步至移动端。`§4.2` 虽仅明列「db、settings、API key 永不参与同步」，但设备名属同类隐私考量。改用既有的纯 UUID4 后此问题自动消除。

---

### 6.2 🔴 P0-2 `event_uuid` 未落库（违反 `learning-model.md` 冻结契约）

**已冻结契约**（`docs/data-model/learning-model.md`）：

| 行 | 原文 |
|---|---|
| 50 | `event_uuid \| TEXT UNIQUE \| 跨设备幂等标识（UUID v4，ADR-005 同步用）` |
| 86 | `event_uuid`：跨设备全局唯一，同步时用于幂等去重（ADR-005） |
| 212 | M8 Mobile Sync 依赖 `learning_events（event_uuid）` 事件日志跨端重放 |
| **222** | **Forbidden Changes：不得删除 event_uuid 字段（多端同步依赖）** |

**实测表结构**：

```
learning_events：id, concept_id, event_type, dimension, weight, source, created_at, detail
                 ↑ 无 event_uuid / event_id 列
```

**代码实况**（`core/mastery.py`）：

```python
180:  event_uuid = str(uuid.uuid4())          # 生成
184:  "INSERT INTO learning_events (concept_id, event_type, dimension, weight, source, detail) "
186:  (concept_id, event_type, dimension, weight, source, detail)   # ← 未写入
198:  event_id=event_uuid,                    # ← 只进 JSONL
```

**后果**：SQLite 行与 JSONL 行**没有关联键**。对端 `apply` 按 `event_id` 去重后重建 mastery，本机侧无法判断哪些事件已应用，重放校验与冲突恢复失去锚点。

**判定**：该字段自 migration 004 起即缺失，属**既有契约欠账**；P8-003D 是最接近闭合它的改动，却只闭合了文件侧。

**修复**：新增 migration 007 补 `event_uuid TEXT UNIQUE`（历史行回填）+ `update_mastery` 同步写入。

---

### 6.3 🔴 P0-3 数据库连接泄漏（`routers/notes.py:110`）

```python
    finally:
        conn.close()          # ← 第一个连接正常关闭

    row = K.get_note_row(connect(), note_id)     # ← 110 行：新连接，从未关闭
    _, body_text = K.read_note_file(rel_path)
    return _detail(row, body_text)
```

位于 `create_note()` 末尾（try/finally 块**之后**）。此处 `connect()` 打开的连接无任何 `close()` 调用——**每次新建笔记泄漏一个文件描述符**。

**为何未被测试发现**：测试用临时 SQLite 连接，进程退出即回收；泄漏只在长驻服务中累积。

**影响**：低频操作，短期不致命；但服务端是长驻进程，长期运行会耗尽 fd。同类模式在其他 router 中未复现（已逐个核对 14 个 router 的 `connect()`/`close()` 配对）。

---

### 6.4 🟠 P1 级问题

#### P1-1 分层违规：`routers/mastery.py` 含业务逻辑

`separation.md` 规定 Router「只做参数校验与 JSON 序列化」。但 `routers/mastery.py:135-159` 直接执行业务写操作：

```python
now = M._now_iso()                                    # ← 调用他模块私有函数
conn.execute("UPDATE concept_mastery SET ease_factor=?, interval=?, ...")
conn.execute("INSERT INTO review_queue ... ON CONFLICT(concept_id) DO UPDATE ...")
new_priority = 0.8 if result == "wrong" else 0.5      # ← 复习优先级策略
```

其中「错答提升优先级 0.8」是**业务策略**，应下沉至 Core。同类问题见 `routers/concepts.py:96`（直接执行 SQL）。

#### P1-2 `_now_iso()` 重复实现

```
core/mastery.py:126          def _now_iso() -> str
core/review_scheduler.py:15  def _now_iso() -> str
```

两份同义实现，且 `routers/mastery.py` 通过 `M._now_iso()` 跨模块调用**下划线私有函数**。

#### P1-3 「同事务」名不副实 + 静默异常

`mastery.py:189` 注释称「同事务上下文」，`TECH_DESIGN` §5.4 称「同一事务内」，但：

- SQLite 事务与文件 IO **无任何原子性关联**（无分布式事务机制）
- JSONL 写在 `UPDATE concept_mastery` **之前**
- 场景 A：UPDATE 失败回滚 → SQLite 无记录、JSONL 有 → **孤儿事件**
- 场景 B：OSError → `except OSError: pass` → SQLite 有、JSONL 无 → **静默丢失**

`except OSError: pass` 与 M7-004.5 刚确立的 **fail-closed** 语义相反。降级策略本身合理（磁盘满不应导致复习失败），但**完全静默**不可接受——至少应 `logging.warning()` 或返回降级标志。

#### P1-4 类型标注与实现不符

`_err()` 定义返回 `JSONResponse`（`mastery.py:18`），但端点标注 `-> dict`（`:38`、`:48`、`:63`、`:82` 等）。功能上可运行（FastAPI 直接透传 Response），但生成的 OpenAPI schema 与实际错误响应形状不一致。

---

### 6.5 ✅ 经核实为安全的项（避免误报）

审核中以下条目初看可疑，逐一验证后确认**无问题**，特此记录以免后续重复排查：

| 项 | 初判 | 验证结论 |
|---|---|---|
| `core/concepts.py:204` f-string SQL | 疑似注入 | ✅ **安全**。`updates` 元素全为硬编码字面量（`domain = ?` / `summary = ?` / `aliases_json = ?` / `status = ?` / `updated_at = datetime('now')`），列名不来自用户输入；`status` 另有白名单校验（`:192-194`） |
| `core/sync/apply.py` 写入校验 | 路径穿越风险 | ✅ **实现正确**。Rule 2 双重校验：路径规范化 → 白名单复检 → **对收到的字节重算哈希**（不信任 remote 声明）；明确拒绝绝对路径、`C:x` 形式盘符 |
| `web/` 前端资源清理 | 监听器泄漏 | ✅ **完整**。`KnowledgePlanet.tsx:154-159` 清理 rAF + IntersectionObserver + visibilitychange + globe.destroy；`KnowledgeRadar.tsx:48-49` 清理 setTimeout；`NoteEditor.tsx:83-84` 解绑 keydown |
| `core/` 层依赖 | 分层越界 | ✅ **0 违规**。全量 grep 无任何 `import fastapi` |
| 调试残留 | 代码卫生 | ✅ **0 处**。无 `console.log` / `TODO` / `FIXME` / `debugger` |

---

### 6.6 代码问题修复清单

| 优先级 | 项 | 位置 | 动作 |
|---|---|---|---|
| ~~**P0**~~ ✅ | 数据库连接泄漏 | `routers/notes.py:110` | **`cc9915d` 已修**（row 移入 try 块）— 见 §6.7.1 |
| ~~**P0**~~ ✅ | 设备身份重复 | `core/mastery.py:49-82` | **`cc9915d` 已修**（删除 `_get_device_id()`，接入 `load_or_create_device`）— 见 §6.7.1 |
| ~~**P0**~~ ✅ | `event_uuid` 未落库 | migration + `mastery.py:184` | **`cc9915d` 已修**（migration 007 补列 + 唯一索引 + INSERT 写入）。**历史行不回填**，符合 `learning-model.md:219` 追加式约束 |
| **P1** | Router 含业务逻辑 | `routers/mastery.py:135-159` | 下沉至 `core/mastery.py`，Router 只做编排 |
| **P1** | `_now_iso` 重复 | `mastery.py:86` / `review_scheduler.py:15` | 合并至 `core/timeutil.py` 并公开 |
| **P1** | 静默异常 | `mastery.py:~189` | `except OSError` 改为 `logging.warning`（保留降级语义） |
| **P1** | 「同事务」措辞 | `mastery.py:~189` + §5.4 | 改为「同一调用内尽力追加」，注明无原子性保证 |
| **P1** | 文档虚假陈述 | `docs/ai/CURRENT_STATE.md:15` | 删掉「UPDATE 回填」，改为「历史行保持 NULL（追加式约束）」— §6.7.3 N1 |
| **P2** | 设备身份健壮性 | `core/sync/device.py:70-87` | 加内存缓存；解析失败抛错而非覆盖文件 — §6.7.3 N2 |
| **P2** | 类型标注 | 约 18 处端点 | `-> dict` 实返 `JSONResponse`，统一标注 |
| **P2** | 失败路径测试 | `tests/unit/test_eventlog.py` | 补 OSError 降级、回滚孤儿、SQLite↔JSONL 一致性断言 |

**测试覆盖盲区说明**：`test_eventlog.py` 8 项测试均为成功路径，**无一项**覆盖 OSError 降级或回滚孤儿场景，且未断言 SQLite 与 JSONL 的**对应关系**——这正是 6.2 的 `event_uuid` 缺失未被 461 个测试捕获的原因。

---

### 6.7 ✅ P0 修复复核（HEAD `cc9915d`）

> 复核范围：`git show cc9915d`（7 文件 +73/−112）+ 真实数据库副本上的 migration 实测 + 全量测试重跑。
> **本节为当前有效结论；§6.1–§6.3 保留原始分析过程。**

#### 6.7.1 三项 P0 逐项验证

| P0 | 修复动作 | 验证方式 | 结论 |
|---|---|---|---|
| **P0-1 设备身份双轨** | 删除 `mastery._get_device_id()`（−41 行），改用 `from .sync.device import load_or_create_device`（`mastery.py:29`），`update_mastery()` 内取 `device.device_id` 传入 eventlog | ① 全仓 grep `_get_device_id` / `_DEVICE_ID` / `metadata/device_id`，`app/` 与 `tests/` **0 处残留**；② 检查 `core/sync/*` 无任何模块 import `core.mastery` → **无循环导入**；③ 核对 conftest：`tmp_workspace` 通过 `monkeypatch.setenv("WORKSPACE_DIR")` 隔离，故新增的 `test_device_identity_shared_with_sync` 断言的是**同一 workspace 下的真实一致性**，非空断言 | ✅ **已闭合** |
| **P0-2 `event_uuid` 未落库** | 新增 `migrations/007_event_uuid.sql`（`ALTER TABLE ... ADD COLUMN event_uuid TEXT` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_events_uuid`），`mastery.py:144-146` 的 INSERT 含 `event_uuid` | 在**真实数据库副本**（7 行既有数据）上实跑：列成功添加 → 7 行全为 NULL 且**未报错**；重复 uuid-A 被拦截（`UNIQUE constraint failed: learning_events.event_uuid`）；**多个 NULL 可共存**，故历史行不会撑爆唯一索引；INSERT 正常 | ✅ **已闭合** |
| **P0-3 连接泄漏** | `notes.py:101` 将 `row = K.get_note_row(conn, note_id)` 移入 try 块，复用原连接；`finally: conn.close()` 不变 | 读取改后文件确认：`conn.close()` 在 `finally`，`row` 在 try 内读取，错误路径 `return _err(...)` 提前返回不会走到未绑定引用 | ✅ **已闭合** |

#### 6.7.2 附带消除的 P1

- ✅ **hostname 泄露到同步层**：旧实现把 `socket.gethostname()` 拼进 `device_id` 写进 eventlog（Layer 1 同步内容）。现在 `device_id` 是纯 UUID4，hostname 只写入 `metadata/devices.json`（ADR-020 规定 Layer 3 永不同步）。此项在 §6.4 原列为 P1，本次修复顺带闭合。
- ✅ **文档-实现一致性**：`test_smoke.py` 的 migration 计数 6→7 已同步，注释同步更新。

#### 6.7.3 复核新发现（2 项）

**🟠 N1｜`docs/ai/CURRENT_STATE.md:15` 声称的「UPDATE 回填」不存在，且不应补**

原文：`P0-2：migration 007 补 event_uuid 列 + UPDATE 回填 + UNIQUE 索引。`
实际 `007_event_uuid.sql` 只有 `ALTER TABLE` + `CREATE UNIQUE INDEX`，**没有任何 UPDATE**。

**不要去补这个回填**——`learning-model.md:219` Forbidden Changes 明写「不得修改已写入的 learning_events 行（追加式）」，对既有 7 行做 UPDATE 本身就违反冻结契约。正确做法是**改文档**：把「+ UPDATE 回填」改为「历史行保持 NULL（追加式约束，禁止回填）」。

> 顺带更正本报告 §6.6 原始建议中「补 `event_uuid` 列**（历史回填）**」的表述——该建议与追加式约束冲突，以 007 的实际实现（不回填）为准。

**🟡 N2｜`load_or_create_device()` 无缓存，且损坏时会静默轮转设备身份**

```python
# core/sync/device.py:70-87
if devices_path.exists():
    try:
        return DeviceInfo.from_dict(json.loads(devices_path.read_text(...)))
    except (json.JSONDecodeError, KeyError):
        pass          # ← 落到下方，新建身份并覆盖原文件
```

- **无内存缓存**：旧的 `_DEVICE_ID` 是模块级全局变量（读一次缓存），新实现**每次 `update_mastery()` 都读一次磁盘**。学习事件是高频路径，建议恢复一层缓存。
- **静默轮转身份**：若 `devices.json` 损坏或被杀毒软件截断，`JSONDecodeError` 被吞 → 生成**全新 device_id 并覆盖原文件**。M7 已配对的对端设备会因此认不出本机，且**无任何日志**。
- **失败面扩大**：`load_or_create_device` 的 `OSError`（权限/占用）现在会被 `update_mastery` 的 `except OSError: pass` 一并吞掉——原本设备身份失败不影响事件写入，现在会**连带静默丢失 eventlog 行**。

建议：文件存在但解析失败时**抛错而非覆盖**，并在 `update_mastery` 中把 `except OSError` 改为 `logging.warning`。

#### 6.7.4 实测复核数据

| 命令 | 结果 |
|---|---|
| `pytest -q` | **459 passed**（183.31s） |
| `npx tsc --noEmit` | **PASS**（exit 0） |
| 测试数变化 | 461 → 459：删除 3 项 `_get_device_id` 测试 + 新增 1 项 `test_device_identity_shared_with_sync`，**算术吻合，无隐藏失败** |
| 前端 | 本提交 **0 个前端文件改动**，`vite build` 结论沿用上次 |

#### 6.7.5 仍未闭合项

| 项 | 位置 | 状态 |
|---|---|---|
| N1 文档虚假陈述 | `docs/ai/CURRENT_STATE.md:15` | 🟠 工作区已改待提交（改文档，勿补回填） |
| N2 设备身份健壮性 | `core/sync/device.py:70-87` | 🟡 待改 |
| **N3 `event_uuid` 回归保护为零** | `tests/unit/test_eventlog.py` | 🟠 **待改（回退实验已证明）— 素材在 `server/_verify_p0.py:第7项`** |
| N4 导入链耦合 | `mastery.py:29` → `core/sync/__init__.py` | 🟡 非缺陷，可选解耦 |
| Router 含业务逻辑 | `routers/mastery.py:135-159` | 🟠 未动 |
| `_now_iso()` 重复 | `mastery.py:86` / `review_scheduler.py:15` | 🟠 未动 |
| 静默异常 + 「同事务」措辞 | `mastery.py:~189` | 🟠 未动 |
| 端点返回类型标注 | 约 18 处 `-> dict` 实返 `JSONResponse` | 🟡 未动（详见下方更正） |

> **更正 §6.4 的 P1-4 表述**：原写「`_err` 类型标注与实现不符」不准确。实测 5 处 `_err` 定义（attachments / mastery / notes / sync / tutor）**均正确标注 `-> JSONResponse`**。真实问题是**端点函数**标注 `-> dict`、错误路径却 `return _err(...)` 返回 `JSONResponse`（如 `notes.py:70 create_note`），共约 18 处。

#### 6.7.6 二次独立复核新发现（2 项）

> 由第二次独立复核（重新实跑 diff、真实数据库、全量 pytest 191.51s）得出，与 §6.7.3 不重复。

**🟠 N3｜`event_uuid` 的回归保护为零——已用回退实验证明**

§6.7.1 判定 P0-2「已闭合」，依据是代码正确。**但没有任何测试能阻止它被改回去。**

决定性实验：把 `mastery.py:144-146` 的 INSERT 改回不含 `event_uuid`（即完全回退 P0-2），然后只跑 eventlog 测试——

```
$ pytest tests/unit/test_eventlog.py -q
6 passed, 1 warning in 6.28s          ← P0-2 已被完全回退，测试依然全绿
```

原因（可回溯）：

| 项 | 证据 |
|---|---|
| 测试中零断言 | `grep -rn "event_uuid" server/tests/` → **0 处匹配** |
| 断的是哪一环 | `test_update_mastery_writes_eventlog` 分别断言 SQLite 有 1 行、jsonl 有 1 行，**但从不断言两者标识符相等**（缺 `assert events[0]["event_uuid"] == latest["event_id"]`） |

这正是 §1「测试验证的是管道，而不是管道两端是否真的连通」的**第二次复现**——上一次它掩盖了「eventlogs 没有生产者」，这一次它掩盖了「`event_uuid` 没有落库」。同一个盲区，同一个位置。

**现成的修复素材已经躺在仓库里**：未入库的 `server/_verify_p0.py` 第 7 项正是这条断言——

```python
db_uuids = [r[2] for r in rows];  jl_ids = [ln["event_id"] for ln in lines]
assert sorted(db_uuids) == sorted(jl_ids), "FAIL: SQLite 与 eventlog 的标识符不一致"
```

建议把它（连同第 8、11 项的设备一致性与 hostname 防泄漏断言）从临时脚本搬进 `tests/unit/test_eventlog.py`。**否则下次重构 INSERT 时，这个 P0 会静默复活。**

附带：删除 `test_get_device_id_from_env` 后，**设备身份再无任何环境变量注入点**（旧 `LEARNING_OS_DEVICE_ID` 已随 `_get_device_id()` 移除，`load_or_create_device()` 不支持覆盖）。🟡 测试需靠 `tmp_workspace` 夹具重定向 workspace，隔离性尚可，但注入能力弱于修复前。

**🟡 N4｜`core.mastery` 现在会连带导入整个 M7 同步引擎**

`mastery.py:29` 的 `from .sync.device import load_or_create_device` 会先执行 `core/sync/__init__.py`，而后者是 eager import（`manifest` / `scanner` / `diff` / `protocol` / `messages` / `transfer` / `transport` 全量）。实测导入链：

```
$ python -c "import app.core.mastery"   # 新增模块
app.core, app.core.concepts, app.core.mastery,
app.core.sync, .device, .diff, .manifest, .messages, .protocol, .scanner, .transfer, .transport
```

**定性：不是缺陷**——无循环导入（`core/sync/*` 均不 import `core.mastery`）、无导入期副作用（`socket.socket()` 与 `threading.Thread` 都在函数体内）、全标准库、459 测试全通过。

但耦合方向值得记一笔：复习答题与 AI Tutor 都要走 `update_mastery()`，即**学习热路径现在传递依赖整个同步子系统**。两个可选解法（皆非紧急）：

1. 把设备身份移出 `core/sync/`（如 `core/device.py`），`core/sync/` 反向引用——ADR-020 冻结的是 `metadata/devices.json` 的**存储位置**，不是模块归属
2. 给 `core/sync/__init__.py` 加 PEP 562 `__getattr__` 惰性导入，保留现有公开 API 不变

#### 6.7.7 二次复核实测数据

| 命令 | 结果 |
|---|---|
| `pytest -q` | **459 passed**（191.51s；§6.7.4 记录 183.31s —— 机器波动，非差异） |
| 真实数据库 `workspace/db/learning-os.db` | `schema_migrations` 七条含 `007_event_uuid` ✅ · `learning_events` 含 `event_uuid` 列 ✅ · `idx_events_uuid` UNIQUE 索引存在 ✅ · **9 行中 7 行 `event_uuid` 为 NULL**（不回填，符合追加式约束） |
| 各 router `connect()`/`close()` 配对 | 14 个文件**全部配对**，P0-3 无残留 |
| `learning-model.md:219` | 经核实**确为**「不得修改已写入的 learning_events 行（追加式）」——§6.7.3 N1 的判断成立，不回填是对的 |

#### 6.7.8 N3 闭环验证（HEAD `8d0de31`）

用户已将 `_verify_p0.py` 的三条断言搬入 `tests/unit/test_eventlog.py`（新增 4 项守护，459→463），临时脚本已删。本节记录**独立复核**结果。

复现回退实验（把 `mastery.py:144-146` 的 INSERT 改回不含 `event_uuid`）：

```
$ pytest tests/unit/test_eventlog.py -q
FAILED tests/unit/test_eventlog.py::test_event_uuid_lands_in_both_stores - As...
FAILED tests/unit/test_eventlog.py::test_event_uuid_unique_index_enforced - F...
2 failed, 8 passed, 1 warning in 10.59s
```

对照 §6.7.6 的同一次实验（当时 **6 passed** 静默通过）→ **N3 盲区确认闭环**。恢复后 10/10 全绿，`git diff --stat server/` 为空。

四条守护的实际覆盖：

| 测试 | 守护的断裂方式 | 评价 |
|---|---|---|
| `test_event_uuid_lands_in_both_stores` | INSERT 丢 `event_uuid` / 两端 uuid 不一致 / 出现 NULL 行 | 核心守护，`sorted()` 比较可捕获"数量对但内容错" |
| `test_event_uuid_unique_index_enforced` | migration 007 的 UNIQUE 索引被删 | 真实 INSERT 触发 `IntegrityError`，非空断言 |
| `test_eventlog_device_id_matches_identity_file` | 设备身份再次分叉 | 比素材原版更严——多验了 sync 侧 `load_or_create_device()` 读回同一身份 |
| `test_eventlog_never_contains_hostname` | hostname 重新混入 `device_id` | P1-4 闭合的永久守护 |

---

## 6.8 P8-003D Tutor Knowledge Base — 开工前置核查

> 范围：为下一项任务「Tutor 读取用户笔记内容（FTS5 + concept→notes→context）」做的契约前置扫描。
> 目的：把「写完才发现违约」变成「开工前先裁决」。以下全部为可回溯的事实核查。

### 6.8.1 ⚠️ 三个必须先裁决的契约冲突

**① ADR-014 §2.8 明确禁止 RAG**

```
### 2.8 Forbidden（M4 阶段）
- RAG / Vector DB / Embedding
- Agent 框架 / Function Calling
```

任务自述为「RAG 层：FTS5 + concept→notes→context」，与这条 Forbidden 字面冲突。

- 缓和因素：标题限定为「M4 阶段」，当前已推进到 P8；且 `AGENTS.md` §2.3 禁止的是**向量库 / LangChain**，手写 FTS5 检索并不在此列
- 但这是**延后型禁止，不是自动解除**。参考先例：`TASKS.md` 中 P8-FE-001 因 ADR-013 冻结配色，要求「以最小 ADR 附录形式过审」
- **建议**：开工时补一份最小 ADR 附录，明确「ADR-014 §2.8 的 RAG 禁止，在 P8-003D 范围内以 **FTS5 关键词检索**形式解除；向量检索 / Embedding 继续禁止」

**② ADR-014 §2.5 + `tutor-context.md` §3 的白名单里没有 notes**

| 来源 | 原文 |
|---|---|
| `ADR-014-ai-tutor.md:110-115` | 黑名单：`- vault 全文（除非用户明确引用）` |
| `docs/data-model/tutor-context.md:71` | 不可见：`vault 全文`，原因「隐私 + token 预算」 |
| `core/tutor_context.py:5-12` | 允许：`concept, mastery, mistakes, related, review, recent_events`；禁止：`vault 全文, settings, api_key, 历史聊天, raw markdown` |

三处一致地把 vault 内容挡在外面，但 ADR-014 留了一个口子：**「除非用户明确引用」**。

这决定了两种完全不同的实现：

| 路线 | 做法 | 是否需要改契约 |
|---|---|---|
| **甲·显式引用** | 只有用户在提问里引用了某篇笔记（如 UI 上 `@笔记` / 选中笔记提问）时，才把该笔记内容注入 context | **不需要**，直接符合 ADR-014 现有条款 |
| **乙·自动检索** | Tutor 自动用 FTS5 检索相关笔记并注入 | **需要**改 `tutor-context.md` §2 白名单 + `tutor_context.py` 顶部白名单 |

**这是必须由项目所有者裁定的第一项**——它决定 P8-003D 是纯实现任务，还是实现 + 契约修订。

**③ Token 预算需要重新分配**

`tutor-context.md:§5` 冻结：Context snapshot **~1000 tokens**，Total input **~1700 tokens**，总计 < 3000 tokens/次。现有条目已达 `MAX_MISTAKES=5 / MAX_RELATED=10 / MAX_RECENT_EVENTS=5`。注入笔记片段必然挤压这份预算，需明确「笔记片段占多少 token、挤掉谁」。

### 6.8.2 ✅ 复用点已经存在（`AGENTS.md` §1 L2，禁止重写）

前两轮审计连续两次抓到「重复实现」（`_get_device_id`、以及更早的 `eventlogs`），这一轮**同样的坑已经挖好**：

| 已有能力 | 位置 | 现状 |
|---|---|---|
| `search_notes(conn, q, limit)` | `core/knowledge.py:150-180` | FTS5 检索 + `sanitize_fts_query()` 防注入，参数化 `MATCH ?` |
| `suggest_for_context(conn, query, note_id, limit)` | `core/knowledge.py:411` | **已经做了**「FTS 笔记匹配 + concept LIKE + 图谱邻居 + memory 占位」——正是 P8-003D 描述的 concept→notes→context |
| `notes_fts` 虚表 | migration 001 | 字段 `title / body / note_id`，实测 5 行数据 |

⚠️ **一个具体缺口**：`suggest_for_context` 返回的每条匹配里 `"snippet": None` 是**硬编码**（`knowledge.py:429`），从未填充真实片段。P8-003D 若走「自动检索」路线，需要把它从 `None` 变成真实片段（FTS5 内置 `snippet()` 函数即可，无需新依赖）。

**结论**：P8-003D 应该是「给 `build_tutor_context()` 加一个 `_get_notes()` 步骤 + 修好 `snippet`」，而不是新建一套检索。

### 6.8.3 质量天花板（要提前设对预期）

`ADR-011`（Accepted·延后型决策）冻结：FTS 用 **unicode61**，不做分词增强。原文：

> v1 中文长句检索体验有限（已知、已记录、可接受）

即：中文**长句/段落**检索命中率本就有限，短字段（标题/tags）基本可用。P8-003D 的「笔记内容检索」正好踩在这个受限区。

- 不要按英文 RAG 的召回预期来验收
- 若实测中文档召回不可接受，正确做法是走 ADR-011 已记录的改进路径（首选 `tokenize='trigram'` 重建 `notes_fts`，SQLite 内置能力），**而不是**引入 jieba —— ADR-011 已明确拒绝分词依赖

### 6.8.4 关于「先写连通性断言」

用户提议在八项清单外增加一条：**先写连通性断言，再写功能实现**。这条建议应当采纳，且可以表述得更锋利——

P8-003D 的数据链是 **5 跳**：

```
笔记文件 → notes 表 → notes_fts 索引 → TutorContext.notes → prompt → Provider 收到
```

前两轮「测试全绿但断链」的教训，本质都是**只验了中间某几跳**：eventlogs 那一轮验了「管道能合并 jsonl」但没验「系统会产生 jsonl」；`event_uuid` 那一轮验了「SQLite 有行」和「jsonl 有行」但没验「两者是同一行」。

因此 P8-003D 的守护断言应覆盖：

1. **端到端标识符相等**：写入一篇笔记 → 检索 → 出现在 context → 出现在最终 prompt 里，全程同一个 `note_id`
2. **内容非空**：context 里的笔记片段不是 `None` / 空串（直接针对 §6.8.2 的 `snippet: None`）
3. **黑名单反向断言**：`build_tutor_context()` 的结果里**不含** `settings` / `api_key` / 未引用笔记的全文（§6.8.1 ②）
4. **预算断言**：context 序列化后 token 数在 `tutor-context.md` §5 的 ~1000 以内

第 3 条尤其值得强调——前面所有教训都是「该有的东西没有」，而 Tutor 这条链路的风险是反过来的：**不该有的东西混进去**。这是本项目第一次需要在守护里加**反向断言**。

### 6.8.5 契约裁决结果（项目所有者 2026-08-28 裁定）

| 裁决点 | 裁定 | 依据 |
|---|---|---|
| ① ADR-014 §2.8 RAG 禁令 | **走附录解除**（新增 §2.8.1，带日期），不新建 ADR、不改措辞 | ADR-014 是冻结契约；带日期附录节是本项目已确立的修订形式（P8-FE-001 对 ADR-013 的先例）。附录一次说清：(a) 显式引用（ADR-014:114 既有条款，即日生效）；(b) FTS5 关键词自动检索（本附录解除，独立任务）。向量检索 / Embedding / LangChain **维持永久禁止** |
| ② 实现路线 | **甲（显式引用）先行**，乙（自动检索）预登记为 **P8-003E** | 甲零契约冲突；隐私面从第一天就收紧，反向断言天然可测；乙的构件全是甲的子集，零浪费；触发条件 = 用户反馈引用摩擦（沿用本项目「触发条件解锁」风格） |
| ③ Token 预算 | `MAX_NOTE_EXCERPTS=2`，片段 ≤600 字符；**注入笔记时** `MAX_RELATED` 10→6、`MAX_RECENT_EVENTS` 5→3，总预算仍 ≤~1700 | 属契约维护性增记（AGENTS §10 同步义务），非原则修订 |

### 6.8.6 八项清单的前提核查（落盘前必须钉死的三项）

对八项清单逐条做了可验证性核查。**7 项成立，3 项前提与代码不符**：

**✅ 已核实成立**

| 清单项 | 核查结果 |
|---|---|
| 2 架构位置 | `build_tutor_context()`（`tutor_context.py:121`）确为唯一组装点；`MAX_RELATED=10` / `MAX_RECENT_EVENTS=5` 见 `tutor_context.py:22-24` |
| 5 snippet 缺口 | `knowledge.py:429` 的 `"snippet": None` 确为硬编码 ✅ |
| 6 零迁移 | `notes` 表含 `path` 列（`id/path/title/tags_json/content_hash/mtime/created_at/updated_at`），可经既有文件读取取正文 ✅ |
| 7 类型文件 | `shared/types/tutor.ts` 存在 ✅ |
| 8 部分文件 | `routers/tutor.py` 存在 ✅；`tests/unit/test_tutor_context.py` **不存在**（清单已注明「或新文件」）✅ |

**⚠️ ① 清单第 3 项的前端链路目前不存在——而且是「从未接通」，不是「加个开关」**

`TutorPanel` 确实预留了这个能力：

```tsx
// web/src/components/tutor/TutorPanel.tsx:66-67, 98
/** 当前活跃 concept ID（从 NoteEditor 或 Graph 传入） */
conceptId?: number | null;
...
export function TutorPanel({ conceptId }: Props) {
```

但全仓**唯一**的渲染点是 `App.tsx:35` 的 `<TutorPanel />`——**零 props**。`NoteEditor`（实际在 `web/src/views/NoteEditor.tsx`，非清单所写 `components/notes/`）从不渲染 TutorPanel。

**连带后果（比清单第 3 项本身更严重）**：

```tsx
// TutorPanel.tsx:143-147
if (conceptId == null) {
  return <div className="tutor-empty">Select a concept to start</div>
}
```

`conceptId` 恒为 `undefined` → **Tutor tab 永远显示空状态，是个死 tab**。`views/placeholders.tsx:24` 还留着一个未使用的 `TutorPanelView` 占位符。

所以 P8-003D 实际是「先接通一条从未接通的链路，再加笔记引用」。这不是坏事——它和 `eventlogs` 那次是同一类（设计意图早就写好了，接线没做）——但**工作量与风险都应按此重估**，且它天然适合用同一条连通性断言来守护。

需要裁定：**conceptId 的接线是否纳入 P8-003D 范围**？不纳入的话，笔记引用做完了用户依然看不到。

**⚠️ ② 清单第 7 项的端点形态与代码不符**

清单写「现有 tutor 请求体 + `note_ids`（可选字段，向后兼容）」，但 `GET /tutor/context/{concept_id}` 是 **GET + 路径参数，没有请求体**。全仓唯一的 tutor POST 是 `/tutor/test`（`TutorTestRequest`，仅 `concept_id: int`）。

三种选法，需要裁定：

| 方案 | 形态 | 代价 |
|---|---|---|
| A | `GET /tutor/context/{cid}?note_ids=1,2` | 改动最小，但 URL 长度与数组解析需约定 |
| B | 扩展 `POST /tutor/test` | 该端点语义是 smoke test，不适合承载产品功能 |
| C | 新增 `POST /tutor/context` | 语义最干净，但增加一个端点（需登记 `TECH_DESIGN` §9） |

**⚠️ ③ 与 `ui.ts:3` 的架构注释冲突**

```ts
/** UI 层唯一全局状态：当前激活视图。业务数据一律来自 API，不进 store。 */
```

store 里虽有 `focusNoteId`，但它是**跨视图跳转目标**（图谱点节点 → 打开笔记并聚焦），被 NoteEditor 消费后即 `clearFocus()`，**不是「当前正在编辑的笔记」**。

若走「TutorPanel 知道当前笔记」，两条路：

- **提升进 store**：需要修改上面那条带明确注释的约定（note_id 可论证为 UI 选中态而非业务数据）
- **TutorPanel 内自带笔记选择器**：不动 store，且「用户主动选一篇」比「自动带当前笔记」更贴合 ADR-014:114 的「**用户明确引用**」语义，也符合 ADR-016 的克制风格 —— **倾向此方案**

---

## 7. 修订优先级

| 优先级 | 修订项 | 类型 | 理由 |
|---|---|---|---|
| **P0** | §4.1 DDL 全面重写为 migration 001–006 的实际 schema | 文档错误 | 唯一来源定位下，错误 DDL 会直接误导开发 |
| **P0** | §5 整章重写（四维名/权重/衰减/事件类型/SM-2 公式） | 文档错误 + 实现缺失 | 产品灵魂模块，且与 §10 验收标准绑定 |
| ~~**P0**~~ ✅ | 补 `learning_events.event_uuid` 列（migration 007） | 冻结契约违约 | **`cc9915d` 已闭合**（历史行不回填，符合追加式约束） |
| ~~**P0**~~ ✅ | 合并两套设备身份 | 架构 | **`cc9915d` 已闭合**，eventlog 与 sync 共享同一 device_id |
| ~~**P0**~~ ✅ | 修 `routers/notes.py` 连接泄漏 | 缺陷 | **`cc9915d` 已闭合** |
| **P1** | §9 API 表按实际 15 个 router 重新枚举 | 文档错误 | 12 个幽灵端点 + 30 个未登记端点 |
| **P1** | **补 `event_uuid` 回归断言**：`row["event_uuid"] == line["event_id"]` | 测试缺口 | 回退实验证明 P0-2 可被静默改回（§6.7.6 N3） |
| 🟠 | 改 `CURRENT_STATE.md:15` 虚假的「UPDATE 回填」 | 文档错误 | 回填会违反 `learning-model.md:219` 追加式约束（工作区已改） |
| **P2** | `load_or_create_device` 加缓存 + 损坏时不覆盖 | 缺陷 | 静默轮转设备身份会让已配对对端失联 |
| **P2** | 解耦 `core.mastery` → `core/sync` 导入链 | 架构 | 学习热路径传递依赖整个同步子系统（§6.7.6 N4，非缺陷） |
| **P1** | §2.2 模块图更新 | 文档错误 | 约半数条目不存在 |
| **P1** | §6 标注各节实现状态（✅/❌） | 文档错误 | 避免读者误判 AI 能力 |
| **P1** | §7 重写为三表方案，或明确旁车与三表的关系 | 路线漂移 | 当前两方案并存且无说明 |
| **P1** | §8.1 更新为 Planet + force 方案 | 文档错误 | 三模式从未实现 |
| **P2** | §3.1 依赖表同步（删 marked，补 dagre/d3-force/cobe） | 文档错误 | |
| **P2** | §4.2 数据目录同步（devices.json / manifest.json 不存在） | 文档错误 | |
| **P2** | 修 §3 内部矛盾（视觉编码颜色 / SM-2 公式） | 文档矛盾 | |
| **P2** | §10 增加状态列，或明确指向 TASKS.md 为唯一状态源 | 结构 | 消除双份维护 |
| **P2** | 补 P8 四项设计 + Sync 系统架构章节 | 内容缺失 | |

### 7.1 关于 `eventlogs` 的裁决（已于 `2c6b8d1` 裁定：路线甲）

> 本节为审阅当时的原始裁决记录。项目所有者已选定路线甲并落地（`2c6b8d1`），
> 因此下表保留作为决策依据。执行结果：**生产者已存在，且 `cc9915d` 已补齐
> `event_uuid` 与设备身份两处断链，ADR-020 至此真正闭合**（验证见 §6.7.1）。

这是一个**需要项目所有者决策**的问题，因为两条路都合理：

**路线甲：补实现（闭合设计）**
在 `update_mastery()` 中于同一事务内追加 jsonl 行（含 `device_id` + 全局唯一 `event_id`）。
- 优点：ADR-020 三层真值模型完整成立，M8 移动端的学习状态同步得以实现
- 代价：需处理 SQLite 事务与文件写入的原子性（崩溃时可能表有而文件无）；需补集成测试，**且必须用真实调用链而非夹具**

**路线乙：撤设计（降级声明）**
承认 v1 不跨端同步学习状态，将 §5.4 / ADR-020 中 eventlogs 相关内容降级为 backlog。
- 优点：消除文档虚假承诺，与「不追求功能数量」原则一致
- 代价：`core/sync/` 中 scanner/transfer/apply 的 eventlog 能力成为死代码，M8 的学习状态同步需重新设计

**倾向性判断**（供参考，非结论）：考虑到 M7 的 eventlog 合并逻辑已完整实现且经过 27+19 项测试验证，路线甲的边际成本低于路线乙的沉没成本损失。但**无论选哪条，当前"文档承诺 + 无生产者"的状态都必须终结**。

---

## 8. 一句话总结

**关于代码**：质量高于同星段开源项目的平均水平。安全基线（SQL 注入、路径穿越、fail-closed 校验）扎实，前端资源清理完整，分层铁律零违规，无调试残留。三处 P0 都是局部问题——一处 fd 泄漏、一处重复实现、一处契约字段缺失——不涉及架构，修复成本低。

**关于技术大纲**：一份**设计水准很高、但已停更三个里程碑**的文档。价值集中在 §1 定位、§2.3 原则、§3.2 否决备选——这三部分是真正的资产且至今准确；问题集中在 §4 数据模型、§5 掌握度引擎、§9 API——这三部分是新人最依赖的操作手册且已全部失修。

**两者的共同点**：问题都不在能力不足，而在**承诺与实现的落差**。文档承诺「同一事务写入」但无原子性保证；冻结契约要求 `event_uuid` 但表里没有；`device.py` 自述是唯一读写路径但被另起炉灶。这些落差的共同特征是——**它们全部能通过测试**，因为测试验证的是管道，而不是管道两端是否真的连通。

> **复核后补充（`cc9915d`，二次复核同 HEAD）**：上述三处 P0 落差已全部修复并经两轮独立实测验证。这从反面印证了判断——它们确实是**局部问题**，而非架构缺陷。
>
> 但两轮复核暴露出一条更值得警惕的规律：**修复本身又会制造新的落差**。第一轮发现 `CURRENT_STATE.md` 声称了并不存在的回填，且合并设备身份时顺手把「每次事件读一次磁盘」和「损坏即静默轮转身份」带进了学习热路径。第二轮则用回退实验证明——**三项 P0 里最核心的那项（`event_uuid` 落库），其修复至今没有任何测试守护**：把它完全改回去，6 项测试依然全绿。
>
> 这不是执行不力，而是「测试验证管道、不验证管道两端是否连通」这个盲区的第二次复现。建议每次修复提交后，除了回扫契约清单，还要补一条**针对该修复本身的反向断言**——有了它，这条规律才会在下一次修复前失效。

---

## 9. 修复路线建议

按「阻断性 → 正确性 → 卫生」排序，可与 `OPEN_SOURCE_REMEDIATION.md` 的第一阶段并行推进：

**第一批（正确性）—— ✅ 已于 `cc9915d` 全部完成**
1. ~~修 `notes.py:110` fd 泄漏~~ ✅
2. ~~删除 `_get_device_id()`，接入 `core/sync/device.py`~~ ✅
3. ~~migration 007 补 `event_uuid`~~ ✅（**未回填**，符合 `learning-model.md:219` 追加式约束）

**第二批（防回退 + 契约闭合，当前待办）**

4. **【新，最高优先】给 `event_uuid` 补回归断言**：把 `server/_verify_p0.py` 的第 7 项
   （`SQLite.event_uuid == jsonl.event_id`）、第 8 项（device 一致性）、第 11 项（hostname 防泄漏）
   搬进 `tests/unit/test_eventlog.py`，然后把临时脚本删掉。
   **理由**：回退实验证明，把 P0-2 完全改回去 6 项测试依然全绿——这个修复目前没有任何守护。
5. 改 `CURRENT_STATE.md:15` 虚假的「UPDATE 回填」表述（**勿补回填**，工作区已改待提交）
6. Router 业务逻辑下沉至 Core
7. 合并 `_now_iso()`，消除跨模块私有函数调用
8. `except OSError` 改为可观测降级（现覆盖面已扩大到设备身份读取）
9. 修正「同事务」相关措辞（代码注释 + `TECH_DESIGN` §5.4）

**第三批（健壮性 + 文档）**
10. `load_or_create_device` 加内存缓存；`devices.json` 解析失败改为抛错而非覆盖
11. （可选）解耦 `core.mastery` → `core/sync` 导入链（§6.7.6 N4）
12. 重写 §4.1 DDL 与 §5 掌握度引擎
13. 按实际 router 重新枚举 §9 API 表
14. 修复 3 处内部矛盾（§3）

---

*审阅结束。所有结论均可通过文中标注的文件与行号回溯验证。*
