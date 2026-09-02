# ADR-013: Frontend Design System

**状态**：已批准（2026-08-27）
**决策者**：项目负责人
**关联**：M3b UI Polish · M4 AI Tutor · M2b Knowledge Universe · AGENTS §16

---

## 1. Problem

项目进入 M3b/M4 阶段，前端将大量新增 UI。当前无设计约束，AI 生成代码容易导致：
- 每个页面自创风格
- 渐变/装饰滥用
- 组件像后台管理系统
- 风格不可控

需要一份架构级约束，冻结视觉方向，防止设计漂移。

## 2. Decision

采用 **Minimal Scientific Workspace** 风格。

> 像一个长期使用 10 年的知识工具。

### 2.1 Design Keywords

```
Minimal · Clean · Professional · Calm · Scientific
```

禁止：
```
Cyber · AI Future · Neon · Gaming · Dashboard
```

参考产品（布局/信息层级/操作逻辑）：
- Obsidian：知识工作流
- VS Code：开发工作区
- Linear：极简产品感
- Typora：写作体验

### 2.2 Color System — Light Theme（默认）

```
白色空间 + 橙色生命线
```

主背景：`#FFFFFF`
辅助背景：`#F7F7F7`
文字：`#1A1A1A`
辅助文字：`#666666`
边框：`#E5E5E5`
品牌色：`#FF8A00`（Orange）

使用比例：
```
白色     90%
灰色      8%
橙色      2%
```

橙色只能用于：
- 当前选中状态
- 重要节点
- 学习反馈（掌握度提升、完成复习）
- AI 提示
- 操作反馈

禁止：
- 大面积橙色背景
- 卡片橙色背景
- 渐变
- 装饰线

### 2.3 Layout — 三栏工作空间（设计冻结，M5-003 实施）

```
┌───────────────────────┐
│        Header         │
├───────┬───────────┬───┤
│       │           │   │
│ Nav   │  Content  │Ctx│
│ Panel │  Area     │   │
│       │           │   │
└───────┴───────────┴───┘
```

比例：
```
Navigation Panel:  220px
Content Area:      flex
Context Panel:     320px
```

命名约定（内部 CSS class）：
```
.navigation-panel   — 左栏导航
.content-area       — 中间主内容
.context-panel      — 右栏上下文
```

Context Panel 动态内容（按页面切换）：
| 页面 | Context Panel 内容 |
|---|---|
| Note | Radar + Backlinks |
| Dashboard | Review Queue |
| Graph | Graph Info |
| Tutor | Tutor Memory |
| MindMap | Node Info |

### 2.4 Icon Policy

```
禁止引入图标库。
禁止 emoji 图标。
禁止装饰性 SVG。
禁止自制图标。
```

允许：
- 纯文字按钮
- hover 状态
- 快捷键提示
- 右键菜单

文字本身就是 UI。

### 2.5 Component Rules

组件必须服务功能。禁止装饰性组件。

命名：功能化
```
允许: ReviewList, NotePanel, GraphView, SuggestionList
禁止: FancyCard, SuperPanel, GlowEffect, HeroSection
```

最多两层容器嵌套。禁止卡片套卡片套卡片。

大多数内容：直接列表，不包装成卡片。

### 2.6 Animation Rules

默认：没有动画。

允许：微交互
- hover
- fade
- expand

时间：`150-250ms`

禁止：
- 粒子背景
- 流光
- 星空
- 背景动画
- 霓虹发光

### 2.7 CSS Rules

禁止：
- gradient
- backdrop-filter
- glassmorphism
- neon color
- excessive shadow

允许：
- border
- subtle background
- 150-250ms transition

### 2.8 Knowledge Universe — 例外

普通界面：Minimal Scientific。
Knowledge Universe：允许 Scientific Visualization。

允许：
- 节点大小变化
- 力导向运动
- 星图感
- 微动画

禁止：
- 飞船驾驶舱
- 赛博朋克
- 星空背景
- 3D 游戏化

定位：不是"知识宇宙游戏"，而是"可探索的科学知识地图"。

### 2.9 Page Design Rules

#### Dashboard
禁止统计卡片（学习天数/知识数量/AI 次数/完成率/排行榜）。
文字优先：

```
今天

需要复习

线性代数
二叉树

最近学习

矩阵乘法

薄弱区域

概率论
```

#### Note Editor
参考 Obsidian：标题 + 正文 + 链接 + LaTeX + 代码块。
增强：右侧 Radar + Backlinks。

#### Knowledge Universe
特殊模式。可以炫。但默认白底。
节点：大小=连接数，亮度=mastery，颜色=domain。

### 2.10 Forbidden UI Patterns

- 渐变背景
- 玻璃态 (glassmorphism)
- 霓虹发光
- 过度装饰 card
- 每个按钮配 icon
- 彩虹节点
- Dashboard 统计卡片
- Hero Section
- Feature Card Grid

### 2.12 Known Conflict — Gradient / Backdrop vs Design Assets（待裁决，2026-08-31）

**状态**：所有者裁定「维持现状 + 记录」，未改代码，待显式裁决。

§2.7 禁止 gradient / backdrop-filter / glassmorphism / glow，但项目设计资产
`ui/*.html` 明确使用这些处理，且 `web/src/global.css` 已 1:1 移植：

| 选择器 | 用法 | 来源资产 |
|---|---|---|
| `.btn-primary` | `linear-gradient(135deg,var(--brand),var(--brand-2))` + `box-shadow:var(--shadow-glow)` | `motion-primitives.html` |
| `.avatar` / `.topbar__dot` | 品牌渐变 | `app-shell.html` ⚠️ **已归档** |
| `.topbar` | `backdrop-filter: saturate(180%) blur(12px)` 毛玻璃 | `app-shell.html` ⚠️ **已归档** |
| `.wavelink` | 品牌渐变下划线 | `motion-primitives.html` |
| `.skel` | 灰渐变 shimmer | `motion-primitives.html` |

> **2026-09-01 归档注**：`app-shell.html` 因「平级侧栏违背笔记优先 IA」移入
> `ui/archive/legacy-gallery-html-2026-09-01/`，上表两行的来源资产路径随之变更。
> **但冲突并未消解** —— 三处样式已在 `web/src/global.css` 1:1 移植（`.topbar` L2190 含
> `backdrop-filter`、`.avatar` L1951 与 `.topbar__dot` 品牌渐变），
> 其中 `.topbar` / `.topbar__dot` 由 `components/shell/TopBar.tsx` 实际消费。
> 归档只移走示例页，`global.css` 未动，本条依旧待所有者裁决。

同理 §2.6「动效 150-250ms」与设计资产内的 `.fade-target`(.6s) / `.skel`(1.4s) /
`ProgressRing`(1.2s) / tab `left`(.35s) 也存在张力。

**裁决路径（均未执行，需所有者显式发起）**：
- A 修本 ADR：在 §2.7/§2.8 追加「设计系统豁免」，批准上述品牌处理为既有设计语言；
- B 守严格版：从 `global.css` 与 `ui/*.html` 剥除全部 gradient/backdrop/glow 并将动效压到 250ms。

当前为「ADR 与设计资产不一致」，非实现违规。

### 2.13 Spotlight 例外 — 仅限空状态引导（2026-09-02 裁决）

**状态**：所有者裁定「解禁 · 仅空状态引导」。本条是 §2.7 目前**唯一**的例外。

§2.7 禁止 gradient。但「鼠标跟随聚光」（Spotlight）在**空状态引导**场景下是功能而非装饰：
当界面无内容可读、且用户只有一条路可走时，聚光把注意力指向唯一的 CTA。
此处不存在「干扰阅读」——因为没有内容要读；橙色仍严格服务于「注意力指针」语义。

**允许**（三条门禁缺一不可）：

1. **空状态**：界面无内容列表、无正文、无数据图表。渲染分支为
   `empty` / `onboarding` / `error`，而非 `loaded`。
2. **单一出口**：该界面只有一个主 CTA，无并列动作（卡内 `button` 数为 1，
   关闭与辅助链接不计）。
3. **可撤销**：仅 hover 触发；整段实现包在
   `@media (hover:hover) and (prefers-reduced-motion:no-preference)` 内，
   触摸设备与 reduced-motion 下完全不启用。

**禁止**（§2.7 / §2.10 在这些场景完整有效）：

- 笔记列表卡、复习卡、检索结果卡等**任何有内容可读的卡**
- 右栏已有内容的面板（反链 / 掌握度 / 批注）
- 常亮聚光（非 hover 触发）
- 渐变描边（conic / radial 描边）、玻璃态、霓虹发光
- 按钮渐变、渐变背景 —— 本例外**不**豁免这些
- 对外物料（落地页 / 介绍页）另议，不属本例外范围

**实现约束**：

| 项 | 取值 |
|---|---|
| 聚光强度 | `rgba(255,107,53,.13)` 中心，38% 处 .04，62% 全透明 |
| 半径 | 普通卡 320px / 大号卡 460px |
| 过渡 | `opacity` ≤ 250ms（§2.6 上限） |
| 指针跟随 | 事件委托 + 单 rAF + 30fps 节流，只写 `--mx/--my` |
| CTA 对比度 | `--brand-deep` 底 + 白字 4.13:1（AA）；**不用** `--brand`（配白字仅 2.84:1） |

**落点**（2026-09-02 全量审计结论，完整判定见 `ui/empty-states.html`）：

对 `web/src` 中全部 **12 个空态分支**逐条过三条门禁，结果：

| 结论 | 数量 | 分支 |
|---|---|---|
| **允许** | 1 | `views/NoteEditor.tsx:278` 首篇笔记 onboarding（`notes.length === 0`，唯一 CTA「＋ 新建」） |
| **补一个 CTA 后允许** | 4 | `galaxy/GalaxyCanvas.tsx:741` `!planet` 空态（须补「回工作区写笔记」）<br>`galaxy/GalaxyCanvas.tsx:734` `error`（须补「重试」）<br>`mindmap/MindMapCanvas.tsx:488` 未选中导图（须补「新建导图」）<br>`views/ReviewSessionView.tsx:181` 暂无待复习（临界：CTA「开始复习」在卡外，建议收进卡内） |
| **禁止** | 7 | `NoteEditor.tsx:284` 有笔记未选中（左栏有内容）<br>`KnowledgeRadar.tsx:66/:78` 无查询/无结果（右栏局部面板）<br>`ContextRail.tsx:100/115/165/171` 大纲/反链/掌握度/薄弱概念 空（右栏有正文）<br>`TopBar.tsx:104` 搜索无匹配（容器面积 < 聚光半径 320px）<br>`NoteEditor.tsx:266` · `ReviewSessionView.tsx:158` · `GalaxyCanvas.tsx:727` —— **这三处是加载态，不是空态，应走 Skeleton 而非聚光** |

**首选落点**：`galaxy/GalaxyCanvas.tsx:741` 的 `!planet` 分支——全屏、无内容可读、
语义即「还没有笔记」，比 `NoteEditor` 更像空状态；用大号卡（半径 460px）。
⚠️ 该分支当前**一个按钮都没有**，必须先补唯一 CTA，否则门禁 2 不过。

**规范页**：`ui/spotlight-card.html`（组件规格 + 内容卡反例）、`ui/empty-states.html`（全量落点审计）。
旧稿（内容卡形态的聚光画廊）保留在 `ui/archive/legacy-gallery-html-2026-09-01/spotlight-card.html`，
仅作「为何否决内容卡聚光」的可回溯证据，不可再作为实现模板。

**裁决记录**：2026-09-02 所有者审阅 `ui/index.html` 中的归档卡片后表示「我挺喜欢的」，
选择解禁但限定范围；本条即该裁定的落地。

**接线状态（2026-09-02 所有者二次裁定）**：**只出规范，不写入 `web/` 业务代码。**
沿用「组件先在 ui 库定稿」的既有节奏，与 M9-007 回灌同一批处理。
接线开工时以 `ui/empty-states.html` 的落点清单为准，**不要重新盘点**。

> 背景：全量 19 个 `web/src/components/ui/` 导出组件中，仅 5 个进入业务
> （`Progress` 2 · `Badge` 2 · `Tooltip` 1 · `Select` 1，及 `ToastProvider` 仅挂载而
> `useToast()` 调用数 0）。**`Button` 的业务引用数为 0** —— 属整层未接线，
> 需整体排期，不适合零散修补。同理，动效基元落点清单（`ui/empty-states.html` §④）
> 也只作规范，不接线。

### 2.11 Dependency Policy

保持：React + 纯 CSS + Zustand
禁止引入：Material UI / Ant Design / Chakra / Tailwind UI / lucide-react

## 3. Consequences

### 迁移路径

Phase 1（当前）：冻结 ADR-013 + AGENTS §16 + CSS 变量迁移（暗→白橙）
Phase 2（M5-003）：三栏布局 + Context Panel + Dashboard 重构
Phase 3（M3b）：Knowledge Universe 视觉 polish

### 对 AI 的约束

AGENTS.md §16 强制所有前端生成遵守本 ADR。

### 冻结范围

本 ADR 冻结的是设计方向和约束，不是具体实现。
具体布局实现随里程碑演进，但必须在本 ADR 框架内。
