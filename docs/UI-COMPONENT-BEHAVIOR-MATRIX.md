# UI-COMPONENT-BEHAVIOR-MATRIX — 组件行为矩阵（Phase 1.5 Frozen）

日期：2026-09-07 · 状态：**FROZEN**
范围：Phase 2A 的 **10 个 Reference Component** 全量登记（它们是后续一切组件的设计母版）；
P1 知识组件（NoteTree/Outline/LearningStatus 等）在 Phase 4 迁移前按同格式补录。
来源标注协议同 `UI-DESIGN-SYSTEM-SPEC.md`（[A] Apple Fact / [B] Interpretation / [C] OLOS Decision）。

通用硬约束（适用于所有组件）：
- 状态完备：rest / hover / pressed / focus-visible / disabled / loading / selected（[A] "Always include a press state for a custom button"——HIG Buttons）
- 命中区 ≥ 44px [A]；语义 HTML；键盘可达；Esc 关闭浮层 + focus restoration [A/B]
- 动效走 `UI-MOTION-SPEC`；材质走 DESIGN-SYSTEM-SPEC §4；每组件过动画九问
- Responsive 检查点：1440 / 1200 / 1024 / 768（[C]），窄窗 Explorer/Inspector 折叠、Workbench 保主体

---

## 1. Button

- **Anatomy**：`label · icon(前/后) · prominence(regular|prominent|plain|destructive|glass) · size(sm|md|lg) · loading`
- **Prominence 规则** [A]："Keep the number of prominent buttons to one or two per view."；"Use style — not size — to visually distinguish the preferred choice."
- **Role**：destructive 用系统红语义且**永不 prominent** [A]
- **States**：rest / hover（surface 提亮 + shadow-1）/ pressed（**scale 0.97 + 内侧加深**，spring-snappy）/ focus-visible（ring）/ disabled（降透明不降尺寸）/ loading（spinner 替换 icon，label 可改进行时态 [A] "Checkout → Checking out…"）/ success（短暂 ✓ 后回落）
- **Material**：regular/prominent/destructive/plain → raised 系；`glass` prominence 仅在 functional layer 内使用（glass-regular 材质、无边框叠加）[A] 系统提供 glass/glassProminent 按钮样式的转译
- **形状**：横排 capsule、纵列 rounded-rectangle、icon-only 圆形 [A]
- **A11y**：`<button>`；loading 时 `aria-busy`；destructive 不做默认焦点
- **Responsive**：sm 触点 32px 最小（含 padding 凑满 44 命中区）

## 2. IconButton

- **Anatomy**：`icon · tooltip(必需，icon-only 语义) · prominence · shape(circular)`
- **States**：同 Button；**icon 不做高频 hover 动画** [C]（HIG Motion："avoid adding motion to UI interactions that occur frequently"）
- **Motion**：press spring-snappy；确认类图标（复制成功）才允许一次 bounce（ICON-MOTION-SPEC）
- **A11y**：必带 `aria-label`；命中区 ≥44px

## 3. Tabs

- **核心要求**：**selection continuity** [B]——单一 active indicator（玻璃胶囊/滑块）作为**同一个空间实体**在 tab 间移动（FLIP），禁止"旧背景消失 + 新背景出现"[A] morphing 语义（"dynamically morphs between the controls... singular floating plane"，219）
- **States**：rest / hover（仅文字提亮）/ selected / focus-visible / disabled
- **Motion**：indicator 移动 spring-gentle；**retarget 必须**：A→B→C 快速切换时指示器从当前位置直接奔向 C，不排队播放（UI-MOTION-SPEC §velocity continuity）
- **Material**：tab 条本身 raised（内容层）；active indicator 可用 accent-soft 填充，**不用玻璃**（tab 条不是浮层）
- **A11y**：`role="tablist/tab"` + `aria-selected` + 方向键导航
- **Responsive**：溢出时横向滚动 + 边缘 ScrollEdgeFade

## 4. SegmentedControl

- **核心要求**：active capsule 是**持续存在的空间实体**——move / morph / settle [B]（同 Tabs 依据）
- **States**：每段 rest/hover/selected/disabled；segment 文本随选中态切换 text-primary/inverse
- **Motion**：capsule 宽度随段宽 morph（width+transform 同帧），settle 带 spring-gentle 微过冲；快速连点 retarget
- **Material**：容器 raised；capsule 用 accent-soft 或 surface-elevated+shadow-1（**非玻璃**，控件属内容层）
- **A11y**：`role="radiogroup"` 语义或 `aria-pressed` 组

## 5. SearchField

- **States**：idle / focus / typing / loading / results / empty / error
- **Focus 响应**：不止 border 变橙 [C 指令书]——容器 surface 提亮（sunken→elevated）、影升起（shadow-1→2）、放大镜图标 accent 化、快捷键 hint 淡出；整体 spring-gentle
- **Material**：sunken 面（内容层）；置于 Toolbar 内时继承浮层材质但**自身不加玻璃**（glass-on-glass 禁）
- **Motion**：results 面板从输入框下缘 materialize（origin=输入框）；loading 时 icon→spinner（Magic Replace）
- **A11y**：`role="searchbox"`；结果列表 `aria-activedescendant`；Esc 清空/收起
- **Responsive**：≥1024 常驻 TopBar；窄窗折叠为 icon 触发

## 6. Toolbar

- **定性**：**Functional Layer** [A]（"Toolbars take on a Liquid Glass appearance... provide a grouping mechanism"）——不能做成大 Card
- **Anatomy**：`group(primary/secondary) · divider(ToolbarSpacer) · overflow(⋯) · item`
- **States**：item 同 IconButton；group hover 聚合反馈（整组微抬升而非单点跳）
- **Material**：glass-regular（浮动 Toolbar）或 floating（贴边静止）；组内共享背景，**组内项不再各自加底** [A] "don't mix text and icon items in a shared background"
- **Motion**：整组 materialize（随所在浮层）；overflow 菜单从 ⋯ 原 materialize
- **A11y**：每 item 有 label；overflow 用 menu 语义

## 7. Popover（Material Reference 母版）

- **Anatomy**：`trigger · origin · surface(glass-regular) · content · (arrow 可选)`
- **Motion**：**从 trigger origin materialize**（opacity 0.96→1 + scale 0.98→1 + blur 2→0 + origin 相对位移→0，spring-gentle）[B]（219："the bubble simply pops open"；参数 [C]）；关闭 dissolve（更快、无回弹、朝关系方向微退）
- **Interaction**：Escape / outside click / focus trap / **focus restoration** [A/B]
- **禁止**：屏幕居中 fade in [C 指令书]；嵌套玻璃；内容长文用 clear（[A] text-heavy 用 regular）
- **A11y**：`role="dialog"`（非模态）或 menu 语义；`aria-expanded` 于 trigger
- **Responsive**：空间不足自动翻转到可用侧；≤768 降级为 Sheet（同一 state model）

## 8. Sheet

- **定性**：上下文关系呈现，不是 bottom:0 滑块 [C 指令书]
- **State model**（冻结，为手势预留）：`closed → opening → open → dragging(reserved) → closing`；状态机实现，禁止 CSS 类直切
- **Material**：glass-regular（顶部圆角 lg）；底内容可 ScrollEdgeFade
- **Motion**：自底 materialize（translateY 8%→0 + opacity 0.96→1 + blur，spring-gentle）；关闭 dissolve 向下退出；**interrupt-safe**（拖动预留：transform 由状态机驱动而非 keyframe）
- **A11y**：`aria-modal`、focus trap、Esc、focus restoration [A]
- **Responsive**：宽窗可做居中 modal sheet（同材质同状态机）

## 9. CommandPalette

- **定性**：Workbench 核心交互，floating functional layer 一等公民 [B]，不是普通 Dialog [C 指令书]
- **Anatomy**：`query field · result groups(Recent/Notes/Concepts/Actions) · active row · footer hints(↑↓ Enter Esc)`
- **Motion**：顶部居中 materialize（origin=屏幕顶缘，对应快捷键唤起的来源感 [C]）；组间 stagger ≤ 40ms [C]（表达分组，非装饰）
- **Interaction**：Cmd/Ctrl+K 唤起；keyboard-first（↑↓/Enter/Esc）；**focus restoration**；快速连续输入不闪烁（结果更新不重放进场动画）
- **Material**：glass-regular + shadow-4（z-palette 最高层）
- **A11y**：combobox/listbox 语义；结果数 `aria-setsize`
- **Responsive**：宽度 min(680px, 90vw)；窄窗全宽

## 10. Toast

- **定性**：feedback system（success/info/warning/error 四语义）
- **State model**：`materialize → idle → (hover pause) → auto dismiss / manual dismiss`
- **Motion**：右下角 materialize；自动消失前 3s 呼吸提醒（**可取消**：hover 暂停计时 [A] "Let people cancel motion"）；离场 dissolve
- **Material**：glass-regular（瞬时反馈浮层）；左侧状态色条（4px，语义唯一用色处）
- **A11y**：`role="status"`（success/info）/ `role="alert"`（error/warning）；不抢焦点
- **Responsive**：窄窗置底全宽

---

## 附录：State Matrix 汇总表（验收用）

| 组件 | rest | hover | pressed | focus | disabled | loading | selected | 打断安全 |
|---|---|---|---|---|---|---|---|---|
| Button | ✓ | ✓ | ✓ 强制 | ✓ | ✓ | ✓ | ✓(aria-pressed) | ✓ retarget |
| IconButton | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tabs | ✓ | ✓ | — | ✓ | ✓ | — | ✓ 连续体 | ✓ velocity |
| SegmentedControl | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ capsule 实体 | ✓ retarget |
| SearchField | ✓ | ✓ focus | — | ✓ | ✓ | ✓ | — | ✓ |
| Toolbar | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Popover | ✓ open | — | — | ✓ trap | — | — | — | ✓ Esc/outside |
| Sheet | state machine | — | — | ✓ | — | — | — | ✓ gesture-ready |
| CommandPalette | ✓ | ✓ row | ✓ | ✓ | — | ✓ | ✓ active row | ✓ |
| Toast | lifecycle | pause | ✓ dismiss | — | — | — | — | ✓ |
