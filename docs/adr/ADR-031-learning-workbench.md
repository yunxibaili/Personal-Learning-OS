# ADR-031: Learning Workbench（自适应学习工作台）

日期：2026-09-07 · 状态：**Accepted**
依据：`docs/UI-WORKBENCH-IA.md` · `UI-WORKBENCH-COMPETITIVE-RESEARCH.md` · `UI-WORKBENCH-WORKFLOW-MODEL.md` · `UI-WORKBENCH-DESIGN-DECISIONS.md` · `UI-WORKBENCH-PAGE-COMPOSITION.md`（Phase 3/3.5 设计冻结）
裁定：项目所有者（Phase 3.5 验收通过 + 设计全权委托，唯一硬约束：颜色简约）

---

## Context

v0.3 的 `frontend/` 是"一个 tab 一个页面"的 Consumer（ADR-029），每个后端能力各占一页。
Phase 3.5 竞研（Apple Split View、VS Code editor groups/locked groups/Peek、Obsidian linked views、
Tana tabs vs panels、Notion side peek、Zotero Show on Page、Capacities backlink context、Bear Workspace）
共同指向同一问题：**人在处理一个核心对象时，相关信息应该靠近但不打断核心对象。**

同时，OLOS 的产品差异化在于学习链路 **Annotation → Concept → Mastery → Review → Tutor**
必须能在工作台内零切换完成，而不是分布在不同页面。

## Decision

采纳 **Adaptive Learning Workbench**：一个 Workbench，pane 按任务动态组织。以下为本 ADR 冻结的架构原语与决策：

### 架构原语（后续一切 UI 的推导起点）

```text
Workbench · Work Object · Context · Peek · Compare · Focus · Search Scope
```

### 冻结决策（Phase 3.5 验收确认）

1. **Context ≠ Inspector**：Context 回答"这个对象与我的学习任务有什么关系"
   （Related/Backlinks/Mastery/Review/Mistakes/Annotation/Tutor），**不全部常驻**——
   三档密度 Minimal/Standard/Research 按对象类型与任务自动选档（DECISIONS D5）。
2. **第二 Pane = 第二 Work Object（Parallel Knowledge Work）**：不叫 Split Editor、
   不退回编辑器复制思维。功能名 **Compare Workspace（并置工作区）**，槽位语义天然 locked
   （新对象只进 Work Surface——VS Code locked group 转译）。
3. **对象生命周期 = Peek → Context → Pinned → Tab 四态，UI 载体三个**：
   PeekPanel（浮层查看）/ ContextPane（跟随焦点）/ WorkSurface（primary+并置槽位）。
   Pin 不设独立 UI——并置位即固定态（VS Code locked group、Obsidian pin 语义合并）。
4. **Search = 一个系统，多个 Scope**：L1 Global（⌘K，↑↓ 预览不替换当前阅读）、
   L2 Workspace（Explorer 内过滤器）、L3 Document Find（⌘F 行内）。共享搜索语言与结果模型，
   UI 宿主不同（HIG Searching：单一入口 + scope 显式）。
5. **Annotation → Learning Memory**：四层级 Highlight→Annotation→ConceptLink→Learning Action，
   边注层呈现（Quiet/Normal/Research 三密度），与源双向锚定（Zotero Show on Page 语义）。
   批注持久化为 **Phase 4 提案**（需 annotations 实体），3A 以内存态验证交互模型。

### 两层模型（用户永远不见实现状态）

```text
实现层：S0 Reading / S1 Browsing / S2 Context / S3 Compare / S4 Focus（布局状态机）
用户层：我在读东西 / 我要找东西 / 我要参考另一个东西 / 我要深入理解 / 我要专注
```

UI 不暴露模式名；布局由任务动作驱动（toggle Explorer / toggle Context / Open Right / Focus）。
**默认只有 Work Surface**——Explorer 与 Context 都不是常驻（动态布局，非三栏模板）。

### 与既有 ADR 的关系

- **ADR-029**（Frontend Consumer）：本 ADR 修订其"单页工作区（平级 tab）"表述——
  Work Surface 的 WorkbenchTabs 为本地 UI state（非 URL 路由），Consumer 原则、
  三层契约、api wrapper 约束**全部维持**。
- **ADR-030**（sessionStorage 会话指针）：维持；pane/宽度等布局状态为本地 UI state，不入 canonical data。
- **ADR-013 §2.7.1**：材质服从 IA（Task→hierarchy→Layout→Interaction→Material→Motion）；
  玻璃仅限 Rail/TopBar/Palette/Peek/Popover/Sheet/Drawer 浮层；内容面（Explorer/Context/正文）raised/base。

### 验收（Phase 3A ≠ 壳工程）

3A 唯一验收标准 = **6 条真实 Workflow 可跑通**（Note→Peek→Context→Tutor；
Search→Preview→Open→Open Right；Compare→Link；Paper 选择→批注→Context（内存态）；
Note→弱概念→Review→Return；Write+Reference）。Shell 漂亮但工作流别扭 = 3A 不通过。

## Consequences

- 正面：后续 Note/Paper/Search/Annotation/Tutor/Review 均以 Work Object + Context 槽位接入，
  不再逐页设计；学习链路零切换成为产品差异化。
- 代价：`App.tsx` 平级 tab 退役（旧视图保留为工作对象渲染器/过渡入口）；前端结构重组。
- 中性：零后端契约改动；批注持久化与 Focus scope 列 Phase 4 提案。
