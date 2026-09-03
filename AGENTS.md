# Personal Learning OS — 工程宪法（Engineering Constraints）

> 本文件是**强制工程约束**，不是建议。任何后续功能设计、代码生成、架构调整、依赖引入、数据结构设计、文件操作、版本控制设计都必须遵守。
> 若需求与本文冲突：① 不得自行绕过；② 必须明确指出冲突；③ 说明现有规则为何无法满足；④ 给出最小改动方案；⑤ 经确认后才能修改架构原则。
> 准备实施下述行为时必须先发出 `[ARCHITECTURE WARNING]` 并等待确认（见 §7）。
>
> **任何会话开始写代码之前，必须先通读以下四份文件**：
> ① `docs/adr/principles.md`　② `docs/DEPENDENCIES.md`
> ③ `docs/security/network-boundary.md`　④ `docs/version-control/git-policy.md`

> **⚠️ 项目形态（2026-09 纯后端化，现行有效）**：本仓库现已收敛为**纯后端**项目。
> 前端（`web/` React/Vite/Tauri、`ui/` 设计原型、`shared/types/` 共享 TS 契约）及本地
> UI 归档/实验目录（`_backup/` `_local/` `sandbox/`）已移除。下文涉及 React/Vite/Tauri/
> npm/前端阶段的章节（§9 技术栈冻结表、§16 Frontend Rules、§12 四层中的 Frontend 等）均为
> **历史约束或已移除内容的说明，权威后端信息以 `docs/backend/` 为准**。
> 权威后端档案：`docs/backend/README.md`（架构/技术栈/功能/数据模型/API/测试/运行态/历史）。

## 0. 核心工程原则

Local-first · Minimal Dependencies · Open Source Reuse · Standard Library First ·
No Reinventing the Wheel · Modular Architecture · Explicit Data Ownership ·
Version Control First · Reproducible Development · Small and Maintainable Codebase

项目目标不是堆叠技术，而是在尽可能少的复杂度下实现完整能力。禁止为了"看起来高级"而增加技术栈。

> **⚠️ 当前开发政策：P8 收尾阶段（2026-08-31 裁定，现行有效）** ——
> 端到端闭环 + 契约一致性为最高准则，前后端范围限制已解除；
> 跨层修改须真实原因（`AGENTS.md` §12 / `docs/PROJECT_STATE.md` §0.1）。
> 「后端优先（2026-08-28）」与「前端阶段（2026-08-30）」均为历史政策，见 `PROJECT_STATE.md` §0。

## 1. 能力复用优先级链（Ponytail 阶梯）

写任何代码之前，逐级检查，停在第一级成立的台阶：

```
1. 这东西需要存在吗？        → 不需要：不做（YAGNI）
2. 代码库里已有？            → 复用，不重写
3. 标准库能做？              → 用标准库
4. 平台原生能力能做？        → 用平台能力
5. 已安装的依赖能做？        → 用它
6. 一行能写完？              → 就一行
7. 以上都不行                → 才写最少可用的实现
```

阶梯在理解问题之后运行，而不是代替理解：先读要改的代码，追踪真实数据流，再选台阶。

**禁止重新实现以下成熟基础设施**（除非有经确认的架构原因）：
Markdown parser · Git engine · SQL engine · Code editor · Syntax highlighter ·
LSP · AST parser · 数学符号引擎 · HTTP client · JSON/YAML parser · Graph layout engine · Auth 框架

开发精力只投入核心创新：Knowledge Graph · Learning Memory · AI Tutor · Visual Learning Engine。

**但禁止"为了复用而复用"**：
- 少量简单代码（几十行内、标准库可完成）< 一个复杂依赖
- 成熟复杂能力 > 自研大型轮子
- 按实际维护成本判断，不机械遵守 DRY

## 2. 依赖纪律

### 2.1 引入前六连问（Dependency Review）
1. Python / TypeScript / Rust 标准库是否已提供该能力？
2. 当前项目已有依赖是否已提供该能力？
3. 项目内是否已有类似实现？
4. 是否有成熟、活跃、广泛使用的开源项目可复用？
5. 能否组合已有能力解决？
6. 若必须新增，是否真的值得长期维护成本？

只有前面方案都不合理才允许新增。登记模板见 `docs/DEPENDENCIES.md`，答不全不准加入。

### 2.2 禁止清单（永久）
- ORM / Query Builder（后端直写 SQL）
- CSS 框架（Tailwind 等）、UI 组件库、图标库
  - D3 全家桶（渲染/选择集模块）；~~唯一例外 `d3-force` 物理计算单模块（ADR-007）~~
    ——**该例外已失效（2026-09-02 收口标记）**：d3-force 已于 v0.1.0-rc.1 移除，
    Universe 现为自研 Canvas 2D（`GalaxyCanvas.tsx`）；
    PixiJS / Three.js / Manim / markmap 同禁（可视化走 §8 两套管线：Knowledge Universe 与 Trace）
- LangChain / LlamaIndex 及一切 AI 编排框架（管线手写）
- 向量数据库与 embedding 服务（实测性能瓶颈之前）
- 状态管理库除 Zustand 外不再增加
- 为几十行的功能引入 npm 包；为工具函数引第三方库；同领域多个重叠框架；
  为"未来可能需要"提前安装；为追流行引入依赖

### 2.3 防膨胀与审计
- 禁止 Dependency Creep / Duplication / Framework Creep / Abstraction Creep
- 同一能力域只允许一个明确方案；新库与旧库重叠时优先复用旧的；
  新库明显更优必须先提替换方案，不允许两者并存
- 每个里程碑结束做依赖审计：未使用 / 重复 / 间接 / 过时 / 高风险 /
  可被标准库替代 / 可删除
- 目标是**最小的合理依赖集合**，不是为了数字牺牲可靠性

## 3. 架构红线

- 后端只用 Python 标准库 `sqlite3` 直写 SQL；图谱查询用递归 CTE，不引图数据库
- LLM 接入只走 OpenAI-compatible HTTP 接口（含 Ollama），settings 配置驱动，代码不感知厂商
- 正文唯一事实源是 `workspace/vault/` 下 Markdown 文件；SQLite 只存元数据/索引/学习状态
- 思维导图结构唯一事实源是 `*.mindmap.json` 旁车文件；md 中带 `generated:mindmap`
  标记的大纲段是派生视图，禁止手改（TECH_DESIGN §7，ADR-002）
- 可视化一律走 Trace → 模板渲染管线（TECH_DESIGN §8），禁止直接生成动画数据或视频
- 用户代码执行必须子进程隔离 + 超时限制，禁止服务进程内 exec
- **多端可见性铁律**：凡需跨设备可见的状态必须以文件形式存在于 workspace/
  （md / 旁车 json / eventlogs jsonl）；SQLite 在任何设备上都只是可重建的本地缓存；
  db、settings、API key 永不参与同步（ADR-005）
- **图谱分层铁律**：React Flow 仅渲染（graph-ui）；节点/边/关系与全部图计算归
  Core（graph-core）；布局引擎独立模块——UI 组件内禁止图计算（ADR-008/separation.md）
- **用户数据永不锁死**：vault 永远是开放 Markdown；系统必须始终保留一键全量导出能力
  （MD+附件+JSON 元数据，backlog T-EXPORT）；禁止引入阻碍导出/迁移的私有格式或云端绑定
- **AI 调用边界**：Router 禁止直连 LLM；一切提示词组装必须经 core/ai Context Builder，
  未来 RAG 只是给 Builder 增加数据源而非新管线（ADR-010）
- **Entity vs Document**：Markdown 是内容载体，Entity 是知识对象；
  Tutor 与检索面向实体+学习记忆，而非文件关键词搜索（ADR-009）

### 3.1 数据所有权分离
应用源码（server/ web/ docs/）与用户数据严格分离：

```
learning-os/            # 应用源码，Git 管理
├── server/ web/ docs/
├── workspace/          # 用户私有数据根（可在设置中改路径），整个目录 .gitignore
│   ├── vault/          # Markdown 笔记 + *.mindmap.json
│   ├── attachments/
│   └── db/             # SQLite
└── .git
```

- 用户知识库 / 用户代码 / AI 生成内容 / 应用源码四者明确区分
- "代码上传"只能理解为 Import / Attach / Open / Sync，绝不复制进应用源码
- 应用默认不修改用户原始代码
- **本地归档区 `_local/`**（仓库根，整体 .gitignore）：旧代码快照、被替换的历史文档版本、
  临时实验脚本、个人调试脚本——仅存本机，永不提交。
  注意：正式回归测试（pytest/vitest 用例）不属于此列，必须随代码入库（可复现开发原则，
  见 `docs/security/network-boundary.md`「本地归档区」节）

## 4. 版本控制（第一天启用）

- Git 是 Source Code / Architecture / Configuration Template / Documentation 的**唯一版本真相**
- 禁止自造 commit / diff / patch / branch / history 系统
- Commit：小、清晰、可回滚、单一目的；conventional 风格
  （feat: / fix: / refactor: / docs: / chore:）；禁止巨大混合提交
- Semver `MAJOR.MINOR.PATCH`；每个稳定里程碑 = Git tag + CHANGELOG 条目
- 详细规则见 `docs/version-control/git-policy.md`

### 4.1 外部 Git 仓库导入边界
- 必须：识别 repository、保留原始 `.git`、不破坏历史、不改用户 Git 配置、展示 branch 与工作区状态
- 默认 **Read-only / Safe Import**；commit / push / pull / checkout / merge / rebase 仅在用户明确要求时
- 禁止默认上传用户代码到云端；仅当用户明确选择上传/同步/发送给云端 AI 时才产生网络传输，
  且 UI 必须明示：哪些文件、发到哪里、为什么、是否含隐私
- AI 只能获得：当前文件、当前选中代码、用户明确授权的目录/上下文
  绝对禁止自动读取或上传：`.env`、密钥、Token、SSH keys、凭证、数据库、私人配置、Git credentials

## 5. 写码前架构检查十问

实现新功能之前逐条回答，答案不合理不得写码：
1. 当前代码是否已经能完成？
2. 是否已有对应依赖？
3. 标准库是否能完成？
4. 是否有成熟开源项目？
5. 是否真的需要新依赖？
6. 是否会增加维护成本？
7. 是否会造成重复实现？
8. 是否会破坏 Local-first？
9. 是否会破坏 Git/版本控制？
10. 是否会造成数据模型重复？

## 6. 保持简单

- 优先 Simple / Explicit / Modular / Readable，拒绝 Clever / Over-engineered / 过度抽象
- 没有真实复杂度就不制造 Factory / Manager / Provider / Adapter / Service /
  Repository / Controller 层
- 任何新模块先问：必要吗？可删除/合并/复用现有模块/标准库/成熟开源吗？

## 7. [ARCHITECTURE WARNING] 协议

准备实施以下任一行为时，**立即停止并向用户报告，未经确认不得继续**：
引入大量 npm 包 · 引入重复库 · 自行实现已有成熟项目 · 自动上传用户代码 ·
自动执行 Git push · 自动修改用户 repository · 用户代码上传云端 AI ·
增加新数据库 · 新状态管理框架 · 新 UI 框架 · 新 ORM · 新构建系统

> **「自动执行 Git push」的作用域**（2026-08-31 澄清）：
> 指**未被告知、未经验收的**静默推送——例如过程中顺手推、把未完成的中间态推上去、
> 或在**导入的第三方 repository** 上执行任何 push。这些必须先报告。
> **本项目仓库（`origin`）在完成一轮任务并跑通自检后推送，是 §18 §2.2 的强制义务，
> 不属此列**——那种情形恰恰相反：不推送才需要报告。

报告格式：
```
[ARCHITECTURE WARNING]
问题：
为什么违反规则：
涉及的依赖/模块：
已有替代方案：
推荐方案：
如果强行实现的长期成本：
```

### 7.1 [ENVIRONMENT CHANGE REQUEST] 协议（环境类）

AI 禁止自行：安装依赖 · 修改系统环境 · 创建成批辅助文件 · 引入开发工具 · 保留无用代码。
认为需要时先输出并等待确认：

```
[ENVIRONMENT CHANGE REQUEST]
新增内容 / 目的 / 替代方案 / 删除风险 / 长期维护成本
```

完整治理规则见 `AGENTS.md §17`。

## 8. 核心创新优先级

时间有限时按此排序，不为 UI 动画/配置系统/复杂插件系统牺牲核心：
1. Knowledge Graph
2. Learning Memory
3. AI Tutor
4. Multi-device Sync 与 Mobile（学习连续性依赖多端可见，ADR-005/006）
5. Visual Learning Engine
6. Knowledge/MindMap Integration
7. Code Learning Environment
8. UI polish
9. 非核心功能

## 9. 技术栈冻结表

**当前生效**：React · TypeScript · Vite · Zustand · TipTap · React Flow · KaTeX ·
Python 3.12 · FastAPI · sqlite3(stdlib) + FTS5 · Markdown · Git · Tauri(M6 起) ·
dagre（Graph 布局）· 自研 Canvas 2D（Galaxy/星系）
（~~marked~~ 从未安装，Markdown 走 tiptap-markdown；~~d3-force / cobe~~ 已于 v0.1.0-rc.1 移除——
ADR-007 例外随之失效）

**规划中（触发条件达成前禁止安装，清单见 REGISTRY）**：
- M8 Mobile：React Native · Expo · expo-sqlite 及 RN 系全部包
- Phase 5 IDE：Monaco · SymPy / Jupyter · Tree-sitter / LSP · Docker 沙箱
- RAG：sqlite-vec + 云端 embedding API（概念数 >2000 或匹配质量不足时）

无充分理由不得替换上述任何一项。

## 10. 文档地图与同步义务

> **文档结构（2026-08-29 整合后）**：docs/ 根部 9 份主题文档为唯一有效层；
> 被合并的旧文档全部在 `docs/archive/`（不再更新）；历史目录已移除。
> 任何新文档先问：能不能并进现有主题文件？禁止再开新散文件。
>
> **单一真相源原则（2026-09-02 所有者裁定，强制）**：项目进度/里程碑/验证数字的
> 唯一权威登记处 = `docs/PROJECT_STATE.md`。其他文档（TASKS / ACTIVE_TASK /
> CURRENT_STATE / README / CHANGELOG / ADR）**只能引用或补充，不得各自维护进度真相**。
> 发现他处与 PROJECT_STATE 冲突：先 `git log` + 代码核实，再回改他处。

### 开发政策（最高优先级）

**后端优先（Backend-First，2026-08-28 裁定）**：后端 backlog 清零之前禁止新增
任何前端任务；前端仅允许最小接线 / 阻断性修复 / 类型契约同步三类。
权威表述：`docs/PROJECT_STATE.md` §0（含解冻条件）。`P8-FE-001` 无限期冻结。

### 入口与权威来源

| 文档 | 职责 |
|---|---|
| `README.md` | 项目入口与启动说明 |
| `AGENTS.md`（本文件） | 工程宪法（操作摘要与强制流程） |
| `docs/PROJECT_STATE.md` | **状态唯一来源**（实然）· §0 = 后端优先政策 |
| `docs/TECH_DESIGN.md` | **技术设计唯一来源**（应然：架构/DDL/API/里程碑） |
| `docs/TASKS.md` | 任务列表、路线与完成报告（见 §11） |

### 主题文档（docs/ 根，按主题垂直整合）

| 文档 | 覆盖内容 |
|---|---|
| `docs/DEPENDENCIES.md` | 依赖政策 + 注册表（后端优先期冻结前端依赖） |
| `docs/DATA_MODEL.md` | 数据模型契约：learning-model · tutor-context · prompt · language · 表审计 |
| `docs/SYNC.md` | M7 同步全链：model/transport/conflict/recovery/边界审计 |
| `docs/TESTING.md` | 测试策略 · 矩阵 · 回归 · 发布清单 |
| `docs/EVALUATION.md` | Tutor 评估体系（plan/metrics/cases） |
| `docs/archive/design/DESIGN.md` | 前端设计规格（**冻结 / 已归档**：Learning Loop · UI Reference · Earth UI） |

### 参考目录

| 目录 | 内容 |
|---|---|
| `docs/adr/` | ADR-001~025 + principles + separation + upmark（重大决策记录） |
| `docs/ai/` | AI 会话流程（PROJECT_MEMORY · SESSION_PROTOCOL · CURRENT_STATE · ACTIVE_TASK · ADR_INDEX） |
| `docs/release/` | 发布审计与导出清单（RELEASE_AUDIT_M7 · EXPORT_MANIFEST） |
| `docs/security/` · `docs/version-control/` | 网络边界 · Git 策略（活契约，未合并） |
| `docs/diagrams/` · `docs/audit/` | 架构图 · 里程碑审计报告 |
| `docs/archive/` | 已整合旧文档（只读，不再更新） |

## 11. 任务与报告制度（强制）

- **每次会话开始任何工作前，必须先读 `docs/TASKS.md` 对齐当前状态；收工前立即同步状态并回填报告**
- 全部开发任务登记于 `docs/TASKS.md`：开始前写计划，完成后回填报告
- 报告必须包含：做了什么 · 改动文件 · **测试了什么（实际执行的测试命令+预期/实际结果表）** · 遗留问题
- 未回填报告的任务视为未完成；里程碑收尾**四件事**：依赖审计(REGISTRY) →
  **环境删除测试 + 删除优先检查**（AGENTS.md §17 §五）→ CHANGELOG → tag

## 12. 分层架构纪律（前后端分离，强制）

四层职责固定：**Frontend**(web/) · **Backend**(routers/) · **Core**(server/core/) · **Data**(workspace/)。
唯一合法调用链：

```
Frontend → HTTP /api/v1 → Router(校验) → Core(业务) → 数据访问函数 → SQLite/文件
```

- Frontend 禁止：直连 SQLite/文件系统、业务规则、AI 调用、图谱算法、持久化核心数据
- Backend 禁止：UI 代码、控制页面逻辑、保存前端状态
- Core 不 import FastAPI；LLM 请求只允许在 `core/ai/*`；图谱算法只在 core；同步协议只在 syncengine
- API 全部版本化 `/api/v1/*`；响应形状以 `shared/types/*.ts` 为唯一契约，pytest 契约测试锁定
- 白名单/黑名单与模块隔离细则见 `docs/adr/separation.md`

### 写码前输出协议（强制）

任何功能生成代码前，必须先输出以下 8 项并等待用户确认：

```
1 功能目标   2 架构位置(层/模块)   3 Frontend 改动   4 Backend 改动
5 Core 改动  6 Data 改动          7 API 设计(路径/schema/错误码)   8 文件变化列表
```

禁止先写页面再临时拼后端。

### 设计三问（随八项清单一并作答）

1. 这是用户真正需要的吗？
2. 是现在必须做的吗？
3. 三个月后新人能看懂吗？

### 端到端闭环协议（P8 收尾阶段 · 2026-08-31 项目所有者裁定）

> 政策来源：`PROJECT_STATE.md` §0.1。自 P8 收尾阶段起，
> **不再人为限制前后端修改范围，以「端到端闭环 + 契约一致性」为最高优先级**；
> 「前端任务不改后端」的阶段性限制解除。

**以真实代码为准**：开工前先读当前实现 / API / Shared Types / Core / Store / UI /
测试 / ADR / TASKS / git history。文档 ≠ 代码时先核实；已实现的不重复实现，
已废弃的不重新引入。

**跨层修改规则**：允许按真实需要修改 Frontend / Shared Types / Router / Core /
Migration / Tests / Documentation——**必须有真实原因，禁止借任务名义扩权**。
典型合法场景（修真正的问题，而非为任务扩范围）：

- A：API response 缺前端必需字段 → 改 Router/Core/Shared Type
- B：后端行为语义错误 → 改后端 + 测试
- C：Backend 返回 ≠ Shared Type 声明 → 统一契约
- D：Core 已有能力但 Router 未暴露 → 补 Router
- E：Router 已有但 Frontend 未接入 → 接 Frontend
- F：schema 确实不足 → migration + Core + API + Types + Frontend + Tests 全链补齐

**禁止的偷懒形态**：frontend workaround · duplicated state · 类型强转/`any` ·
魔法字段 · 重复 API · 隐式 fallback · 与后端实际行为不符的 mock。
**禁止**：为 PASS 测试改测试语义 · 自动发送 Tutor 提问（tutorSeed ≠ 自动提问）·
重复实现已有 API/Core · 无理由新增表/依赖/Provider · 顺手实现未排期功能。

**契约一致性（硬要求）**：endpoint · method · request body · response shape ·
nullable · enum · ID 类型 · 时间格式 · 错误码 · loading/failure · 空数据 · 幂等——
Backend 实际返回 = Shared Type 声明 = Frontend 消费，三层必须一致
（`refId`/`ref_id` 事故与 M3.5-B 两次字段误判皆为前车之鉴）。

**验证与回归**：跨层功能 pytest + vitest + `tsc --noEmit` + `vite build` 全绿；
不能只验证自己改的文件。旧测试因设计变更失败：先判断过时 / 设计变更 / 真回归，
**不许删测试了事**；设计确已变更则更新测试 + 文档 + 说明原因。

**错误隔离与安全**：辅助 AI 功能（extractor 等）失败不得影响主 answer；
api_key / token / secret 永不入 answer / snapshot / memory / prompt / 日志 / event。

**验收输出**：完成后逐文件说明修改 · 数据流图（User Action → … → UI）·
测试结果（pytest/vitest/tsc/build 各自数字）· 架构自检（ADR 是否违反 /
API 一致 / Types 同步 / DB 变化 / 新依赖 / 跨层修改——逐项是或否+说明）·
commit hash 与 working tree 状态。

**未满足最终判断标准的项，明确标注：已完成 / 部分完成 / 未完成 / 后续任务——
不许用「目前 MVP 足够」掩盖。**

**核心哲学**：「不改后端」不是质量，「只改三个文件」不是质量。
质量 = 功能正确 + 架构正确 + 数据一致 + API 一致 + 类型一致 + UI 一致 +
测试完整 + 文档同步 + 未来可维护——目标是让整个系统真正一致，
而不是一堆能分别通过测试的模块。

## 快速参考

| 事项 | 约定 |
|---|---|
| 后端 | Python 3.12 + FastAPI + sqlite3（venv + pip + requirements.txt） |
| 前端 | React + TypeScript + Vite + Zustand + 单一 global.css |
| 端口 | FastAPI 默认 :8000（绑 127.0.0.1），环境变量 `PORT` 可覆盖——与 UpMark 共存时用 `PORT=8100`；Vite :5173（proxy `/api/v1` → 后端） |
| 测试 | pytest（server/tests），vitest（web）——以 core/契约/源码审计为主，UI 层用 renderToStaticMarkup 与源码接线测试（无 jsdom） |
| 任务跟踪 | docs/TASKS.md（完成必须回填测试报告） |
| 本地归档 | `_local/` 存旧代码/旧文档/临时脚本，仅本机不入库 |
| 实验沙盒 | `sandbox/` 一次性实验用完即删；版本基线与环境变量见 AGENTS.md §17 |
| 用户数据 | 一律在 `workspace/`（默认路径，设置可改），永不入库 |
| 一键测试 | `.\scripts\test.ps1`（全量）/ `-Smoke`（M2 烟测）/ `-Watch`（监听） |

## 13. 测试基础设施规范（M2+ 强制）

**三层测试体系**（M2 起每个功能必须覆盖）：

| 层级 | 位置 | 工具 | 速度 | 何时运行 |
|---|---|---|---|---|
| Unit | `tests/unit/` | 纯函数调用 | <1s | 每次改 core |
| API | `tests/api/` | FastAPI TestClient | ~2s | 每次改 router/core |
| Smoke | `tests/api/test_*_smoke.py` | TestClient 全流程 | ~2s | 里程碑验收 |

- **禁止手工启动 uvicorn 跑测试**——TestClient 一条命令出结果
- **禁止 PowerShell `Invoke-RestMethod` 发送 UTF-8 中文 JSON 请求**（GBK 乱码）——统一用 pytest TestClient 或 Python httpx
- 每个新功能必须拥有不依赖人工启动服务的自动化测试路径
- 测试用例使用临时 workspace（`tmp_workspace` fixture），绝不触碰真实用户数据
- SQLite 连接在断言时打开、用完即关——避免 TestClient 与 fixture 并发锁冲突

## 14. Windows 开发环境红线

- **UTF-8 源码禁止 PowerShell 管道写入**——一律使用 Write 工具
- **API 测试禁止 `Invoke-RestMethod`**——GBK 控制台会把中文 JSON 体乱码
- 进程管理（kill/start）合并为单条脚本，避免多次 bash 调用的 PowerShell 启动开销

## 15. AI Agent Context Loading Rules

For AI-assisted development, the following context loading protocol is mandatory.
Detailed rules in `docs/ai/SESSION_PROTOCOL.md`.

### Required loading order

1. `docs/ai/PROJECT_MEMORY.md` — permanent memory (<200 lines, never changes)
2. `docs/ai/CURRENT_STATE.md` — current state (updated every commit)
3. `docs/ai/ACTIVE_TASK.md` — active task (if exists)
4. `docs/ai/ADR_INDEX.md` — ADR index (expand only relevant ADRs)

### Do not

- Scan entire `docs/` directory to "understand the project"
- Re-read all 12 ADRs on every session
- Reopen completed architectural decisions
- Modify frozen modules without review (see CURRENT_STATE "Do Not Touch")
- Start coding without reading CURRENT_STATE first
- Take on an entire milestone in one session (must decompose into sub-tasks)

### Context files location

```
docs/ai/
├── PROJECT_MEMORY.md    # AI permanent memory
├── CURRENT_STATE.md     # Current state snapshot
├── ACTIVE_TASK.md       # Current active task
├── SESSION_PROTOCOL.md  # AI behavior rules
└── ADR_INDEX.md         # ADR index (expand on demand)
```

## 16. Frontend Generation Rules

AI 生成 UI 必须遵守 ADR-013 Frontend Design System。
详细规范见 `docs/adr/ADR-013-frontend-design-system.md`。
视觉参考见归档的 `docs/archive/design/DESIGN.md`（前端设计规格，纯后端化后已冻结，不再维护）。

### Design Philosophy

```
Minimal · Clean · Professional · Scientific
```

目标：像一个长期使用 10 年的知识工具。
不是：SaaS Dashboard / AI Demo / 营销网站。

### Layout Rules

禁止：
- 随意新增页面
- 随意新增侧边栏
- 随意新增浮窗

新增布局必须经过 ADR。

### Component Rules

组件必须服务功能。禁止装饰性组件。

禁止：DecorativeCard / FancyPanel / GlowEffect / HeroSection / FeatureCard
允许：ReviewList / NotePanel / GraphView / SuggestionList

### CSS Rules

禁止：gradient / backdrop-filter / glassmorphism / neon color / excessive shadow
允许：border / subtle background / 150-250ms transition

### Icon Rules

禁止引入图标库。禁止 emoji 图标。禁止装饰性 SVG。
优先：文字 / 快捷键 / tooltip

### Orange Usage

橙色只能用于：当前选中 / 重要节点 / 学习反馈 / AI 提示 / 操作反馈
禁止：大面积橙色背景 / 卡片背景 / 渐变 / 装饰线

### Reference Products

允许参考：Obsidian / VS Code / Linear / Typora
禁止模仿：AI 营销网站 / Dashboard 模板 / 游戏 UI

---

## 17. 开发环境治理（Environment Governance）

> 并入自 `AGENTS.md §17`（原标题：开发环境记录与环境治理（Environment Governance））

> **强制约束**。原则：Minimal · Reproducible · Clean Workspace · Disposable Experiment。
> 目标：新机器可重装 · 一条命令启动 · 依赖来源可追溯 · 删临时文件不影响项目 · 零不可追踪污染。
> 关联：`AGENTS.md` §11（里程碑收尾）/ §7（WARNING 协议）· `docs/version-control/git-policy.md`

日期：2026-08-26 · 状态：Accepted

### 一、版本基线（本机实测）

| 工具 | 版本 | 说明 |
|---|---|---|
| Python | 3.12.10 | venv 隔离于 `server/.venv`（不入库） |
| Node.js | 24.18.1（npm 11.16） | 依赖锁 `web/package-lock.json` 必须提交 |
| Rust | 1.98.0 (GNU 工具链) | `D:\RustToolchain`（rustup + cargo），Tauri CLI 2.11.4 |

### 二、安装与启动（唯一权威来源 = README.md）

```
后端：cd server && python -m venv .venv && pip install -r requirements.txt
      uvicorn app.main:app --reload --port 8000        # 或 python -m app.main（读 PORT）
前端：cd web && npm install && npm run dev             # http://127.0.0.1:5173
```

禁止出现"你电脑装了 xxx 就能跑"——一切以项目内配置文件定义为准。

### 三、目录归属法

任何文件创建前必须能归入且仅归入一类：
Source Code / Configuration / Documentation / Test / Build Artifact / Runtime Data。

| 路径 | 归属 | 入库？ |
|---|---|---|
| `web/src/` 等 | Source | ✅ |
| `migrations/` · `requirements*.txt` · `package.json` · 各 md | Config/Doc/Test | ✅ |
| `web/dist/` | Build Artifact | ❌ gitignore |
| `server/.cache/` | Backend 缓存产物 | ❌ gitignore |
| `server/.venv/` · `node_modules/` | 环境本体 | ❌ gitignore |
| `workspace/` | Runtime Data（用户私有） | ❌ gitignore |
| `_local/` | 本地归档：旧代码快照/被替换文档 | ❌ gitignore，**长期保留** |
| `sandbox/` | 一次性实验 | ❌ gitignore，**用完即删** |

禁止出现 `temp/ test2/ backup/ old/ new/ demo-final/ *-copy/` 这类目录；
禁止把生成物混进源码目录。

### 四、sandbox 实验规则

- 实验代码一律进 `sandbox/<实验名>/`（如 `sandbox/force_layout_try/`）
- 不进入正式模块、不被正式代码 import、不加正式依赖声明
- 实验结束**必须删除**；有价值的结论沉淀为 ADR 或 TECH_DESIGN 条目，代码本身丢弃
- 与 `_local/` 的区别：`_local/`=有保留价值的归档；`sandbox/=`即弃草稿

### 五、里程碑收尾检查（并入 AGENTS §11，共四件事）

1. **依赖审计** → REGISTRY 审计记录
2. **环境删除测试**：删掉 `.venv/ node_modules/ dist/ .cache/ 临时文件` 后，
   仅凭源码+配置按 README 能否完整重建运行？（实测通过才算过）
3. **删除优先检查**：未使用依赖 / 未使用文件 / 空目录 / 废弃代码 / 重复实现 —— 优先删除而非保留
4. CHANGELOG 条目 + Git tag（版本策略见 git-policy.md）

### 六、禁止清单

- 项目目录外随意安装工具；保存下载缓存/AI 缓存/日志垃圾/测试数据入库
- 未经批准引入：Docker（部署前）/ Kubernetes / 复杂 CI / Monorepo 工具 / Nx / Turborepo / Bazel——简单脚本够就不加工具

### 七、[ENVIRONMENT CHANGE REQUEST] 协议

AI 禁止自行：安装依赖 · 修改系统环境 · 创建成批辅助文件 · 引入开发工具 · 保留无用代码。
认为需要时，先输出并等待确认：

```
[ENVIRONMENT CHANGE REQUEST]
新增内容：
目的：
替代方案：
删除风险：
长期维护成本：
```

### 八、环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `PORT` | 8000 | FastAPI 监听端口（仅 `python -m app.main` 方式读取）；与 UpMark 共存设 8100 |
| `API_PORT` | 8000 | Vite dev proxy 目标端口 |
| `WORKSPACE_DIR` | `<repo>/workspace` | 用户数据根，可指向任意本地目录 |

---

## 18. 版本控制策略（Version Control Policy）

> 并入自 `docs/version-control/git-policy.md`（原标题：版本控制策略（Version Control Policy））

> 强制约束来源：`AGENTS.md` §4。Git 是本项目唯一的版本控制真相；
> 禁止自造 commit / diff / patch / branch / history 系统。

### 1. 基本规则
- 项目**第一天**启用 Git（已于 2026-08-26 初始化）
- 主干 `main`；个人项目允许 main 直接小步提交，较大功能开 `feature/<name>` 短分支
- Commit 必须小、清晰、可回滚、单一目的；禁止 "feat: everything" 式巨型混合提交
- Conventional 风格前缀：

| 前缀 | 用途 |
|---|---|
| feat: | 新功能 |
| fix: | 缺陷修复 |
| refactor: | 重构（不改行为） |
| docs: | 文档 |
| chore: | 构建/工具/杂项 |
| test: | 测试 |

### 2. 用户数据永不入库
- `workspace/` 整体 `.gitignore`（知识库、附件、SQLite、AI 生成内容）
- `.env*` 及一切密钥凭证禁止提交
- 构建与验证产物不入库：`dist/`、`dist_verify*/`、`coverage/`、`*.log`
- 导入的外部 Git repository 保留原始 `.git`，默认只读；
  commit/push/pull/checkout/merge/rebase 仅在用户明确要求时执行

#### 2.1 入库 / 不入库边界（2026-08-31 明确）

**必须入库**（丢失即不可逆，或破坏可复现开发）：

| 类别 | 例子 | 理由 |
|---|---|---|
| 源码 | `server/app/**` · `web/src/**` | 一切工作的本体 |
| 契约 | `shared/types/**` | 前后端唯一权威定义 |
| 测试 | `server/tests/**` · `web/src/**/*.test.ts` | 可复现开发；**正式回归测试不属于「本地临时脚本」**，必须入库 |
| 文档 | `docs/**` · `AGENTS.md` · `README.md` · ADR | §10 同步义务 |
| 依赖锁 | `server/requirements.txt` · `web/package-lock.json` | 环境可复现 |
| 静态资源 | `web/public/**`（含 `favicon.svg`、`assets/dots-world.png`） | 运行时依赖 |
| 配置模板 | `.gitignore` · `vite.config.ts` · `tsconfig.json` | 环境一致性 |

**永不入库**：

| 类别 | 例子 | 处置 |
|---|---|---|
| 用户私有数据 | `workspace/`（知识库/附件/SQLite/AI 生成内容） | gitignore |
| 密钥凭证 | `.env*` · API key · Token · SSH key | gitignore；LLM key 只存 `workspace/db/` |
| 构建与验证产物 | `dist/` · `dist_verify*/` · `coverage/` · `*.log` | gitignore |
| Python/Node 环境 | `.venv/` · `node_modules/` · `__pycache__/` · `.pytest_cache/` | gitignore |
| 本地归档区 | `_local/`（旧代码快照/旧文档版本/临时脚本） | gitignore |
| 一次性实验 | `sandbox/`（用完即删；有价值的结论沉淀为 ADR） | gitignore |
| 后端缓存 | `server/.cache/` | gitignore |
| 打包产物 | `src-tauri/target/` | gitignore |

> **判据**：这个东西丢了，能从 git 历史/origin 恢复吗？能 → 不入库（或可删）；
> 不能 → 必须入库。**测试与文档按「不能」处理。**

### 2.2 推送策略（2026-08-31 明确）

- 本项目仓库（`origin` = `Personal-Learning-OS`）：**每轮任务完成即推送**
  （`git push origin main`）。积压在本地 = 单点风险——仅存于本机磁盘，无副本。
- 推送前自检：`tsc --noEmit` / `vitest run` / `pytest -q` 全绿 + 构建通过。
- **例外**：在 `feature/<name>` 短分支上的未完成工作可不推，但合回 `main` 后必须推。
- **导入的第三方仓库**：仍适用 §4.1 / §19 的 Read-only 边界——
  commit/push 仅在用户明确要求时执行，绝不自动 push。
  > ⚠️ 该边界的作用域是**导入的外部仓库**，不是本项目仓库。
  > 曾因误读为全局禁令导致本项目 118 个提交积压 4 天未推送（2026-08-31）。
- 若推送因认证失败（HTTPS 无法交互输凭据 / SSH publickey 被拒），
  **必须明确报告用户**，并说明本地未推送的提交数——不得静默跳过。

### 3. 版本发布（Semver）
- 格式 `MAJOR.MINOR.PATCH`；MVP 开发期固定 `0.x.y`
- 每个稳定里程碑：
  - annotated tag：`git tag -a v0.Y.0 -m "..."`
  - CHANGELOG.md 新增条目（Keep a Changelog 格式）
  - 对应里程碑验收标准全部满足才允许打 tag
- 预期映射（按实际完成度执行）：M1→v0.1.0 · M2/M2b→v0.2.x · M3→v0.3.0 ·
  M4→v0.4.0 · M5→v0.5.0 · M6（桌面安装包）→v0.6.0 · 1.0.0 待产品稳定后评估

### 4. 可复现开发
- Python：requirements.txt 固定版本区间 + venv
- Node：package-lock.json 必须提交
- 启动命令以 README.md 为准，保持两条命令可用

---

## 19. 安全与网络边界（Security & Network Boundary）

> 并入自 `docs/security/network-boundary.md`（原标题：安全与网络边界（Security & Network Boundary））

> 强制约束。关联：`AGENTS.md` §3/§4.1 · ADR-003 · `docs/version-control/git-policy.md`
> 违反本文的行为必须先发 `[ARCHITECTURE WARNING]`（AGENTS §7）。

日期：2026-08-26 · 状态：Accepted

### 默认姿态

1. **零遥测**：无统计、无崩溃上报、无匿名分析、无"检查更新"外呼
2. **只绑回环**：FastAPI/Uvicorn 监听 `127.0.0.1`，禁止 `0.0.0.0`（防局域网暴露）
3. **无出站即无风险**：不写任何非白名单的网络请求代码路径

### 出站白名单（唯一例外）

| 用途 | 目标 | 启用条件 |
|---|---|---|
| LLM 对话/抽取 | 用户在设置中显式配置的 `base_url`（OpenAI-compatible `/v1/chat/completions`） | 设置页填写后才存在此代码路径 |
| Embedding（Phase 3 起） | 同上协议，另行显式启用 | 触发条件见 REGISTRY 规划表 |

白名单之外的一切出站请求（更新检查、字体/CDN 拉取、第三方统计等）一律不做。
前端构建产物必须完全本地化，不引用 CDN。

### 发送给云端 LLM 的上下文最小化

- 只发送：当前用户问题 + 检索到的相关概念/掌握度/错误摘要 + 明确授权的笔记片段
- **绝对排除**（无论用户如何配置，代码层硬过滤）：
  `.env` · API 密钥 · Token · SSH keys · Git credentials · 数据库文件 ·
  `workspace/db/` · 系统私人配置
- UI 义务：首次使用云端 LLM 前明示"哪些内容会被发送到哪里"；对话页提供
  「本次发送的上下文」透视（与 TECH_DESIGN §6.2 context_json 对应）
- AI 不获得整库访问权：只能拿到管线检索出的片段与用户显式授权的范围

### 外部 Git 仓库导入

> ⚠️ **本节作用域 = 导入到本项目的第三方/外部仓库，不是本项目仓库本身。**
> 本项目仓库（`origin`）的推送策略见 **§18 §2.2**——每轮任务完成即推送。
> 曾因把本节误读为全局「禁止自动 push」导致 118 个提交积压 4 天（2026-08-31）。

- 默认 Read-only / Safe Import；保留原始 `.git`，不改历史、不改用户 Git 配置
- commit / push / pull / checkout / merge / rebase 仅在用户明确指令时执行
- 禁止默认上传用户代码到云端；同步/推送必须用户逐次发起

### 密钥与凭证

- LLM API key 仅存 `workspace/db/` 内 SQLite；API 响应永不再返回明文；不写日志
- `.env*` 一律 gitignore；生产形态下无服务器端密钥

### 未来扩展的边界预留

- Phase 5 代码执行沙箱：Docker 容器 `--network none`，CPU/内存/时长受限
- 多语言 trace（gdb/LLDB）：同样仅本地子进程

### 本地归档区（不入库）

`_local/`（仓库根，整体 gitignore）：旧代码快照、被替换的历史文档版本、
临时实验脚本、个人调试脚本——仅存本机，永不提交。
**正式回归测试（pytest/vitest 用例）不属于此类，必须随代码入库**（可复现开发原则）。
`sandbox/` 为一次性实验区，同样不入库且用完即删；有价值的结论沉淀为 ADR/TECH_DESIGN 条目。
（两区边界与环境删除测试见 `AGENTS.md §17` §三/§四/§五）

