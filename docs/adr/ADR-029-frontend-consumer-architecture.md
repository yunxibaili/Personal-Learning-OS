# ADR-029 · Frontend Consumer Architecture Decision（前端消费端架构决策）

- 状态：**Accepted**（2026-09-05 Owner 于 F0-GATE 正式批准生效；本 ADR 是 2026-09-05 所有者 F0 裁决的正式落地文本）
- 日期：2026-09-05
- 决策者：项目所有者
- 关联：`ADR-001`（Markdown/vault 唯一事实源）· `ADR-013`（Frontend Design System）· `ADR-006`（移动端技术栈）· `ADR-022`（Product Mode Boundary）· `ADR-023`（Visualization Boundary）· `ADR-028`（Document Revisions）· `AGENTS.md §9 / §12 / §16`
- 冲突登记：`AGENTS.md §9`（冻结表仍列 TipTap / Tauri / dagre 生效）· `AGENTS.md §12`（「响应形状以 `shared/types/*.ts` 为唯一契约」，该目录已不存在）· `PROJECT_BRIEF §7`（Tauri 2 sidecar + React 18 + TipTap v3）· `ADR-006`（M8 = Tauri 2 Mobile）
- **本 ADR 只登记冲突，不自动修改上述任何文件。** 相应条款改写须 Owner 单独授权（见 §10.3、§13）。

---

## 0. 本 ADR 的性质（先读这一节）

### 0.1 一句话核心

> **Frontend 是 Backend API 的 Consumer，而不是重新定义 Backend truth 的第二套系统。**

这是本次裁决的实质。技术选型（React 19 / CodeMirror 6 / openapi-typescript）是这一命题的**推论**，不是决策本身。

### 0.2 为什么是「一条总纲」而不是 N 条修订 ADR

项目当前有 16 份与前端相关的历史 ADR（见 §10 矩阵）。若采用「ADR-029 修 A、ADR-030 修 B、ADR-031 修 C」的逐条修订方式，会重演 `[26]-D` 的治理循环：每一条修订都会牵出新的字面不一致，审计边界持续扩张，永远收不了口。

因此本 ADR 采用 **Architecture Reset / Consumer Boundary** 总纲形式：

1. 一次性声明：**新前端是一个全新的 Consumer，不是旧前端的延续、修复或恢复**；
2. 一次性给出历史前端 ADR 的**统一处置矩阵**（§10），不再逐条立 ADR；
3. 一次性冻结 MVP 范围（§8），未列入者一律延后，不因「顺手」扩张。

### 0.3 Consumer 三定律（本 ADR 的硬边界）

| # | 定律 | 含义 |
|---|---|---|
| L1 | **Truth 单向** | Markdown vault 是唯一事实源（ADR-001）。前端只读/写 API，不得持有、缓存为真相、或在本地重算业务状态（mastery / SM-2 / 图谱 / 概念关系）。 |
| L2 | **契约单向** | 响应形状由后端 OpenAPI 定义，前端生成类型消费。**不得**另立手写 TS 类型作为契约，也不得要求后端为前端改响应形状（新增需求走后端 ADR/任务，不是前端改契约）。 |
| L3 | **能力不漂移** | 前端不得实现后端职责：不直连 SQLite / 文件系统 / AI provider / 图谱算法 / 同步协议（`AGENTS.md §12` 调用链不变）。 |

违反 L1–L3 的任一实现，无论功能是否可用，均视为越界并回退。

### 0.4 本 ADR 不授权实现

见 §14。确认前保持：**零 `frontend/` 目录、零依赖安装、零代码**。

---

## 1. Architecture Reset / Scope

### 1.1 Reset 声明

- 旧前端实现（`web/`）已整体移除，**仓库内零残留**：无 `package.json` / `*.tsx` / `vite.config*` / `tsconfig*`（2026-09-05 复核确认）。
- 后端不提供静态站点：全仓库 `app/` 与 `routers/` 无 `StaticFiles` / `HTMLResponse`（仅 attachments 使用 `FileResponse`）。
- 因此**不存在「恢复前端」这个动作**。任何以「恢复 `web/`」「把类型同步回 `shared/types/`」为前提的表述，自本 ADR 起一律无效。

### 1.2 新前端的定义

> 新前端 = 一个**纯静态、浏览器运行、通过 HTTP 消费 `/api/v1/*` 的独立 Consumer 应用**，目录为 `frontend/`。

它与旧前端的关系是**断代**，不是**继承**：不继承目录结构、不继承组件库、不继承依赖清单、不继承 `shared/` 约定。

### 1.3 本 ADR 的范围

| 在范围内 | 不在范围内 |
|---|---|
| 架构形态（Web-first / 壳延后） | 具体页面设计与交互稿（属 ADR-013 规范层） |
| UI 技术栈（React 19 + Vite + TS） | 组件清单、路由表、状态管理细节 |
| 编辑器选型（CodeMirror 6 源码模式） | 编辑器快捷键与插件清单 |
| API 契约来源与消费方式 | 后端 API 变更（除 §9 登记项外一律不动） |
| 目录边界与 MVP 功能边界 | 实现排期、任务拆分、代码 |
| 历史前端 ADR 的统一处置 | 后端 ADR（001/005/020/027/028 等） |
| 后端缺口的分类与措辞 | 后端缺口的修复（须单独授权单独 commit） |

---

## 2. Browser-first Boundary（形态决策）

### 2.1 决策

**本地 Web 优先，桌面壳决策延后。** Tauri 2 为唯一候选壳；**不引入 Electron**。

### 2.2 硬约束（这三条是决策的真正内容）

| # | 约束 | 目的 |
|---|---|---|
| H1 | 前端产物是**纯静态 SPA**（`index.html` + JS/CSS），可被任意静态服务器托管 | 形态无关 |
| H2 | 网络层**只用 `fetch`**，不依赖任何原生桥、IPC、Node API | 换壳零改前端 |
| H3 | **禁止在业务代码中调用 shell 专有 API**（Tauri IPC / Electron `ipcRenderer` / 自定义 `window.__HOST__`） | 保证 §12 的 Future Host 可平移 |

H1–H3 使得「未来是否上 Tauri 2」成为**纯宿主层决策**，前端代码零改动。这是「壳延后」能够成立的前提——**延后的是决策，不是约束**。

### 2.3 理由

1. 后端是**独立 Python 进程**（本地 sidecar），壳不需要承载任何业务逻辑；Tauri 在本架构下退化成「窗口 + 进程管理 + 端口注入」，Rust 侧成本相对收益不划算。
2. Electron 需打包完整 Chromium（体积与内存开销量级与本地优先轻量定位冲突），**明确排除**。
3. 后端已可独立运行并通过 Stable Observation 验证（冷启 ~1.1s 到 `/api/v1/health` 200，仅绑 `127.0.0.1`）。**先用起来**比先定壳更有信息量。

### 2.4 开发期运行方式

`vite dev` 直连 `http://127.0.0.1:<PORT>/api/v1`（端口由后端启动参数决定，前端通过环境变量注入 base URL）。**不开 CORS 通配**：开发期用 Vite proxy 或后端既有 CORS 配置，不在本 ADR 内放宽后端安全设置。

---

## 3. UI 技术栈：React 19 + Vite + TypeScript

### 3.1 决策

- **React 19**（当前 stable 主线；不锁定 patch 版本，以安装时 stable 为准）
- **Vite**（构建/开发服务器）
- **TypeScript**（`strict: true`）

### 3.2 明确不引入

| 类别 | 明确不引入 |
|---|---|
| CSS 框架 | Tailwind（含 Tailwind UI） |
| 组件库 | Material UI / Ant Design / Chakra / shadcn 全家桶 |
| 图标库 | lucide-react 等 |
| 路由 | react-router（MVP 为单页工作区，无平级 tab / 无 Dashboard，路由需求出现时另立决策） |
| 状态管理 | 暂不引；若确需，唯一候选为 Zustand（与 `ADR-013 §2.11`「保持：React + 纯 CSS + Zustand」一致） |

**注**：以上排除项与 `ADR-013 §2.11 Dependency Policy` 完全同向，本 ADR 不与其冲突。

### 3.3 与历史冻结表的关系

`AGENTS.md §9` 冻结表仍写「React · TypeScript · Vite · Zustand · TipTap · React Flow · KaTeX · … · Tauri(M6 起) · dagre」。本 ADR：

- **继承**：React / TypeScript / Vite / Zustand（版本升级到 React 19 属同一技术线，不视为替换）；
- **解除**：TipTap（见 §4）· React Flow / dagre / KaTeX / 自研 Canvas 2D（属 Mindmaps / Universe / Visual Engine，均在 MVP 外，届时按需另立决策，不预设引入）；
- **改写为待定**：Tauri（见 §2「壳延后」与 §12）。

`AGENTS.md §9` 的对应改写**不在本 ADR 自动执行**，列入 §10.3 待授权清单。

---

## 4. Editor Decision：CodeMirror 6 源码模式

### 4.1 硬约束（来自 `PRODUCT_PRINCIPLES` 原则 2）

> **Markdown 优先**。编辑器产出只能是派生物，不能成为事实源。

vault 中的 `.md` 是唯一事实源（ADR-001）。编辑器必须保证：**用户所见的文本 = 落盘的文本**。

### 4.2 决策

- 编辑器 = **CodeMirror 6**，**源码模式（source mode）**。
- **MVP 不做 WYSIWYG / 富文本所见即所得。**
- 渲染预览（如需）为只读派生视图，不回写、不产生第二种文档表示。

### 4.3 为什么不是 TipTap（同时也是 B-3 的封口）

| 维度 | CodeMirror 6 | TipTap + tiptap-markdown |
|---|---|---|
| 事实源 | 源码即事实，**100% 保真** | Markdown 是 extension，序列化**有损**，往返会重写用户文本 |
| 与原则 2 | 一致 | 冲突（编辑器内部表示成为第二事实） |
| 定位 | 代码/文本编辑器，天然 Markdown-first | 富文本编辑器，Markdown 为导入导出格式 |
| 治理位置 | 无历史包袱 | 正是冻结项 **B-3**（`tiptap-markdown` / `markdown-it`）所在位置 |

**B-3 状态（Owner 2026-09-05 裁决）**：`Superseded by F0 Editor Decision`——新前端不采用 TipTap 与 `tiptap-markdown` 作为编辑器基础。

其他候选处置：Milkdown（Markdown-first 但 bus factor = 1，维护风险）· Lexical（富文本内核，同 TipTap 的有损问题）· BlockNote（更重，且非 Markdown-first）→ 均**否决**，MVP 不评估。

### 4.4 未来 WYSIWYG 的准入条件（不承诺做）

仅在同时满足以下全部时才可另立决策：① MVP 已完成并被真实使用验证；② 提出可验证的往返保真方案（不改写用户既有 Markdown）；③ 明确它是**可选视图**而非默认模式。**在此之前 WYSIWYG 是冻结话题。**

---

## 5. API Contract：OpenAPI → `openapi-typescript`（types-only）

### 5.1 决策

- 契约来源 = 后端运行时生成的 `/openapi.json`（本地进程，**无外网**）。
- 生成工具 = **`openapi-typescript`**，产物为**单一 `.d.ts` 类型文件**（types-only）。
- 生成命令在开发期手动执行，产物提交（便于 review 契约漂移）。

### 5.2 为什么不是 operationId 型 SDK（hey-api / orval / Kubb）

**实测事实**：102/102 个 operation 都有 operationId，但全部是 FastAPI 自动生成的 `<Python函数名>_<path>_<method>` 形态（例：`list_notes_api_v1_notes_get`），后端**未配置 `generate_unique_id_function`**。

推论：此类 SDK 会把 **Python 函数名**固化为前端调用名。重命名一个 Python handler → 前端 API 静默变更，且无类型错误提示。这直接违反 L2（契约单向）与「前端不得绑架后端命名」。

规模对比（资料包调研）：openapi-typescript 产出 **1 个文件**；hey-api 16；Orval 2,719；Kubb 3,877。

### 5.3 不采用 `openapi-fetch` / `openapi-react-query`

两者已进入 maintenance mode。且我们需要的只是一个薄 wrapper（见 §6），引入运行时依赖不划算。

### 5.4 后端可选改进（登记，不承诺、不阻塞）

后端配置 `generate_unique_id_function` 使 operationId 稳定化，属于**独立后端任务**，须单独授权单独 commit。**不阻塞 F0**：types-only 方案不依赖 operationId。

---

## 6. 网络层：自写最小 fetch wrapper（~50 行）

### 6.1 决策

自写一个约 50 行的 `client.ts`，职责仅限：

1. 从环境变量读取 base URL（`VITE_API_BASE`，默认 `http://127.0.0.1:<PORT>/api/v1`）；
2. 设置 `Content-Type: application/json`；
3. 非 2xx 抛出类型化错误；
4. 把后端统一错误契约 `{"error":{"code","message"}}` 解包成 `ApiError { status, code, message }`；
5. 提供泛型 `get/post/patch/delete`，返回类型由 §5 生成的类型约束。

**禁止**在 wrapper 内做：重试策略、缓存、请求去重、业务态推断、本地持久化。这些属 L1/L3 越界，需要时另立决策。

### 6.2 依据

后端错误契约已实测统一为 `{"error":{"code","message"}}`（Stable Observation ①）。wrapper 只做解包，不发明新语义。

---

## 7. 目录边界：`frontend/`

### 7.1 决策

新前端唯一根目录 = 仓库根下 **`frontend/`**。不复用 `web/`，不创建 `shared/`。

### 7.2 允许的内部结构（草案，实现时可在内部调整）

```
frontend/
  index.html
  package.json          # 唯一新增 package.json
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx
    api/
      schema.d.ts       # 生成物：openapi-typescript 输出
      client.ts         # 自写 ~50 行 wrapper
    features/           # notes / search / concepts / mastery / review / tutor
    components/         # 仅功能组件（AGENTS §16 / ADR-013 约束）
    styles/
```

### 7.3 禁止清单

- ❌ 在 `frontend/` 内实现业务规则：SM-2 / mastery 计算 / 图谱算法 / 概念抽取 / 同步协议（L1、L3）
- ❌ 直连 SQLite、读写 vault 文件系统、直连 AI provider（L3）
- ❌ 引入第二套 TS 类型契约目录（L2）
- ❌ 把 `frontend/` 之外的仓库目录当作前端产物输出位置
- ❌ 在业务代码中调用 shell 专有 API（H3）

### 7.4 后端侧影响

**零。** 后端不托管前端产物，`main.py` 不新增 `StaticFiles`。前端与后端是**两个进程**，通过 HTTP 通信——这也是 §12 Future Host 可平移的基础。

---

## 8. MVP Feature Boundary（冻结）

### 8.1 In-scope（6 项，冻结）

| # | 能力 | 主要端点（实测路径） |
|---|---|---|
| 1 | **Notes** 笔记读写 | `GET/POST /api/v1/notes` · `GET/PATCH/DELETE /api/v1/notes/{note_id}` · `GET /api/v1/notes/tree` · `GET /api/v1/notes/{note_id}/link-suggestions` |
| 2 | **Search** 检索 | `GET /api/v1/search` · `GET /api/v1/knowledge/suggest` |
| 3 | **Knowledge / Concept** 概念 | `GET/POST /api/v1/concepts` · `GET/PATCH/DELETE /api/v1/concepts/{concept_id}` · `GET /api/v1/concepts/domains` |
| 4 | **Mastery** 掌握度 | `GET /api/v1/mastery` · `GET /api/v1/mastery/{concept_id}` · `POST /api/v1/events` · `GET /api/v1/mastery/weak/list` |
| 5 | **Review** 复习 | `GET /api/v1/review/today` · `POST /api/v1/review/{concept_id}/answer` · `GET /api/v1/review/history` · `GET /api/v1/review/stats` |
| 6 | **Tutor Context** 导师上下文 | `POST /api/v1/tutor/context` · `GET /api/v1/tutor/context/{concept_id}` |

### 8.2 Out-of-scope（7 项，明确排除）

Mindmaps · Sync · Chat / AI 生成 · Memories · Universe · Attachments upload · Admin

排除理由统一为：**不属于「验证 Backend 学习闭环可被消费」的最小集**。它们各自对应已存在的后端能力与设计 ADR（见 §10），保留实现权利，但**不在本次解冻**。

### 8.3 硬要求：无 AI provider 时闭环仍可用

> **AI provider 不存在（未配置 / 不可用）时，MVP 的核心学习闭环（笔记 → 检索 → 概念 → 掌握度 → 复习）必须仍然完全可用。**

落地含义：

- 依赖 LLM 的端点（`POST /api/v1/tutor/test` · `POST /api/v1/concepts/extract` · `/chat` · `/trace/run`）**不得**出现在 MVP 关键路径上；
- Tutor Context 走**非生成路径**（`POST /api/v1/tutor/context` 组装上下文），无 provider 时降级为「有上下文、无生成」而非整体不可用；
- 任何 AI 依赖必须**显式标注降级态**，不得静默失败或阻断主流程。

> 这是产品要求，不是实现细节。后端 AI 降级策略本身仍是**待裁决项**（Stable Observation ④ 遗留），但**不阻塞** MVP，因为 MVP 的 6 项能力均不依赖生成。

### 8.4 变更规则

MVP 范围**只能被 Owner 显式扩展**。实现过程中发现的「顺手能做的事」一律登记不实施。

---

## 9. Backend Gap Classification（措辞统一）

Stable Observation ③ 发现 3 项契约/校验级缺口。Owner 已裁定其**性质与措辞**，本节为正式登记。

### 9.1 措辞铁律

> **不得**把这三项称为「Frontend prerequisite / 前端前置阻塞」。
> 它们**不构成 F0 的阻塞项**，不得以此为由推迟或扩大前端决策。

### 9.2 缺口登记

| # | 缺口 | 实测行为 | 分类 | 处置 |
|---|---|---|---|---|
| E1 | `quality` 无范围校验 | `quality=99` → 200，按答对处理 | **Backend Input Validation Follow-up** | 后端补 0–5 范围校验；**单独 commit、单独授权** |
| E2 | `event_type` 无枚举 | 未知值 → 201，维度不变（静默无操作） | **Backend Input Validation Follow-up** | 后端补枚举校验 + 错误返回；**单独 commit、单独授权** |
| E3 | `concept → notes` 无一等回读 | `GET /concepts/{id}` 不含 notes | **非缺陷**（设计取舍） | **暂不修**；MVP 走 `GET /api/v1/knowledge/suggest`（GET 语义 + 带 snippet/score）。canonical 端点登记为可延后后端任务 |

### 9.3 前端校验与后端校验的关系（Owner 明确）

> **前端可以先做 UI validation，但这不能替代 backend validation。**

即：前端输入校验是**体验层**，E1/E2 的后端校验是**契约层**，二者不可互相抵消。前端做了校验**不减少**后端补校验的必要性。

### 9.4 与 P2 的关系

E1/E2 **不并入 P2**。P2 五项继续冻结（见 `MEMORY.md` §3）。E1/E2 建议随「前端首个后端任务」执行，但仍须**独立授权 + 独立 commit**。

---

## 10. 历史前端 ADR 统一处置矩阵

**本矩阵取代逐条修订。** 除明确标注「本 ADR 修订」者外，其余条目**不改状态行、不改正文**，仅声明其与新前端的关系。

### 10.1 矩阵

| ADR | 标题 | 现行状态（原文） | F0 处置 | 理由 |
|---|---|---|---|---|
| 001 | Storage（Markdown/vault） | Accepted | **保留** | 后端侧；L1 的法律依据 |
| 005 | Multi-device Sync | Accepted | **保留** | Sync 排除 MVP，ADR 本身不变 |
| 006 | 移动端技术栈 RN + 混合内核 | **Superseded as primary route; retained as fallback** | **部分重裁** → 见 §11.1 | M8 = Tauri 2 Mobile 前提失效 |
| 007 | d3-force | **Superseded（2026-09-02）** | **无动作** | 已失效 |
| 012 | Context-Aware Knowledge Assistance | 已批准（2026-08-26） | **保留原则 · 解除实现绑定** | 产品/交互原则有效；实现载体已消失；Omniscience 不在 MVP |
| 013 | Frontend Design System | 已批准（2026-08-27） | **保留为原则 · 解除实现绑定 · 不标 Superseded** → 见 §11.2 | 视觉/设计原则继续约束新前端；`web/src` 引用失效 |
| 014 | AI Tutor Architecture | 已批准 | **保留** | 后端侧已实现 |
| 015 | Multilingual | 已批准 | **保留 · 无动作** | 后端侧 |
| 016 | Tutor UI Design | 已批准 | **保留原则 · 解除实现绑定** | Tutor Context 在 MVP 内，但**具体布局不回填**；重画按 ADR-013 + §8.3 降级要求 |
| 017 | Architecture Visualization | 已批准 | **保留 · 不在 MVP** | 可视化需求出现时另立 |
| 018 | Knowledge Universe | **Superseded（2026-09-02）** | **无动作** | 已失效 |
| 019 | MindMap Boundary | **Approved · 2026-08-27** | **保留边界原则 · Mindmaps 排除 MVP** | 边界语义仍有效（系统生成 vs 主动整理） |
| 020 | Sync Truth Model | Accepted | **保留** | 后端侧 |
| 021 | MindMap Exchange Format v1 | **Approved · 2026-08-27** | **保留格式 · 前端实现延后** | 后端已实现交换格式；前端不在 MVP |
| 022 | Product Mode Boundary | **Accepted · 冻结** | **保留（继续约束前端）** | 禁 XP / streak / 游戏化对新前端依然有效 |
| 023 | Visualization Boundary | 冻结 | **保留 · 不在 MVP** | 形状即语义（Note 方 / Concept 圆）在可视化进入时生效 |
| 024 | Note Hierarchy 主/副笔记 | 已批准（2026-09-01） | **保留 · 前端树延后** | 后端已实现；层级树 UI 不在 MVP |
| 025 | Visual Engine V1 | **Accepted（M9 已关闭）** | **保留 · 不在 MVP** | Trace 可视化延后 |
| 026 | Note Hierarchy Tree | **Accepted v3** | **保留设计 · 前端实现延后** | 「默认展开 3 层 + 懒加载 + localStorage 偏好」仍为有效设计输入，但**不进 MVP** |
| 027 | Chinese FTS bigram | Accepted | **保留** | 后端侧 |
| 028 | Document Revisions | **已接受并封口** | **保留 · ② 仍为独立任务** | 「前端 revision/history/diff UI」**不因本 ADR 自动解冻**；ADR-028 明确「不得因存在 ② 而解释为前端解冻」 |

### 10.2 「解除实现绑定」的准确含义

对标注该词的 ADR（012 / 013 / 016）：

- ✅ **继续有效**：产品意图、设计原则、视觉规范、禁止清单、边界语义；
- ❌ **不再有效**：文中指向 `web/src/...` 的具体文件路径、组件名、接线状态、已消失代码的事实陈述；
- 🚫 **不因此判定 ADR 失效或需重写**：历史文本保持原样（provenance 保护，与 `[26]-D` Gate B 同一原则）。

例：`ADR-013 §2.12` 的冲突登记引用了 `web/src/global.css`（已不存在）。本 ADR **不重开 §2.12**（Owner 已裁定「维持现状 + 记录」，且 B-6 为独立待裁项），仅记录：**该冲突的实现载体已随旧前端消失，新前端按 §2.7 原则执行**。

### 10.3 需单独授权才能修改的文档条款（本 ADR 不自动执行）

| 位置 | 原文要点 | 拟改方向 |
|---|---|---|
| `AGENTS.md §9`（L232–236） | 冻结表列 TipTap / Tauri(M6 起) / dagre / React 18 等「当前生效」 | 按 §3.3 / §4 / §12 重写前端相关条目 |
| `AGENTS.md §12`（L304, L314） | 「四层职责固定 **Frontend(web/)**」+「响应形状以 `shared/types/*.ts` 为唯一契约」 | Frontend 层改 `frontend/`；契约条款改为「以后端 OpenAPI 为唯一契约，前端生成类型消费」 |
| `AGENTS.md §16`（L453–457） | 指向 ADR-013 | 保留指向，补充 ADR-029 |
| `PROJECT_BRIEF §7` | Tauri 2 sidecar + React 18 + TipTap v3 | 按 §2 / §3 / §4 更新 |
| `AGENTS.md §10`（L258–260） | Backend-First，`P8-FE-001` 无限期冻结 | 解冻条件与 F0 的关系待 Owner 定义 |

**以上均须 Owner 单独授权 + 独立 docs-only commit。**

---

## 11. 三个明确状态裁定

### 11.1 ADR-006（移动端技术栈）

**现状**：状态行 `Superseded as primary route; retained as fallback`，正文写「M8 主路线改为 Tauri 2 Mobile——**conditional on M8-000 spike**」「M8 全线暂停，PC Stable Baseline 优先」「本 ADR 的引擎策略三选一与编辑分级仍然有效，框架无关部分可平移」。

**裁定**：

1. **「M8 = Tauri 2 Mobile」这一前提失效**——F0 已决定桌面壳延后且 Tauri 2 仅为候选，Mobile 不能再以「Tauri 2 桌面壳的延伸」形式成立。
2. **Desktop 与 Mobile 拆开**：本 ADR（ADR-029）只覆盖 **Desktop Web Consumer**；Mobile 是**独立议题**，不在 F0 范围。
3. ADR-006 中「引擎策略三选一」「编辑分级」「框架无关部分可平移」等**与框架无关的裁定维持有效**；其中「TS 移植版 SM-2 双实现 + pytest↔vitest 一致性夹具」一节，与新前端的 **L1（Truth 单向 / 前端不重算业务状态）冲突** → 若未来重启 Mobile，**该节须重裁**，不得直接沿用。
4. M8 维持暂停。

**ADR-006 状态行不改**（保持 provenance），本条即为重裁记录。

### 11.2 ADR-013（Frontend Design System）

**裁定**：

- **保留**：作为**产品/设计原则**继续约束新前端（Minimal Scientific Workspace · 白橙配色 · 禁止 gradient/毛玻璃/装饰性组件 · §2.11 禁 UI 库/图标库 · `AGENTS.md §16` 的指向关系）。
- **解除**：所有指向旧实现（`web/src/...`、19 个 `web/src/components/ui/` 组件、接线状态段）的绑定。
- **明确不标注 `Superseded`**——它是原则，不是已废弃的实现。

> Owner 原话：「保留为产品/设计原则，但解除旧实现绑定。」

### 11.3 B-3（TipTap / tiptap-markdown）

**裁定**：状态改为 **`Superseded by F0 Editor Decision`**。

依据见 §4.3。新前端不采用 TipTap 与 `tiptap-markdown`；B-3 作为 `[26]-D` 冻结项，**随本 ADR 封口**。

（注：B-3 的字面文本改动仍属 B 组待授权项，落文档动作须 Owner 单独授权。）

---

## 12. Future Tauri 2 Host Boundary（预留，当前不实现）

### 12.1 当前事实

> **Tauri 宿主现在不存在于实现中。** 本节是**边界预留**，不是实施计划，也不构成本 ADR 对未来的承诺。

### 12.2 若未来引入，边界固定为

Tauri 侧只允许做四件事：

1. 启动 / 停止 / 监控 Python 后端 sidecar 进程；
2. 把后端监听端口注入前端（环境变量或启动参数）；
3. 窗口、托盘、菜单、文件关联等 OS 集成；
4. 应用打包与更新。

**不允许**：承载业务逻辑、读写 vault、直连 SQLite、实现 API。

### 12.3 前端侧的唯一接口点

若确需宿主能力，必须集中在 `frontend/src/host/` 单一模块，且**在纯 Web 下必须有 fallback**。业务代码中出现宿主 API 调用即视为违反 H3。

### 12.4 重裁触发条件（满足任一才启动评估）

- 本地 Web 形态已被真实日常使用验证（不是"能跑"，而是"在用"）；
- 出现明确的 OS 集成需求（单窗口、托盘常驻、开机自启、`.md` 文件关联、离线协议 handler）；
- 分发/安装体验成为主要摩擦点。

在此之前，**壳是关闭话题**。

---

## 13. 明确禁止恢复 `web/` 与 `shared/types/`

| 禁止项 | 说明 |
|---|---|
| ❌ 恢复 `web/` 目录 | 旧前端实现已断代，不存在恢复动作；任何「先把 `web/` 拿回来改改」的方案一律否决 |
| ❌ 恢复 `shared/types/` | 违反 L2（契约单向）。契约来源唯一 = 后端 OpenAPI + 生成类型 |
| ❌ 手写第二套 TS 类型契约 | 同上 |
| ❌ 以「同步类型」名义修改后端响应形状 | 需求走后端任务，不是前端改契约 |

`AGENTS.md §12` 中「响应形状以 `shared/types/*.ts` 为唯一契约」一句**因此必须改写**（拟改为「以后端 OpenAPI 为唯一契约，前端生成类型消费」），但改写动作须 Owner 单独授权（§10.3）。

> 在新条款生效前，执行冲突时以**本 ADR §5** 为准，并以「该目录不存在」作为事实依据。

---

## 14. 本 ADR 不授权实现

### 14.1 明确不做

1. 不创建 `frontend/` 目录；
2. 不执行任何 `npm` / `pnpm` / `yarn` 安装；
3. 不写任何前端代码、配置、脚手架；
4. 不修改 `AGENTS.md` / `PROJECT_BRIEF` / 任何既有 ADR（§10.3 为待授权清单，不是授权）；
5. 不修复 E1/E2/E3（§9）；
6. 不处理 P2 五项 / B-1~B-9 / G-1（B-3 状态已裁定，但落文档仍待授权）；
7. 不产生任何 commit。

### 14.2 生效条件

Owner 确认本 ADR（转 **Accepted**）后，才进入下一步。下一步的**建议**顺序（届时另立任务，不在本 ADR 授权内）：

```
① §10.3 文档条款对齐（docs-only 独立 commit，需授权）
② E1/E2 后端输入校验补齐（独立 commit，需授权）
③ frontend/ 脚手架 + 契约生成（首次 npm install，需授权）
④ MVP 六项能力逐个实现（逐项验收，不批量）
```

### 14.3 Owner 需要给出的确认

- [x] §0.3 Consumer 三定律（L1/L2/L3）是否认可为本 ADR 的硬边界
- [x] §2 / §3 / §4 / §5 / §6 / §7 六项技术决策是否照此定稿
- [x] §8 MVP 六项 in-scope 与七项 out-of-scope 是否冻结
- [x] §8.3「无 AI provider 时闭环仍可用」是否作为验收硬条件
- [x] §10 处置矩阵是否取代逐条修订（尤其 013 不标 Superseded）
- [x] §10.3 文档条款是否授权对齐（若授权，作为独立 docs-only commit 执行）
- [x] 是否转入 §14.2 的下一步

> 以上七项已于 2026-09-05 由 Owner 在 F0-GATE 逐项确认（含 §10.3 文档对齐授权）。

---

## 附录 A：决策依据（可验证事实，2026-09-05 复核）

| # | 事实 | 验证方式 |
|---|---|---|
| A1 | 仓库内前端残留为零（无 `package.json` / `*.tsx` / `vite.config*` / `tsconfig*`） | `find` 复核 |
| A2 | 后端无 `StaticFiles` / `HTMLResponse`；仅 attachments 用 `FileResponse` | grep `app/` + `routers/` |
| A3 | OpenAPI = **102 operation / 82 path** | 运行时 `/openapi.json` |
| A4 | 102/102 operation 有 operationId，但为 `<Python函数名>_<path>_<method>`；未配 `generate_unique_id_function` | 解析 OpenAPI |
| A5 | 后端可独立运行，冷启 ~1.1s 到 `/api/v1/health` 200，仅绑 `127.0.0.1` | Stable Observation 真实进程 + 真实 HTTP |
| A6 | 错误契约统一 `{"error":{"code","message"}}` | Stable Observation |
| A7 | `quality=99` → 200 按答对；`event_type` 未知值 → 201 静默无操作 | Stable Observation 探针 |
| A8 | `GET /api/v1/search` 仅 `{note_id,title}`；`GET /api/v1/knowledge/suggest` 带 snippet + score | Stable Observation |
| A9 | MVP 端点路径（§8.1）取自 `server/app/routers/*.py` 的 `APIRouter(prefix=...)` + 装饰器 | 源码 grep |
| A10 | `AGENTS.md §9`（L232–236）/ §12（L304, L314）/ §16（L453–457）、`ADR-013 §2.11` / §2.12、`ADR-006` 状态行为原文引用 | 逐条 grep + 行号 |

资料包：`.workbuddy/artifacts/f0-frontend-architecture-brief.md`；观察报告：`.workbuddy/artifacts/stable-observation-report.md`。

## 附录 B：与 `[26]-D` 的方法论关系

`[26]-D` 的教训：逐条发现 drift 会无限循环，治理边界持续扩张。本 ADR 采用的对应改进：

1. **一次性总纲**取代逐条修订（§10 矩阵）；
2. **provenance 保护**：历史 ADR 状态行与正文不改，只在矩阵中声明关系（与 Gate B 同一原则）；
3. **待授权清单与执行分离**（§10.3、§14.1）——本 ADR 只登记，不执行；
4. **冻结即冻结**：MVP 外的一切不因"顺手"进入（§8.4）。
