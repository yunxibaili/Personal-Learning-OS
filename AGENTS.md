# Personal Learning OS — 工程宪法（Engineering Constraints）

> 本文件是**强制工程约束**，不是建议。任何后续功能设计、代码生成、架构调整、依赖引入、数据结构设计、文件操作、版本控制设计都必须遵守。
> 若需求与本文冲突：① 不得自行绕过；② 必须明确指出冲突；③ 说明现有规则为何无法满足；④ 给出最小改动方案；⑤ 经确认后才能修改架构原则。
> 准备实施下述行为时必须先发出 `[ARCHITECTURE WARNING]` 并等待确认（见 §7）。
>
> **任何会话开始写代码之前，必须先通读以下四份文件**：
> ① `docs/architecture/principles.md`　② `docs/dependencies/dependency-policy.md`
> ③ `docs/security/network-boundary.md`　④ `docs/version-control/git-policy.md`

## 0. 核心工程原则

Local-first · Minimal Dependencies · Open Source Reuse · Standard Library First ·
No Reinventing the Wheel · Modular Architecture · Explicit Data Ownership ·
Version Control First · Reproducible Development · Small and Maintainable Codebase

项目目标不是堆叠技术，而是在尽可能少的复杂度下实现完整能力。禁止为了"看起来高级"而增加技术栈。

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

只有前面方案都不合理才允许新增。登记模板见 `docs/dependencies/REGISTRY.md`，答不全不准加入。

### 2.2 禁止清单（永久）
- ORM / Query Builder（后端直写 SQL）
- CSS 框架（Tailwind 等）、UI 组件库、图标库
  - D3 全家桶（渲染/选择集模块）；**唯一例外 `d3-force` 物理计算单模块（ADR-007）**；
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

完整治理规则见 `docs/environment.md`。

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

**当前生效**：React · TypeScript · Vite · Zustand · TipTap · React Flow · KaTeX · marked ·
Python 3.12 · FastAPI · sqlite3(stdlib) + FTS5 · Markdown · Git · Tauri(M6 起)

**规划中（触发条件达成前禁止安装，清单见 REGISTRY）**：
- M8 Mobile：React Native · Expo · expo-sqlite 及 RN 系全部包
- Phase 5 IDE：Monaco · SymPy / Jupyter · Tree-sitter / LSP · Docker 沙箱
- RAG：sqlite-vec + 云端 embedding API（概念数 >2000 或匹配质量不足时）

无充分理由不得替换上述任何一项。

## 10. 文档地图与同步义务

| 文档 | 职责 |
|---|---|
| `AGENTS.md`（本文件） | 工程宪法（操作摘要与强制流程） |
| `docs/architecture/principles.md` | 十大核心原则权威来源 |
| `docs/architecture/`（ADR-\*） | 重大决策记录（禁止只在聊天记录中决定架构） |
| `docs/dependencies/dependency-policy.md` | 依赖引入流程与红线 |
| `docs/dependencies/REGISTRY.md` | 依赖注册表 + Review 模板 + 审计记录 |
| `docs/security/network-boundary.md` | 网络边界 / 出站白名单 / 数据不出本机规则 |
| `docs/version-control/git-policy.md` | 分支/提交/标签/发布策略 |
| `docs/data-model/INDEX.md` | 数据模型变更索引 |
| `docs/architecture/integration-upmark.md` | UpMark 联动计划（挂起中，未排期） |
| `docs/architecture/separation.md` | 分层架构规范（四层职责/接口先行/契约测试） |
| `docs/environment.md` | 环境治理规则与版本基线（sandbox/_local/收尾四件事） |
| `CONTRIBUTING.md` | 开源贡献指南 |
| `docs/tasks/TASKS.md` | 任务列表与完成报告（见 §11） |
| `docs/TECH_DESIGN.md` | 技术设计唯一来源（架构/DDL/API/里程碑） |
| `README.md` | 入口说明 |
| `CHANGELOG.md` | 变更日志 |
| `docs/ai/PROJECT_MEMORY.md` | AI 永久记忆（<200行，启动必读） |
| `docs/ai/CURRENT_STATE.md` | AI 当前状态快照（每次 commit 后更新） |
| `docs/ai/ACTIVE_TASK.md` | AI 工作记忆（当前子任务范围） |
| `docs/ai/SESSION_PROTOCOL.md` | AI 启动协议与行为规则 |
| `docs/ai/ADR_INDEX.md` | ADR 索引（按需展开，不全读） |

同步义务：出现新依赖 / 新模块 / 新数据结构 / 新 API / 新存储机制 / 新版本控制规则 /
新代码执行机制时，对应文档必须在同一批变更中更新——不允许代码变了文档没变。
新想法一律写入 TECH_DESIGN §10 backlog；里程碑验收标准见 §10。

## 11. 任务与报告制度（强制）

- **每次会话开始任何工作前，必须先读 `docs/tasks/TASKS.md` 对齐当前状态；收工前立即同步状态并回填报告**
- 全部开发任务登记于 `docs/tasks/TASKS.md`：开始前写计划，完成后回填报告
- 报告必须包含：做了什么 · 改动文件 · **测试了什么（实际执行的测试命令+预期/实际结果表）** · 遗留问题
- 未回填报告的任务视为未完成；里程碑收尾**四件事**：依赖审计(REGISTRY) →
  **环境删除测试 + 删除优先检查**（docs/environment.md §五）→ CHANGELOG → tag

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
- 白名单/黑名单与模块隔离细则见 `docs/architecture/separation.md`

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

## 快速参考

| 事项 | 约定 |
|---|---|
| 后端 | Python 3.12 + FastAPI + sqlite3（venv + pip + requirements.txt） |
| 前端 | React + TypeScript + Vite + Zustand + 单一 global.css |
| 端口 | FastAPI 默认 :8000（绑 127.0.0.1），环境变量 `PORT` 可覆盖——与 UpMark 共存时用 `PORT=8100`；Vite :5173（proxy `/api/v1` → 后端） |
| 测试 | pytest（server/tests），vitest（web）——只测 core 逻辑，不为 UI 写测试 |
| 任务跟踪 | docs/tasks/TASKS.md（完成必须回填测试报告） |
| 本地归档 | `_local/` 存旧代码/旧文档/临时脚本，仅本机不入库 |
| 实验沙盒 | `sandbox/` 一次性实验用完即删；版本基线与环境变量见 docs/environment.md |
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
