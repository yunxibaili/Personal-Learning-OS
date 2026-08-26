# Personal Learning OS — 技术设计文档

> 本文档是项目唯一技术设计来源。所有依赖决定附「被否掉的备选及原因」，防止未来开发会话把已否决的方案加回来。配套工程宪法见仓库根 `AGENTS.md`。
> 依赖登记与审查：`docs/dependencies/REGISTRY.md` · 重大架构决策：`docs/architecture/`（ADR） · 版本控制：`docs/version-control/POLICY.md`

---

## §1 项目定位

**一句话**：Local-first 的 AI 个人学习操作系统——以 Markdown 为内容，以 Knowledge Graph 为结构，以 Learning Memory 为核心，以 AI Tutor 为智能层。

它不是：
- 普通笔记软件（Obsidian/Notion 替代品）
- AI 聊天工具
- 在线 IDE

差异化壁垒（按优先级）：
1. **Learning Graph**：知识图谱 × 用户学习状态（掌握度/错误/遗忘），AI 因此知道"我学过什么、哪里薄弱"
2. **记忆感知 AI Tutor**：回答前查询图谱与记忆，针对性讲解；回答后自动更新状态
3. **Visual Learning Engine**（M7+）：代码执行 → Trace → 动画

---

## §2 总体架构

### 2.1 形态演进

```
M0–M5：本地 Web 应用
  浏览器 ──HTTP 127.0.0.1:8000──▶ FastAPI Core ──▶ SQLite + vault/

M6：包 Tauri 壳（桌面版）
  Tauri WebView(加载同一 React 构建产物)
    └─ sidecar 子进程：PyInstaller 打包的 FastAPI 可执行文件
  对后端代码零改动，只加 src-tauri/ 目录
```

选择 Tauri 而非 Electron：包体小、内存占用低；Rust 层仅做窗口与 sidecar 管理，无业务逻辑。
开发期（M0–M5）不装 Rust 工具链，浏览器直接访问。

### 2.2 模块图

```
web/ (React + TS + Zustand)
 ├─ views: NoteEditor / GraphView / MindMapView(M2b) / TutorPanel / ReviewQueue / MemoryDashboard
 └─ lib: api client, trace StepPlayer (M7)
        │ fetch /api/*
server/ ▼
 ├─ main.py          FastAPI 入口 + 静态托管前端构建产物
 ├─ db.py            sqlite3 连接、migration runner
 ├─ routers/         notes concepts graph mastery chat review settings trace(M7)
 └─ core/            纯逻辑层（可单测，不依赖 FastAPI）
     ├─ knowledge.py   笔记索引、双链解析、概念/边 CRUD、递归 CTE 图查询
     ├─ mastery.py     掌握度计算、状态机、SM-2（§5）
     ├─ tutor.py       上下文组装 + 对话编排 + extractor（§6）
     └─ llm.py         OpenAI-compatible HTTP client（裸 urllib/httpx?→标准库 urllib）
```

### 2.3 关键原则

- **Folder 是视图，Graph 才是数据模型**：workspace/vault/ 下任意文件夹组织；概念 `特征值` 可同时关联多个领域，无需复制文件
- **Markdown 文件是正文唯一事实源**：SQLite 存元数据/索引/学习状态；保存时增量重建该笔记的 FTS 索引与双链边；启动时全量扫描校验一致性（hash 不符则重索引）
- **学习事件追加式**：掌握度永远可由事件流重放推导，表里存的是缓存值

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
| Web | marked | Chat 消息 Markdown 渲染 |
| Web | @xyflow/react | 知识图谱视图 |
| Web | @tiptap/react / @tiptap/pm / @tiptap/starter-kit | 富文本编辑器内核 |
| Web | @aarkue/tiptap-math-extension | `$...$` 行内/块级 LaTeX（KaTeX 驱动，社区免费） |

开发依赖：vite、typescript、vitest、pytest、@types/*、@vitejs/plugin-react。

> 本表仅为摘要。完整登记（License/维护状态/Dependency Review 模板）见 `docs/dependencies/REGISTRY.md`；
> 新增任何依赖前必须通过六连问审查（AGENTS.md §2）。

### 3.2 已否决备选（禁止回潮）

| 备选 | 否决理由 |
|---|---|
| Electron | 包体/内存大；业务全在 Python 后端，Electron 无额外价值。Tauri Rust 层只是薄壳 |
| SQLAlchemy / SQLModel | ~11 张表的规模，ORM 是纯抽象税。stdlib sqlite3 参数化查询足够 |
| LangChain / LlamaIndex | RAG/Tutor 管线手写 <200 行且完全可控；框架引入黑盒抽象与版本地狱 |
| openai SDK | 只用 `/chat/completions` 一个端点，SSE 流式解析 ~40 行，标准库可胜任 |
| Tailwind + shadcn/ui | 与最小依赖纪律冲突（拉入 Radix 全家桶）；单一 global.css 足够个人应用 |
| TipTap 官方 mathematics 扩展 | 付费 Pro 包；@aarkue/tiptap-math-extension 免费 且满足 `$` 分隔符需求 |
| sqlite-vec / LanceDB / Qdrant / BGE embedding | MVP 概念匹配交给 LLM（标题列表进 prompt，几百概念规模完全够用）。触发重评条件：概念数 >2000 或匹配质量明显不足 → 先加云端 embedding API + sqlite-vec |
| D3.js / PixiJS / Three.js | 图谱已有 React Flow；数组/栈帧动画为 n≤100 规模，手写 SVG + CSS transition 每模板 <100 行 |
| Manim | 重依赖链(Cairo/Pango/FFmpeg) + 离线视频渲染，违背"交互式可视化"目标。数学动画改为参数化 SVG + 播放头 |
| Monaco / Jupyter / Docker 沙箱 | Phase 5（IDE 阶段）才引入，当前阶段不做代码 IDE |
| Elasticsearch / Meilisearch | FTS5 内置于 SQLite，零运维 |

---

## §4 数据模型（SQLite）

### 4.1 DDL

```sql
-- 配置（LLM base_url/api_key/model、主题等）
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
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 关系边
CREATE TABLE edges (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relation   TEXT NOT NULL,                   -- requires|related|contains|contrasts_with
  origin     TEXT NOT NULL DEFAULT 'manual',  -- manual|ai_suggested|accepted
  weight     REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_id, target_id, relation)
);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);

-- 学习状态：每概念一行，首次触达时惰性创建（缓存，可由 events 重放重建）
CREATE TABLE concept_mastery (
  concept_id       INTEGER PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
  understanding    REAL NOT NULL DEFAULT 0,    -- 定义/直觉
  computation      REAL NOT NULL DEFAULT 0,    -- 计算/解题
  proof            REAL NOT NULL DEFAULT 0,    -- 证明/推导
  application      REAL NOT NULL DEFAULT 0,    -- 应用/编程
  overall          REAL NOT NULL DEFAULT 0,
  state            TEXT NOT NULL DEFAULT 'UNKNOWN',
  ease             REAL NOT NULL DEFAULT 2.5,  -- SM-2
  interval_days    REAL NOT NULL DEFAULT 0,
  reps             INTEGER NOT NULL DEFAULT 0,
  lapse_count      INTEGER NOT NULL DEFAULT 0,
  mistake_count    INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  next_review_at   TEXT
);

-- 学习事件：追加式日志，掌握度的唯一来源
CREATE TABLE learning_events (
  id          INTEGER PRIMARY KEY,
  concept_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,   -- study|explain|quiz_correct|quiz_wrong|code_run|visualize|review
  dimension   TEXT NOT NULL DEFAULT 'understanding',
  delta       REAL NOT NULL DEFAULT 0,        -- 实际施加的增量（记录用）
  score       REAL,                           -- quiz 得分 0~1
  detail_json TEXT NOT NULL DEFAULT '{}',     -- {source:"chat"/"note"/..., note_id, conv_id}
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_concept ON learning_events(concept_id, occurred_at);

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

-- 笔记 ↔ 概念
CREATE TABLE note_concepts (
  note_id    INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  origin     TEXT NOT NULL DEFAULT 'link',   -- link([[..]])|manual|ai
  PRIMARY KEY (note_id, concept_id)
);

-- 双链边（笔记级）：[[目标标题]]
CREATE TABLE note_links (
  source_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, target_id)
);

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
```

延后建表（写入路线图，勿提前创建）：`blocks`（块级引用）、`embeddings`（向量）、`concept_demos`（概念↔保存的可视化示例）。

### 4.2 数据目录约定（用户数据与应用源码分离）

```
learning-os/                 # 应用源码，Git 管理
├── server/  web/  docs/
└── workspace/               # 用户私有数据根——整体 .gitignore，永不入库
    ├── vault/               # Markdown 正文 + *.mindmap.json 旁车
    │   ├── 数学/特征值.md
    │   ├── 数学/特征值.mindmap.json
    │   └── 编程/python/梯度下降.md
    ├── attachments/         # 图片 / PDF
    └── db/learning-os.db    # SQLite
```

- 工作区路径默认 `<repo>/workspace`，可改为任意本地目录（桌面版迁移至 Tauri userData）；
  用户可用任意编辑器直接改 vault 内文件
- 标题 = 文件名去 `.md`；`[[标题]]` 按 title 全库唯一解析（重名时报错提示改名）
- YAML front-matter 支持 `tags:`，索引进 notes.tags_json
- 附件统一放 `workspace/attachments/`，笔记内相对路径引用

---

## §5 Learning Graph 引擎（core/mastery.py）

### 5.1 四维掌握度

维度：`understanding`(直觉/定义) `computation`(计算) `proof`(证明) `application`(编程/应用)，取值 [0,1]。

事件权重（正事件增益随当前值衰减：`delta = w × (1 − current)`，保证渐近逼近 1）：

| event_type | 主维度 w | 备注 |
|---|---|---|
| study（打开/编辑关联笔记） | 0.05 understanding | 每笔记每概念每天最多计 1 次 |
| explain（AI 讲解一轮涉及） | 0.04 understanding | extractor 判定 |
| visualize（看完一次可视化） | 0.06 understanding | M7 起 |
| code_run（运行相关代码成功） | 0.06 application | |
| quiz_correct | 0.18 | 维度按题目标注 |
| quiz_wrong | −0.10 固定 | 同时记 mistake、lapse++ |
| review（复习队列完成） | 按 SM-2 quality 映射 ± | §5.3 |

`overall = 0.35·understanding + 0.25·computation + 0.20·proof + 0.20·application`

### 5.2 遗忘曲线与状态机

展示用有效值（不改存储值）：`effective = score × exp(−Δdays / τ)`，`τ = 30 × ease / 2.5` 天。

状态机（按 effective(overall) 迁移）：

```
UNKNOWN ──任意事件──▶ INTRODUCED ──≥0.40──▶ UNDERSTOOD ──≥0.60且quiz≥2次──▶ PRACTICED
                          ▲                                            │ ≥0.80且近5次正确率≥80%
                          │                                            ▼
                     FORGOTTEN ◀──曾达PRACTICED且eff跌破0.35── MASTERED
                          │
                     进入复习队列；复习按 SM-2 重排，eff回升≥0.60 则回到 PRACTICED
```

### 5.3 SM-2 调度

quiz 得分 s∈[0,1] 映射 quality：`q = clamp(round(1 + s×4), 0, 5)`
- q < 3：reps=0，interval=1天，ease −0.2（下限 1.3）
- q ≥ 3：ease += 0.1 − (5−q)×(0.08+(5−q)×0.02)；interval: reps1→1天，reps2→6天，否则 round(prev_interval×ease)

复习队列 = `next_review_at ≤ now` 或 state=FORGOTTEN 的概念，按优先级（FORGOTTEN > 最久未复习）排序。

---

## §6 AI Tutor（core/tutor.py + core/llm.py）

### 6.1 LLM Adapter

- 唯一协议：OpenAI-compatible `POST {base_url}/v1/chat/completions`，SSE 流式
- 配置全部来自 settings 表：`llm.base_url` / `llm.api_key` / `llm.model` / `llm.fast_model`（extractor/匹配用便宜模型）
- 具体接哪家由用户在设置页填（DeepSeek/Qwen/OpenAI/…均可）；Ollama = base_url 指 `http://127.0.0.1:11434/v1`，零代码差异
- 实现用 Python 标准库 `urllib.request` 手写 SSE 解析（~40 行），不用 SDK（§3.2）

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
- learning_events/mistakes/memories 直接落库（memories 去重靠 content 相似前缀匹配，简单字符串比较即可）
- note_links 直接写 note_concepts(origin='ai')
- concept_suggestions 进「待确认」队列，GraphView 弹 Accept/Ignore；Accept 时 origin='accepted'
- extractor 失败静默跳过，不影响主对话

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
1. 重写大纲段 + 重索引（FTS/note_links/note_concepts 随索引管线自然更新）
2. 大纲中 `[[链接]]` 正常建立笔记↔概念关联
3. 节点「提升为概念」操作 → 建 concepts + edges(relation='contains', origin='manual')

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

## §8 Visual Learning Engine 预设计（M7 实施）

### 7.1 定位

代码执行 → **Trace 记录** → **模板渲染动画**。绝不让 LLM 直接生成动画数据/视频（LLM 只生成示例代码，走同一条 trace 管线）。

### 7.2 采集器（server/core/tracer.py，纯标准库）

- 机制：子进程内 `sys.settrace()`，监听 `call/line/return` 事件 + 每步局部变量快照
- 堆对象模型：list/dict/set/自定义对象分配 heap_id，快照中以 `$ref` 去重（Python Tutor 同思路）
- 限制：单文件脚本、禁 IO/import 白名单外模块、总步数上限 10000、超时 10s（子进程 kill）
- 信任级说明：本地个人应用运行用户自己写的代码，等同用户手动跑脚本；CPU/内存/网络硬隔离沙箱留待 Phase 5 Docker 方案

### 7.3 TraceEvent v1 契约（前后端唯一接口，版本化）

```json
{"v":1,"steps":[
  {"step":12,"type":"call|line|return",
   "frames":[{"func":"quick_sort","line":14,"locals":{"arr":{"$ref":"h1"},"lo":0}}],
   "heap":{"h1":{"t":"list","items":[{"$ref":"h2"},{"$ref":"h3"},5,1]}},
   "stdout":"..."}]}
```

### 7.4 渲染模板（纯前端插件，新模板不动管线）

| 模板 | 场景 | 实现 |
|---|---|---|
| FrameStackView | 递归展开（factorial/快排） | SVG 堆叠帧 + return 值回流动画 |
| ArrayView | 排序/数组操作 | SVG 条形 + swap 高亮 + CSS transition |
| FuncPlotView | 函数图像/优化过程 | SVG 折线/等高线 + 参数播放头（梯度下降球、泰勒逼近），可拖进度条 |

StepPlayer 组件：播放/暂停/单步/速度滑杆，复用于三模板外壳。
观看完成 → `learning_events(type="visualize")` → 喂给掌握度模型。

入口：Concept 详情页「▶ Visualize」按钮 + 笔记 python 代码块「Run & Visualize」（TipTap code block 自定义按钮）。

---

## §9 API 设计（REST，前缀 /api）

| 方法&路径 | 说明 |
|---|---|
| GET/POST /notes · GET/PATCH/DELETE /notes/{id} | 笔记 CRUD（写 .md 文件 + 重索引） |
| GET /notes/{id}/backlinks | 反链 |
| POST /notes/{id}/links/suggest | AI auto-link 建议 |
| GET/PUT /notes/{id}/mindmap | 读/写旁车 `.mindmap.json`；PUT 时重写大纲段并重索引 |
| POST /ai/mindmap (M4) | LLM 生成导图 → 全节点 ai_suggested 入图 → 落盘 |
| GET /search?q= | FTS5 全文搜索（notes） |
| POST /index/rebuild | 全量重建索引（启动自动跑一次） |
| GET/POST /concepts · PATCH/DELETE /concepts/{id} | 概念 CRUD |
| GET/POST /concepts/{id}/edges · DELETE /edges/{id} | 边管理 |
| GET /graph?scope=global\|local&root={id}&depth=n | 图谱数据（递归 CTE） |
| GET /suggestions/edges · POST /suggestions/edges/{id}/accept\|ignore | AI 概念建议队列 |
| GET /mastery · GET /mastery/{concept_id} | 掌握度（含 effective 衰减值） |
| POST /events | 手动记录学习事件 |
| GET /review/today · POST /review/{concept_id}/answer | 复习队列 + 提交答案 |
| GET/POST /conversations · GET /conversations/{id}/messages | 对话历史 |
| POST /chat/stream (SSE) | Tutor 流式对话 |
| GET/PUT /settings | 配置读写（API key 写后永不再返回明文） |
| POST /trace/run (M7) | 运行并返回 TraceEvent[] |

错误约定：`{error: {code, message}}`；业务异常 HTTP 400，内部错误 500 不泄露堆栈。

---

## §10 里程碑与路线图

| # | 内容 | 验收标准 |
|---|---|---|
| M0 | 脚手架 | `pip install -r requirements.txt && npm i` 后两条命令分别起前后端；页面显示框架布局；migration 跑通；本设计文档+AGENTS.md 就位 ✅ |
| M1 | 知识库核心 | 新建/编辑/删除笔记落盘 vault/；TipTap 编辑 `$LaTeX$` 即时渲染；图片/PDF 附件插入；重启后内容一致 |
| M2 | 双链·反链·搜索·图谱 | `[[标题]]` 自动补全并可点击跳转；反链面板列出引用者；FTS5 搜索毫秒级返回；React Flow 全局图+双击节点局部图；Note↔Note、Note↔Concept 边可见 |
| M2b | Mind Map 编辑器 | 笔记⇄导图双模式切换实时同步；Tab/Enter/拖拽改父（环检测生效）；折叠持久化；旁车 json 落盘；FTS 能命中导图文本；[[链接]] 经大纲段进入图谱 |
| M3 | Learning Graph | 概念 CRUD；四维掌握度随事件变化（pytest 覆盖权重/衰减/SM-2 数学）；Dashboard 显示雷达图与状态徽章；FORGOTTEN 自动进复习队列 |
| M4 | AI Tutor | 设置页填任意 OpenAI-compatible 端点即通；流式回答渲染 Markdown+KaTeX；问"什么是特征值"时上下文透视可见注入的掌握度/错误记录；回合后 mastery 数值自动变化；auto-link 建议弹 Accept/Ignore；Concept 页「生成思维导图」一键产出旁车 json+大纲并全量 ai_suggested 入图 |
| M5 | 复习闭环 | 今日复习队列可答题（自评+quiz 两种）；答题驱动 SM-2 重排；Dashboard 学习时间线可见事件流 |
| M6 | Tauri 桌面版 | 安装 Rust 工具链；PyInstaller 打包后端；`tauri dev/build` 出 exe；双击启动=完整应用；数据目录迁移至 userData |
| M7 | Visual Engine V1 | Python 单文件代码 trace 成功（含递归）；StepPlayer 三模板可播放；从 Concept 页一键可视化排序算法；visualize 事件计入掌握度 |
| M8 | AI 生成可视化 | 对任意 Concept 让 LLM 生成示例代码→自动 trace→播放；生成结果可保存复用 |

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
