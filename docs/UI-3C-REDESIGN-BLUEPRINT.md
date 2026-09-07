# OLOS 3C UI REDESIGN BLUEPRINT

日期：2026-09-07 · 阶段：3C Research & Blueprint（**只研究，不实施**）
依据：Style Audit（`PASS WITH ISSUES / B`）+ 本轮外部研究（Apple 官方 / 5 个源码仓库 / 8+ 成熟产品 / 主动外搜）
约束遵守：**代码未改 · 未 commit · 未加依赖 · 未碰 backend**

---

## 1. Executive Summary

OLOS 已具备正确组件与正确层边界；**缺的是“空间如何承载知识工作”**。本轮核心结论：

1. 大屏（≥1600）多出的空间不应变成巨大空白，也不应收拢成右侧 Panel——应成为**阅读场（Reading Field）之外的上下文边距（Contextual Margin）**：边注标记、回链、批注、Peek 落点。
2. **Context 应伴随当前对象**（贴着阅读度量右缘浮动），而不是钉在窗口右缘的面板。
3. **Peek 属于边缘空间**：能进边距就不压正文。
4. P0 是栅格列位缺陷（Context-only 时 Work Surface=264px），必须先修。

---

## 2. Current OLOS State（实测）

| 项 | 现状 |
|---|---|
| 层边界 | 内容层零玻璃；唯一 glass=`.wb__header`；渐变仅 `wb-link` |
| 组件 | ios27 移植六组件 + OLOS 原语；CodeSurface/Math 已落地 |
| 布局 | S0–S4 状态机；**S1-Context-only 列位错误（P0）** |
| Context | 4 个 section；concept 匹配 0 命中；无 Prereq/Backlinks/Review Due |
| Peek | 锚定 source；覆盖阅读列 44%；缺 Ask Tutor |
| Compare | 双阅读面共享几何；关系动作仅 swap/close/Link(内存) |
| Tabs | 静态 pill（ComponentLab 已有 morph indicator 未复用） |
| 大屏 | 2560 → surface 2508 / reader 680 → 1828px 空白 |
| 动效 | transform→spring、颜色→curve 正确；tab 无连续性 |

---

## 3. Apple Research（本轮新增/复核）

| 来源 | 关键原文 | 对 OLOS 的启示 |
|---|---|---|
| HIG Layout | “**Align components with one another to make them easier to scan and to communicate organization and hierarchy.**” “**Group related items… use negative space, background shapes, colors, materials, or separator lines**.” | 层级靠对齐+负空间；不是靠边框 |
| HIG Toolbars | 三个区（leading/center/trailing）；“**Minimize the number of groups… aim for a maximum of three**”；“**Only specify one primary action, and put it on the trailing side**”；“**Use a large title… transitions to a standard title as people begin scrolling**”；“**Reduce the use of toolbar backgrounds and tinted controls… use the content layer to inform the color and appearance of the toolbar**”；自定义组件圆角须与栏同心 | Header 分组 ≤3；单一 primary；大标题→紧凑标题过渡；工具栏少背景 |
| HIG Scroll Views（2026-06） | “**Only use a scroll edge effect when a scroll view is behind floating interface elements… Apply one scroll edge effect per view; keep them consistent in height**” | 每 pane 一个、等高一致（已部分达成） |
| HIG Split Views | “**use a split view to show multiple levels of your app's hierarchy at once**”；“**Consider letting people hide a pane**” | pane 是按任务出现，不是模板 |
| HIG Tab Bars | 用于导航非动作；“**Don't disable or hide tab bar buttons**”；可 minimize | Rail 不应有 disabled 项 |
| HIG Typography | iOS 默认正文 17pt、最小 11pt；避免 Ultralight/Thin/Light；“**Adjust font weight, size, and color as needed to emphasize important information**”；leading 由 text style 定义（松/紧可调） | 中文正文 17 合规；标题权重可加强；行距可按列宽调 |
| HIG Materials / 219 | Liquid Glass = 功能层；“**Don't use Liquid Glass in the content layer**”；lensing/morph/materialize | 玻璃不进内容层（已遵守） |

**Apple 高级感来自**：对齐关系、分组数量克制、单一主操作、大标题→紧凑的滚动过渡、边缘渐隐（scroll edge）、圆角同心、内容决定 chrome 外观。

---

## 4. Source Repository Research（5 个，全部 MIT）

| Repo | What it does | Why it works | OLOS 可复用 | 不可复用 |
|---|---|---|---|---|
| ios27-design-system | 36 组件 spec + 48 page recipes + React 实现 + tokens | 几何/尺寸/动效按 iOS 规格表固化 | 已移植 6 组件；**待校准**：Button 尺寸表(28/34/44/50/56)、Toolbar 三区、Sheet detent | 其 iPhone 页面 IA、Apple 蓝 |
| LiquidGlass-UI | 原生 Web Components，零运行时依赖；光学折射管线 | 不依赖框架即可获得材质 | 折射管线结构（如需升级材质时参考） | 直接引入其组件体系 |
| simple-liquid-glass | React + `<liquid-glass>` WC；**Chromium 折射 / 其它浏览器磨砂降级** | 明确的能力边界声明（llms.txt） | 降级策略写法；能力声明范式 | 依赖本体（不装） |
| lore-glass | 组件行为参考（Button/Dialog/Popover/Tabs…） | 按压凝胶感、边缘 falloff、specular | 按压反馈与边缘规格的表达方式 | 其 registry 结构 |
| liquidglass-react | Sheet/TabBar/Toolbar/Menu/Alert/Growl 组合 | 展示 Apple 式组件如何**共存** | 组件间组合节奏（spacing/层级） | 其视觉主题 |

**结论**：源码层面已“够用”，本轮不复制新组件；只做 **integration 校准**（尺寸表、分组、圆角同心、动效曲线统一）。

---

## 5. Product Research（8 个成熟产品）

| 产品 | 空间机制 | 关键引文/事实 | OLOS 取什么 |
|---|---|---|---|
| **VS Code** | editor groups + Peek + breadcrumbs + preview tab | “**We think there's nothing worse than a big context switch when all you want is to quickly check something.**”(Peek) | 查看第二对象不离开第一对象（Peek/Compare 已对齐） |
| **Obsidian** | panes/tabs/linked views；backlinks 跟随活动笔记 | linked view 随引用对象变化；sidebar 可驻留 | Context 跟随焦点对象重排（recompose） |
| **Tana** | **Tab=工作流，Panel=同一工作流内的第二个对象**；`Cmd+Click`→tab，`Shift+Click`→panel | “**Panels let you open nodes next to each other.**” “**Tabs is supported… to easily switch back and forth between content.**” | 打开动词分级（已实现）；区分 Tab vs Panel 语义 |
| **Zotero** | PDF↔批注↔笔记；**Show on Page** 回跳原位置 | 批注带回链与引文；可从笔记跳回 PDF 原位置 | Annotation↔Source 双向锚定（OLOS 学习链核心） |
| **Notion** | side peek / center peek / full page；details panel；backlinks 可 Always show/Show on hover/Off | 三档打开方式按视图默认；details panel 可开合 | Peek 三档形态；Backlinks 显示策略（hover 优先） |
| **Craft** | 块式文档、封面、卡片、可发布页 | 结构化文档 + 漂亮排版 | 文档级排版细节（标题/封面/间距） |
| **Bear** | 极简写作 + focus mode + 嵌套标签 + 主题 | “**Focus Mode strips everything away until it's just you and the words.**” | Focus(S4) 的极简标准；排版温度 |
| **Heptabase** | 白板 + 可复用卡片 + Highlight Card + 右侧卡库作参考面板 | 高亮→Highlight Card→可拖到白板→**可定位回原文** | 高亮升级为对象；批注链；右侧作为“参考面板”而非 dashboard |

---

## 6. Additional External Research（主动外搜）

- **Aura UI**（macOS-inspired Next.js，MIT）：玻璃导航 pill + Bento + 单文件 token `@theme` → 印证“token 集中化”；但**Bento/大圆角卡网格是 AI 味来源**，OLOS 不采用。
- **apple-fluid-design / Fluid Glass**（社区）：把 WWDC《Designing Fluid Interfaces》落成 tokens+materials+motion（可中断弹簧/速度追踪）→ **material 分档 + 可中断弹簧**与 OLOS Motion Spec 同向。
- **Puppertino / darwin-ui**（macOS 风组件库）：严格 HIG、按需引入 → 证明“HIG 可落地为 web 组件”，但它们**自带 Tailwind/Framer**，OLOS 仅参考规格不引入。
- **macOS Web（Svelte 复刻桌面）**：窗口/程序坞/菜单的**窗口级层级** → 对 OLOS 的启示是“窗口是连续空间，不是卡片集合”。

分类标注：以上为 **Open Source Implementation / Community Opinion**；**Official Design Guidance 仅 Apple HIG**；产品官网为 **Real Product**。Dribbble/Behance 不作为规范依据（本轮未采用其视觉主张）。

---

## 7. Apple Feel Decomposition

| 构成 | OLOS 已有 | 缺失 | 不采用 |
|---|---|---|---|
| Typography | 双尺度、字阶清晰 | 中文标题权重/字距需肉眼校准；数字 tabular 未全覆盖 | 超大 display 字 |
| Spatial Hierarchy | 阅读列居中、meta 安静 | 大屏无结构留白 | — |
| Concentricity | 半径分层存在 | header/tab/控件未形成内外推导 | 处处同半径 |
| Material Restraint | 仅 header/palette/peek 用玻璃 | — | 内容层玻璃 |
| Selection Continuity | Segment/指示器在 ComponentLab | **Workbench tab 无** | 为动画而动画 |
| Motion Continuity | transform→spring 正确 | tab/peek retarget 未量化 | hover scale |
| Adaptive Layout | S0–S4、抽屉 | **S1 列位错误** | iPhone 放大版 |
| Quiet Controls | Rail 安静、无 disabled | — | 徽标/badge |
| Functional Depth | header 渐隐+紧凑 | 深度差可再强化 | 重阴影 |

---

## 8. OLOS Design Principles（本轮新增三条）

1. **One object in focus, everything else in the margin.** 大屏增加的是**边距与参考空间**，不是 UI 数量。
2. **Context陪伴不占位**：Context 贴阅读度量右缘浮动（companion），不占窗口右缘固定列。
3. **Peek 属于边缘**：能进边距就不压正文；压正文时必须可逆（Esc/外点/再点重定位）。

---

## 9. Layout System（P0 修复 + 大屏模型）

### 9.1 列位修复（Decision D-01 · 已按 Owner 4 条修正重写 · 3C-1 已实施）

- **Decision**：`grid-template-areas` + 布局引擎（`workbench/layout.ts` 纯函数 `computeLayout`）按 pane 存在性与视口计算列；各 pane 显式 `grid-area`（单一真相源，旧的 `data-layout` 列规则已退场）。
- **修正 1（已实施）**：`680` 是 **Reading Measure 目标**，不是无条件物理最小宽度；优先级
  `Work Surface > Context > Explorer > Decorative margin`；Context/Explorer 是**可让位 pane**
  （同时开启且 Work Surface < 720 → Context 转抽屉；<1024 一律抽屉；Compare 窄屏→单列 + 全高 Sheet）。
- **修正 2（3C-2 验收标准）**：Context 绝不是“搬到 reader 边缘的 320px 侧栏”；必须具备
  **anchor / density / temporal relevance / hide-show / recomposition**。
- **修正 3（已纳入）**：2560 第一版不做 `AnnotationMargin` 信息系统；边距先承载真实知识关系
  （Peek 落点 / 回链 / Context），AnnotationMargin 仅作 layout host 预留。
- **修正 4（已纳入）**：Compare 头部只保留 **1 个 primary + 1 个关系入口**，其余进 overflow / 上下文菜单。

**3C-1 实测（修复后）**：Context-only 时 Work Surface = 908 / 1068 / 1544 / 2184（1280/1440/1920/2560；**修复前为 264**）。
- **Why**：当前按 DOM 顺序分配列位，Explorer 缺席时 Surface 落到 264px 列。
- **Evidence**：实测 `layout=S1, surface=264, context=964/1124/1604/2244`（1280–2560）。
- **Reference**：HIG Split Views（显式层级）、ADR-031。
- **Trade-off**：需重写 `.wb` 栅格；风险低，收益=修复主工作面。
- **Priority**：**P0**

### 9.2 Layout Matrix

| 视口 | Rail | Explorer | Work Surface | Context | Compare |
|---|---|---|---|---|---|
| 1280 | 52 | 264（可选） | 1fr | 伴伴随（≤320，重叠式浮层） | — |
| 1440 | 52 | 264 | 1fr | companion 320 | S3 对半 |
| 1920 | 52 | 280 | reading 680 + margin | companion 340 | S3 对半 |
| 2560 | 56 | 300 | reading ≤760 + 大 margin（边注/回链/Peek） | companion 360 | S3 对半 + 可选第三参考列 |
| 768 | 44 | 抽屉/全高 Sheet | 全宽 | 右侧 Sheet | 单列切换 |

**大屏多出的空间承载顺序**（有推理的优先级）：① 边注标记/批注边距 → ② Peek 落点 → ③ 回链与小纲 → ④ 第二 Work Object（仅当用户显式并置）。**禁止**用卡片填空。

---

## 10. Workbench

- Header 分组（HIG 三区）：**leading**（返回/Explorer 开合 + 标题）│ **center**（tabs）│ **trailing**（查找/Context/单一 primary=进入专注或 Tutor）。
- 大标题→紧凑标题：滚动 >阈值时标题收缩进 header（Apple `prefersLargeTitles` 行为），并强化 scroll edge。
- Rail：保持 52（≥1920 可 56）；选中=中性底+accent 字形；无 disabled 项。

---

## 11. Reading Surface

- 保留 680 作为**阅读度量**；≥1920 可放宽至 720–760（仍为 measure，不是容器）。
- 块级度量：正文 680 / 代码 breakout ±80（已实现）/ 表格可更宽并横向滚动 / 图片按上下文宽度。
- 中文：正文 17/1.75 + 轻微正字距（已 0.002em）；标题权重建议 700（当前需肉眼确认）；meta/数字 tabular-nums（已部分）。

---

## 12. Context v2

**结构（顺序=学习相关性）**
1. Current Concept（默认）
2. Related Concepts（Standard+）
3. Prerequisites（Research 或 Standard 若有数据）
4. Backlinks / References（Standard+，默认 hover 显示，可 Always show）
5. Mastery（默认）
6. Review Due（Standard+）
7. Annotations（Standard+）
8. Tutor（默认）

**密度门控**
- Minimal：Current + Mastery + Tutor（无 section 标题、大留白）
- Standard：+ Related + Backlinks + Review + Annotations
- Research：+ Prerequisites + Sources + 全部批注（紧凑）

**Decision D-02**：Context 改为 **companion layer**（贴阅读度量右缘、可折叠、不占固定列）；概念匹配改用 concepts API（精确），回退本地解析。
- Evidence：当前 `masteryBars=0`（title 匹配失败）；Context 宽度随窗口线性膨胀（964→2244）。
- Reference：Obsidian linked view / Notion details panel（Always show vs Show on hover）/ Heptabase 右侧参考面板。
- Priority：P1

---

## 13. Peek v2

- **Decision D-03**：Peek 采用 **edge-aware placement**：若阅读列右侧 margin ≥ 320px → 落在边距（不遮正文）；否则锚在 source 下方并做碰撞翻转/上移。
- 动作：**Open / Open Right / Ask Tutor** + Esc。
- Evidence：当前覆盖阅读列 44%；仅 2 个动作。
- Reference：VS Code Peek（inline、Esc 关闭）、Notion side peek（侧向空间）、Zotero 上下文导航。
- Trade-off：需测量 margin 与视口边界逻辑；收益=不打断阅读。
- Priority：P1

---

## 14. Compare v2

**Knowledge Compare Workspace**：一个连续空间被分成两个工作场。
- 共享：排版系统、header 几何、scroll edge 等高、quiet divider（1px，hover 才显示拖拽 affordance）。
- 关系动作：**Compare（比较概念）/ Relate（关联）/ Open Source（打开来源）/ Add to Review / Ask Tutor**。
- 分类：**UI-only**＝Compare 视图切换、Relate（写入内存/待后端）、Open Source（导航）；**Backend-required**＝Relate 持久化、Add to Review（review 队列 API 已存在，可接）。
- Priority：P1（动作落地分 3C-3 与后续）

---

## 15. Tabs

**Decision D-04**：**采用** morph indicator（复用 ComponentLab 的 `tabs2__indicator` 思路）用于 WorkbenchTabs。
- Why：selection continuity + retarget 有明确收益（Apple 强调控件间 fluid morphing；seg 已验证 retarget）。
- 限制：仅用于**同组 tab 切换**；Rail（导航）不用指示器（导航不是选择态）。
- Priority：P1

---

## 16. CodeSurface

原则**冻结**（非玻璃/非渐变/非 glow/12px/深色 token 子树/9 token/Copy/横滚/breakout）。v2 仅研究：
- 行号（已有）、language 显示（已有）、Copy 位置（右上角，符合 VS Code/GitHub）、header 行为（sticky 可选）、选中态对比、密集代码的行高微调。
- **不建议**增加：主题切换器、折叠、minimap（VS Code 化风险）。

---

## 17. Math

| 方案 | 内容 | 优点 | 缺点 | 依赖 | 建议 |
|---|---|---|---|---|---|
| A | KaTeX | 真排版、快、SSR 友好 | **新增依赖**；需处理 markdown 兼容 | +1 | 需 Owner 批准 |
| B | 本地最小 LaTeX 子集渲染（分数/上下标/希腊字母/矩阵子集） | 零依赖、可控 | 覆盖面有限、维护成本中等 | 0 | **推荐先做** |
| C | 保持现状（原样 LaTeX + 排版 surface） | 零风险 | 仍非真排版 | 0 | 作为 B 的兜底 |

**Recommendation**：先 B（有限子集，覆盖 `\frac ^ _ \theta \sum \int` 等高频），若命中率不足再走 A 提案（需明确批准 + 依赖评审）。Markdown canonical 不变。

---

## 18. Annotation（研究结论）

Heptabase 模型最贴合 OLOS：高亮 → **Highlight Card（可复用对象）** → 可嵌入笔记 → **可定位回原文**。
OLOS 链路：Highlight → Annotation → Concept Link → Mastery → Review → Tutor。
当前缺口：批注**内存态**（持久化=Phase 4 提案：annotations 表 + 锚点）。本轮不改。

---

## 19. Search

- 三层（Global/Workspace/Document）保持；scope 由宿主与 placeholder 表达（已实现）。
- Palette：顶部锚定（已改 60px）、透明捕获层（已改）；结果分组与预览保持。
- 建议：≥1920 时 Palette 可略微加宽并右移预览区，使其与阅读列形成空间关系（P2）。

---

## 20. Material

| 位置 | 裁定 |
|---|---|
| Header（浮层） | glass（保留，唯一常驻玻璃） |
| Rail | 实色 surface（保留） |
| Palette / Peek / Sheet / Menu | glass（保留） |
| Context | raised（**companion 可带极轻浮起阴影，不做玻璃**） |
| Reading / Code / Math / Table | 实色（保留，代码比正文更“实”） |

结论：**当前玻璃用量已足够且克制**，不再增加。

---

## 21. Motion

- **Keep**：transform→spring、颜色/背景→curve、press=scale(.96)+brightness、scroll edge 渐隐、reduced-motion 语义降级。
- **Adjust**：tab 指示器 morph（新增）、Peek 位移跟随锚点（新增）、header 大标题→紧凑（增强过渡曲线）。
- **Remove**：无（当前无装饰动画；需防止后续引入 hover scale/背景动画）。

---

## 22. Typography

- 正文 17/1.75（Apple iOS 默认 17pt 合规）；标题 700；meta/caption 13/12 + tertiary；数字 tabular-nums 全量化。
- 中文专项：需**肉眼**校准标题字重与字距（本轮无法自动判断）；建议下一阶段做 A/B 截图对照（Bear/Craft 参照）。

---

## 23. Large Screen

- 2560：reader ≤760 + **大 margin**：边注标记、回链 chip、Peek 落点、可选小纲。
- 原则：增加**工作空间**（可写、可注、可比），不增加 chrome。

---

## 24. Responsive

| 断点 | 策略 |
|---|---|
| 1280 | Explorer 可选；Context 以重叠式 companion 出现 |
| 1440 | Explorer+Companion 并列 |
| 1920 | 阅读度量 + margin；Context companion |
| 2560 | 同上 + 更宽 margin；Compare 可容纳第三参考列 |
| ≤1024 | Explorer/Context→抽屉；768 单列 + Sheet；Compare→切换/单列 |

---

## 25. Accessibility

- 键盘：⌘K/⌘F/Esc/方向键/Enter/⇧Enter 已支持；Compare 需键盘等价（gap 操作可 Tab 到达）。
- focus-visible ring 保持；Peek/Sheet 焦点陷阱与还原（Palette 已做，Peek/Sheet 需对齐）。
- reduced-motion：新增动画（morph/Peek 位移）必须提供降级（movement→minimized）。
- 对比度：Context 文字 tertiary 需 ≥4.5:1（当前待核对）；CodeSurface 深色子树需校验对比度。

---

## 26. P0

1. **D-01 栅格列位修复**（Context-only 塌陷）。

## 27. P1

2. D-02 Context v2（companion + 精确概念匹配 + Prereq/Backlinks/Review Due + 密度门控）。
3. D-03 Peek v2（edge-aware + Ask Tutor）。
4. D-04 Workbench Tabs morph indicator。
5. Compare 关系动作（Compare/Relate/Open Source/Add to Review/Ask Tutor；区分 UI-only 与 backend-required）。
6. Header 大标题→紧凑过渡（含分组三区与单一 primary）。

## 28. P2

7. 大屏 margin 承载（边注/回链/小纲）。
8. Palette 大屏空间关系。
9. Math 方案 B（本地子集渲染）。
10. 中文 typography 肉眼 A/B 校准。
11. 真实笔记样本（含代码/公式/表格）作为回归数据。

---

## 29. What Must Not Change

- 层边界（内容层零玻璃；玻璃不进 Reading/Code/Math）。
- CodeSurface 冻结原则。
- Math 管线（四定界符、反斜杠保留、无 `￥`、canonical 不变）。
- Rail 安静选中与无 disabled 项。
- Motion 选型（transform→spring / 颜色→curve）与 reduced-motion 语义。
- Accent 克制（resting 无 accent 滥用）。
- Source-First 纪律（MIT、attribution、零依赖）。
- ADR-013/024/029/030/031 全部条款。

---

## 30. Implementation Phases

| Phase | Goal | Files | Behavior | Visual | Tests | Screenshots | Risk |
|---|---|---|---|---|---|---|---|
| **3C-1 Layout Foundation** | 修 P0 栅格 + header 分组/大标题过渡 | `workbench.css`, `Workbench.tsx` | pane 显式分配；Work Surface ≥680 | S0–S4 全断点 | 新增尺寸断言（surface≥680，context≥320） | 5 断点 × 5 状态 | 中（栅格重写） |
| **3C-2 Context v2** | companion + 精确匹配 + 新区块 + 密度 | `Workbench.tsx`, `concepts.ts`(用) | Context 贴度量右缘 | 三密度对比图 | 概念匹配单测 + DOM 断言 | context-1440/1920/2560 | 中 |
| **3C-3 Compare v2** | 关系动作 + 共享空间 | `Workbench.tsx`, `workbench.css` | 5 个动作（含 UI-only） | compare 共享几何 | 动作存在性 + 键盘可达 | compare-1920/2560 | 中 |
| **3C-4 Reading Surface** | 度量/中文排版/块度量 | `NoteReader.tsx`, `workbench.css` | 度量 680–760 | reading A/B | 解析单测 | reading-1440/1920/2560 | 低 |
| **3C-5 Large Screen** | margin 承载 | `workbench.css`, 新 `AnnotationMargin` | 边注/回链落点 | 大屏 margin 图 | DOM 断言 | 1920/2560 | 中 |
| **3C-6 Motion/Material Calibration** | morph/Peek/reduced-motion | `workbench.css`, `CodeSurface.tsx`(no) | 新增动画降级 | 动效序列图 | reduced-motion 断言 | motion 序列 | 低 |
| **3C-7 Visual Regression** | 截图集 + Scorecard 更新 | docs + tmp | — | before/after | 全量门禁 | release/ | 低 |

---

## 31. File-level Change Plan（预期，未执行）

- `frontend/src/workbench/workbench.css`：栅格（areas）、header 分组、Context companion、margin、tab indicator 样式。
- `frontend/src/workbench/Workbench.tsx`：ContextPane 结构/匹配、Peek 定位与动作、header 行为、tab 指示器接线、Compare 动作。
- `frontend/src/workbench/NoteReader.tsx`：度量与中文排版微调。
- （可能新增）`frontend/src/workbench/AnnotationMargin.tsx`：大屏边注落点。
- 测试：新增 `workbench/layout.test.ts`（源码/尺寸断言）、扩展 `content-pipeline.test.ts`。

## 32. Dependency Impact

**0**。所有方案用 CSS Grid/React/Web API；Math 方案 A 需 KaTeX（**未批准前不装**）。

## 33. Backend Capability Gaps

| 需求 | 现状 | 缺口 |
|---|---|---|
| 概念精确关联 | concepts API 存在（related notes/概念） | 需接入 Context 匹配 |
| Review Due | review API 存在 | Context 区块需调用 |
| Annotation 持久化 | **无** | Phase 4 提案（annotations 表+锚点） |
| Relate（A↔B 关系） | 部分（links/wikilinks） | 显式关系对象=Phase 4 提案 |

本阶段**不改后端**。

## 34. Risk Analysis

- 栅格重写可能引入新断点回归 → 用尺寸断言 + 5 断点截图缓解。
- Context companion 可能在 1280 挤压阅读列 → 1280 用重叠式浮层（可关闭）。
- morph indicator 若用于 Rail 会变“为动画而动画” → 明确仅用于同组 tab。
- 中文排版主观 → 必须 A/B 截图由 Owner 肉眼裁定。

## 35. Visual Benchmark Plan

`?design=apple-source-reference` 扩展为 **Golden Scenes**：Reading(含代码/公式/表格/批注)/Context 三密度/Peek 边距落点/Compare/Research/Search/Focus；每场景 1280/1440/1920/2560/768；存 `tmp/apple-refinement/{before,round1,round2,final}`。

## 36. Acceptance Criteria

- P0 修复：任意 pane 组合下 `Work Surface ≥ 680`。
- Context：三密度视觉明显不同；概念命中 >0；区块齐全。
- Peek：边距可用时不遮正文；3 动作 + Esc。
- Compare：≥3 个关系动作，UI-only 与 backend-required 已标注。
- Tabs：morph indicator + retarget（A→B→C 不排队）。
- 门禁全绿 + 5 断点截图 + Scorecard 更新 + **零依赖/零后端改动**。

---

# 24 问回答

1. **最强 UI 特征**：层边界纪律（内容层零玻璃、渐变仅语义 wikilink、accent 克制）+ 已验证的 6 条 Workflow 连续性。
2. **最影响 Apple 感的三点**：① 大屏留白无结构 ② Context 仍是面板形态 ③ Peek 压正文且动作不全。
3. **最影响知识工作的三点**：① Context 语义不足（无 Prereq/Backlinks/Review）② 批注未持久化 ③ Compare 无关系语义。
4. **最影响 1920/2560 的三点**：① reader 恒定 680 无视口策略 ② 多余空间无承载 ③ Compare/Peek 未利用边距。
5. **Context v2**：Current → Related → Prerequisites → Backlinks → Mastery → Review Due → Annotations → Tutor，按三密度门控，形态为 companion（贴度量右缘）。
6. **Peek v2**：edge-aware 定位 + Open / Open Right / Ask Tutor + Esc + 再点重定位。
7. **Compare v2**：连续空间 + 共享几何 + 5 个关系动作（UI-only 与 backend-required 分离）。
8. **Tab 是否 morph**：**是**，仅同组 tab；Rail 不用。
9. **CodeSurface 还改吗**：原则冻结；v2 只做细节（选中态/行高/header sticky），不加主题器/minimap。
10. **Math 路线**：先本地子集渲染（零依赖）；不足再提 KaTeX 提案待批准。
11. **绝不能改**：层边界、CodeSurface 原则、Math 管线、Rail 安静态、Motion 选型、accent 克制、Source-First 纪律、全部 ADR。
12. **实施顺序**：3C-1 布局 → 3C-2 Context → 3C-3 Compare → 3C-4 Reading → 3C-5 大屏 → 3C-6 动效/材质 → 3C-7 回归。
