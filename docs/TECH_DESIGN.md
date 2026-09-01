# Personal Learning OS — 技术设计文档

> 本文档是项目**唯一技术设计来源**（应然：我们打算怎么建）。
> 当前实际状态（实然：现在建成什么样）见 `PROJECT_STATE.md`；任务与路线见 `TASKS.md`；
> 工程宪法见仓库根 `AGENTS.md`。
>
> **⚠️ 开发政策：后端优先（2026-08-28 裁定）** —— 后端 backlog（`TASKS.md` §2）清零之前
> **禁止新增任何前端任务**。详见 `PROJECT_STATE.md` §0 与 `TASKS.md` §0。
>
> 配套文档：依赖 `DEPENDENCIES.md` · 数据模型契约 `DATA_MODEL.md` · 同步 `SYNC.md` ·
> 测试 `TESTING.md` · 评估 `EVALUATION.md` · 架构决策记录 `adr/`（ADR-001~023）
>
> 所有依赖决定附「被否掉的备选及原因」，防止未来开发会话把已否决的方案加回来。

---

## §1 项目定位

> **Open Learning OS** is an open-source, local-first AI learning environment that helps people
> collect knowledge, understand concepts, practice skills, and build long-term memory.
>
> 一个开源、本地优先、AI 驱动的学习型知识操作系统：帮助用户收集知识、理解概念、
> 练习技能，并形成长期记忆。

**核心价值不是记录信息，而是帮助用户学会信息。**
不设"击败 Obsidian/Notion"目标，不做商业 SaaS——避免无限堆功能。

**用户画像**：
| 类别 | 谁 | 诉求 |
|---|---|---|
| P1 第一用户 | 项目所有者 | 高等数学/编程学习、备考、长期知识库 |
| P2 学习者 | 大学生·自学者·转行程序员·考证人群 | 易安装、数据开放、不被锁定 |
| P3 贡献者 | 开源社区 | 文档完善、架构可读、扩展点清晰 |

**三层数据架构（不许混）**：

```
L1 User Content     workspace/vault/*.md            用户写的内容（Markdown 真相）
L2 Knowledge Graph  concepts + links                知识本身及其关系（类型化实体）
L3 Learning Memory  concept_mastery + events +      我和知识的关系（掌握度/错误/
                    mistakes + memories              遗忘/偏好——产品灵魂）
```

**产品形态**：多端 Local-first——Tauri 桌面应用（Windows 先行）+ React Native 移动端（Android 先行），
设备间经局域网文件同步（§2.4 与 ADR-005/006）。浏览器只是开发期前端视图，交付物是桌面与手机 App。

它不是：
- 普通笔记软件（Obsidian/Notion 替代品）
- AI 聊天工具
- 在线 IDE
- 商业 SaaS / 云端绑定服务

差异化壁垒（按优先级）：
1. **Learning Graph**：知识图谱 × 用户学习状态（掌握度/错误/遗忘），AI 因此知道"我学过什么、哪里薄弱"
2. **记忆感知 AI Tutor**：回答前查询图谱与记忆，针对性讲解；回答后自动更新状态
3. **Visual Learning Engine**（M9+）：代码执行 → Trace → 动画

---

## §2 总体架构

### 2.1 形态演进

```
M0–M5：浏览器仅作前端开发视图（App-first 数据规约自第一天生效）
  浏览器 ──HTTP 127.0.0.1:${PORT:-8000}──▶ FastAPI Core ──▶ SQLite(缓存) + workspace/

M6：Tauri 桌面版（首个正式交付形态）
  Tauri WebView(加载同一 React 构建产物)
    └─ sidecar 子进程：PyInstaller 打包的 FastAPI 可执行文件
  对后端代码零改动，只加 src-tauri/ 目录

M7：LAN Sync v1 —— 桌面成为同步宿主（ADR-005）
M8：React Native Android 客户端 —— 混合内核离线可用（ADR-006）
```

选择 Tauri 而非 Electron：包体小、内存占用低；Rust 层仅做窗口与 sidecar 管理，无业务逻辑。
选择 React Native 而非 Flutter：复用 TS 类型/API client/Zustand 心智，避免第二语言栈（ADR-006）。
开发期（M0–M5）不装 Rust/RN 工具链，浏览器直接访问。

### 2.2 模块图

```
web/ (React + TS + Zustand)
 ├─ views: NoteEditor / GraphView / MindMapView(M2b) / TutorPanel / ReviewQueue / MemoryDashboard
 └─ lib: api client, trace VisualEngine (M9, 组件入 ui 库)
        │ fetch /api/*
server/app/ ▼         # Python 包（启动：uvicorn app.main:app）
 ├─ main.py          FastAPI 入口（绑定 127.0.0.1，PORT 环境变量可覆盖默认 8000）+ 静态托管前端构建产物
 ├─ db.py            sqlite3 连接、migration runner
 ├─ routers/         notes concepts graph mastery chat review settings sync(M7) trace(M9)
 └─ core/            纯逻辑层（可单测，不依赖 FastAPI）
     ├─ knowledge.py   笔记索引、双链解析、概念/边 CRUD、递归 CTE 图查询
     ├─ mastery.py     掌握度计算、状态机、SM-2（§5）
     ├─ tutor.py       上下文组装 + 对话编排 + extractor（§6）
     ├─ llm.py         OpenAI-compatible HTTP client（标准库 urllib）
     └─ syncengine.py  manifest 对比、差量清单、冲突检测（M7，ADR-005）
```

> 分层映射（强制）：web/=Frontend · main.py+routers/=Backend · core/=Core Engine · workspace/+SQLite=Data Layer。
> 规范见 `docs/adr/separation.md`；API 自 M0 起一律 `/api/v1/*`。

### 2.3 关键原则

- **Folder 是视图，Graph 才是数据模型**：workspace/vault/ 下任意文件夹组织；概念 `特征值` 可同时关联多个领域，无需复制文件
- **Markdown 文件是正文唯一事实源**：SQLite 存元数据/索引/学习状态；保存时增量重建该笔记的 FTS 索引与双链边；启动时全量扫描校验一致性（hash 不符则重索引）
- **学习事件追加式**：掌握度永远可由事件流重放推导，表里存的是缓存值

### 2.4 多端数据流（App-first 规约）

```
workspace/vault/**(md+旁车json) + attachments/** + metadata/eventlogs/*.jsonl
        ↑↓ 文件 = 同步唯一真相（manifest/sha256 三态对比，HTTP 差量传输）
桌面 FastAPI（同步宿主 + 完整引擎）←LAN→ 手机 RN（expo-sqlite 缓存 + 事件回放内核）
        ↘ AI 降级阶梯：在家走桌面引擎；外出直连云 LLM（ADR-006）
```

铁律：**凡需多端可见的状态必须以文件形式存在**；SQLite 在任何设备上都只是
可重建的本地缓存/索引；db、settings、API key 永不参与同步。
详细设计见 ADR-005（同步模型）与 ADR-006（移动端栈）。

---

## §3 依赖裁决表

### 3.1 运行时依赖（全量清单）

| 端 | 包 | 用途 |
|---|---|---|
| Python | fastapi | Web 框架 |
| Python | uvicorn | ASGI server |
| Web | react / react-dom | UI |
| Web | zustand | 状态管理 |
| Web | katex | LaTeX 渲染 |
| Web | dagre 0.8.5 | Graph 层级布局纯函数（`lib/graph/layout.ts`） |
| Web | d3-force 3.0.0 | Universe 力导向域聚类（ADR-007 唯一批准例外） |
| Web | cobe 0.6.5 | Knowledge Planet WebGL 点阵地球（含性能契约） |
| Web | @xyflow/react | 知识图谱 / 导图画布（仅渲染） |
| Web | @tiptap/react / @tiptap/pm / @tiptap/starter-kit | 富文本编辑器内核 |
| Web | @aarkue/tiptap-math-extension | `$...$` 行内/块级 LaTeX（KaTeX 驱动，社区免费） |
| Web | tiptap-markdown | TipTap JSON ↔ Markdown 双向转换；**禁作存储格式**，真相仍是 vault .md |
| Web | @tiptap/extension-image | 图片节点内嵌渲染（markdown `![](src)` 往返） |
| Python | python-multipart | 附件上传的 form-data 解析（FastAPI UploadFile 必需件） |

开发依赖：vite、typescript、vitest、pytest、@types/*、@vitejs/plugin-react。

> **TipTap 家族实装为 v3 线**（@tiptap/* 3.x）：由已批准依赖 tiptap-markdown 0.9 与
> aarkue 数学扩展 1.4 的 peer 契约决定（2026-08-26）；v2 线已停止演进，钉旧版违背维护性要求。

> 本表仅为摘要。完整登记（License/维护状态/Dependency Review 模板）见 `DEPENDENCIES.md`；
> 新增任何依赖前必须通过六连问审查（`AGENTS.md` §2）。
>
> **依赖纪律（后端优先阶段加强）**：新增前端依赖在后端 backlog 清零前一律不予受理，
> 除非该依赖是后端能力的必要前提。

### 3.2 已否决备选（禁止回潮）

| 备选 | 否决理由 |
|---|---|
| Electron | 包体/内存大；业务全在 Python 后端，Electron 无额外价值。Tauri Rust 层只是薄壳 |
| SQLAlchemy / SQLModel | ~12 张表的规模，ORM 是纯抽象税。stdlib sqlite3 参数化查询足够 |
| LangChain / LlamaIndex | RAG/Tutor 管线手写 <200 行且完全可控；框架引入黑盒抽象与版本地狱 |
| openai SDK | 只用 `/chat/completions` 一个端点，SSE 流式解析 ~40 行，标准库可胜任 |
| Tailwind + shadcn/ui | 与最小依赖纪律冲突（拉入 Radix 全家桶）；单一 global.css 足够个人应用 |
| TipTap 官方 mathematics 扩展 | 付费 Pro 包；@aarkue/tiptap-math-extension 免费 且满足 `$` 分隔符需求 |
| sqlite-vec / LanceDB / Qdrant / BGE embedding | MVP 概念匹配交给 LLM（标题列表进 prompt，几百概念规模完全够用）。触发重评条件：概念数 >2000 或匹配质量明显不足 → 先加云端 embedding API + sqlite-vec |
| D3.js / PixiJS / Three.js | 图谱已有 React Flow；数组/栈帧动画为 n≤100 规模，手写 SVG + CSS transition 每模板 <100 行 |
| Manim | 重依赖链(Cairo/Pango/FFmpeg) + 离线视频渲染，违背"交互式可视化"目标。数学动画改为参数化 SVG + 播放头 |
| Monaco / Jupyter / Docker 沙箱 | Phase 5（IDE 阶段）才引入，当前阶段不做代码 IDE |
| Elasticsearch / Meilisearch | FTS5 内置于 SQLite，零运维 |
| Framer Motion | 图谱动效（呼吸/亮度过渡）用 CSS transition + rAF 即可覆盖；引入动画库属依赖膨胀（ADR-007 关联裁决） |

---

## §4 数据模型（SQLite）

> **⚠️ 本节 DDL 已按 migration 001~007 的实际产物校正（2026-08-28）。**
> 旧版本此处的 DDL 停更于 M3，与 migration 004 重建后的 schema 不符，照抄会直接报错。
> 字段语义、冻结约束与 Forbidden Changes 见 **`DATA_MODEL.md`**。

### 4.1 DDL（当前实际 schema）

```sql
-- 配置（LLM base_url/api_key/model；api_key 读取时脱敏为 ******）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL              -- JSON 字符串或纯文本
);

-- 概念节点：Knowledge Graph 第一等公民
CREATE TABLE concepts (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL UNIQUE,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  summary      TEXT NOT NULL DEFAULT '',
  domain       TEXT NOT NULL DEFAULT '',      -- 自由文本标签：数学/编程/...
  origin       TEXT NOT NULL DEFAULT 'manual', -- manual|markdown|ai_suggested（来源）
  status       TEXT NOT NULL DEFAULT 'active', -- stub生命周期: unconfirmed|confirmed|active|archived（migration 003）
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 统一关系表（ADR-008）：任意类型实体间的有向关系
-- entity_type ∈ {note, concept}，预留 code_symbol|formula|person|resource
CREATE TABLE links (
  id          INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id   INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  relation    TEXT NOT NULL,      -- wikilink|mentions|requires|related|contains|contrasts_with|derived_from|implements
  origin      TEXT NOT NULL DEFAULT 'manual',  -- manual|markdown|ai_suggested|accepted（历史注释含 accepted，实际枚举校对归 origin 统一 micro-task）
  weight      REAL NOT NULL DEFAULT 1.0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, target_type, target_id, relation)
);
CREATE INDEX idx_links_source ON links(source_type, source_id);
CREATE INDEX idx_links_target ON links(target_type, target_id);

-- 学习状态：每概念一行，首次触达时惰性创建
-- ⚠️ migration 004 已重建此表：四维收敛为 JSON 列，不再是四个独立列
CREATE TABLE concept_mastery (
    concept_id    INTEGER PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
    dimensions    TEXT NOT NULL DEFAULT '{"knowledge":0,"practice":0,"recall":0,"transfer":0}',
    effective     REAL NOT NULL DEFAULT 0,     -- 四维加权派生值
    next_review   TEXT,
    ease_factor   REAL NOT NULL DEFAULT 2.5,   -- SM-2
    interval      INTEGER NOT NULL DEFAULT 0,
    review_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 学习事件：追加式日志，掌握度的唯一驱动源（永不修改已写入的行）
CREATE TABLE learning_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id    INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    event_type    TEXT NOT NULL,   -- answer_correct|answer_wrong|explain|visualize|review|code_run
    dimension     TEXT,            -- knowledge|practice|recall|transfer
    weight        REAL NOT NULL DEFAULT 1.0,
    source        TEXT NOT NULL DEFAULT 'manual',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    detail        TEXT,                     -- migration 005
    event_id      TEXT                      -- migration 007+009，跨端幂等标识（UUID v4）
);
CREATE UNIQUE INDEX idx_events_id ON learning_events(event_id);

-- 复习队列：SM-2 调度结果（可由 mastery + SM-2 重建）
CREATE TABLE review_queue (
    concept_id    INTEGER PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
    due_at        TEXT NOT NULL,
    priority      REAL NOT NULL DEFAULT 0.5,   -- 0.5 默认 / 0.8 错答
    status        TEXT NOT NULL DEFAULT 'pending',
    last_result   TEXT,                        -- correct|wrong
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 错误记录
CREATE TABLE mistakes (
  id          INTEGER PRIMARY KEY,
  concept_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  resolved    INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用户记忆（Mem0 风格）：事实/偏好/目标/错误模式
CREATE TABLE memories (
  id           INTEGER PRIMARY KEY,
  kind         TEXT NOT NULL,      -- fact|preference|goal|mistake_pattern
  content      TEXT NOT NULL,
  importance   REAL NOT NULL DEFAULT 0.5,
  confidence   REAL NOT NULL DEFAULT 0.5,
  concepts_json TEXT NOT NULL DEFAULT '[]',   -- ["特征值", ...]
  last_used_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 笔记元数据（正文在 workspace/vault/*.md）
CREATE TABLE notes (
  id           INTEGER PRIMARY KEY,
  path         TEXT NOT NULL UNIQUE,   -- vault 相对路径（POSIX 风格分隔符）
  title        TEXT NOT NULL,          -- 文件名去扩展名
  tags_json    TEXT NOT NULL DEFAULT '[]',
  content_hash TEXT NOT NULL,          -- sha256(body)，增量索引判断
  mtime        REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- （笔记↔概念、笔记↔笔记 关系列已并入上方统一 links 表 —— ADR-008）

-- 对话
CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE messages (
  id              INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,             -- user|assistant
  content         TEXT NOT NULL,
  context_json    TEXT NOT NULL DEFAULT '{}', -- 本轮注入上下文快照（上下文透视功能）
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 全文搜索（独立 FTS5 表，随笔记保存增量维护）
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, note_id UNINDEXED
);

-- 思维导图（migration 006，ADR-019）
-- ⚠️ 三表只是编辑器工作区，结构真相仍是旁车 *.mindmap.json（ADR-002/021）
CREATE TABLE mind_maps (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE mind_map_nodes (
  id         INTEGER PRIMARY KEY,
  map_id     INTEGER NOT NULL REFERENCES mind_maps(id) ON DELETE CASCADE,
  concept_id INTEGER REFERENCES concepts(id) ON DELETE SET NULL,
  label      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE mind_map_edges (
  id         INTEGER PRIMARY KEY,
  map_id     INTEGER NOT NULL REFERENCES mind_maps(id) ON DELETE CASCADE,
  source     INTEGER NOT NULL REFERENCES mind_map_nodes(id) ON DELETE CASCADE,
  target     INTEGER NOT NULL REFERENCES mind_map_nodes(id) ON DELETE CASCADE,
  relation   TEXT NOT NULL DEFAULT 'related',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Migration 历史**：001_init → 002_links_unify → 003_concept_status → 004_learning（重建
concept_mastery / learning_events / review_queue）→ 005_events_quality（`detail` 列）→
006_mindmap（三表）→ 007_event_uuid（`event_id` 列 + UNIQUE 索引）→ 008_study_sessions → 009_event_id_rename（`event_uuid` → `event_id` 术语统一）。

**新表规矩（自下一个 migration 生效）**：任何 migration 新增表，必须在同一提交中登记
生产者位置（模块 / 函数 / 调用点）；无生产者的表不得合入。

**延后建表（写入路线图，勿提前创建）**：`blocks`（块级引用）·
`embeddings`（RAG 立项且概念数 >2000）· `concept_demos`（M9 后评估）。

### 4.2 数据目录约定（用户数据与应用源码分离）

```
learning-os/                 # 应用源码，Git 管理
├── server/  web/  docs/
└── workspace/               # 用户私有数据根——整体 .gitignore，永不入库
    ├── vault/               # Markdown 正文 + *.mindmap.json 旁车
    │   ├── 数学/特征值.md
    │   ├── 数学/特征值.mindmap.json
    │   └── 编程/python/梯度下降.md
    ├── attachments/         # 图片 / PDF（同步）
    ├── metadata/            # 同步与设备数据（ADR-005）
    │   ├── eventlogs/       # learning_events 追加日志 <yyyy-mm>.jsonl —— 跨端的学习状态真相
    │   └── devices.json     # 设备身份（纯 UUID4，由 core/sync/device.py 读写）
    └── db/learning-os.db    # SQLite 本地缓存/索引 —— 永不同步
```

> **目录校正**：旧版本此处列出的 `metadata/manifest.json` **不存在**——
> manifest 是每次扫描时内存计算的对象，不落盘缓存。

- 工作区路径默认 `<repo>/workspace`，可改为任意本地目录（桌面版迁移至 Tauri userData）；
  用户可用任意编辑器直接改 vault 内文件
- 标题 = 文件名去 `.md`；`[[标题]]` 按 title 全库唯一解析（重名时报错提示改名）
- YAML front-matter 支持 `tags:`，索引进 notes.tags_json
- 附件统一放 `workspace/attachments/`，笔记内相对路径引用
- **附件路径策略（ADR-008 冻结）**：媒体只能经上传接口进入 attachments/；
  Markdown 只允许相对 URL `/api/v1/attachments/<name>`；
  禁止绝对盘符路径、`file://`、外部临时 URL 作为长期引用——写入时由 Core 校验拒绝
- 学习状态跨端：写入 learning_events 表的同一事务内追加一行 JSON 到
  `metadata/eventlogs/<yyyy-mm>.jsonl`（含 device_id 与全局唯一 event id）；
  同步后各端按序回放重建 concept_mastery，回放按 event id 幂等去重
- memories / conversations 属单设备内容，v1 不参与同步（对话导出 json 在 backlog）

---

## §5 Learning Graph 引擎（core/mastery.py）

> **⚠️ 本节已按实际实现重写（2026-08-28）。** 旧版本的四维命名、事件权重、衰减公式与状态机
> 均为 M3 前的设计意图，**与代码不符**（原审核 §2.2 判定）。以下以代码为准。
> 冻结约束与 Forbidden Changes 见 `DATA_MODEL.md`。

### 5.1 四维掌握度（实际实现）

维度（`concept_mastery.dimensions` JSON 列），取值 [0,1]：

| 维度 | 权重 | 含义 |
|---|---|---|
| `knowledge` | 0.35 | 知识理解（概念认知、定义记忆） |
| `practice` | 0.30 | 应用能力（解题、代码实现） |
| `recall` | 0.20 | 主动回忆（不提示下能否想起） |
| `transfer` | 0.15 | 迁移能力（跨领域应用、类比） |

```
effective = 0.35×knowledge + 0.30×practice + 0.20×recall + 0.15×transfer
```

### 5.2 事件 → 维度增量映射（实际实现）

`update_mastery(conn, concept_id, event_type, dimension=None, weight=1.0, source="manual", detail=None)`：

| event_type | 目标维度 | 增量 |
|---|---|---|
| `answer_correct` | `dimension` 或 knowledge | +0.15 × weight |
| `answer_wrong` | `dimension` 或 knowledge | −0.10 × weight（不低于 0） |
| `explain` | knowledge | +0.08 × weight |
| `visualize` | practice | +0.05 × weight |
| `review` | recall | +0.10 × weight |
| `code_run` | practice | +0.08 × weight |

约束：增量后 clamp 到 [0.0, 1.0]。

**与原设计的差异（有意偏离，非缺陷）**：

- 原设计的 `study` / `quiz_correct` / `quiz_wrong` 事件类型**未实现**，实装为
  `answer_correct` / `answer_wrong`
- 原设计的「正事件增益随当前值衰减 `delta = w × (1 − current)`」**未采用**，实装为固定增量
- 原设计的 `understanding`/`computation`/`proof`/`application` 四维命名**已被 migration 004 替换**
- `answer_wrong` 时同步落 `mistakes`（P8-003E 补齐）

`source` 枚举：manual · review · tutor · code_trace · exam · import · ai_generated

### 5.3 时间衰减（P8-003B，实际实现）

```
decay_effective(base, days, tau=14) = base × exp(−days / tau)     # days ≤ 0 或 base ≤ 0 时返回 base
effective_now = decay_effective(concept_mastery.effective, days_since_last_seen)
last_seen = MAX(learning_events.created_at)                        # UTC-aware 解析
```

`tau = 14` 天（默认常量 `DEFAULT_TAU`）。**与原设计的差异**：原设计 `τ = 30 × ease / 2.5`，
实装为固定 14 天，不随 ease 变化。

`effective_now` 为**只读派生值，不落库**，用于：

- `GET /review/today` 排序：错答优先 → `effective_now` 低优先 → 到期早优先
- `build_tutor_context()` 让 AI 看到衰减后的真实水平
- API 输出 `effective_now` 字段

**状态机**：原设计的 UNKNOWN → INTRODUCED → UNDERSTOOD → PRACTICED → MASTERED / FORGOTTEN
**未实现**。当前以 `effective_now` 连续值表达状态（`weak` 判定 = effective_now < 0.3），
无离散状态列。

### 5.4 SM-2 调度（core/review_scheduler.py，独立模块）

```
输入：quality(0-5), ease_factor, interval, review_count
输出：{ease_factor, interval, next_review, review_count}

quality < 3：interval 重置为 1 天
quality ≥ 3：interval = prev_interval × ease_factor
```

可注入 `now` 参数保证测试确定性。**可替换声明**：SM-2 参数不是产品常量，
替换为 FSRS/Leitner 时只改 `review_scheduler.py`，不改 mastery 模型；替换需开 ADR
（评估项见 `TASKS.md` O13）。

### 5.5 事件日志导出（多端同步源，ADR-005 / ADR-020）

- `update_mastery()` 在 `learning_events` INSERT 成功后，追加一行 JSON 到
  `metadata/eventlogs/<yyyy-mm>.jsonl`（`f.write` + `flush` + `os.fsync`）
- JSONL 字段：`event_id` · `concept_id` · `event_type` · `dimension` ·
  `weight` · `source` · `detail` · `device_id` · `created_at`
- `device_id` 由 `core/sync/device.py` 的 `load_or_create_device()` 提供（纯 UUID4，
  存 `metadata/devices.json`），**eventlog 与 M7 同步共用同一身份**
- 各端同步后按序回放重建 `concept_mastery`；回放以 `event_id` 幂等去重

> **⚠️ 「同事务」措辞修正**：SQLite 写入与文件追加之间**没有原子性保证**。
> 实现上是「先写 SQLite，再追加文件；文件写失败时 `except OSError: pass`，不阻断 SQLite 写入」。
> 崩溃窗口内可能出现「表有而文件无」。修正措辞与改为可观测降级见 `TASKS.md` B22 / B23。

**纯度要求**：mastery / SM-2 计算必须保持纯函数性（禁止读墙钟做语义判断，
时间必须显式传参）——这是 M8 TS 移植版一致性的前提。

---

## §6 AI Tutor（core/tutor.py + core/llm.py）

> **实现状态（2026-08-29 更新）** 本节大部分是**设计意图**，实际落地约 1/2：
>
> | 节 | 内容 | 状态 |
> |---|---|---|
> | 6.1 | LLM Adapter（OpenAI-compatible HTTP） | ✅ B1a 已实现（openai_compat + settings factory，非流式）；SSE 流式未实现 → B2 |
> | 6.2 | 记忆感知上下文管线 | ⚠️ 部分实现。①②④ 未做，③ 前置链未做；白名单 6 类已冻结 |
> | 6.2 ⑥ | 流式回答 | ❌ 未实现 → B2 |
| 6.3 | Extractor | ✅ B3 v1 已实现（范围收窄：memories+概念桩；events 经 update_mastery；C1-C5 修正全部吸收） |
> | 6.3 | Extractor（回合后二次调用） | ❌ 未实现 → B3 |
>
> 已完成：`build_tutor_context()` 白名单 · `build_prompt()`（M4-B 冻结）·
> `LLMProvider` Protocol + `MockProvider` · `TutorService` · 显式笔记引用（P8-003D 甲路线）。

### 6.1 LLM Adapter

- 唯一协议：OpenAI-compatible `POST {base_url}/v1/chat/completions`，SSE 流式
- 配置全部来自 settings 表：`llm.base_url` / `llm.api_key` / `llm.model` / `llm.fast_model`（extractor/匹配用便宜模型）
- 具体接哪家由用户在设置页填（DeepSeek/Qwen/OpenAI/…均可）；Ollama = base_url 指 `http://127.0.0.1:11434/v1`，零代码差异
- 实现用 Python 标准库 `urllib.request` 手写 SSE 解析（~40 行），不用 SDK（§3.2）
- **B1a 已实现（2026-08-29）**：`core/ai/providers/openai_compat.py`（非流式 complete）
  + `core/ai/config.py` settings 驱动 factory（llm.provider/base_url/api_key/model）。
  B1b 真实凭据端到端冒烟押后（需 API key）

### 6.2 记忆感知上下文管线（每轮用户消息触发）

```
① 概念匹配：
   a. FTS/子串命中 concepts.title+aliases → 候选集
   b. 若为空 → fast_model 调用：输入=用户问题+全量概念标题列表，输出相关 ids（JSON）
② 取候选概念的 mastery + 未解决 mistakes(≤3条) + 最近 events(≤5条)
③ 前置链：递归 CTE 沿 requires 上溯 2 层，汇总前置概念 mastery 概要
④ memories：importance × 新近度 top 5
⑤ 组装 system prompt（预算 ~1500 token）：
   [Teacher 人设 + 教学规则(苏格拉底式/从已知到未知/直击弱点)]
   + 用户状态块：「已牢固掌握X/Y；'特征向量'证明维度仅34%；
                 曾在对角化中混淆特征值/特征向量——从直觉切入，勿重复定义」
⑥ 流式回答；完整 context_json 存入 messages（上下文透视 UI 展示"为什么这样答"）
⑦ 回合结束 → extractor 异步执行（§6.3）
```

### 6.3 Extractor（回合后第二次 LLM 调用，fast_model，JSON 输出）

```json
{
  "learning_events": [{"concept":"特征值","type":"explain","dimension":"understanding"}],
  "mistakes":        ["再次混淆特征值与特征向量的方向含义"],
  "memories":        [{"kind":"preference","content":"偏好先直觉类比再给证明","importance":0.6}],
  "note_links":      [{"note_title":"线性代数笔记","concepts":["矩阵","特征值"]}],
  "concept_suggestions": [{
      "title":"对角化","summary":"将矩阵化为对角形的变换",
      "connects":[{"from":"特征值","relation":"requires"}]}]
}
```

处理规则：
- learning_events 经 `mastery.update_mastery(source='ai_extractor')` 落库（绝不裸 INSERT）
- memories 直接落库（upsert_memory + 前缀去重）
- concept_suggestions 进「待确认」队列（origin='ai_suggested' + status='unconfirmed'），Accept 时只改 status（origin 永不变，C4）；Ignore 删除 unconfirmed 桩
- extractor 失败静默跳过，不影响主对话（单点故障禁止）

---

## §7 Mind Map 系统（M2b 编辑器 · M4 AI 生成）

### 7.1 定位与技术路线

| 路线 | 代表 | 借鉴 | 不采纳部分 |
|---|---|---|---|
| 专用格式+Canvas | XMind / MindNode | 拖拽编辑体验 | 私有文件格式，AI 与搜索不可读 |
| Markdown 驱动 | Markmap / Obsidian 插件 | 结构与知识库天然连通 | 只读渲染；markmap 内核依赖 D3（禁令） |
| 结构化知识地图 | Freeplane | 节点属性/过滤（backlog） | XML 格式笨重 |
| 无限画布 | Obsidian Canvas / Miro | 空间自由度 | 层级语义弱 |

融合定位：**XMind 的编辑体验 × Markmap 的知识连通 × Freeplane 的属性能力（后期）**。
实现复用已装 @xyflow/react 自研编辑层，**零新增依赖**（ADR-002）。

### 7.2 存储模型

> **实现状态（2026-08-28）**：migration 006 增加了 `mind_maps` / `mind_map_nodes` /
> `mind_map_edges` 三表作为**编辑器工作区**；旁车 `*.mindmap.json` 仍是**结构真相**。
> 两方案并存且分工明确，不是漂移——三表支撑 API 查询与 Concept Binding，
> 旁车承载跨端同步（ADR-020 Layer 1）与结构恢复。
> 大纲段反向解析（`*.mindmap.json` → Markdown 大纲）挂起 → `TASKS.md` B18。

三角色分工：

| 角色 | 载体 | 编辑方式 |
|---|---|---|
| **结构真相** | 旁车文件 `数学/特征值.mindmap.json` | 导图模式 |
| **语义真相** | `特征值.md` 正文（定义/解释/公式） | markdown 模式 |
| 派生视图 | md 内「结构大纲」段（头部 `<!-- generated:mindmap -->` 标记） | **禁手改**，保存导图时自动重写 |

schema v1：

```json
{"v":1,
 "root":{"id":"n1","text":"特征值","collapsed":false,"children":[
   {"id":"n2","text":"[[线性变换]]","collapsed":false,"children":[...]}]},
 "layout":{"n1":{"x":0,"y":0},"n2":{"x":220,"y":-80}}}
```

- 大纲段为嵌套列表 + `[[链接]]` 原样保留；PUT 时服务端重写该段并重索引
  → 导图内容免费进入 FTS5 搜索、反链扫描、note_concepts 图谱关联管线
- 恢复策略：json 丢失 → 由大纲段反向重建结构（布局自动重排）；布局损坏 → 仅丢坐标

### 7.3 编辑器交互（web MindMapView，React Flow）

- Tab 加子级 · Enter 加同级 · 双击改名 · Del 删除子树（确认）·
  拖至另一节点=改父级（环检测：目标不得是自身祖先）· 折叠展开（collapsed 入 json）
- 布局：layout 缺失或点「整理」→ 手写 tidy-tree 自动重排
  （LR 方向：叶子堆叠定 y、深度×间距定 x，约 100 行）

### 7.4 图谱同步规则

保存导图（PUT /notes/{id}/mindmap）时：
1. 重写大纲段并重索引（FTS 与 links 随索引管线自然更新）
2. 大纲中 `[[链接]]` 按 ADR-008 解析规则建立 note→note/concept 关系
3. 节点「提升为概念」→ 建 concepts + links(relation='contains', origin='manual')

### 7.5 AI 生成管线（M4）

`POST /api/ai/mindmap {note_id}` → fast_model 输出嵌套 JSON
（prompt 注入笔记标题/摘要/已有概念列表防重复建点）→ schema 校验 →
**全部节点立即建 Concept(origin='ai_suggested') + contains 边(origin='ai_suggested')**，
图谱中淡色显示、可过滤、可删 → 写旁车 json + 重写大纲段。
失败静默跳过，不影响笔记。

### 7.6 V1 边界

不做：协作、自由画布布局持久化（仅 tidy-tree + 手动坐标）、
节点属性面板（Freeplane 式，backlog）、markdown 模式反向编辑大纲。

---

## §8 可视化系统

### 8.1 Knowledge Universe——学习反馈的可视化奖励层（M3b 实施）

定位：**不是生产工具，是学习反馈的奖励层**。用户打开软件就能看到自己的宇宙在生长：
新星出现（新概念）、星球点亮（复习成功）、光色暗淡（遗忘预警）。
数据全部来自既有表与推导——**零新表**；数据库驱动宇宙，宇宙永不反向影响 schema。

```
Knowledge Universe（视觉奖励层，本节）
      ↑
Learning Graph（concepts + links，ADR-008）
      ↑
Markdown Vault（事实源）
```

#### 三模式

| 模式 | 内容 | 数据源 |
|---|---|---|
| Galaxy 全局 | 全概念宇宙总览 | concepts/links + mastery |
| Explorer 技能树 | 双击概念沿 requires 逐层展开学习路径 | 递归 CTE（§2.2，已有） |
| Memory Map 记忆地图 | 快遗忘节点自动变暗，复习后重新点亮 | effective（§5.2）+ next_review_at |

#### 视觉编码（四维）

| 维度 | 编码 | 来源 |
|---|---|---|
| 大小 | 连接度推导（度数 + 复习优先级），**不加存储列** | links 聚合查询 |
| 亮度 | 掌握度有效值 effective ∈ [0,1] | concept_mastery |
| 颜色 | **掌握三色**：绿=掌握(effective≥0.7)、黄=学习中(0.4~0.7)、红=薄弱(<0.4)。**实然注记**：原设计映射离散 state（PRACTICED 等），但状态机未实现、无离散状态列——实然依据只有 effective 数值段 | effective（唯一可用依据） |
| 呼吸节奏 | 学习活跃度（近 7 天事件频率） | learning_events |

> 领域(domain)不再用颜色区分，改由力导向聚簇自然分组表达。

#### 布局与过滤

- 力导向：`d3-force` 单模块（唯一 D3 例外，ADR-007；**仅负责物理计算，不存任何数据**，
  M3b 时安装）；领域聚簇以 domain 同类吸引权重实现
- **动态过滤铁律**：默认只渲染当前焦点概念的 2 层邻居，禁止无过滤全量渲染
- 位置缓存：`metadata/universe-layout.json`——设备本地、不同步、可随时重建；
  知识本身永不依赖该文件
- 模块约定（M3b 实装时建立目录）：`web/src/features/universe/{UniverseView,
  NodeRenderer,LayoutEngine,AnimationEngine,themes}`

#### 动效治理

每个动画必须回答：**它帮助了哪一步学习？**
好动效 = 显示薄弱 · 显示成长 · 引导复习；禁止炫光/粒子/纯装饰。

验收项：新节点接入连线动画（成长可见）· 掌握度变化亮度过渡 ·
FORGOTTEN 变暗/复习重新点亮 · 技能树逐层展开。
stretch：学习扩散波纹（需先论证学习收益）。
AI Explain 概念链路径点亮 → 挂 M4 验收。
Level 3 探索模式（星云/星域叙事）⏭ backlog；WebGL/Three.js ⏭ M9 后评估且**永不进入核心依赖**；
Debug Mode（代码知识图）⏭ Phase 5。

### 8.2 Learning Trace Engine（算法可视化引擎，M9 实施）

> **⚠️ 契约版本化、安全模型、模板路由、范围边界、与 ADR-023 的裁决，
> 一律以 `docs/adr/ADR-025-visual-engine-v1.md` 为唯一来源。本节与之冲突时以 ADR 为准。**

**定位（ADR-025 v2）**：**受控的 Python 教学示例执行可视化器，不是通用代码可视化器。**
`sys.settrace` 对受控教学示例足够好，但没有必要用它解决通用算法可视化问题。

**V1 范围锁死**：

- **允许**：Concept 页预置的 6 个教学示例 · 单文件 · 基础类型 · 清单中声明的 `example_id` · 三个 Renderer
- **禁止**：用户任意代码 · 笔记 code block 自动执行 · 力扣 / 链表 / 树 / DP / 图 · 通用 AST→可视化
  （后三类归 **M9.5 ALGOGEN / VTA**）
- **入口只有一个**：`POST /api/v1/trace/run`，**只接受 `example_id`，不接受 code 字符串**；
  `code` 是 **V1 禁止字段**（不是「暂不支持」），请求体含 `code` → 422

核心链路：

```text
Concept 页预置示例 → example_id → Trusted Examples → POST /trace/run
  → 独立 Python 子进程（sys.settrace）→ safe_snapshot + limits → TraceRun
  → VisualEngine（IDE 步进）→ FrameStackView / ArrayView / GeneralView
  → Learning Event（visualize）
```

**数据职责不混淆**：`Markdown` = 知识 + 可视化声明；`TraceRun` = **运行时派生数据，V1 不持久化**；
`Learning Event` = 用户是否使用过动画。**Markdown 保存声明，不保存 Trace 本体。**

### 8.3 采集器（`server/app/core/tracer/` 包，纯标准库）

- **结构**：`core/tracer/{__init__,runner,snapshot,limits}.py` + `examples/`
  （快照逻辑独立，Python 版本升级时不污染 tracer 主逻辑）
- **机制**：独立 OS 子进程内 `sys.settrace()`，监听 `call/line/return` + 每步局部变量快照
- **不做对象图**：无 `heap_id`、无 `$ref` 去重，值内联在 `frames[].locals`（见 §8.4）
- **五重限制**（不能只依赖 timeout）：`MAX_RUNTIME` 10s · `MAX_TRACE_EVENTS` 5000 ·
  `MAX_STDOUT_BYTES` 64KB · `MAX_STDERR_BYTES` 64KB · `MAX_RECURSION_DEPTH` 100
- **第六道护栏（API 层，ADR-025 §5.7）**：`MAX_CONCURRENT_TRACES = 1`——
  同步 handler 只保证不阻塞事件循环，并发多个 10s 级 trace 仍会占满线程池；
  已有 trace 在跑时再请求 → **429 `trace_busy`**，不排队
- **cleanup 生命周期**：trace 结束（含 timeout kill）后必须在 `finally` 中
  cancel watchdog Timer → 关闭 tempfile 句柄 → `process.wait()` 回收 → 删 tempfile（kill ≠ cleanup complete）
- **`example_id` 是清单枚举键，不是文件路径**——worker 源码只经 manifest 的 `path` 字段解析，
  绝不 `Path("examples") / example_id` 拼接（防路径穿透，ADR-025 §3.3）
- **输出**：stdout / stderr **一律走 tempfile**，禁止 `PIPE`。
  理由不是「PIPE 死锁」（`subprocess.run(capture_output=True)` 并不死锁），
  而是**内存无界**——无限 `print` 会把父进程读爆
- **拦截机制（ADR-025 §5.4，勿误读）**：`sys.settrace` **只采集、不拦截**——`line` 事件在该行执行前回调，
  无法否决行内副作用。IO 禁止由两层实现：① 子进程执行用户代码前收敛 `builtins`
  （移除 `open`/`exec`/`eval`/`compile`/`input`/`breakpoint`）
  ② 替换 `builtins.__import__` 为白名单版本（`os`/`sys`/`subprocess`/`socket` 等因此不可达）
- ⚠️ **事件循环红线**：`POST /trace/run` 的 handler **必须是同步 `def`**——
  `async def` 中阻塞等待会冻结整个 FastAPI 事件循环最长 10 秒。
  非协程只是**必要条件**，并发保护靠上一条 429 护栏（守护测试 12 + 16 缺一不可）
- 信任级说明：V1 执行随代码发布的受信任示例，等同用户手动跑脚本；Docker 沙箱留待 Phase 5

### 8.4 TraceRun v1 契约（前后端唯一接口，版本化）

> **冻结形状以 `ADR-025` §4 为唯一来源**（顶层六字段 · `TraceEvent` · `TraceValue` · `status` 五值）。
> 下方为示意，缺字段以 ADR 为准。落地位置：`shared/types/trace.ts`
> + 契约测试 `server/tests/unit/test_trace_contract.py`。

```json
{"version":"1","language":"python",
 "events":[{"step":12,"line":14,
   "frames":[{"func":"quick_sort","line":14,"locals":{"arr":[3,7,2,8,1],"lo":0}}],
   "stdout":"","metadata":{}}],
 "status":"completed","error":null,
 "metadata":{"example_id":"quicksort-basic","template":"ArrayView"}}
```

- **API 返回值是 `TraceRun`，不是 `TraceEvent[]`**——`status` / 错误 / 版本 /
  运行元数据不得塞进 `TraceEvent`
- **`status`**：`completed` · `timeout` · `error` · `trace_limit` · `output_limit`；
  四类非 `completed` 一律 **HTTP 200**，已录得的部分轨迹仍可回放。
  真 4xx/5xx 只用于调用方错误（未知 `example_id` → 404 · `mode:"vta"` → 400）
- **`settrace` 是实现，不是协议**：`TraceRun` 中不得出现任何 settrace 专有概念
  （无 `opcode`、无 `f_lineno`、无 `frame.f_*` 语义）

### 8.5 渲染模板（纯前端插件，新模板不动管线）

| 模板 | 场景 | 实现 |
|---|---|---|
| `FrameStackView` | factorial / 递归 / 调用栈 | SVG 堆叠帧 + return 值回流 |
| `ArrayView` | quicksort / 二分 / 排序 | SVG 条形 + 当前位置高亮 + CSS transition |
| `GeneralView` | 其他简单算法（**V1 fallback**） | SVG frames + locals + 简单容器 |

> 原 `FuncPlotView` **已取消**，改为 `GeneralView`；函数图像待有真实需求时再立。

目录 `web/src/components/ui/visual-engine/`（**入 ui 组件库**，经 `ui/index.ts` 导出）：
`VisualEngine` 组合壳 · `CodePane`（IDE 风格代码 pane）· `DebugToolbar`（步进控制）· 三个 Renderer。
**模板 View 不处理步进控制**——M8 Mobile 改触摸交互时只动 `DebugToolbar` / `stepping.ts`。
> 2026-09-01 所有者裁定：否决播放器（StepPlayer/TraceTimeline），改 IDE 调试器语义，详见 ADR-025 §3.2。

**模板路由（ADR-025 §3.4）**：由 `core/tracer/examples/manifest.py` 的 `template` 字段决定，
前端只读该字段路由，**不做语义分析**。V1 **不做**自动推断（不做 swap 检测 / heap diff），延后 M9.5。

**入口**：Concept 详情页「▶ Visualize」，按 `concepts.title` 匹配示例清单。
无匹配示例的 Concept **不显示**按钮（不是灰置）。

> ⚠️ 笔记内 code block「Run & Visualize」入口**已取消**——V1 不执行用户代码。
> 且 `examples/` 属**应用资产**，绝不放 `workspace/vault/`（用户数据区，会参与同步且可被改写）。

**`visualize` 事件：点击即记录**，不等待播放完成。V1 衡量的是「用户是否主动使用」，
不是「是否完整观看」；`visualize_started/25/50/completed` 细分留待 M9.5。

---

## §9 API 设计（REST，前缀 /api/v1——版本化，破坏性变更升 /v2）

> **⚠️ 本表已按实际 14 APIRouter / 49 端点重写（2026-08-29；含 T-EXPORT）。**
> 旧版本混入了 12 个从未实现的端点，同时遗漏了 30 个已实现端点。
> 响应形状的唯一契约定义于 `shared/types/*.ts`，由 pytest 契约测试锁定。

**图例**：✅ 已实现 · ❌ 设计意图未实现

### 9.1 已实现（49 端点 / 14 Router）

| 类别 | 方法&路径 | 说明 |
|---|---|---|
| **Notes** ✅ | `GET/POST /notes` · `GET/PATCH/DELETE /notes/{id}` | 笔记 CRUD（写 .md 文件 + 重索引）；POST @201 |
| **Notes** ✅ | `GET /notes/{id}/backlinks` | 反链（links router） |
| **Concepts** ✅ | `GET /concepts`（domain/origin/status 过滤）· `GET /concepts/domains` · `GET /concepts/{id}`（含 mastery）· `POST /concepts` @201 · `PATCH /concepts/{id}` | 概念 CRUD。**无 DELETE**（ADR-023 边界） |
| **Graph** ✅ | `GET /graph`（root_type / root_id / depth 1~3） | 图谱读模型，递归 CTE，只读 |
| **Universe** ✅ | `GET /universe` | Universe 可视化投影（nodes + edges） |
| **Mastery** ✅ | `GET /mastery` · `GET /mastery/{id}` · `POST /events` @201 · `GET /mastery/weak/list` | 四维掌握度 · 学习事件 · 薄弱概念（limit 10） |
| **Review** ✅ | `GET /review/today` · `POST /review/{id}/answer` · `GET /review/history` | SM-2 队列 · 答题（更新 mastery + 排期 + 队列）· 历史 |
| **MindMap** ✅ | `GET/POST/DELETE /mindmaps` · `/nodes` · `/nodes/{id}/bind` · `/edges` · `/concepts/search` · `/export` · `/import` | 14 端点。ADR-021 交换格式 v1 |
| **Tutor** ✅ | `GET /tutor/context/{concept_id}` · `POST /tutor/context` · `POST /tutor/test` | 结构化上下文 · 显式笔记引用（P8-003D）· 全链路 Smoke |
| **Sync** ✅ | `GET /sync/status` · `POST /sync/resolve` · `GET /sync/files/{path}` · `POST /sync/receive` | 冲突派生 · 裁决（keep_local/keep_remote）· 文件代理 · 接收（强制经 SyncApply） |
| **Search** ✅ | `GET /search` | FTS5 全文检索 |
| **Suggest** ✅ | `GET /knowledge/suggest` | 上下文感知建议（FTS + concept LIKE + 图谱邻居） |
| **Settings** ✅ | `GET /settings` · `PUT /settings` | 配置读写（api_key 脱敏为 `******`） |
| **Export** ✅ | `GET /export` | T-EXPORT/B11 一键全量导出 zip（vault+attachments+eventlogs+mind_maps+settings 脱敏） |
| **Conversations** ✅ | `GET/POST /conversations` · `GET/DELETE /conversations/{id}/messages|` · `POST /chat` | B7 对话持久化 + 最小非流式对话（context 快照落 messages） |
| **Attachments** ✅ | `POST /attachments` · `GET /attachments/{name}` | 附件上传与读取 |
| **Admin** ✅ | `POST /admin/reindex`（`prune` 参数） | Markdown → SQLite 索引恢复；Sync 接收后自动触发 |

### 9.2 设计意图，未实现

| 方法&路径 | 说明 | 归属 |
|---|---|---|
| ❌ `POST /notes/{id}/links/suggest` | AI auto-link 建议 | B4 |
| ❌ `GET/PUT /notes/{id}/mindmap` | 旁车读写 + 重写大纲段（当前走三表 API） | B18 |
| ❌ `POST /ai/mindmap` | LLM 生成导图 | B6 |
| ❌ `POST /index/rebuild` | 全量重建索引（实装为 `POST /admin/reindex`） | — |
| ❌ `GET/POST /concepts/{id}/edges` · `DELETE /edges/{id}` | 边管理（当前边由 links 表统一承载） | — |
| ❌ `GET /suggestions/edges` · `POST /suggestions/edges/{id}/accept\|ignore` | AI 概念建议队列 | B5 |
| ❌ `GET/POST /conversations` · `GET /conversations/{id}/messages` | 对话历史 | B7 |
| ❌ `POST /chat/stream`（SSE） | Tutor 流式对话 | B1 + B2 |
| ❌ `GET /sync/pair` | 配对码 → LAN bearer token | S2 |
| ❌ `POST /sync/manifest` · `/sync/fetch` · `/sync/push` | 三态差异交换与差量传输（E2E 已验证传输协议，HTTP 层未建） | S2 |
| ❌ `POST /trace/run` | 运行并返回 TraceEvent[]（M9） | M9 |
| ❌ `GET /api/v1/home` | Mobile 聚合读（recent_notes + weak_concepts + review_count） | Mobile API Preparation，仅确有需求时补 |

错误约定：`{error: {code, message}}`；业务异常 HTTP 400，内部错误 500 不泄露堆栈。

---

## §10 里程碑与路线图

> **状态以 `TASKS.md` §4.3 为唯一来源**——本表只定义「验收标准」，不维护进度，
> 避免双份维护产生漂移（原审核 §4.2 判定）。
>
> **当前阶段：后端优先**（`PROJECT_STATE.md` §0）。后端 backlog（`TASKS.md` §2）清零前，
> 本表中所有含前端交付物的里程碑（M6 / M8 / M9 / M10）一律不启动。

| # | 内容 | 验收标准 |
|---|---|---|
| M0 | 脚手架 | `pip install -r requirements.txt && npm i` 后两条命令分别起前后端；页面显示框架布局；migration 跑通；FastAPI 绑定 127.0.0.1 且支持 `PORT` 环境变量；workspace 目录结构符合 §4.2（含 metadata/ 空骨架）；本设计文档+AGENTS.md 就位 ✅ |
| M1 | 知识库核心 | 新建/编辑/删除笔记落盘 vault/；TipTap 编辑 `$LaTeX$` 即时渲染；图片/PDF 附件插入；重启后内容一致 |
| M2-A | Markdown 链接解析器 | `[[标题]]` 三级解析（concept→note→自动建桩 origin=manual）；附件绝对路径/file:// 写入拒绝；解析单测覆盖 |
| M2-B | Link 索引与反链 API | 保存笔记时增量重建 links；GET 反链列表含来源摘要；删除实体级联清理 links 无孤儿 |
| M2-C | 搜索 UI | 笔记视图内搜索框：FTS5 结果点击即跳转打开对应笔记 |
| M2-D | Graph Read Model | GET /api/v1/graph?root=&depth= 返回 {nodes,edges}（递归 CTE，多态 links）；契约测试锁定 |
| M2-E | React Flow 基础图谱 | 安装 @xyflow/react；节点/边渲染、点击跳转、双击局部展开；默认布局——无动画无 d3-force（M3b 边界） |
| M2b | Mind Map 编辑器 | 笔记⇄导图双模式切换实时同步；Tab/Enter/拖拽改父（环检测生效）；折叠持久化；旁车 json 落盘；FTS 能命中导图文本；[[链接]] 经大纲段进入图谱 |
| M3 | Learning Graph | 概念 CRUD；四维掌握度随事件变化（pytest 覆盖权重/衰减/SM-2 数学）；Dashboard 显示雷达图与状态徽章；FORGOTTEN 自动进复习队列 |
| M3b | Knowledge Universe 视觉层 | 三模式切换（Galaxy/Explorer/Memory Map）；四维视觉编码生效（大小=连接度推导/亮度=effective/颜色=domain/呼吸=活跃度）〔注：颜色编码后经 §8.1 修订为掌握三色（domain 改力导向聚簇表达），见「领域(domain)不再用颜色区分」行——本行为 M3b 立项时设计，保留原文〕；FORGOTTEN 变暗且复习后点亮；requires 技能树逐层展开；2 层动态过滤；d3-force 布局（ADR-007） |
| M3.5-A | Knowledge Radar MVP | 编辑器右侧面板（Ctrl+Shift+K 唤起）；上下文关键词提取→FTS匹配+图谱邻居推荐；点击跳转笔记/概念；memory 字段暂 null（ADR-012 Phase A） |
| M3.5-B | Full Omniscience | +concept_mastery 掌握度 +review_due 复习建议 +mistakes 错误历史（ADR-012 Phase B，前置 M3/M5） |
| M4 | AI Tutor | 设置页填任意 OpenAI-compatible 端点即通；流式回答渲染 Markdown+KaTeX；问"什么是特征值"时上下文透视可见注入的掌握度/错误记录；回合后 mastery 数值自动变化；auto-link 建议弹 Accept/Ignore；Concept 页「生成思维导图」一键产出旁车 json+大纲并全量 ai_suggested 入图；AI Explain 时概念链在 Galaxy 上路径点亮 |
| M5 | 复习闭环 | 今日复习队列可答题（自评+quiz 两种）；答题驱动 SM-2 重排；Dashboard 学习时间线可见事件流 |
| M6 | Tauri 桌面版 | 安装 Rust 工具链；PyInstaller 打包后端；`tauri dev/build` 出 exe；双击启动=完整应用；数据目录迁移至 userData |
| M7 | LAN Sync v1 | 第二设备经配对码完成配对；双向同步 vault+attachments+eventlogs 三类白名单；新增/变更/删除三态正确；冲突保留双份并出现在解决列表；db/settings/密钥验证永不出现在传输内容中 |
| M8 | Mobile MVP(Android) | RN 应用配对桌面→全量拉取→离线浏览/FTS 搜索/复习测验；SM-2 TS 内核与 Python 版通过同一事件夹具一致性测试；笔记轻编辑可推回；AI 在局域网走桌面引擎、外出提示降级或直连云 |
| M9 | Visual Engine V1 | Python 单文件代码 trace 成功（含递归）；VisualEngine 三模板可步进检查；从 Concept 页一键可视化排序算法；visualize 事件计入掌握度 |
| M10 | AI 生成可视化 | 对任意 Concept 让 LLM 生成示例代码→自动 trace→播放；生成结果可保存复用 |

### 路线图 backlog（有想法先记这里，不扩当前范围）

- Phase 3 RAG：云端 embedding API + sqlite-vec，PDF 导入分块入库，文档问答
- Phase 5 IDE：Monaco、Tree-sitter AST 分析（代码符号↔Concept 关联）、LSP、Docker 执行沙箱、Jupyter/SymPy 集成
- 多语言 trace（C++/Java/Rust，经 gdb/LLDB）
- blocks 表（块级引用，SiYuan 式）
- concept_demos 表（保存的概念演示库）
- Tag 作为图节点类型
- 导出：整库静态站点/Anki 牌组
- 移动端查看（Tauri 2 mobile 或 PWA，届时评估）
- 概念文件夹包 `knowledge/<概念>/`（concept.md + examples/ + code/，Phase 4/5 再议）
- md 大纲段反向解析（在 markdown 模式手改大纲回写 json，ADR-002 后续项）
- Mind Map 节点属性/图标/过滤器（Freeplane 式）
- XMind(.xmind) / markmap(.mm) 文件导入
- 同步增强：WebSocket 实时推送 · CRDT(Yjs/Automerge，触发=双端并发编辑冲突频发) · 后台常驻同步 · iOS 客户端 · memories/conversations 跨端同步
- **UpMark 联动**（错题登记→概念掌握度→双向出题）：挂起中，见 docs/adr/integration-upmark.md

### Future Roadmap（云端与开源生态——明确延后，只预留接口，禁止提前实现）

> **六个月禁令（2026-08-26 起）**：用户系统 · 云端服务 · 插件运行时 · 3D 知识宇宙——
> 即便被催促也先冻结（PRODUCT_PRINCIPLES §5：追求学习效果而非功能数量）。

| 项 | 预留方式 | 解锁触发 |
|---|---|---|
| Cloud Service（用户系统·云同步·云向量·云AI） | provider/settings/WORKSPACE_DIR 抽象即接口 | 有真实多用户需求 |
| 插件体系 `plugins/{math,programming,language}` | 仅目录与加载点设计约定 | 开源社区阶段 |
| i18n 国际化 | 文案集中化管理 | 首个外部贡献者/英文需求 |
| Docker 打包 | 构建脚本位预留 | 首次对外公开发布前 |
| **T-EXPORT 全量数据导出**（vault+attachments+metadata+settings.json → zip） | —— | **首次对外公开发布前必须**（数据不锁死红线，AGENTS §3） |

---

## §11 架构原则（Engineering Principles）

> 并入自 `docs/adr/principles.md`（原标题：架构原则（Engineering Principles））

> 本文是项目原则的**权威来源**（AGENTS.md 为操作摘要）。修改原则须经确认并同步 AGENTS.md。
> 关联：ADR-004 · `docs/DEPENDENCIES.md` · `AGENTS.md`

日期：2026-08-26 · 状态：Accepted

### 十大核心原则

| # | 原则 | 在本项目中的含义 |
|---|---|---|
| 1 | Local-first | 所有功能默认离线可用；用户数据只在本机；云能力是可选增强，永远可关闭 |
| 2 | Minimal Dependencies | 运行时依赖全集见 REGISTRY；新增走 Dependency Review |
| 3 | Open Source Reuse | 非核心能力优先复用成熟开源，不自研 |
| 4 | Standard Library First | Python/TS/Rust 各自标准库优先于一切第三方 |
| 5 | No Reinventing the Wheel | 见下方禁重复实现清单 |
| 6 | Modular Architecture | core/ 纯逻辑层可单测不依赖框架；router 薄；UI 组件保持简单 |
| 7 | Explicit Data Ownership | 源码 / 用户知识库 / 用户代码 / AI 生成内容四者物理分离 |
| 8 | Version Control First | Git 第一天启用，唯一版本真相 |
| 9 | Reproducible Development | lockfile + requirements.txt + README 两条命令可跑 |
| 10 | Small and Maintainable Codebase | 小文件、直白代码、拒绝抽象表演 |

目标不是堆叠技术，而是在最少复杂度下实现完整能力；禁止为了"看起来高级"增加技术栈。

### 能力复用优先级链

```
已有标准能力 → 已有项目代码 → 已装依赖 → 成熟开源项目 → 最后才是新依赖或自行实现
```

对应操作阶梯（Ponytail）：见 `AGENTS.md` §1。

### 禁止重新实现的成熟基础设施

Markdown parser · Git engine · SQL engine · Code editor · Syntax highlighter ·
LSP · AST parser · 数学符号引擎 · HTTP client · JSON/YAML parser ·
Graph layout engine · Auth 框架 —— 除非有经 ADR 确认的架构原因。

### 平衡式（防止机械执行）

- 少量简单代码（几十行、标准库可完成）**<** 一个复杂依赖
- 成熟复杂能力 **>** 自研大型轮子
- 一切按长期维护成本判断，不机械遵守 DRY，也不为了"零依赖"自造轮子

### 核心创新投入方向

开发精力只投给真正的差异化：Knowledge Graph · Learning Memory · AI Tutor ·
Visual Learning Engine · Personal Learning OS 整合。

---

## §12 分层架构规范（Separation of Concerns）

> 并入自 `docs/adr/separation.md`（原标题：分层架构规范（Separation of Concerns））

> **强制约束**。任何代码设计必须先做职责划分再实现。违反本文件触发
> `[ARCHITECTURE WARNING]`（AGENTS §7）。宪法摘要见 `AGENTS.md` §12。

日期：2026-08-26 · 状态：Accepted

### 一、四层模型与本仓库映射

```
Frontend  web/          UI 渲染 · 交互 · Zustand 状态 · 路由切换 · 动画 · 可视化 · 只经 HTTP 调 API
Backend   server/app/   main.py + routers/ —— 参数校验 · 业务编排 · API 服务 · 任务调度
Core      server/core/  纯逻辑引擎（knowledge/mastery/tutor/llm/syncengine/tracer）——可单测、不依赖 FastAPI
Data      workspace/    SQLite（仅经 core 内数据访问函数触达）+ Markdown/JSON 文件事实源
```

### 二、职责白名单 / 黑名单

| 层 | 只允许 | 永远禁止 |
|---|---|---|
| Frontend | UI 渲染、交互、状态管理、动画、图形可视化、调 API、展示错误 | 直连 SQLite/文件系统；业务规则；AI 调用；图谱算法；持久化用户核心数据 |
| Backend | API 接口、编排 Core、数据转换、同步服务、权限/配对校验、调度 | UI 代码；页面逻辑；保存前端状态 |
| Core | 核心算法（掌握度/SM-2/图查询/上下文管线/SSE 解析/diff） | import FastAPI；读 HTTP 请求对象；关心 UI |
| Data | schema migration、参数化 SQL、文件原子读写 | 被 Frontend 直接触碰；承载业务判断 |

**唯一合法调用链**：`Frontend → HTTP /api/v1 → Router(校验) → Core(业务) → 数据访问函数 → SQLite/文件`

### 三、接口先行开发流程（每个功能强制）

```
Step1 定义数据结构（表/文件格式变更先进 docs/DATA_MODEL.md §A 变更日志）
Step2 设计 API 契约（路径/schema/错误码，写入 TECH_DESIGN §9）
Step3 实现 Backend + pytest（契约测试锁响应形状）
Step4 实现 Frontend（只消费契约）
Step5 双侧测试 → TASKS 回填报告
```

禁止先写页面再临时拼后端。

### 四、模块隔离细则

#### AI 隔离
LLM 请求只允许出现在 `server/core/ai/*`（llm.py/tutor.py/extractor）。UI 组件零直连；
链路恒为 `用户输入 → /api/v1/chat/stream → tutor.py → LLM → SSE 返回`。
**Router 禁止 import llm**——一切提示词组装经 Context Builder（ADR-010），
未来 RAG 仅作为 Builder 的数据源扩展。

#### Knowledge Universe 三段式
| 段 | 位置 | 职责 |
|---|---|---|
| graph-core | core/knowledge.py + 递归 CTE | node/edge/relation/图计算/2 层邻居过滤 |
| graph-api | routers/graph.py | GET /api/v1/graph 契约输出 {nodes,edges} |
| graph-ui | GraphView / MindMapView | React Flow + d3-force 视觉编码，零算法 |

禁止在 React 组件里计算图算法；禁止 Backend 返回 UI 结构。

#### 同步归属
协议实现只在 `core/syncengine.py`（扫描/hash/diff/conflict）；桌面 router 与手机端都只是
协议客户端/宿主。手机 App 禁止自行改动或另造同步语义（ADR-005 单一真相）。

### 五、共享类型契约

- `shared/types/*.ts` 是 API 响应形状的**唯一权威定义**（Concept/GraphNode/Edge/MasteryRecord/MemoryRecord…）
- Python 侧不复制类型，而以 pytest **契约测试**断言真实响应与 shared/types 一致
- 禁止前端自造一份形状、后端再造一份
- backlog：若手工镜像漂移频繁，引入 openapi-typescript 代码生成（走 Dependency Review）

### 六、错误契约

Backend 输出 `{error: {code, message}}`（HTTP 400 业务错 / 500 不泄堆栈）；
Frontend 仅负责展示与重试交互，**不得**在 UI 里重判业务规则。

### 七、依赖控制

新增依赖沿用 AGENTS §2 六连问 + REGISTRY 登记。分层本身不引入新框架：
分层靠目录约定与测试约束，不靠 DI 容器/装饰器框架。

---

## §13 UpMark 联动计划（挂起中 · 未排期）

> 并入自 `docs/adr/integration-upmark.md`（原标题：UpMark 联动计划（挂起中 · 未排期））

> **状态：SHELVED**。本文档只记录计划与边界，不含任何已实现功能；
> 用户显式发起联动开发时才解挂。关联：TECH_DESIGN §10 backlog · TASKS 挂起区。
> 关联项目：https://github.com/yunxibaili/UpMark · 本地 `D:\dev\upmark`

日期：2026-08-26 · 状态：Shelved

### 一、UpMark 是什么（速览）

- **升本通**：个人备考工具。PC(Windows) FastAPI + SQLAlchemy + SQLite（默认 :8000），
  自研 MD 行扫描状态机解析题库导入；Flutter Android App 绑定 PC → 全量下载 →
  离线刷题 → 回家批量幂等上报进度
- 数据规模：~790 题 / 12 科目 / 48 章；题型 单选/判断/填空(+材料分组)；支持图像题与 `$公式$` 文本化
- 题库格式：`练习题.md` 分区 + 编号题干 + 选项 + `**【答案】**` + `**【讲解】**`，
  E/W 校验码体系（E100 BOM / W302 缺答案 …），规范见其 `docs/MD格式规范v2.2.md`
- 与本联动直接相关的既有能力：**错题本（in_wrong_book）**、答题记录
  （question_id/is_correct/answered_at，幂等去重）
- 接口契约唯一依据：仓库根 `api_contract_v2.json`。常用：
  `GET /api/sync/all` · `GET /api/sync/questions/{chapter_id}` ·
  `POST /api/sync/progress` · `GET /api/health`

### 二、为什么联动

Learning OS 的 mistakes / learning_events / SM-2 复习与 UpMark 的错题本天然互补：

```
UpMark 刷题答错(is_correct=false, 入错题本)
      ↓ U1: 桌面桥接客户端定期/手动拉取 progress
Learning OS integrations/upmark.py
      ↓ 题目↔概念映射（如"04-导数与微分"章 → Concept「导数」）
quiz_wrong 事件 + mistakes 登记 → 掌握度下调 · FORGOTTEN 排期 · AI Tutor 定向讲解
      ↓ U2: 反向通道
复习队列推荐弱概念 → 经契约取对应章节题目嵌入测验 → 结果回传 progress
```

形成「做题 → 诊断 → 复习 → 再做题」闭环，两系统各守本职。

### 三、联动阶段（解挂后再细化排期）

| 阶段 | 内容 | 方向 | 前置 |
|---|---|---|---|
| U1 错题登记流入 | 拉 progress → 映射概念 → 写 quiz_wrong/mistakes | UpMark → Learning OS | M3+M4 完成 |
| U2 双向出题 | 复习队列出题嵌入测验，结果回传 | 双向 | +M5 测验模式 |
| U3 题库文件导入（远期可选） | 练习题.md 作为 exercises 资产引入 workspace（适配其格式规范） | UpMark → vault | U1/U2 验证价值后 |

映射存储（U1 解挂时建）：`question_concept_map(upmark_question_id, concept_id, confidence)`
——先登记于 docs/DATA_MODEL.md §A 变更日志，走 migration，禁止提前创建。

### 四、硬边界（红线）

1. **只经 UpMark 公开 REST 契约通信**（以 api_contract_v2.json 为准）；
   禁止直连其 SQLite——对方红线禁改表结构，外部直读存在锁与 schema 漂移风险
2. 两仓库完全独立：不共享代码、不建 monorepo；Learning OS 侧只新增
   `server/core/integrations/upmark.py` 一个客户端模块（标准库 HTTP，符合依赖纪律，
   REGISTRY 登记）
3. **端口共存**：两服务默认都占 :8000。FastAPI 自 M0 起支持 `PORT` 环境变量——
   共存时以 `PORT=8100` 启动 Learning OS
4. 不向 UpMark 写入其红线禁止的内容；不触碰其 test-bank/computer-bank 私有数据的分发
5. 联动产生的学习数据仍遵循 ADR-005：以文件形式落 workspace 才可多端可见

### 五、解挂流程

用户说「启动 UpMark 联动 U1/U2/U3」→ 本文件升版记录决策 → TASKS 登记正式任务 →
Dependency Review（如需）→ 按 AGENTS 流程开发。

