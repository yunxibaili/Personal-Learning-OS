# UI-MOTION-SPEC — 动效规范（Phase 1.5 Frozen）

日期：2026-09-07 · 状态：**FROZEN**
依据：`UI-APPLE-MOTION-RESEARCH.md`（HIG Motion / WWDC25-219 / SwiftUI 动画文档 / Motion.dev）
来源标注协议：[A] Apple Fact / [B] Apple-derived Interpretation / [C] OLOS Decision。

---

## 1. Motion 分类（七类，每类有准入条件）

| 类别 | 定义 | 准入（答不出不实现 [A] "Don't add motion for the sake of adding motion"） |
|---|---|---|
| micro | 单控件微反馈（press/hover/toggle） | 高频交互仅做状态切换，不加时长动画 [A] |
| feedback | 操作结果确认（success/error/copy） | 有明确语义状态变化 |
| materialize | 浮层/元素进入 | 材质面从触发点"凝聚"出现，非 fade |
| dissolve | 离场 | 更快、更安静、无回弹 |
| morph | **同一对象**变形（Tab 滑块/SegmentedControl capsule/图标替换） | 必须是同一个视觉实体的 shape/size/state 变化 [A] "singular floating plane" |
| spatial | 位置关系变化（面板展开/收纳/Rail 退场） | 与滚动/布局手势有因果 |
| immersive | Galaxy/Algorithm 沉浸动效 | 动画必须服从数据/步进（Phase 5） |

## 2. Spring Rule（冻结）

> **transform 类物理属性 → spring；opacity/color/视觉衰减类 → duration + easing**。
> [B] 依据："physical properties like x or scale are animated with spring physics, whereas values like opacity or color are animated with duration-based easing curves"（Motion.dev）+ SwiftUI spring(duration:bounce:) 模型 [A]。

Spring token（[C] 参数，`linear()` 实现，零依赖）：

```css
--spring-snappy: /* 控件按压/hover/toggle —— ~280ms, bounce≈0.12 */
--spring-gentle: /* 面板/浮层/Tab 指示器 —— ~360ms, bounce≈0.06 */
--spring-bouncy: /* 确认反馈/Magic Replace —— ~420ms, bounce≈0.45，仅确认语义可用 */
```

选型表：Button press=snappy · Tab indicator=gentle · Popover/Sheet materialize=gentle ·
SegmentedControl settle=gentle · 图标确认=bouncy · 位置收纳=gentle。

## 3. Materialize（进场模型）

> [A] "Instead of fading, Liquid Glass objects materialize in and out by gradually modulating the light bending and lensing."（219）

初始模型（[C] OLOS initial implementation parameters，**非 Apple 固定参数**，真实浏览器观察后调）：

```text
opacity   0.96 → 1     （材质始终"在"，只是未聚焦）
scale     0.98 → 1     （原点=触发控件，非元素中心）
blur      2px → 0      （lensing 近似）
translate 触发方向 4px → 0
shadow    无 → 语义高度（与 materialize 同帧）
```

**禁止**：opacity 0→1 作为唯一进场 [C 指令书]；大位移/旋转进场。

## 4. Dissolve（离场模型）

更快（约进场时长的 60%）、无 bounce、无过冲；opacity + blur(0→2px) + 朝关系方向小幅撤退 [B]（"visually recedes"，219）。

## 5. Morph（同一对象变形）

> [A] "Liquid Glass dynamically morphs between the controls in each context. This maintains... a singular floating plane."

规则：
1. morph 前后必须是**同一视觉实体**（Tab indicator、SegmentedControl capsule、Button→Popover 的面板、图标状态）；
2. 尺寸变化伴随材质加权（越大影越深）[A] "casts deeper, richer shadows"；
3. 实现：FLIP（First-Last-Invert-Play）测量起止几何 → transform 过渡；Web Animations API 用于需要精确控制处。

## 6. Velocity Continuity / Retarget（硬要求）

> [A] "SwiftUI preserves the velocity... across multiple keyframes for continuous motion within a track."

适用交互：Tabs · SegmentedControl · Panel resize · Sidebar collapse · Sheet drag · Popover morph · Algorithm step 导航。

**模型**：`当前视觉状态 + 当前速度 + 新目标 → retarget → settle`。
禁止 A→B→C 排队播放 [C 指令书]。

实现策略：
1. CSS transition（默认）：值变更自动从当前插值态 retarget——天然满足，**优先**；
2. WAAPI：`commitStyles()` 后取消重放，保留当前速度（用于 keyframe 复杂动画）；
3. FLIP 动画：以实时 getBoundingClientRect 为 First，天然连续；
4. 禁止：`animation` 一次性 keyframe 用于可变目标位置（不可 retarget）。

## 7. Reduced Motion（语义降级，非全零）

> [A] "Make motion optional... avoid using it as the only way to communicate important information."（HIG Motion）

| 原动画 | 降级为 |
|---|---|
| Movement（translate/scale 位移动画） | 即时状态切换（无过渡） |
| Morph | 直接替换为终态（+50ms opacity 确认） |
| Materialize/Dissolve | opacity 0↔1 快切（≤60ms）+ 影即刻到位 |
| Bounce/Breathe/Pulse | 静态状态色/图标替换（信息不丢） |
| 进度/活动指示 | 常亮状态色或文本（"Syncing…"） |

**禁止** `animation-duration: 0.01ms` 作为唯一策略 [C 指令书]；Phase 1 的全局降级保留为兜底层，
组件层按上表逐类覆写（`@media (prefers-reduced-motion: reduce)` 内重定义语义 class）。

## 8. 动画准入九问（review 标准，答不出不实现）

Why · What · Relationship · Meaning · Timing · Interruptibility · Reduced Motion ·
**Does it improve comprehension or feedback?** · **高频交互是否受影响？** [A]（"avoid adding motion to UI interactions that occur frequently"）

## 9. 实现边界

- 允许：CSS transitions/animations（含 `linear()` spring）、Web Animations API、SVG 动画、Canvas（immersive）。
- 禁止（未经审批）：Framer Motion 等第三方动画库 [C]（红线：现有栈够用即零依赖；确需按指令书 §17 流程立项）。
- 性能预算 [C]：动效仅 transform/opacity/filter（合成层属性）；同屏 backdrop-filter 面 ≤3；任何动画不得引发布局抖动（layout thrash）。
