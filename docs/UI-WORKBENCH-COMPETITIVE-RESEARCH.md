# UI-WORKBENCH-COMPETITIVE-RESEARCH — 竞品工作模式研究（Phase 3.5）

日期：2026-09-07 · 性质：真实网络研究（全部来源实际访问）
方法：External Pattern → Why it works → OLOS user problem → OLOS adaptation → **Keep / Modify / Reject**（禁止拼盘）
前轮已研究并沿用：Apple（Split Views/Searching/Materials）、VS Code（Custom Layout/Peek）、Zotero（PDF Reader）——详见 `UI-WORKBENCH-IA.md`。

---

## 1. 各产品研究纪要

### Obsidian（help.obsidian.md tabs/backlinks/pane layout）

- **Tabs**：多 tab + tab group，可堆叠（Stacked tabs，灵感来自 Andy Matuschak sliding notes）；**Pinned tab**："links in a pinned tab always open in another tab"——钉住即不再被点击顶掉。
- **Linked views（关键模式）**："Linked views are tabs that reference another tab. **When the referenced tab's content changes, the linked view updates as well.**" Backlinks/Outline/Local Graph 都可作为 linked view 打开，跟随活动笔记。
- **Panes**：Cmd/Ctrl+Click 在新 pane 打开（对 file explorer/backlinks/search/graph 全适用）；pin pane = "never gets replaced even when it's active"；linked panes 同步滚动/同步打开同一文件；布局与尺寸跨会话记忆；Workspaces 插件保存/还原布局。
- **Backlinks**：跟随活动 tab 更新；"Links to here" + "Unlinked mentions" 两节；可 open linked backlinks pane 钉住特定笔记的回链。

### Tana（tana.inc/docs/navigation）

- **Tabs vs Panels 的语义区分（关键模式）**：
  > "Tabs... makes it easy to look up something or **switch context, while preserving the view you were working on**."（tab = 另一个工作流）
  > "Multiple panels can be opened in a tab, to work on things **side-by-side**."（panel = 同一工作流内的另一个对象）
- 交互动词化：`Cmd+Click` 开新 tab、`Shift+Click` 开新 panel、`Cmd+S` 打进焦点 panel——**打开行为本身区分了对象的生命周期层级**。
- Panels 独立滚动、独立调宽、sticky 工具栏；侧栏 Pinned 区固定常用节点。

### Notion（releases / side peek）

- **三档打开方式**："side peek, center peek, or open as full page"，且可**按视图设默认**（"Open pages as" per-view default）。
- Side peek 的价值：编辑右侧页面时"keep your database items visible and interactive on the left"——**列表与详情同屏共存**。
- 三档可临时切换（面板左上角图标），默认与临时分离。

### Capacities（docs.capacities.io backlinks / networked note-taking / release-59）

- **Backlinks 带上下文**："Backlinks are shown **with context** so you can inspect where the reference comes from and decide whether to open the source object."——不是链接计数器，是重访思考的入口。
- **Unlinked mentions**：发现"写过但没链"的潜在连接；升级判据："**link for meaning, not for volume**"。
- **Local graph per object**（无全局图谱）："Explore in the right side panel"——图谱跟随对象。
- **对象生命周期实证**：highlight → link to concept/definition object → backlink review → synthesis；"promote a highlight into an object"（高亮升级为独立对象）。
- **AI context**：选多个对象作为 AI 上下文，**"their linked objects (backlinks) are automatically added to the context too"**，回答附来源链接。

### Bear 2.9（blog.bear.app Workspaces）

- **Tag as Workspace**："Bear shows only the notes under that tag. The Sidebar shows only the tags related to it... **Everything else steps aside, the world is now zoomed in on exactly what you need right now.**"
- 整个界面（列表/侧栏标签/搜索/归档/废纸篓）都被 workspace 过滤；workspace 菜单快速切换（Pinned/Recent）；退出即回全量视图。

---

## 2. Competitive Pattern Matrix

评级：● 强实现 · ◐ 有但弱/变体 · ○ 无。OLOS 列 = 本轮裁定（§4）。

| Pattern | Apple | VS Code | Obsidian | Tana | Notion | Zotero | Capacities | Bear | **OLOS 裁定** |
|---|---|---|---|---|---|---|---|---|---|
| Split / 并置 | ●(split view) | ●(groups/grid) | ●(panes) | ●(panels) | ○ | ◐(双窗) | ○ | ○ | **Adopt**（S3 单层二级，对象语义） |
| Peek | ◐(sheet) | ●(inline peek) | ○ | ○ | ●(center peek) | ○ | ○ | ○ | **Adopt**（Knowledge Peek） |
| Pin | ◐ | ●(pinned tabs) | ●(pinned tab/pane) | ◐(sidebar pin) | ○ | ○ | ○ | ◐(pinned tags) | **Modify**（并入"副对象固定态"，不单设 UI） |
| Search | ●(scope/primary) | ●(palette+search) | ◐ | ●(Cmd+S→panel) | ● | ◐ | ◐ | ◐ | **Adopt**（三层，§Search Model） |
| Context 随对象 | ◐ | ○ | ●(linked views) | ◐(references 区) | ○ | ◐ | ●(local graph) | ○ | **Adopt**（Context Pane 绑对象） |
| Annotation 双向锚定 | ○ | ○ | ○ | ○ | ◐(comments) | ●(Show on Page) | ◐(highlights) | ○ | **Adopt**（边注层四层级） |
| Backlinks 带上下文 | ○ | ○ | ◐(有 snippet 开关) | ◐(references) | ○ | ◐ | ●(with context) | ○ | **Adopt**（source+snippet+relationship） |
| Focus / Scope | ◐(hide panes) | ●(Zen) | ◐ | ◐ | ○ | ○ | ○ | ●(workspace 过滤) | **Modify**（Focus=状态机 S4；Scope 列 Phase 4 提案） |
| Tabs | ○ | ● | ● | ● | ○ | ◐(tabs) | ○ | ○ | **Adopt**（WorkbenchTabs=另一工作流） |
| Panels 常驻 | ●(secondary) | ● | ●(sidebars) | ● | ●(side peek) | ○ | ●(side panel) | ○ | **Modify**（Context 非常驻，按任务开） |

## 3. WHY——每个被采纳模式的成立理由

| Pattern | Why it works |
|---|---|
| Peek | 临时查看不付 context switch 代价（VS Code 原话）；知识工作里"看一眼概念"频率极高 |
| 并置 | 比较两个对象时，切换成本高于分屏成本（Tana panels 场景）；左边研究对象 + 右边任何对象 |
| Linked view | Backlinks/Outline 的价值依赖"跟随当前对象"（Obsidian linked view；Capacities local graph） |
| Pin/Lock | 固定的 pane 让"打开新对象"有确定落点，布局不被冲散（VS Code locked group；Obsidian pin） |
| Backlink context | 只有 source+snippet 才能唤起"我当时为什么链它"（Capacities） |
| Tag/Scope Focus | 学习高度依赖范围（一科一考）；整界面过滤比"隐藏侧栏"更强（Bear） |
| 打开动词分级 | Cmd=tab / Shift=panel / click=replace——用输入动作表达对象生命周期（Tana） |
| 按视图默认打开方式 | 不同对象类型需要不同默认（Notion side/center/full per view） |

## 4. 裁定汇总：Adopt / Modify / Reject

**Adopt（原样吸收）**
1. Peek 优先原则（查看≠打开）。
2. Linked view 语义——Context Pane 绑定"当前对象"而非绑定页面。
3. Backlinks 带 source+snippet+relationship。
4. 三层搜索 + 单一入口 + scope 显式。
5. 打开动词分级（click=替换 / ⌘=tab / ⇧=并置——Tana 模式 [C] 快捷键具体值可调）。
6. 按对象类型设置默认打开方式（Notion per-view default 转译）。

**Modify（改造后吸收）**
1. Split Editor → **Compare Workspace（并置工作区）**：第二 pane=第二工作对象，仅单层二级。
2. Pinned tabs + locked groups → 合并为"副对象固定态"（副 pane 永不被导航顶掉），不暴露独立 pin UI。
3. Bear Workspace → **Focus Mode（S4）** 采用其"整界面随范围收缩"思想，但 OLOS 的 Focus 保留最小上下文（§Page Composition）；tag/hierarchy scope 列 Phase 4 提案（后端需 scope 查询参数，不动现有契约）。
4. Notion per-view default → **按对象类型默认打开方式**（Note 链接=Peek；搜索结果=Peek；Graph 节点=Context 聚焦…）。
5. Capacities AI context → **Tutor 上下文自动并入对象回链**（与既有 tutor context builder 对齐，仅描述层增强）。

**Reject（明确不做）**
1. VS Code 网格 editor layout / 浮动窗口——IDE 需求，知识工作 S3 已覆盖。
2. Obsidian 无限 pane 链 / linked pane 同步滚动——复杂度>收益，文档型协作才会用。
3. Tana `Cmd+S` 打进焦点面板的搜索语义——与系统保存直觉冲突。
4. Capacities 式"万物皆对象"重构——OLOS 的对象模型已由 notes/concepts 构成，不做元模型改造。
5. 全局图谱 vs 局部图谱之争——OLOS 保留 Universe（全图）+ Context 聚焦（局部），两者本就分层。
6. 高亮"升级为对象"（Capacities promote）——OLOS 中概念已是对象，批注→概念链接即可，不引入新实体。

---

## 5. 反向审查（指令书 §49）

- **Apple 适合**：hide/show pane、thin divider、多宽度适配、scope 显式。**不适合**：把 sheet 当 peek（模态太重）。
- **VS Code 直接借**：locked group、preview/pinned 语义、Peek-Esc。**IDE-specific 拒绝**：网格、终端即 editor、CodeLens 类内联信息。
- **Obsidian 采用**：linked view 跟随、pin 语义。**非必需**：任意拆分无限嵌套、stacked tabs（美学强但信息密度低）。
- **Notion 采用**：三档打开 + 按对象默认。**不采用**：块数据库模型。
- **Tana 采用**：tab=工作流 / panel=对象的语义区分与打开动词分级。**不采用**：desktop-only tabs 限制。
- **Zotero 最有价值**：Show on Page 回跳 + 批注→笔记带引文。
- **Capacities 最有价值**：backlink context snippet + "link for meaning" + AI 上下文并入回链。
- **全部拒绝**：见 §4 Reject 清单。

## 6. 产品差异化回答（指令书 §45）

> 为什么不用 Obsidian/Notion/Tana/Zotero/VS Code+Markdown？

不是 UI 漂亮。是这五者都停在"信息管理"，OLOS 的链路是：

```text
Read → Annotation → Concept → Mastery(4D+decay) → Review(SM-2) → Tutor
```

- Obsidian/Tana/Capacities：链路止步于 **link**（回链上下文），没有掌握度模型、没有调度复习、没有绑定对象的 Tutor。
- Notion：无双向链接深度、无学习语义。
- Zotero：研究链路最强，但止步于 **note**，不进入 learning memory。
- **OLOS = 把这条链做进日常阅读/写作/研究的工作模式本身**（批注→概念→复习全部在 Workbench 内零切换完成）。这是唯一不能被上述产品组合替代的部分。
