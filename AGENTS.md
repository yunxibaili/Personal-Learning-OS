# Personal Learning OS — 工程宪法（Engineering Constraints）

> 本文件是**强制工程约束**，不是建议。任何后续功能设计、代码生成、架构调整、依赖引入、数据结构设计、文件操作、版本控制设计都必须遵守。
> 若需求与本文冲突：① 不得自行绕过；② 必须明确指出冲突；③ 说明现有规则为何无法满足；④ 给出最小改动方案；⑤ 经确认后才能修改架构原则。
> 准备实施下述行为时必须先发出 `[ARCHITECTURE WARNING]` 并等待确认（见 §7）。

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
- D3.js / PixiJS / Three.js / Manim / markmap（可视化走 Trace 管线与自研布局，TECH_DESIGN §7/§8）
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

## 4. 版本控制（第一天启用）

- Git 是 Source Code / Architecture / Configuration Template / Documentation 的**唯一版本真相**
- 禁止自造 commit / diff / patch / branch / history 系统
- Commit：小、清晰、可回滚、单一目的；conventional 风格
  （feat: / fix: / refactor: / docs: / chore:）；禁止巨大混合提交
- Semver `MAJOR.MINOR.PATCH`；每个稳定里程碑 = Git tag + CHANGELOG 条目
- 详细规则见 `docs/version-control/POLICY.md`

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

## 8. 核心创新优先级

时间有限时按此排序，不为 UI 动画/配置系统/复杂插件系统牺牲核心：
1. Knowledge Graph
2. Learning Memory
3. AI Tutor
4. Visual Learning Engine
5. Knowledge/MindMap Integration
6. Code Learning Environment
7. UI polish
8. 非核心功能

## 9. 技术栈冻结表

**当前生效**：React · TypeScript · Vite · Zustand · TipTap · React Flow · KaTeX · marked ·
Python 3.12 · FastAPI · sqlite3(stdlib) + FTS5 · Markdown · Git · Tauri(M6 起)

**规划中（Phase 5 前，禁止提前安装）**：Monaco · SymPy / Jupyter · Tree-sitter / LSP · Docker 沙箱

无充分理由不得替换上述任何一项。

## 10. 文档地图与同步义务

| 文档 | 职责 |
|---|---|
| `AGENTS.md`（本文件） | 工程宪法 |
| `docs/TECH_DESIGN.md` | 技术设计唯一来源（架构/DDL/API/里程碑） |
| `README.md` | 入口说明 |
| `docs/architecture/` | ADR 重大决策记录（禁止只在聊天记录中决定架构） |
| `docs/dependencies/REGISTRY.md` | 依赖注册表 + Review 模板 |
| `docs/version-control/POLICY.md` | 分支/提交/标签/发布策略 |
| `docs/data-model/INDEX.md` | 数据模型变更索引 |

同步义务：出现新依赖 / 新模块 / 新数据结构 / 新 API / 新存储机制 / 新版本控制规则 /
新代码执行机制时，对应文档必须在同一批变更中更新——不允许代码变了文档没变。
新想法一律写入 TECH_DESIGN §10 backlog；里程碑验收标准见 §10。

## 快速参考

| 事项 | 约定 |
|---|---|
| 后端 | Python 3.12 + FastAPI + sqlite3（venv + pip + requirements.txt） |
| 前端 | React + TypeScript + Vite + Zustand + 单一 global.css |
| 端口 | FastAPI :8000，Vite :5173（proxy `/api` → 8000） |
| 测试 | pytest（server/tests），vitest（web）——只测 core 逻辑，不为 UI 写测试 |
| 用户数据 | 一律在 `workspace/`（默认路径，设置可改），永不入库 |
