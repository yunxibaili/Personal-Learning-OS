# Earth UI — 知识星球地球效果规格

> 状态：规格冻结（2026-08-28）。示例代码在 `ui/`，正式实现为 `web/src/components/planet/KnowledgePlanet.tsx`（Cobe 方案，P8-001C）。

---

## 1. 来源与边界

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

## 2. 渲染规格（Canvas 2D 方案）

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

## 3. 性能契约（与 P8-001C 一致，冻结）

- canvas 280px（卡片版）/ dpr=1（性能红线，不乘 devicePixelRatio；Hero 版允许 dpr≤2）
- 单 rAF · 30fps 节流（`FRAME_MS = 1000/30`）
- 容器 `contain: layout paint size`
- `IntersectionObserver` / `visibilitychange` 不可见即完全暂停
- `prefers-reduced-motion: reduce` → 渲染静态一帧，无 rAF
- 卫星渲染上限 16 颗，超出聚合显示总数

## 4. 实现方案对比（ADR-023 边界内）

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
