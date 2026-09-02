# UI 示例（ui/）

设计系统 v1 的自包含 HTML 示例目录。浏览器直接打开即可预览，仅依赖 `assets/` 下贴图。

> 视觉语言对齐 **mimo.mi.com**：白空间 + 橙色生命线 + 大字 + 点阵地球。
> 单一设计来源见 [`UI_DESIGN.md`](./UI_DESIGN.md)。

## 文件索引

| 文件 | 说明 | 关联 |
|---|---|---|
| `UI_DESIGN.md` | **设计系统技术文档**（原则/色板/字阶/间距/圆角/阴影/动效/栅格/组件清单/a11y/性能契约/与 web/src 映射/开源参考） | 单一设计来源 |
| `tokens.css` | **设计令牌**（CSS 自定义属性，MiMo 橙白体系；与 `web/src/global.css` 互为镜像） | `UI_DESIGN.md` |
| `ui-preview.html` · `ui-preview.smoke.js` | **单页整合原型（所有组件真实内联，不走 iframe）**：14 段正文 + 归档。`§hero` 是点阵地球的**唯一落位**（460px / 4 轨 / 4 星，脚本由 `sync-dot-earth.mjs` 同步）；`§2` 主笔记概览已**移除整个星球系统**，只剩 chip ↔ 卡双向锚。守护 **148/148** | Phase 2/3 实现目标 · `note-workspace.html` |
| `index.html` | **总览入口**（gallery：色板/字阶/间距 + 页面与组件导航） | 本目录全部示例 |
| `graph-view.html` | **知识图谱规范页**（前后对照 + 规范表 9 条 + 已移除噪音 8 项 + ADR-023 裁决记录） | `web/src/components/graph/` · ADR-023 |
| `note-workspace.html` · `note-workspace.smoke.js` | **笔记工作区（建议主界面）**：三栏（列表 240 / 编辑器 680 / 右栏 320），680px 行宽，可视化降为右栏标签。**2026-09-02 移除整个星球系统**——标题回到单列 `.note-head`，全页**零 canvas、零 rAF**。守护 **63/63** | `web/src/views/NoteEditor.tsx` |
| `orbit-tree.html` · `orbit-tree.smoke.js` | **星系层级规范页（2026-09-02 由 `note-tree.html` 更名重塑）**：主/副笔记单父树，层级 = **轨道**而非缩进——① 轨道展开 `grid-template-rows 0fr→1fr`（非 `display:none`）② 卫星 stagger 45ms 依次入轨 ③ 星球点 6px 实心 → 16px 轨道环（`border`+`padding` 过渡，无 SVG）④ 空轨道走虚线圈（不复制 spotlight 渐变）⑤ orphan 保留不删、warn 虚线环区分。含 Bento 卫星网格（**只取**「尺寸=重要性」网格原则，**弃用**其独立仪表盘定位）· 前后对照 · 编码通道预算 · 动效预算 · 业界对照表。守护 **72/72** | ADR-024 · 回灌替换 `NoteListView` 平铺列表 |
| `home-hero.html` | 首页 Hero（大字 + 橙色渐变 CTA + 自包含点阵地球 + 轨道卫星 + 浮动芯片） | `docs/DESIGN.md` §3 |
| `dot-earth.html` · `dot-earth.smoke.js` | **点阵地球规范页（2026-09-02 新增，样式与脚本的定稿处）**：点阵地球自转 + 多轨彩色卫星（≤6 色，超出回退中性灰）+ 沿轨道墨色拖尾。① 三档尺寸真实渲染（200 糊 / 260 勉强 / 320 清晰）② 落位对照（笔记 300px 太大 · 硬塞 150px 点阵糊 · **Hero 460px 采用**）③ 规格表 21 行 ④ 彩色卫星边界 ⑤ 结论。守护 **137/137**，其中含「内联副本与定稿处逐字节相同」的防漂移断言 | `home-hero.html`（起源）· `ui-preview.html §hero`（唯一落位） |
| `mini-star.html` · `mini-star.smoke.js` | **小尺度星球规范页**：56/72/88/96 四尺寸，纯色中央星球无贴图，0–16 卫星。**2026-09-02 起笔记区不再使用**（「卫星 = 笔记」映射取消），退为规范页留档——将来列表行 / 卡片角标要小星从这里取，不要新写。守护 **46/46** | `dot-earth.html` §④ |
| `bento-dashboard.html` · `bento-dashboard.smoke.js` | **Bento 网格规范页（2026-09-02 解禁）**：**只取**「尺寸 = 重要性」的网格原则与 tile span，**弃用**「独立仪表盘」定位与 MiMo 风视觉（gradient / backdrop-filter / 多色 palette 全部去掉）。守护 **47/47** | `ui-preview.html` §4 · `orbit-tree.html` |
| `sync-dot-earth.mjs` | **点阵地球脚本同步脚本（幂等）**：把 `dot-earth.html` 的定稿脚本原样覆盖进使用方（默认 `ui-preview.html`）。整合页是**内联副本**，改完定稿处必须重跑一次，否则副本漂移 | `dot-earth.html` → `ui-preview.html` |
| `motion-primitives.html` | 动效基元（FadeInUp / CountUp / Skeleton / Toast / ProgressRing / WaveUnderline / SegmentedControl / Input）+ **落点清单**（2026-09-02 新增，结论；完整判定表在 `empty-states.html` §④） | 跨组件复用 |
| `spotlight-card.html` | **空状态聚光引导规范页（2026-09-02 解禁）**：鼠标跟随聚光。**仅限**「无内容可读 + 单一 CTA」的空状态 / 首次引导 / 加载失败兜底；三条门禁 + 实现约束 + 内容卡反例对照 | ADR-013 §2.13 · 首选落点 `GalaxyCanvas.tsx:741` 空态 |
| `empty-states.html` | **空态与首次引导规范页（2026-09-02 新增）**：`web/` 全量 12 个空态分支逐条判定（1 允许 / 4 补 CTA 后允许 / 7 禁止）+ 4 个允许落点真实演示 + 反例对照 + 加载态 Skeleton 对照 + **动效基元落点清单（唯一来源）** + 编码通道 / 实现约束 / a11y 规范表 | ADR-013 §2.13 · `empty-states.smoke.js` |
| `empty-states.smoke.js` | 空态页零依赖守护脚本（48 项断言）：门禁 2「卡内 button 数 = 1」/ 判定统计 / 聚光实现约束 / 单 rAF 30fps 节流 / 可撤销开关 / 令牌合规 | `empty-states.html` |
| `visual-engine.html` | **M9 视觉引擎原型页（样式定稿处）**：6 示例真实 TraceRun + 编码通道预算表 + 组件规格表 + 步进语义表 | `visual-engine/` · ADR-025 |
| `visual-engine.smoke.js` | 原型页零依赖 DOM 冒烟脚本（36 项断言，驱动内联的真实 TraceRun） | `visual-engine.html` |
| `visual-engine/` | **M9 视觉引擎组件库**（TS/TSX）：6 组件 + 3 纯逻辑模块 + CSS。**仅 ui 库，未合并进 `web/`**，回灌归 M9-007 | `UI_DESIGN.md` §7.4 · ADR-025 v3 |
| `visual-engine-demo.html` | **M9 视觉引擎演示页（组件跑起来的样子）**：页面壳按 ui 库规范，组件样式直接引用 `./visual-engine/visual-engine.css`（不复制不重写）；数据/渲染脚本由同步脚本从定稿处注入 | `visual-engine.html` · `visual-engine/` |
| `visual-engine/sync-demo-html.mjs` | 演示页同步脚本（幂等）：把定稿处的 `#traceData`（6 示例真实 TraceRun）与主渲染脚本注入演示页占位块。改完 `visual-engine.html` 后重跑一次即可 | `visual-engine-demo.html` |
| `audit-component-wiring.mjs` | **组件层接线审计**：扫 `web/src` 统计 21 个导出符号的业务引用，排除组件层/`motion/`·`dev/`·`ComponentGallery`·测试。产出「已接线 / 零接线」清单。2026-09-02 接线前给出「组件层没接线」的证据，接线后用于复核（21 个符号 3 接线 → 10 接线），可随时重跑 | `empty-states.html` §④ |
| `audit-ui-health.mjs` | **ui 库健康审计**：① 全库 `href="./..."` 死链 ② 根目录 html 是否登记进 `index.html` ③ 是否被 `README`/`UI_DESIGN` 提及 ④ 体积排序。整理 ui 库（启用留根目录 / 不用进 `archive/`）时的判定依据 | 本库 |
| `archive/visual-engine-tsx-2026-09-01/` | **归档**：样式定稿前的 M9 TSX 稿，冻结不再维护 | 已被 `visual-engine/` 取代 |
| `archive/legacy-gallery-html-2026-09-01/` | **归档**：`app-shell.html` · `bento-dashboard.html` · `marquee.html`（与后续设计裁决冲突，理由见该目录 `README.md`）；另有 `spotlight-card.html` **旧稿**——其「内容卡聚光」形态仍被否决，2026-09-02 以「空状态引导」限定形态解禁，新稿在根目录 `spotlight-card.html` | `UI_DESIGN.md` §7.1/§7.2 已标 `归档·` / ⛔ · ADR-013 §2.13 |
| `assets/dots-world.png` | 点阵世界贴图（地球自转滚动用，**实测 2000×1049**，306KB） | `home-hero.html` · `dot-earth.html` |

### M9 视觉引擎：`visual-engine/` 的三条边界

1. **不合并**：组件只放 `ui/visual-engine/`，`web/src/components/ui/index.ts` 按所有者裁定
   （2026-09-01）**不导出** M9 组件——避免「ui 库一套样式、项目里另一套」的双份来源。
2. **样式回溯**：任何样式疑问以 `visual-engine.html` 为准，组件 CSS 是它的等值转写。
3. **旧稿归档**：`archive/` 只进不出——需要复用时 copy 到 `ui/` 根目录新文件并重新登记，不原地修改。
   两个归档目录：`visual-engine-tsx-2026-09-01/`（M9 样式定稿前 TSX 稿）、
   `legacy-gallery-html-2026-09-01/`（3 个违背现行裁决的旧画廊 HTML + 1 份
   spotlight 旧稿——后者已于 2026-09-02 以「空状态引导」新形态解禁回根目录）。
   总览页 `index.html` 对归档项统一 `is-archived` 灰显并标注「已归档」。

## 目录分层：启用 vs 归档（2026-09-02 所有者裁定，现行规则）

**根目录 = 只放现行启用项；不用的全部收进 `ui/archive/<批次>-<日期>/`。**

| 层 | 位置 | 判定 | 要求 |
|---|---|---|---|
| **启用** | `ui/` 根目录 | 现行设计方向的唯一来源，新工作以它为模板 | 必须在下方「文件索引」登记；配色走 `tokens.css`，不写裸值 |
| **归档** | `ui/archive/<批次>-<日期>/` | 与现行裁决冲突、或已被取代的旧稿 | 目录内必须带 `README.md` 写清**为何归档**；`index.html` 中标 `is-archived` 灰显并指向归档路径 |
| **支座** | `ui/assets/` · `ui/visual-engine/` | 被启用项引用的资源 / 组件库，本身不是示例页 | 随引用方一同维护 |

**三条纪律**：

1. **归档只进不出**：归档目录内的文件不再原地修改。需要复用就 copy 到根目录新文件并重新登记
   ——2026-09-02 的 spotlight 解禁即照此办理：根目录新建合规形态，归档旧稿原样保留作否决证据。
2. **解禁要改 ADR**：把归档项拿回来用，必须先在设计文档/ADR 里写清**新的适用范围**，
   不能只挪文件。spotlight 的适用边界见 ADR-013 §2.13。
3. **不留悬空引用**：任何文件移动/归档后，全库 grep 旧路径并同步
   （`README.md` · `index.html` · `UI_DESIGN.md` · `docs/`）。

## 规范 vs 接线（2026-09-02 所有者裁定，同日已执行完毕）

> **状态更新（2026-09-02 下午）**：所有者解除冻结，落点清单**已按单执行**，`web/` 业务代码已改。
> 下方保留的是接线前的裁定与依据；接线结果见本节末尾的「接线后实测」。

**原裁定：ui 库只出规范，不做接线；`web/` 业务代码本轮不动。**

`empty-states.html` 与 `motion-primitives.html` 里的落点清单是**接线任务的依据**，不是施工单。
开工时直接按清单执行，不要重新盘点一遍——这条在接线时同样有效，
现场判断只有「清单没料到的事实」才算数（例：某处已有常驻指示器 → 不重复反馈）。

判定背景（接线前快照）：全量 19 个 `web/src/components/ui/` 导出组件里，只有 5 个进了业务
（`Progress` 2 · `Badge` 2 · `Tooltip` 1 · `Select` 1，以及 `ToastProvider` 仅挂载、
`useToast()` 调用数 0）。**`Button` 的业务引用数是 0**——
这不是「某几个基元找不到落点」，而是**整个组件层都没接线**，需要整体排期，不适合零散修补。

### 接线前落点表（原计划）

| 基元/组件 | 落点 | 原状态 |
|---|---|---|
| `Skeleton` | `NoteEditor.tsx` · `ReviewSessionView.tsx` · `GalaxyCanvas.tsx`（三处裸文字加载态） | 待接线 |
| `Toast`（`useToast`） | Provider 已挂 `App.tsx`；落点：保存失败 / 同步冲突 / 复习提交反馈 | 待接线 |
| `Tabs` | `ContextRail.tsx` 手写 tablist（语义逐项等价，需扩 Badge 槽位） | 待接线 |
| Spotlight | `GalaxyCanvas.tsx` `!planet` 空态（**须先补一个 CTA**，否则门禁 2 不过） | 待接线 |
| `SegmentedControl` / `WaveLink` | 不适用（`role="radiogroup"` 与 tab 语义冲突 / 反链是动作应留 button） | 不接线 |

### 接线后实测（`ui/audit-component-wiring.mjs` 重跑，31 个业务文件）

组件层 21 个导出符号：**3 个接线 → 10 个接线**。

- **基础层 17 个：7 接线 / 10 零接线**
  - 接线：`Button`（本轮首落：`GalaxyCanvas` 空态 CTA）· `Badge` · `Skeleton` · `Progress` · `Tabs` · `ToastProvider` · `useToast`
  - 零接线：`Input` · `Tag` · `Select` · `Textarea` · `Checkbox` · `Avatar` · `Modal` · `Tooltip` · `SegmentedControl` · `Switch`
- **动效层 4 个：3 接线 / 1 零接线**
  - 接线：`ProgressRing`（复习完成页）· `FadeInUp`（反链列表 · MemoryList）· `CountUp`（右栏待复习数）
  - 零接线：`WaveLink`（判不适用）

三处**刻意偏离**原清单建议（理由见 `empty-states.html` ④ 表内）：
`ProgressRing` 落完成页而非顶部进度（避免同一数字三重编码）、
`Toast` 接两处而非三处（同步冲突已有常驻指示器）、
`FadeInUp` 不落笔记列表（常驻高频，动画即干扰）。

**回归门禁**（`web/` 内，`npm test` 已覆盖）：
`src/components/ui/wiring.test.ts`（30 项，接线不回退 + 不越界）+
`src/components/ui/components.test.tsx`（21 项，组件结构与派生值）。
两处均零新增依赖：`renderToStaticMarkup` 测结构，`import.meta.glob(..., { query: "?raw" })` 读源码做门禁。

## 信息架构：笔记优先（2026-08-29）

**本项目是笔记应用，图谱 / Universe / 导图 / 掌握度全部由笔记派生。**
界面权重要体现这一点，否则就是本末倒置。

原结构把 7 个入口做成平级 tab（笔记 / 图谱 / Universe / 导图 / AI Tutor / 复习 / 仪表盘），
笔记占 1/7，可视化占 3/7。建议改为：

| 项 | 处理 |
|---|---|
| 主导航 | **取消**。打开应用即笔记工作区，顶栏只留搜索与待办提醒 |
| 图谱 / Universe / 导图 | 收进右栏「关联」标签，服务于当前笔记 |
| 复习 | 顶栏带数字的徽章；有才提醒，没有就安静 |
| 仪表盘 | 删除。学习数据分散到该出现处（复习徽章、右栏掌握度） |
| 知识雷达 / 搜索结果 / 反链 | 一律退到右栏，不进编辑器工具栏 |

**编辑器的三条硬约束**：

1. **行宽 680px 居中** —— 中文一行约 30 字，回扫不丢行
2. **工具栏只放格式控件** —— 任何 AI / 可视化 / 搜索控件都在邀请用户中断思路
3. **保存状态用极小的字放元信息行** —— 写作时不该看见它

完整原型与判断依据见 [`note-workspace.html`](./note-workspace.html)。

## 配色令牌（v1 变更，与 mimo.mi.com 对齐）

| 令牌 | v1 | 原 ui 示例 | 备注 |
|---|---|---|---|
| `--brand` | `#FF6B35` | `#FF8A00` | MiMo mimo-orange；同步改 `web/src/global.css` |
| `--bg-soft` | `#F5F5F5` | `#F5F4F2` | MiMo 页面底色（更轻） |
| `--border` | `#ECECEC` | `#E8E6E2` | 更细，呼吸感 |
| `--text` | `#171717` | `#111111` | MiMo gray-900 |
| `--hl` | `#FBF1CF` | `#FBF1CF` | 双链高亮（保留） |
| `--ink` | `#35618F` | `#35618F` | 辅色（保留） |
| 字体 | MiSans → Inter | 同 | 主栈一致 |

## 性能契约（继承 P8-001C · 冻结）

- 单 rAF · 30fps 节流（`--frame-ms = 1000/30`）
  - **唯一例外：点阵地球 `dot-earth.html` 用 60fps。** 地球自转只有 ~7px/秒，30fps 下每帧走 0.23px，点阵会读成「一格一格」。代价由预缩放贴图 + 预烘焙叠加层抵消，每帧只剩 1:1 位块传输
  - 节流判断必须留**容忍窗口**（`FRAME_TOL = 6ms`）：60Hz 帧间隔在 16.6–16.9ms 抖动，硬比 `FRAME_MS` 会让「两次 vsync」偶尔差一点不到阈值而整帧跳过，于是 33ms/50ms 交替 —— 这正是「掉帧、不连贯」的根因
- canvas 卡片版 dpr=1 / Hero dpr≤1.5
- 容器 `contain: layout paint size`
- `IntersectionObserver` + `visibilitychange` 不可见即停
- `prefers-reduced-motion: reduce` → 全部停
- 循环内禁 `getComputedStyle` / 逐帧 DOM 重建 / `box-shadow` 动画
- 卫星渲染上限 16 颗

## 地球实现备注

`home-hero.html` 的地球有两条不可回退的实现约束，改动前务必先读：

1. **点阵轮廓来自贴图，不来自算法**。大陆形状由 `assets/dots-world.png` 的像素排布决定，
   不是球面随机采样。曾尝试用 `theta/phi` 随机采样生成，结果是噪点球而非地球。
   正像 + 水平镜像预拼成 2 倍宽长条，横向滚动即自转，接缝天然对齐。
2. **轨道环必须前后半段分开绘制**（`sin(t)` 判深度），才能让地球遮挡后半段轨道。
   前后切换处 `baseAlpha` 与半径的取值连续，避免闪烁。
3. **卫星不做真遮挡**（2026-09-02）。环被地球盖住是对的，但**卫星一律画在地球之上**，
   只用连续 alpha（0.95 前 / 0.725 侧 / 0.525 后）+ 半径表达远近。
   曾按「球后先画、被盖住」实现，结果卫星每圈约 3 成时间整个消失，进出那一瞬（0.04s）像卡了一下。
   `home-hero.html` 仍保留真遮挡（它的球占画布 0.733，卫星相对更小，观感不同）——两处不必强行统一，
   改之前先读 `dot-earth.html` §③「球后卫星」一行。

分层刻意只有两层：知识星球 + 轨道卫星。球面概念节点与连线已于 2026-08-29 移除，
概念网络归 GraphView，首页保持「白空间优先 / 单一焦点」。

## 知识图谱视觉规范

**为什么旧版显得花哨**：同一个维度（关系类型）被 3 个通道重复编码——颜色、线宽、虚线，
且 9 种颜色里混入了粉红 `#b08080` 与绿色 `#4a7a4a`，与橙白体系冲突。

**编码通道预算：一个维度 = 一个通道。**

| 维度 | 通道 | 取值 |
|---|---|---|
| 关系类型 | 线色 | 依赖类 `#a3a3a3`；其余 `#e5e5e5` |
| 语义强弱 | 线宽 | 1.5px / 1px（仅 `prerequisite` `requires` 提升一级） |
| 交互状态 | 品牌橙 | 仅 hover（边 2px）与 selected（节点 1.5px 环） |
| 掌握度 | Concept 环 | 轨道 `--border`，进度 `--brand`，2px |

数值取自 React Flow v12.11.5 官方默认（`node_modules/@xyflow/react/dist/style.css`
`--xy-edge-stroke-default: #b1b1b7` / connectionline `stroke-width: 1`）与 Obsidian Graph View
（默认单色，Groups 与 Arrows 均为用户自选开启）。完整对照与出处见 [`graph-view.html`](./graph-view.html)。

**不可回退的两条约束**：

1. **橙色 = 注意力指针，只服务两件事**：交互焦点（hover / selected）与 mastery 进度。
   **不用于静态分类**（关系类型、领域等）——一旦用于静态分类即被稀释。
2. **形状即语义，不靠颜色区分。** Note = 方形，Concept = 圆形（ADR-023 冻结）。
   加颜色区分等于再引入一套色相。

**ADR-023 冲突已裁决（2026-08-29）**：原「数据流边界」表标 Graph mastery「仅 tooltip」，
与「视觉编码」条款的 mastery 环互斥。**裁决取视觉编码条款**——保留 mastery 环，
并明确它是 Graph 中 mastery 的**唯一**视觉出口（禁止尺寸/填充色/排序/动画等其他投射）。
ADR-023 已同步修订，「禁止」条款补上唯一例外，并新增「编码通道预算」横切约束。

## 选型与开源参考

| 来源 | 用法 | 链接 |
|---|---|---|
| mimo.mi.com | 整体视觉语言 | https://mimo.mi.com/ |
| shadcn/ui | 组件 API 形态、a11y 模式 | https://github.com/shadcn-ui/ui |
| Aceternity UI | SpotlightCard 灵感 | https://ui.aceternity.com/ |
| Magic UI | Marquee 灵感 | https://magicui.design/ |
| React Bits | 微交互参考 | https://reactbits.dev/ |
| Uiverse | 社区 UI 元素灵感 | https://uiverse.io/ |

> 视觉/结构灵感 100% 自写；项目禁 CSS 框架（AGENTS §2.3），禁第二状态库。

## 规则

- 新增示例须在本 README 索引登记
- 配色/交互须符合 `docs/DESIGN.md` 与 `UI_DESIGN.md`
- 禁止：深色科技感 / 紫色 AI 风 / 数据驾驶舱
- 令牌只改 `tokens.css`，示例通过 `var()` 引用，不写裸值

---

### 变更记录

| 日期 | 内容 |
|---|---|
| 2026-08-29 | 设计系统 v1 落地（10 个文件）；移除全部 pre-v1 示例（14 个 HTML + `react/HeroEarth.tsx` + `assets/orbit.png`），已入回收站可还原 |
| 2026-08-29 | 知识图谱简约化：9 色 3 通道 → 2 级中性灰 1 通道；移除点阵背景/MiniMap/蓝环/绿边；Concept 加 mastery 环；新增 `graph-view.html` 规范页 |
| 2026-08-29 | 信息架构纠正「本末倒置」：新增 `note-workspace.html` 笔记优先原型（取消 7 平级 tab，笔记即工作区，可视化降为右栏上下文） |
| 2026-09-01 | **M9 视觉引擎入库**：组件落 `visual-engine/`（6 组件 + 3 纯逻辑模块 + CSS，仅 ui 库不合并 `web/`），`visual-engine.html` 为样式定稿处（36 项冒烟 + 68 项单测 + tsc 全绿），定稿前 TSX 稿归档 `archive/visual-engine-tsx-2026-09-01/` |
| 2026-09-01 | **旧画廊 HTML 归档**：`app-shell` / `bento-dashboard` / `spotlight-card` / `marquee` 四项与现行裁决冲突，移入 `archive/legacy-gallery-html-2026-09-01/`（含归档理由 README）；总览页 `index.html` 新增 M9 Visual Engine 卡片，归档项 `is-archived` 灰显并改指归档路径 |
| 2026-09-01 | **M9 演示页落地**：新增 `visual-engine-demo.html`（ui 库规范页面壳 + 组件样式直引 `visual-engine/visual-engine.css`）与幂等同步脚本 `visual-engine/sync-demo-html.mjs`——数据与渲染脚本只从定稿处 `visual-engine.html` 注入，杜绝手抄漂移。无头浏览器自检：3 章节渲染/步进交互/编码通道/21 个导出符号全通过，零运行时错误 |
| 2026-09-01 | **多层级笔记列表规范页**：新增 `note-tree.html`——主/副笔记单父树（V1 只渲染一层，星球/卫星）。行/箭头双命中区、过滤命中分支自动展开、键盘 ↑↓→←、orphan 进「未挂载」组保留+警告不删。无头浏览器自检：展开收起/选中切换/键盘/过滤/orphan 全过，零运行时错误。数据规则对齐 ADR-024 裁决链（Markdown 事实源 · resolve_hierarchy 统一消费） |
| 2026-09-02 | **Spotlight 解禁（限定空状态引导）**：`spotlight-card.html` 以「空状态聚光引导」新形态回到 `ui/` 根目录——三条门禁（空状态 / 单一 CTA / 可撤销）+ 实现约束表 + 内容卡反例对照；可交互（真实 pointermove 跟随，单 rAF + 30fps 节流）。内容卡形态的旧稿保留在归档，作「为何否决内容卡聚光」的证据。ADR-013 新增 §2.13，为 §2.7「禁 gradient」的**唯一**例外 |
| 2026-09-02 | **ui 库启用/归档分层清理**：根目录只留现行启用项，归档一律收进 `ui/archive/<批次>-<日期>/` 并各带理由 README；`index.html` 归档卡统一 `is-archived` 灰显且链接指向归档路径 |
| 2026-09-02 | **空态与首次引导规范页**：新增 `empty-states.html` —— `web/` 全量 12 个空态分支按 ADR-013 §2.13 三门禁逐条判定（**1 直接允许** = `NoteEditor.tsx:278` 首篇 onboarding、**4 补 CTA 后允许** = Galaxy 空态/错误 · MindMap 空态 · Review 临界、**7 禁止** = 含 3 处加载态应走 Skeleton + 右栏/雷达/搜索浮层等有内容可读的界面）；4 个允许落点真实演示（可交互聚光 + 「模拟触摸/reduced-motion」开关）+ 内容卡与右栏反例对照 + Skeleton 加载态对照；另附**动效基元落点清单**（本库唯一来源） |
| 2026-09-02 | **空态页守护脚本**：新增 `empty-states.smoke.js`（零依赖最小 DOM shim，48 项断言）—— 守住门禁 2「允许落点卡内 `button` 数 = 1」、判定统计 1/4/7、聚光强度与半径、30fps 节流、可撤销开关、令牌合规。回归验证已实跑：故意往卡里加第二个按钮 + 改坏聚光强度 → 立即 3 failed，回退后 48 全绿。修掉实现侧一处隐患：`lastWrite` 初值由 `0` 改 `-Infinity`（原写法会让页面加载后头 33ms 内的首次移动被误判为节流中） |
| 2026-09-02 | **索引页补齐**：`index.html` 新增 Empty States / UI Preview / Visual Engine Demo 三张卡（后两张此前只在 README 登记、总览页缺失）；校验通过——17 个链接全部可达、13 张卡片无重复、根目录 10 个示例 HTML 全部登记 |
| 2026-09-02 | **动效基元落点清单**：`motion-primitives.html` 新增落点区（可直接用 / 需调·限范围 / 不适用 三档），完整判定表指向 `empty-states.html` §④，不复制避免两处维护 |
| 2026-09-02 | **左栏规范页改名并重塑为「星系层级」**：`note-tree.html` → **`orbit-tree.html`**（守护脚本同步改名 `orbit-tree.smoke.js`）。内容全面重写：层级表达由「缩进 + chevron 旋转」改为**轨道**——轨道展开走 `grid-template-rows 0fr→1fr`（可过渡，取代 `display:none`）、卫星 `transition-delay: calc(var(--i) * 45ms)` stagger 入轨、星球点由 6px 实心经 `border`+`padding` 过渡展开成 16px 轨道环（`background-clip: content-box`，无 SVG 无图片）、空轨道用虚线圈表达（刻意不复制 spotlight 渐变）、orphan 改 warn 虚线环（形状即语义）。保留 Bento 卫星网格但明确取用边界：**只取**「尺寸=重要性」网格原则与 tile span，**弃用**「独立仪表盘」定位（裁决 A 已删）与 MiMo 风视觉；页面 §「为什么能用（与归档理由不冲突）」专章交代。守护脚本两条陈旧断言按事实修正（不是删除）：D10 原找「不取」二字而新文案作「弃用」；F1 原把 `--i`/`--sat-cols`/`--bento-cols` 判为幽灵 token，但三者是 `style="--x:…"` 就地传参的**页面局部参数**，本就不该进 `tokens.css`——「幽灵」的正确定义改为「tokens.css 没有、且页面内也找不到任何赋值点」，并补 F1b 断言要求局部参数必须被 `var()` 真实消费。全库引用同步：`index.html`（含缩略图改为星球环/卫星点/虚线 orphan 环）、`ui-preview.html`（补齐 orbit-tree / empty-states / visual-engine-demo 三个 tab）、`README.md`、`UI_DESIGN.md` §7.2 / §版本记录。**未动** `docs/adr/ADR-026-note-tree.md` 与 `web/src/components/notes/buildNoteTree.ts`——那两者指后端契约 `GET /notes/tree` 与 web 组件 `NoteTreeList`，与 ui 规范页同名不同物。实跑 72/72 |
| 2026-09-02 | **`.gitignore` 锚定 bug 修复**：`src-tauri/target/` 含内部斜杠 → 被锚定到仓库根，匹配不到实际路径 `web/src-tauri/target/`，导致 **1.4GB 构建产物长期显示为未跟踪**（随时可能被误 `git add`）。改为显式 `web/src-tauri/target/` + `web/src-tauri/gen/`，并补 `vite.config.ts.timestamp-*`。`web/src-tauri/Cargo.lock` 按 AGENTS §2.1「依赖锁=必须入库」保留待提交，不忽略 |
| 2026-09-02 | **点阵地球规范页**：新增 `dot-earth.html` + `dot-earth.smoke.js`（**137/137**）。点阵地球自转 + 多轨彩色卫星（≤6 色，超出回退中性灰）+ 沿轨道墨色拖尾，移植自 `home-hero.html`。五段：① 三档尺寸真实渲染 ② 落位对照（笔记 300px 太大 / 硬塞 150px 点阵糊 / **Hero 460px 采用**）③ 规格表 21 行 ④ 彩色卫星边界 ⑤ 结论。另加 `sync-dot-earth.mjs`（幂等同步脚本）——整合页是内联副本，改完定稿处必须重跑 |
| 2026-09-02 | **「掉帧、不连贯」根因定位为节流逻辑，不是渲染开销**：原 `if (dt < FRAME_MS) return` 硬比阈值，而 60Hz 帧间隔在 16.6–16.9ms 抖动 —— 「两次 vsync」偶尔差一点不到 33.33ms 就整帧跳过，于是 33ms/50ms 交替（纯 JS 模拟 60Hz 抖动实测：27.6fps，277 帧里 44 帧落在 ~50ms = 16%）。修法两条：**帧率上限由 30 提到 60**（自转只 ~7px/秒，30fps 下每帧 0.23px，点阵读成「一格一格」）+ **节流留 6ms 容忍窗口**（`FRAME_TOL`）。修后模拟：59.5fps，间隔全部落在 16.6–17ms。附带的渲染侧优化：贴图按渲染尺寸预缩放（`buildStrip`）、暗角与顶部柔光预烘焙成一张叠加层（`buildOverlay`）、卫星光晕按色预渲染缓存（`glowSprite`）—— 每帧只剩 1:1 位块传输 |
| 2026-09-02 | **「卫星卡一下」= 卫星钻到地球背面消失**：定位前先量过轨迹（自转步长 0.075–0.078px/帧 ±2%、卫星速度 265px/s ±5.5% 属椭圆预期），证明运动本身匀速无停顿，遂排除「接缝减速」等猜测并直接问清。真遮挡让卫星每圈约 3 成时间整个消失，进出那一瞬 0.04s 像卡住。改为**卫星一律画在地球之上**，用连续 alpha（0.95 前 / 0.725 侧 / 0.525 后）+ 半径 `0.8 + 0.2×depth` 表达远近；轨道环仍分前后半段（环被球盖住是对的）。规格表与守护脚本都写明「不要改回真遮挡」 |
| 2026-09-02 | **球体收小 + 卫星尺寸两轮定档**：`EARTH_D` 0.60 → **0.50**（460px 容器 → 直径 230px），轨道不再被压；`fit` 回到 1.0。卫星半径按**绝对观感**定为 `地球半径 × 0.085–0.160`（460px → 11.2–18.4px）—— 第一版照抄 `home-hero.html` 的比例 0.024–0.059 是错的：它地球占画布 0.733、本组件只有 0.50，照搬后卫星只剩 3.4–6.8px，被指「卫星又太小了」。两轮经过都写进规格表，避免第三次调参 |
| 2026-09-02 | **所有者裁定：取消「卫星 = 笔记」映射，笔记区移除整个星球系统**。「优化器就不用显示卫星系统了。也不用搞笔记增加卫星增加了，这个点阵地球就是主页的固定动画。」落地：`note-workspace.html` 与 `ui-preview.html` §2 的 `.star-card`（标题 + 右上 88px Mini Star 两列网格）退回单列 `.note-head`，删掉 153 行 Mini Star 启动脚本，stats「卫星笔记」→「关联笔记」，现在是**零 canvas、零 rAF**，只保留 chip ↔ 卡双向锚（`note-workspace.html` 601 → 428 行）。`mini-star.html` 留作规范页，**当前无页面消费** |
| 2026-09-02 | **文档与实现对齐（点阵地球）**：`EARTH_D` 改 0.50 后，① 的三档「地球直径 / 点距」与 ⑤ 的结论仍停在 0.60 的数字（120/156/192px · 1.7/2.2/2.7px），已按公式 `直径 ÷ 1049 × 15` 重算为 **100/130/160px · 1.43/1.86/2.29px**（贴图实测 2000×1049）；卫星由 5 颗减到 4 颗（删掉杜撰的「贝叶斯定理的直觉」）后 aria-label 与文案仍写 5 颗；§②/④/⑤ 仍写「笔记里继续用 88px Mini Star」，与已交付状态直接冲突 —— 三类共 15 处旧文案全部改写，并把「尺寸建议」由 ≥260px 上调到 **≥320px**（260px 的点距只有 1.86px，未过可辨下限 2.2px） |
| 2026-09-02 | **ui 文档补齐**：`README.md` 登记 `dot-earth.html` / `mini-star.html` / `bento-dashboard.html` / 四个 smoke 脚本 / `sync-dot-earth.mjs`，并补两条「不可回退」约束（点阵地球用 60fps 是 30fps 契约的**唯一登记例外**；卫星不做真遮挡，而 `home-hero.html` 保留真遮挡，两处不必强行统一）；`UI_DESIGN.md` 新增 **§8.1「页面 × 组件坐标表」**——1264 视口下逐区实测坐标与触发条件（`note-workspace` 7 区 / `ui-preview` 9 区）+ 4 条落位裁决；顺带修掉 §8 抬头里「`bento-dashboard.html` 作废」这条已被解禁推翻的表述 |
| 2026-09-02 | **总览页登记**：`index.html` 新增 Dot Earth 卡片（点阵 pattern + 三色卫星的 SVG 缩略图），Mini Star 卡片补注「2026-09-02 起笔记区不再使用，退为规范页」并互链。全库重跑：7 个 smoke 脚本全绿（dot-earth 137 · ui-preview 148 · orbit-tree 72 · note-workspace 63 · bento-dashboard 47 · empty-states 48 · mini-star 46 · visual-engine 36），`audit-ui-health.mjs` **零死链** + 13/13 根目录 html 全部登记 |
| 2026-09-02 | **所有者裁定：规范与接线分离**。Spotlight 与动效基元**只出规范，不写入 `web/` 业务代码**（沿用「组件先在 ui 库定稿」节奏，与 M9-007 回灌同一批）。背景：19 个 `components/ui/` 导出组件中仅 5 个进业务，`Button` 引用数为 0 —— 属整层未接线，需整体排期。裁定与接线状态表见本 README「规范 vs 接线」（**注：同日所有者解除冻结，下一条为执行结果**） |
| 2026-09-02 | **组件层接线执行完毕**（上一条裁定的解除与落地）。按 `empty-states.html` ④ 落点清单照单执行，未重新盘点。实测（`audit-component-wiring.mjs` 重跑，31 个业务文件）：21 个导出符号 **3 接线 → 10 接线**（基础层 7/17，动效层 3/4）。落点：`Skeleton`×3 加载态（容器定高 + `.sr-only`）· `useToast()` 自动保存失败与评分提交失败 · `Tabs` 替换 ContextRail 手写 tablist（扩 `badge` 与容器 `className` 两个槽位）· `CountUp` 右栏待复习数（带 `key`）· `FadeInUp` 反链列表与 MemoryList · `ProgressRing` 复习完成页 · `Button` 星系空态 CTA（**本轮首落，此前业务引用数为 0**）。**解锁点**：`.btn-primary` 由渐变改 `--brand-deep` 纯色实底——选「就地修」而非新增变体/覆盖类，依据是影响面实测为零（该类名当时仅 `primitives.tsx` 一处引用、零处真实渲染）。三处刻意偏离原清单（理由见 `empty-states.html` ④）：`ProgressRing` 落完成页避三重编码、`Toast` 不接同步冲突（TopBar 已有常驻指示器）、`FadeInUp` 不落笔记列表。**门禁**：新增 `web/src/components/ui/wiring.test.ts`（30 项）+ `components.test.tsx`（21 项），零新增依赖（`renderToStaticMarkup` + `import.meta.glob(?raw)`）；另加 `web/vitest.config.ts` 开 `css: true`（Vitest 默认会把 CSS 替换为空串，样式门禁会对空串判定）。验收：`vitest` **87 passed / 6 files**、`tsc --noEmit` 0、`vite build` 0 |
