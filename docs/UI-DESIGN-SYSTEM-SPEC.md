# UI-DESIGN-SYSTEM-SPEC — Open Learning OS 设计系统规范（Phase 1.5 Frozen）

日期：2026-09-07 · 状态：**FROZEN**（Phase 1.5 Design Specification Freeze）
依据链：`UI-APPLE-DESIGN-RESEARCH.md` + `UI-APPLE-MOTION-RESEARCH.md` → 本文 → `UI-COMPONENT-BEHAVIOR-MATRIX.md` / `UI-MOTION-SPEC.md` / `UI-ICON-MOTION-SPEC.md`
正式名称：**Open Learning OS — Dynamic Spatial Learning UI**

> **来源标注协议（强制）**：每个设计决定标注层级——
> **[A] Apple Fact** = Apple 官方原文要求 · **[B] Apple-derived Interpretation** = 从 A 推导的转译 ·
> **[C] OLOS Decision** = 本项目自选参数/启发式（可经视觉审查调整，**不得**冒充 Apple 规范）。

---

## 1. 设计语言定义

**Dynamic Spatial Learning UI** = Spatial hierarchy + Functional layer + Content-first layout
+ Contextual materials + Physical interaction + Purposeful motion。

> [A] "Liquid Glass forms a distinct functional layer for controls and navigation elements... that floats above the content layer."（HIG Materials）
> [B] Liquid Glass 只是 Functional Layer 的一种 Material，**不是产品视觉主题**。
> [C] 质量优先级：Content > Hierarchy > Interaction > Context > Material > Motion > Decoration。

## 2. 层模型（最高约束）

| 层 | 成员 | 允许材质 | 禁止 |
|---|---|---|---|
| **CONTENT LAYER** | 笔记正文、阅读面、概念内容、Learning Status、Review 内容、代码、Graph 数据、算法解释、**Explorer/Inspector 面板** | base / raised / standard(thin/regular/thick) | Liquid Glass、glass-on-glass、装饰 blur/glow/gradient |
| **FUNCTIONAL LAYER** | Activity Rail、TopBar、Toolbar、Command Palette、Popover、Sheet、Drawer、Peek、瞬态控件 | glass-regular（默认）/ glass-clear（媒体之上）/ floating | 过度着色、信息垃圾场 |

> [A] "Don't use Liquid Glass in the content layer." · "always avoid glass on glass."（219/HIG）
> [B] Explorer/Inspector 归内容层——它们承载知识本身，玻璃化会与阅读争夺注意力。
> [C] 稳态下内容不与玻璃相交（滚动用 ScrollEdgeFade 溶解，Phase 3 实现）。

## 3. Color Token（语义即层级）

> [A] "Tinting should only be used to bring emphasis to primary elements and actions."（219）
> [B] 橙色 = 注意力指针，继承自白橙 v1 的**语义**而非实现。
> [C] 具体色值（OLOS Decision，见 `design/tokens.css`；dark immersive 子树随 `data-surface` 切换）。

| 语义 | Token | 层级作用 |
|---|---|---|
| canvas / surface / surface-elevated / sunken | `--color-background/surface/surface-elevated/surface-sunken` | 空间深度四级（背景→内容→浮起→下沉） |
| text-primary/secondary/tertiary | `--color-text-*` | 信息降噪（对应 HIG vibrancy default→quaternary 对比度递减 [A]） |
| functional accent（橙） | `--color-accent / accent-soft / accent-text` | **仅** primary 操作、激活态、学习警示 |
| selection / focus-ring | `--color-highlight / --color-focus-ring` | 键盘焦点永远可见（HIG：focus 不可仅靠颜色微差 [A]） |
| success / warning / error | `--color-*` | 状态语义；destructive 永不 prominent（[A] HIG Buttons） |
| glass 文本分层 | 100% / 75% / 55% | [B] vibrancy 转译：玻璃面上文字按层级降不透明度，不用次级玻璃 |

## 4. Material System（注册表，取代单一 `surface-glass`）

| Material | 用途 | 关键属性 | 来源 |
|---|---|---|---|
| base | 页面/阅读 | 平色零效果 | [C] |
| raised | 内容层内浮起面板（Explorer/Inspector/卡片） | 白底+hairline+shadow-1 | [C] |
| floating | Rail/TopBar 静止容器 | raised + shadow-3 | [C]（语义 [A] floating functional layer） |
| **glass-regular** | Palette/Popover/Sheet/Drawer/Peek/浮层 Toolbar | blur+saturate + 亮度自适应兜底 + **影随内容加深**（文字上方影更实） | [A] regular 变体："provides legibility regardless of context... text-heavy safe" |
| **glass-clear** | **仅**富媒体/沉浸背景上的瞬时控件 | 高透 + **dimming-layer 35%** + 上层内容粗壮明亮；局部压暗允许 | [A] clear 变体三条件（HIG Materials） |
| standard-thin/regular/thick | 内容层内部分隔（悬浮编辑条、分层卡） | 不透明度分级 | [A] standard materials |
| immersive | Galaxy/Graph/Algorithm/代码 | 暗色 token 子树（非玻璃） | [C] |

**Glass 规则**：
1. glass-regular 为默认；glass-clear 须同时满足 [A] 三条件，且**与 regular 不得在同一视图随意混用** [A]；
2. **glass-on-glass 禁止** [A]——玻璃面内控件用 fill + hairline + 对比分层，不再叠玻璃；
3. **同屏 glass 面 ≤ 3**——[C] OLOS design/performance heuristic（非 Apple 规则），真实浏览器验收后可调；
4. glass 面文字不得使用 quaternary 级对比 [A]（"avoid using quaternary on top of thin/ultraThin materials"的转译）。

## 5. Typography（双尺度，冻结）

> [C] 阅读 17px/1.75 + UI 13–14px 双尺度与 680px 行宽为 OLOS 产品语义（继承自 08-31 裁定，非 Apple 参数）。
> [A] 字阶思想对齐 HIG（display→caption 递减、大标题收字距）。

字阶与 class 定义见 `design/typography.css`；新增：**数字/学习指标用 tabular-nums**（Canvas/Inspector 数值对齐）[C]。

## 6. Spacing / Radius / Concentricity

- spacing 4pt 基准（`--space-3xs..3xl`）[C]；**分组间距 ≥ 组内间距 × 2** [B]（Apple grouping 语义转译）。
- **Concentricity** [A]："Glass controls nest perfectly into the rounded corners of windows, maintaining concentricity throughout the UI."
  [C] 推导规则：inner radius = outer radius − padding（取整到 2px）；容器 lg(16)→控件 sm(8)→capsule 999；玻璃面 radius-xl(22)。z-index 协议（base→toast 六级）沿用 Phase 1，**不得组件内自造 z 值**。

## 7. Depth（影的语义）

> [A] "The element is aware of what's behind it and increases the opacity of its shadow when it is over text... lowers... over a solid light background."（219）

[B]/[C] 转译：影 = 可读性机制，不是装饰。四级 shadow token 对应四级浮起高度；**glass 面在文字上方必须加深影**（CSS 无法逐像素感知内容，Phase 2 以「glass 面覆盖滚动内容时加 `.is-over-content` 态」近似实现）；禁止彩色 glow（ADR-013 §2.7.1 维持）。

## 8. Navigation / Functional Layer 模型

> [A] "The sidebar and tab bar, together, form a cohesive and consistent language for the core navigation... a single navigational element that fluidly scales as the canvas grows."（219）
> [A] "Tab bars can... recede when a person scrolls up or down."（Adopting）

[B]/[C] 落地：ActivityRail（窄）↔ Explorer（宽）同一导航状态模型；TopBar/Rail 随滚动退场（`useScrollRecede`，Phase 3）；CommandPalette 是 functional layer 的一等公民（不是普通 Dialog）。

## 9. 冻结清单与守护

| 冻结项 | 守护 |
|---|---|
| 内容层禁玻璃 + glass 仅三类浮层 | `design-tokens.test.ts` 源码门禁（保留并扩展） |
| glass 拆 regular/clear、clear 带 dimming | Phase 2A 首个 PR 修订 surfaces.css 并同步门禁 |
| 零大型 UI 依赖（React/TS/CSS/SVG/Canvas/Web API 之外须审批） | package.json 门禁（新增依赖测试） |
| 冻结 UX 语义（presentError/assistantMessageView/sessionStorage 指针/tutorSeed≠自动发送） | 既有测试延续，rebuild 不碰 |
| 旧 web//ui/ 资产只作考古 | 无复制；如发现复制即 review 退回 |
| 本 SPEC 的 [C] 参数（glass≤3、0.97、blur 20、stagger 40ms、680px） | 标注为 OLOS heuristic，真实浏览器验收后可调，调值不需新授权、调**规则**需新授权 |

## 10. 与其他三份 SPEC 的分工

- `UI-COMPONENT-BEHAVIOR-MATRIX.md`：组件级 state×material×interaction×motion×a11y×responsive 矩阵（Phase 2A 的 10 个 Reference Component 全量登记）。
- `UI-MOTION-SPEC.md`：motion 分类、spring 模型、materialize/dissolve/morph、retarget/velocity continuity、reduced motion。
- `UI-ICON-MOTION-SPEC.md`：内部图标分层结构与语义动效。
