# UI-APPLE-MOTION-RESEARCH — Apple 动效行为模型研究（Phase 0 / Research）

日期：2026-09-07 · 来源：HIG Motion · WWDC25-219 转录 · SwiftUI《Controlling the timing and movements of your animations》· SF Symbols 官方页 · Motion (motion.dev) 文档
目标：把 Apple 动效**从"参数"还原成"行为模型"**，再转译到 Web。不是"transition: 200ms ease"这种伪动效设计。

---

## 1. HIG Motion 总纲（先立规矩）

| 原则 | 原文 |
|---|---|
| 有目的 | "Add motion purposefully, supporting the experience without overshadowing it. Don't add motion for the sake of adding motion." |
| 动效可选，信息不丢 | "Make motion optional... avoid using it as the only way to communicate important information." |
| 反馈要短而准 | "Aim for brevity and precision in feedback animations... it tends to feel lightweight and unobtrusive." |
| 高频交互不加动 | "In apps, generally avoid adding motion to UI interactions that occur frequently." |
| 可取消 | "Let people cancel motion. As much as possible, don't make people wait for an animation to complete." |
| 反馈要符合直觉方向 | "if someone reveals a view by sliding it down from the top, they don't expect to dismiss the view by sliding it to the side." |

**Web 推论**：reduced-motion ≠ "全部 animation: none"。降级方案必须保留：opacity 状态反馈、即时态切换、非动效层级线索（影/位置/颜色）。这与指令书 §9 完全一致。

## 2. Materialization（出现 ≠ fade）

Liquid Glass 的出现/消失不是透明度过渡：

> "Instead of fading, Liquid Glass objects **materialize in and out by gradually modulating the light bending and lensing**, ensuring a graceful transition that preserves the optical integrity of the material."（219）

**行为模型拆解**（Web 转译）：
- opacity（0.96→1 而非 0→1，材质"始终存在"）
- scale（0.98→1，从触点原点）
- blur（2px→0，模拟 lensing 聚焦）
- 轻微位移（4px→0，来自触发方向）
- 影（由无到语义高度）

**禁**：大位移长距离飞入、大角度旋转进场。**语义词**：`anim-materialize`（从触发原点）/ `anim-dissolve`（离场更快、无回弹）。

## 3. Morphing（形变 = 关系连续性）

> "Liquid Glass dynamically morphs between the controls in each context. This maintains the concept of having a singular floating plane that the controls live on."（219）
> "When showing a menu, the bubble simply pops open to reveal the content contained within."（219）
> "When glass flexes and morphs to larger sizes... it casts deeper, richer shadows, has more pronounced lensing and refraction effects."（219）

**行为规律**：
1. morph 是**同一物体变形**，不是 A 消失 B 出现；
2. 尺寸变化伴随材质特性变化（越大越"厚"：影更深、lensing 更强）；
3. morph 保持"单一浮动平面"概念——控件不各飞各的；
4. Apple 用 `GlassEffectContainer` 让相邻玻璃形状"fluidly morph into each other"。

**Web 转译候选**（Phase 2/3 实现清单）：
- Button → Popover：popover 从按钮圆角矩形展开（同 origin、同 radius 推导），而非居中淡入；
- Tab 激活：玻璃胶囊沿 tab 轨道滑动（FLIP），而非每个 tab 各自高亮；
- Sidebar ↔ 收起：宽度过渡 + 内容 materialize，非 display 切换；
- Icon A → B（Magic Replace）：旧图标 dissolve + 新图标 materialize，同位置同尺寸。

## 4. Spring / Physical Feel（有质量，不是 CSS transition）

**SwiftUI 模型**（官方文档）：弹簧 = `duration` + `bounce` 两个参数；预设 `.bouncy` / `.smooth` / `.default`；可混用 `.easeInOut(duration:)`。关键帧体系（`KeyframeAnimator`）：
- 按属性分轨道（`KeyframeTrack(\.scale){...}`），每轨道可混 `LinearKeyframe` / `CubicKeyframe` / `SpringKeyframe`；
- **轨道内速度保持**："SwiftUI preserves the velocity (that is, the speed of the animation) across multiple keyframes for continuous motion within a track."——这是"物理感"的技术本质：不断速度。
- `PhaseAnimator` = 离散阶段循环（适合 step-by-step 表达），`KeyframeAnimator` = 逐帧插值（适合复杂协同）。

**Motion (motion.dev) 印证**："physical properties like x or scale are animated with spring physics, whereas values like opacity or color are animated with duration-based easing curves."

**Web 转译裁定**：
1. 物理属性（transform: translate/scale）→ spring；非物理属性（opacity/color）→ duration curve。**这条规则直接写进组件规范**；
2. CSS 无法原生弹簧 → 方案排序：CSS `linear()` 缓动（现代浏览器可模拟弹簧，零依赖）→ Web Animations API（可程序化 spring + 速度继承）→ Framer Motion（**暂不引入**，现有栈够用；如确需，按指令书 §17 流程立项）；
3. 弹簧 token 化：`--spring-snappy`（按钮/控件 ~ duration 0.25s bounce 0.15）、`--spring-bouncy`（确认反馈 bounce 0.5）、`--spring-gentle`（面板/抽屉 bounce 0.08）。用 `linear()` 生成，Phase 1 修订时落地。

## 5. Micro Interactions（微交互库，Phase 2 逐项实现）

| 微交互 | Apple 行为模型 | Web 实现 |
|---|---|---|
| 按压 | "Always include a press state"（HIG Buttons）+ 材质"flexing and energizing with light" | scale 0.97 + 内侧高光加深，spring-snappy |
| 交互发光反馈 | "the material illuminates from within as a form of feedback... the glow spreads throughout the element"（219） | 玻璃面内 radial 高光泛起（**非**外发光 glow；不违反 §2.7 装饰禁令，因为是交互反馈而非装饰） |
| 临时抬升 | "lift up into Liquid Glass temporarily... resting state stay visually quiet"（219） | 静止 flat，hover/focus 抬升（影→higher，材质→glass-regular） |
| 选择/激活 | 色调范围基于底层亮度生成（tinting heuristics） | accent-soft 填充 + 语义 ring |
| 保存/同步指示 | 呼吸感（对应 Symbol Breathe） | 透明度 1→0.55→1 循环，2s，reduced-motion 下改为常亮状态色 |
| 骨架屏 | shimmer 属内容层加载，属 standard material 范畴 | 低调 opacity 脉动，不做彩虹渐变 |

## 6. Symbol Motion（SF Symbols 8 系统化动效）

官方页（2025 版）确认的动效语言：**Bounce / Wiggle / Rotate / Breathe / Pulse / Magic Replace / Draw On-Off / Variable Rendering（Variable Color & Variable Draw）**；"These animated effects leverage a symbol's layer structure, enabling compatibility with custom symbols."

**转译到我们的 SVG icon set**（Phase 2）：
- 每个图标按**图层**绘制（stroke 组分层），才能有层级动效；
- Bounce = 触发确认（如复制成功）→ translateY spring 一次；
- Pulse/Breathe = 持续状态（同步中、生成中）；
- Magic Replace = 状态切换（播放↔暂停、收藏↔已收藏）；
- Variable Color = 进度类（多段不透明度轮转）——Web 用 CSS opacity 分层动画实现；
- Draw = 首次出现（用 SVG stroke-dashoffset）——克制使用，仅空态插画级。

## 7. 动效质量门槛（写入 review 标准，指令书 §16 全文采纳）

每个动画必须回答：Why / What / Relationship / Meaning / Timing / Interruptibility / Reduced Motion。
**答不出 → 不加。** 追加两条 Apple 来的硬规则：
8. 高频交互（列表滚动、普通 hover）不加进场动效；
9. 打断必须安全：spring 从当前值继续，不从头重放（Web Animations API `commitStyles`/`getCurrentValues` 保速度；CSS transition 天然满足，keyframe 动画需可中断设计）。

## 8. 与冻结政策的一致性

- ADR-013 §2.7 禁的是**装饰性** gradient/glow/玻璃滥用；本研究的"交互发光反馈"是**功能反馈**，且 Apple 明确其为材质行为（"illuminates from within as a form of feedback"）。ADR-013 §2.7.1 附录已限定 glass/popover/sheet 三面可用，微交互光效**仅在这三面内**实现；base/raised 面的反馈用影与 scale，不用光。
- HIG Motion 的"目的性"条款与 Anti-Drift 第 3/4 条同源：**Motion ≠ decoration**。
