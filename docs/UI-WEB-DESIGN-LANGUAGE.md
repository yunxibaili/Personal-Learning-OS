# UI-WEB-DESIGN-LANGUAGE — Web 转译与设计语言裁定（Phase 1 Design Direction）

日期：2026-09-07 · 依据：《UI-APPLE-DESIGN-RESEARCH》+《UI-APPLE-MOTION-RESEARCH》
本文回答：**Apple 的原则搬进 React + CSS + SVG + Canvas，应该如何实现**。
转译公式：`Apple principle → Interaction principle → Web implementation → Component API`。
禁止：`Apple screenshot → 复制 CSS`。
（本文取代 UI-REBUILD-DESIGN-AUDIT.md 中与之冲突的设计决定；该文档的工程结构与实施序列仍有效。）

---

## 1. 核心转译表

| Apple 原则 | 交互原则 | Web 实现 | 组件 API 落点 |
|---|---|---|---|
| Liquid Glass = 悬浮功能层 | 导航/控件浮于内容之上，内容永远不被遮挡 | position 层级 + z-index 协议 + `glass-regular` 材质类 | `TopBar / ActivityRail / CommandPalette / PeekPanel / Popover / Sheet / Drawer` |
| 内容层禁玻璃 | 阅读面只做信息层级 | 平色 surface + spacing + typography 分层 | `surface-base` 上的一切阅读组件 |
| Regular / Clear 两变体不混用 | 可读性兜底 vs 媒体沉浸 | 两个材质类；clear 强制叠 `dimming-layer`（35% 黑） | `GlassSurface variant="regular" \| "clear"` |
| Scroll edge effect | 内容滚入功能层下方时溶解 | 滚动容器顶部/底部渐隐 mask（白→透明 overlay，非 blur） | `ScrollEdgeFade`（Phase 3） |
| Tab bar ≈ Sidebar 同一语言 | 宽窄屏导航语义连续 | 同一 `Navigation` 状态模型，两种渲染形态 | `ActivityRail`（窄）↔ `Explorer`（宽） |
| Tab bar 随滚动退场 | 内容最大化 | 滚动方向检测 + translateY 收纳 | `useScrollRecede`（Phase 3） |
| Concentricity | 控件"属于"容器 | radius token 推导规则：inner = outer − padding；容器统一 `--radius-xl` 面板 / `--radius-md` 控件 | 所有容器/控件默认值 |
| 标签栏可 minimize | 静止安静、交互苏醒 | 静止态低对比（secondary 文本），hover/focus 抬升 | Rail/TopBar 项 |
| Tint 只给主操作 | 一屏 1–2 个 prominent | Button prominence: prominent/regular/plain/destructive/glass | `Button prominence` |

## 2. Material System（裁定版，修订 Phase 1 实现）

| Material | 用途 | 关键属性 | 来源页 |
|---|---|---|---|
| base | 页面与阅读内容 | 平色、零效果 | — |
| raised | Explorer/ContextRail 静止面板 | 白底 + hairline + shadow-1 | — |
| floating | Floating TopBar / Rail | raised + shadow-3 | "navigation layer floats above content" |
| **glass-regular** | Palette/Popover/Sheet/Drawer/Peek/浮层 Toolbar | blur(20px)+saturate(180%) + 亮度自适应兜底 + 影随内容加深（文字上方） | regular 变体 |
| **glass-clear** | 仅媒体/沉浸背景上的瞬时控件 | 高透 + **dimming layer 35%** + 局部压暗 | clear 变体三条件 |
| immersive | Galaxy/Graph/Algorithm/代码 | 暗色 token 子树（非玻璃） | — |
| standard-thin/regular/thick（内容层） | 内容层内部分隔（如分层卡片、悬浮编辑条） | 不透明度分级，blur 可选 | HIG standard materials |

**新增硬规则（研究得出）**：
1. glass-on-glass 禁止——glass 面上的元素用 `fill + hairline`，不用第二层玻璃；
2. glass 上文字用高对比分层（对应 vibrancy）：主文 100% / 次文 75% / 三级 55%；
3. backdrop-filter 实例数预算：同屏 ≤ 3 个玻璃面（性能 + 克制双约束），源码门禁已在 Phase 1 建立并保留。

## 3. Color（语义重裁，不只给色值）

| 语义 | 作用 |
|---|---|
| canvas / surface / surface-elevated / sunken | 空间深度四层（背景→内容→浮起→下沉） |
| text-primary/secondary/tertiary | 信息降噪（HIG vibrancy 分级思想：default/quaternary 对比度递减） |
| **accent（橙）** | **注意力指针**：仅 primary 操作、激活态、学习警示；禁止装饰性使用 |
| selection / focus-ring | 选中与键盘焦点，永远可见 |
| success / warning / error / information | 状态语义；destructive 永不做 prominent |
| glass 文本分层 | 100/75/55%（vibrancy 转译） |

## 4. Typography & Spacing & Radius（确认 Phase 1 方向，微调）

- 双尺度（阅读 17/1.75 + UI 13–14）与 680px 行宽：**确认保留**（产品语义，与 Apple typography 分级兼容）。
- 字阶补充：数字/学习指标用 `--text-title` + tabular-nums（Canvas/Inspector 场景）。
- spacing 4pt 基准保留；新增规则：**分组间距 ≥ 组内间距 × 2**（Apple grouping 语义）。
- radius 推导规则固化为 CSS：容器 lg(16)→控件 sm(8)→胶囊 999；玻璃面 radius-xl(22)。

## 5. Motion System（修订版 token）

```css
/* 时长（保留 Phase 1） */
--motion-instant/fast/standard/slow/spatial
/* 新增：弹簧（spring 模型，linear() 实现，零依赖） */
--spring-snappy:  /* 控件按压/hover，~260ms, bounce 0.12 */
--spring-gentle:  /* 面板/抽屉，~320ms, bounce 0.05 */
--spring-bouncy:  /* 确认反馈（图标 Magic Replace/Bounce），~400ms, bounce 0.45 */
/* 新增：语义动画 */
--anim-materialize / --anim-dissolve / --anim-morph
```

**选型规则（写进组件规范）**：transform → spring；opacity/color → duration curve；
进场 materialize（blur+scale+位移，从触发原点）；离场 dissolve（更快、无回弹）；
reduced-motion：时长归零但**保留 opacity 反馈 + 状态色 + 非动效层级线索**（HIG："Make motion optional"≠信息丢失）。

## 6. Component Anatomy（Phase 2 硬约束，逐组件）

每个组件登记：anatomy / states / motion / material / a11y / web strategy。首批示例：

**Button**（HIG 已给 anatomy：Style×Content×Role）
- anatomy：`label · icon · prominence(prominent|regular|plain|destructive|glass) · size(sm|md|lg) · loading · motion`
- states：default/hover/pressed(**强制**，无 press state = unresponsive)/focus-visible/disabled/loading
- shape：横排 capsule、纵列 rounded-rectangle、icon-only 圆形；命中区 ≥44px
- motion：press = spring-snappy scale 0.97；prominent 才用 accent 底
- a11y：语义 `<button>`、`aria-busy` loading、destructive 不做 default focus

**Popover / Sheet / Drawer / Dialog**（浮层族，glass-regular 默认）
- anatomy：`anchor · surface(glass-regular) · arrow(可选) · content`
- motion：从 anchor 原点 materialize（scale 0.98→1, blur 2→0, spring-gentle）；离场 dissolve
- a11y：focus trap、Esc、**focus restoration**（Adopting 文档与指令书 §11 一致）
- 禁：嵌套玻璃；内容长文用 regular（"text-heavy 组件用 regular"——HIG Materials）

**SearchField / CommandPalette**
- anatomy：`field · placeholder · shortcut hint · result groups(Notes/Concepts/Actions/Recent)`
- motion：面板 materialize；结果组 stagger ≤ 40ms（"stagger"有目的：表达分组，不是炫技）

**Skeleton / EmptyState / ErrorState / Toast**
- 状态即设计（指令书 §32）；skeleton 用内容层 standard material（不玻璃）；toast 浮层 glass-regular，自动消失 + hover 暂停（可取消原则）

其余组件在 Phase 2 开工时按同表格式逐个补充进本文档附录。

## 7. Workbench（裁定，替代 ASCII 图的字面理解）

按研究结论组织：**功能层（Rail + Floating TopBar）浮于内容层（Workbench + Explorer + Inspector）之上**；
Explorer/Inspector 是**内容层的一部分**（raised 面板，非玻璃——glass 只给 Rail/TopBar/Palette/Peek/浮层）。
此裁定修正了"上一轮把 ContextRail 也当浮层"的潜在误读。窄屏时 Rail 保持、Explorer 收起、Inspector 折叠为 Sheet（glass-regular）。

## 8. Quality Gate（合并指令书 §21/§22/Quality Bar）

- 每个 Phase 交付 = 代码 + Playground 样张 + **真实浏览器验收**（无头 Chromium：截图、computed styles、交互、reduced-motion 模拟、主应用回归）+ 门禁测试。
- Animation 七问（Why/What/Relationship/Meaning/Timing/Interruptibility/Reduced Motion）写进组件文档；答不出不加。

## 9. 对 Phase 1 代码的处置

保留：目录结构、tokens 清单、surface 分层、源码门禁模式、Playground 骨架、z-index 协议、radius/space。
修订（Phase 2 首个 PR 内完成）：glass 拆 regular/clear+dimming、spring token 落地（linear()）、reduced-motion 降级策略细化、glass 文本分层、影随内容策略（glass 面 hover 加深）、Playground 升级为 Component Laboratory（含"设计研究证明"卡：每个组件旁展示 Principle/Material/Motion/A11y/Web strategy——指令书 §11）。

---

## 附：来源与置信度

- 高置信（原文提取）：HIG Materials/Buttons/Motion、WWDC25-219 全转录、Adopting Liquid Glass、SF Symbols 官方页、SwiftUI Phase/Keyframe 文档。
- 中置信（章节级，未全转录）：WWDC25-356/323——其结构与控件主题已被 219 + Adopting 覆盖，Phase 2 组件实现前如需可补看章节视频。
- 未访问：Mobbin / Awwwards（组件实现期再查）；Radix（行为参考，Phase 2 浮层组件实现时对照其 focus management 模式，仅参考不引入）。
