# Design — 前端设计与交互规格

> > **解冻状态**（`PROJECT_STATE.md` §0）：后端 backlog 已清零，项目所有者于
> 2026-08-30 显式宣布进入前端阶段——前端阶段开启。
> **FE-001 视觉打磨已于 2026-08-30 由项目所有者显式宣布解冻**（同日指示「解冻前端任务」），
> 见 `PROJECT_STATE.md` §0 与 `TASKS.md`「前端阶段任务（Phase 0–4）」。
> 本文自即日起为前端任务的规格依据。
>
> ⚠️ 三处规格已被 2026-08-30/31 裁决覆盖，以裁决为准：
> ① §2「禁深色科技感」——Universe 改为**星系**语义（主笔记=星球／副笔记=卫星），
> 地球渲染移植自 `ui/home-hero.html`，视觉仍守白空间线稿（详见 `TASKS.md` 裁决记录）；
> ② §3 Earth UI 中「一个地球 + 全部笔记绕行」的表述作废，改为**多星球系统**，
> 层级从 `/graph` 边拓扑推断（2026-08-31 方案 A），见 `components/galaxy/GalaxyCanvas.tsx`
> 的 `derivePlanets`（13 项单测锁定）；
> ③ §5「页面对应」中的 **Dashboard 已删除**（裁决 A：笔记优先，打开应用即笔记工作区）。
> Dashboard 的「今日复习入口」改由 TopBar 复习徽章承载，「学习趋势」由右栏掌握度标签承载。
>
> ℹ️ 原「P8-003 Home 与裁决 A 冲突」已裁定 = 方案 B（2026-08-30 项目所有者选定）：
> HomeView 撤销、不占独立 tab；`/api/v1/home` 端点保留供 Phase 2 右栏复用。
> 详见 `TASKS.md` 待决项处置记录。

前端视觉与交互规格。合并自原 `docs/design/` 下的多份文档。

---

## 目录

1. [Learning Loop — 学习循环设计](#1-learning-loop-学习循环设计)
2. [UI Reference — 视觉参考边界](#2-ui-reference-视觉参考边界)
3. [Earth UI — 知识星球地球效果规格](#3-earth-ui-知识星球地球效果规格)

---

## 1. Learning Loop — 学习循环设计

> 本文件描述用户每日学习循环与系统事件流。
> 配合 `learning-model.md`（数据契约）使用。

---

### 1. Daily Loop

用户每天：

```
打开软件
  ↓
看到今日复习（review_queue）
  ↓
回答问题 / 阅读讲解
  ↓
系统生成 learning_event
  ↓
mastery 重新计算
  ↓
review_queue 更新（下次复习时间）
  ↓
继续学习新内容
```

核心问题：**用户每天为什么打开它？**

答案：因为系统知道他该复习什么。

---

### 2. Event Flow

```
用户行为
  │
  ├─ answer_correct / answer_wrong    （复习答题）
  ├─ explain                          （Tutor 讲解）
  ├─ code_run                         （代码实践）
  ├─ visualize                        （可视化探索）
  └─ manual                           （手动标记）
  │
  ↓
learning_events（追加写入，永不修改）
  │
  ↓
event reducer（mastery.py 计算）
  │
  ↓
concept_mastery（更新四维掌握度）
  │
  ↓
review_scheduler（SM-2 计算下次复习）
  │
  ↓
review_queue（写入/更新待复习条目）
```

---

### 3. Data Flow Rule

**永远通过 event 间接更新，禁止直接修改 mastery。**

```
正确:
  user action → event → mastery calculation → mastery update

禁止:
  user action → mastery update（跳过 event）
```

原因：
- event 是真相，mastery 是投影
- 未来多端同步只同步 event，mastery 可重放
- 未来 AI Tutor 需要 event 历史做分析

---

### 4. UI 原则

#### 允许

- 掌握度数值（effective 百分比）
- 学习趋势（最近 7 天 event 数量）
- 待复习数量
- 薄弱概念列表

#### 禁止

- 游戏积分
- 等级系统（Lv.1 → Lv.2）
- 徽章 / 成就
- 排行榜
- 连续打卡天数（压力感）

原因：这不是 Duolingo，是学习操作系统。

---

### 5. 页面对应

> **⚠️ 本表依裁决 A 更新（2026-08-31）**：Dashboard 已删除，无平级 tab，
> 打开应用即**笔记工作区**；图谱/星系/导图/复习为浮层态，Tutor 为右栏抽屉。

| 界面 | 循环角色 | 形态 |
|---|---|---|
| **笔记工作区** | 学习新内容 + 生成 event（主界面，承载原 Dashboard 的复习入口） | 三栏主界面 |
| 复习 | 答题 + 反馈 | 浮层（TopBar 复习徽章进入） |
| AI Tutor | 讲解 + 生成 explain event | 右栏抽屉 |
| Knowledge Radar | 发现关联知识 | 右栏「雷达」标签 |
| ~~Dashboard~~ | ~~今日复习入口 + 学习趋势~~ **已删除（裁决 A）** | 入口改由 TopBar 复习徽章 + 右栏掌握度承载 |
| Graph | 知识关系可视化 |

---

### 6. 未来扩展点

- **M4 Tutor**：explain event 增加 AI 讲解质量维度
- **M3b Universe**：event 驱动节点动画（新 event → 节点亮起）
- **M7 Sync**：event log 同步（jsonl 追加式）
- **M8 Mobile**：移动端复习入口

---

## 2. UI Reference — 视觉参考边界

> AI 生成 UI 前必读。明确审美边界，防止设计漂移。

---

### Primary Inspiration

#### Obsidian
知识工作流
- 双链
- 文件结构
- 侧边栏导航
- 信息密度高但不拥挤

#### VS Code
开发体验
- 命令面板
- 快捷键
- 信息密度
- 三栏工作区

#### Linear
产品质感
- 极简
- 快速操作
- 干净的列表和表单

#### Typora
写作体验
- 干净编辑区域
- 无干扰的 Markdown 环境

### Earth UI（知识星球）

首页地球效果的视觉与实现规格：`docs/DESIGN.md`
示例代码：`ui/earth-hero.html` · `ui/earth-planet-card.html`（索引见 `ui/README.md`）

---

### Avoid

禁止参考：
- Notion 营销页
- AI 聊天套壳产品
- 数据驾驶舱 / Admin Dashboard
- 游戏化学习软件
- SaaS Landing Page
- AI Demo 网站

---

### Color Reference

目标气质：
```
白色空间 + 橙色生命线
```

不是：
```
深色科技感
紫色 AI 风
蓝色渐变
彩虹配色
```

---

### Layout Reference

目标：
```
Obsidian 的工作区理念
VS Code 的信息层级
Linear 的极简操作
```

不是：
```
后台管理系统
SaaS 仪表盘
AI 助手聊天界面
```

---

### 核心感觉

打开 Open Learning OS 的感觉：

```
像打开 VS Code 学习
像打开 Obsidian 思考
像打开一本现代教材
```

不是：

```
像打开一个 AI 玩具
像打开一个 SaaS 后台
像打开一个数据看板
```

---

## 3. Earth UI — 知识星球地球效果规格

> 状态：规格冻结（2026-08-28）。示例代码在 `ui/`，正式实现为 `web/src/components/planet/KnowledgePlanet.tsx`（Cobe 方案，P8-001C）。

---

### 1. 来源与边界

- 视觉原型：MiMo 官网 Canvas 点阵地球（原型存档 `D:\yunxibaili\111\earth-effect\index.html`）
- 本项目示例：`ui/earth-hero.html`（Hero 全屏版）、`ui/earth-planet-card.html`（Dashboard 卡片版）
- 审美边界：遵守 `UI_REFERENCE.md` —— 白色空间 + 橙色生命线，禁止深色科技感 / 紫色 AI 风
- 语义映射（原型 → Learning OS）：

| 原型元素 | Learning OS 语义 |
|---|---|
| 点阵地球自转 | 知识库整体（持续生长，无缝滚动） |
| 轨道环 | 近地轨道（LEO）：多条错倾环近贴地表（rx 1.15R~1.55R），内环更快 |
| 卫星 | 笔记（GET /api/v1/notes 驱动，上限 16 颗聚合）——彩色圆点（域色）+ 墨色拖尾，**大小随笔记字数增长，封顶 MAX_SAT_PX** |
| 表面节点 | 概念（mastery < 0.3 → 虚线弱化外圈） |
| 节点连线 | 概念间 links（GET /api/v1/links） |
| 域色 | KnowledgePlanet.tsx PALETTE（6 色循环） |

### 2. 渲染规格（Canvas 2D 方案）

```
贴图        dots-world.png 预拼接「正像 + 镜像」无缝长条（加载时离屏 canvas 合成），
            接缝处边缘像素天然连续 → 自转横向滚动永无回退闪烁（周期 = 2 × 贴图宽）
地球半径     R = canvas_size / 640 * 205（参考坐标系 640px / 205px），四周留出轨道空间
轨道环       近地轨道 4 条：ORBITS = [{rx,ry,tilt}] 错倾组合（tilt ±0.18~0.85 rad），
            每条分前后半段绘制实现地球遮挡
卫星        彩色圆点（PALETTE 域色）+ 墨色拖尾（rgb(32,34,40)，沿轨道向后渐隐渐细 ~1.1 rad）；
            不画太阳能板形状。半径 = MIN_SAT_PX + words / SAT_WORDS_DIV，封顶 MAX_SAT_PX；
            角速度随轨道半径递减（内环快，开普勒近似）；sin(t) 判前后，后半段缩小降透明
自转速度     BASE_SPEED 0.085/帧（按 16.67ms 归一，dt 上限 100ms 防暂停后跳变）
交互        鼠标横移/拖动 → 与自转共用同一 rotation 相位（拖动不会复位）
光照        径向暗角（中心亮边缘暗）+ 左上柔光
```

遮挡采用 2D 分层绘制（后半段环 → 地球 → 前半段环），与 KnowledgePlanet 的数学 z-position（`isBehind`）是两种等价方案；Cobe 实现内地球遮挡由 WebGL 自带深度解决。

### 3. 性能契约（与 P8-001C 一致，冻结）

- canvas 280px（卡片版）/ dpr=1（性能红线，不乘 devicePixelRatio；Hero 版允许 dpr≤2）
- 单 rAF · 30fps 节流（`FRAME_MS = 1000/30`）
- 容器 `contain: layout paint size`
- `IntersectionObserver` / `visibilitychange` 不可见即完全暂停
- `prefers-reduced-motion: reduce` → 渲染静态一帧，无 rAF
- 卫星渲染上限 16 颗，超出聚合显示总数

### 4. 实现方案对比（ADR-023 边界内）

| | Cobe（正式实现，P8-001C） | Canvas 2D（本规格示例） | React 组件（`ui/react/HeroEarth.tsx`） |
|---|---|---|---|
| 依赖 | cobe ^0.6.5（WebGL） | 零依赖 | 仅 react（零三方依赖） |
| 地球 | WebGL 点阵球（mapSamples=6000） | 贴图循环滚动 | 贴图循环滚动（同 Canvas 2D） |
| 遮挡 | 数学 z-position（isBehind） | 分层绘制（back→globe→front） | 分层绘制（同 Canvas 2D） |
| 额外特性 | marker 系统 | — | 滚动视差 + 鼠标偏转自转，props 传 notes |
| 优势 | 真实球面观感 | 零依赖、绘制自由度高 | 可直接替代/对标 `KnowledgePlanet.tsx` |
| 定位 | DashboardView 内嵌卡片 | Hero/营销页、离线 fallback | React 集成路径（strict tsc 通过） |

三套方案共用同一份语义映射与性能契约；替换或新增使用场景需更新本文件并登记 `ui/README.md` 索引。
`ui/react/HeroEarth.tsx` 整合自 `111/mimo-clone` 的 HeroEarth.tsx（原版为太阳能板卫星+单轨环+接缝贴图），已按本规格改造（LEO 轨道 / 圆点+墨色拖尾 / 字数定大小 / 正像+镜像无缝贴图 / 深度连续消跳变 / 30fps+暂停+reduced-motion）。

