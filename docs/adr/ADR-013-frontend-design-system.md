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
