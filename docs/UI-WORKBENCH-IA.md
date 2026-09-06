# UI-WORKBENCH-IA — Learning Workbench 信息架构与工作流设计（Phase 3 设计稿）

日期：2026-09-07 · 状态：**IA 设计冻结草案**（Phase 3 实施依据；实施前随 ADR-031 入档）
授权：项目所有者《Learning Workbench Information Architecture》指令 + 设计全权委托（唯一硬约束：颜色简约）
研究来源（本轮实际访问）：

| 来源 | 状态 | 学到什么 |
|---|---|---|
| HIG Split Views | ✅ 全文 | pane 表达层级、可隐藏、thin divider、多宽宽适配 |
| HIG Searching | ✅ 全文（2026-06 更新） | 唯一搜索入口、scope 显式化、local search=当前视图过滤器 |
| VS Code Custom Layout | ✅ 全文 | editor groups / secondary side bar / locked group / pinned tabs |
| VS Code Code Navigation | ✅ 全文 | **Peek**："nothing worse than a big context switch when all you want is to quickly check something... we embed the result inline" |
| Zotero PDF Reader | ✅ 全文 | 批注→笔记自动带回链与引文；"Show on Page" 从笔记跳回 PDF 原位置 |
| Hypothesis | ⚠️ 站点不可达 | 依 Owner 引用 + 通用模式补记：正文高亮 ↔ 侧栏 annotation card 双向联动 |
| Readwise | ⚠️ 未直接访问 | 依 Owner 引用补记：highlight/note/tag 与原文上下文连接 |

核心研究结论（一句话）：**五个产品的共性不是外观，而是同一个问题的答案——"人在处理一个核心对象时，相关信息应该靠近但不打断核心对象"。**

---

## 1. 根本转变：页面 → 工作模式

**废除"一个 tab 一个页面"的划分**（Notes/Search/Concepts/Review/Graph… 各自成页 = SaaS 化）。
改为：**一个 Workbench，pane 按任务动态出现**。页面不再以"后端 endpoint"划分。

> [A] Apple："use a split view to show multiple levels of your app's hierarchy at once"；
> "Consider letting people hide a pane when it makes sense... Provide multiple ways to reveal hidden panes."（HIG Split Views）

**布局状态机（默认收拢，按任务展开）**：

```text
S0 默认阅读   [Rail][ Work Surface ]
S1 浏览       [Rail][ Explorer ][ Work Surface ]
S2 上下文     [Rail][ Explorer ][ Work Surface ][ Context ]
S3 并置研究   [Rail][ Work A ][ Work B ]          （Explorer/Context 可同时收起）
S4 专注       [Rail][ Work Surface ]（其他 pane 全收，含 Review Focus）
```

规则：
1. **Explorer 与 Context 都不是常驻**——按任务出现的辅助空间 [A] "hide other panes to reduce distractions"。
2. 切换入口：Rail 图标（Explorer）与 Work Surface 头部「Context」按钮（Context）；均为可逆 toggle，带快捷键。
3. pane 记忆用户上次宽度（本地 UI state，循 ADR-030 先例，不进 canonical data）。
4. 响应式收放：≥1440 三栏可全开；1024–1440 Explorer/Context 互斥展开（一个开另一个自动收）；<1024 全部收起、Work Surface 独占 [C]。

## 2. Workspace Model（工作面对象）

Work Surface 承载的"当前对象"类型：

```text
Note（阅读/编辑） · Concept · Paper（附件/PDF · Phase 4+） · Review Card（Focus）
Graph 视图 · MindMap · Algorithm Trace · Search 结果集（见 §4）
```

每种对象声明自己需要的最小布局（对象驱动 pane，而非页面驱动）：

| 对象 | 默认布局 | 建议辅助 pane |
|---|---|---|
| Note | S0 | Explorer（跳转）→ Context（学习状态） |
| Paper | S1 | Context = Annotation 层（§5） |
| Note ×2 比较 | S3 | — |
| Review | S4 Focus（Again/Hard/Good + 键盘） | 退出回原 workspace，不跳页 |
| Graph/MindMap | S0 全幅 | Context = 节点详情 |
| Algorithm | S3 变体 [Code][Viz][Inspector] | — |

> 设计含义：**"用户为什么要看到这个 Button"由任务回答**——Rail 上不出现与当前对象无关的入口。

## 3. Pane Model（并置工作区，而非 Split Editor）

**命名与语义**：第二 pane 不是"第二个编辑器"，是**第二个工作对象**。

- 主 pane = **研究对象**（正在处理的核心）；副 pane = **任何对象**：另一篇笔记、概念详情、搜索结果、Tutor 上下文、Review 内容、Graph 节点。
- 触发：链接右键/长按菜单「在右侧打开」；或 Peek 内「固定为工作对象」（§6）。
- 实现：**单层二级 pane**（不做 VS Code 全网格；网格布局是代码工具需求，知识工作 S3 已够 [C]，未来需要再扩）。
- [A] "Set reasonable defaults for minimum and maximum pane sizes" + thin divider + 可拖拽调宽（ResizableSplitPane，Phase 2A 已有基础）。
- [A] Locked group 思想转译 [B]：**Context pane 天然"锁定"**——打开新对象只进 Work Surface，不顶掉 Context；Explorer 结果列表同理。这是 VS Code locked group 的直接转译（"any request to open a new editor will create it in another group"）。

## 4. Context Model（把 Inspector 升级为 Context Pane）

> [B] 核心问题从"这个对象的属性是什么"变成"**我正在看的东西，与我的学习状态有什么关系**"。

Context Pane = 一张**连续的上下文面**（非卡片墙），分区固定顺序：

```text
Context（当前对象 x）
├── Outline / 定义          （对象结构）
├── Mastery                 （Effective 68% + 四维 + decay 时间线）
├── Recent Review           （最近复习/错题）
├── Links · Backlinks       （关系）
└── Tutor                   （「就这个问 Tutor」——sidecar，见 §7）
```

数据全部来自既有后端（mastery/review/mistakes/links/concepts/tutor context builder）——**零后端改动**。
Context 的内容随 Work Surface 对象联动（选中 [[概念]] → Context 切到该概念；选中文字批注 → 切到批注上下文，见 §5）。

## 5. Annotation Model（论文批注 = 边注层，不是批注页面）

> [A] Zotero："Annotations added to notes will automatically include links back to the PDF page"；
> "Show on Page... will open the original PDF to the page where the annotation was made."——**批注与原文双向锚定**是硬需求。

**四个层级（OLOS 决策）**：

```text
L1 Highlight   这里重要（选中即出气泡：Highlight/Annotate/Ask Tutor，禁止大 Dialog）
L2 Annotation  为什么重要（一段我的理解；挂在选区）
L3 ConceptLink 和哪个概念有关（[[Attention]] → 自动进 concept/links 体系）
L4 Learning Action 加入复习 / 标记薄弱 / 生成笔记 / 问 Tutor
```

**呈现 = 边注层**：批注以行内标记 + 右缘小标记点呈现（贴在选区所在行的右边缘），不遮挡正文；
**选中某条批注 → Context Pane 显示该批注的完整上下文**（引文 + 我的理解 + 关联概念 + Learning Actions）——
这是 Hypothesis 双向联动的 OLOS 版：点正文标记 → Context 聚焦；点 Context 条目 → 正文滚动到锚点并高亮。
「全部批注」作为 Context 内的一个 tab（而非独立页面）。

**进入学习链**（与既有后端天然连接）：

```text
Paper → Highlight → Annotation → Concept → Mastery → Review
```

差异化定位：别人做 annotation manager，**OLOS 做 Annotation → Learning Memory** [C]。

## 6. Peek Model（临时 → 固定的转化器）

> [A] VS Code："We think there's nothing worse than a big context switch when all you want is to quickly check something. That's why we support peeked editors... we embed the result inline."；Esc 关闭。

- `[[链接]]` 点击 → **Peek 浮层**（就地弹出：定义 + mastery + 最近复习 + 相关笔记），
  操作：`打开`（替换 Work Surface）/ `在右侧打开`（晋升为 S3 副对象）/ `问 Tutor`（sidecar）/ Esc 关闭。
- **Peek → Pin 的转化是知识工作的核心动作**：temporary → persistent workspace object。
- Peek 不改变工作空间状态；连续 Peek 不叠加（单实例）。

## 7. Tutor = Contextual Sidecar（冻结既有语义）

- Tutor 不再是独立聊天页：入口附着在学习对象上（Note→Explain / 弱点概念→Ask / Review→Hint / Graph 节点→Ask）。
- 呈现：Context Pane 的 Tutor 区（宽屏）或 Drawer（窄屏/专注态）——两者同一 state model。
- **冻结语义不动**：`presentError` 收口、`assistantMessageView` 生命周期、sessionStorage 会话指针、`tutorSeed`≠自动发送。

## 8. Search Model（三层，禁止混用）

> [A] HIG Searching（2026-06）："If search is important, give it a primary position"；"Aim to make your app's content searchable through a single location"；"Clearly display the current scope of a search."；local search = "acts as a filter on the current view"。

| 层 | 入口 | 范围 | 结果行为 |
|---|---|---|---|
| L1 Global | `⌘/Ctrl+K` CommandPalette | 全库：Notes/Concepts/Actions/Recent | **预览不替换**：↑↓ 在右侧预览面板内联预览（保持当前阅读），Enter 才打开 |
| L2 Workspace | Explorer 顶部搜索框 | 当前工作集（Work Surface + 副 pane + 关联概念 + 批注） | 作为当前视图过滤器（[A] Music local search 模式） |
| L3 Document Find | `Ctrl/Cmd+F` | 仅当前文档 | 行内查找高亮 + 计数 + 上/下 |

L1 预览行为是关键差异：**搜索结果 up/down → 预览面板刷新，当前阅读不破坏**（对应指令书 §11 的 ASCII，与 VS Code "preview vs pinned" 思想同源）。

## 9. Explorer 重定义（动态导航，非文件夹树）

> [B] Markdown 是数据真相，但用户的问题是"我现在应该看什么"。

Explorer 分区按当前对象动态组织：

```text
EXPLORER
├── Current     当前对象（含面包屑：AI ▸ Deep Learning ▸ Transformer [A] VS Code breadcrumbs）
├── Related     关联笔记（links/graph 邻接）
├── Hierarchy   层级子树（当前对象所在分支展开，非全 vault 铺开）
└── Recent      最近
```

完整 vault 树保留在「All Notes」模式（切换 tab，不删除能力）。
Scope 搜索框常驻 Explorer 顶部（= L2 Workspace Search）。

## 10. 任务 × 工作面矩阵（产品矩阵，实施验收依据）

| 用户在做什么 | 主工作面 | 辅助 Context | 布局态 |
|---|---|---|---|
| 阅读笔记 | Note | Outline/backlinks/mastery | S0→S2 |
| 研究论文 | Paper | Annotations/Concepts | S1→S2 |
| 比较知识 | Note A | Note B | S3 |
| 找知识 | Search | Preview | S0 + Palette |
| 理解概念 | Note/Concept | Tutor | S0→S2 |
| 复习 | Review Focus | Concept context | S4 |
| 查关系 | Graph | Node context | S0→S2 |
| 做算法 | Code/Trace | Variables | S3 变体 |
| 写笔记 | Editor | Related knowledge | S1→S2 |

## 11. 实施排序（Phase 3，建议 3 个子阶段）

| 子阶段 | 内容 | 验收 |
|---|---|---|
| **3A Workbench Shell** | 布局状态机 S0–S4 · ActivityRail · ResizableSplitPane 接线 · Work Surface 抽象 · Context Pane 骨架（Mastery/Links 分区接真实 API） · Explorer 动态分区 | 状态机切换 + 响应式 4 断点 + 真实浏览器 |
| **3B Peek + 并置** | PeekPanel（→Pin 转化）· S3 双对象（副 pane + locked 语义）· 链接菜单「在右侧打开」 | 快速 Peek/Pin/retarget 交互 PASS |
| **3C Search 三层 + Tutor sidecar** | CommandPalette 预览态 · L2 过滤器 · L3 行内查找 · Tutor sidecar 收编（迁移现有 ChatPanel，语义冻结） | 三层搜索不混淆 + sidecar 流式不回归 |

- 依赖关系：3A 是地基；3B/3C 可并行。
- **治理**：本 IA 与 ADR-029「单页工作区」表述冲突处，以 **ADR-031「Learning Workbench」** 正式化（dated appendix 形式引用本文件），实施前完成。
- 后端契约零改动；批注（Paper）依赖附件/Annotator 能力评估，Phase 4+ 另立项。

---

## 附：逐字引用索引

- HIG Split Views / Searching / Materials：developer.apple.com/design/human-interface-guidelines/{split-views,searching,materials}
- VS Code Custom Layout：code.visualstudio.com/docs/configure/custom-layout
- VS Code Code Navigation（Peek）：code.visualstudio.com/docs/editing/editingevolved
- Zotero PDF Reader：zotero.org/support/pdf_reader
- Hypothesis / Readwise：站点本轮不可达/未访问——模式依 Owner 指令书引用补记，Phase 3B 实施前补核。
