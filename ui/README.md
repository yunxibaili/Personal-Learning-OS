# UI 示例（ui/）

设计系统 v1 的自包含 HTML 示例目录。浏览器直接打开即可预览，仅依赖 `assets/` 下贴图。

> 视觉语言对齐 **mimo.mi.com**：白空间 + 橙色生命线 + 大字 + 点阵地球。
> 单一设计来源见 [`UI_DESIGN.md`](./UI_DESIGN.md)。

## 文件索引

| 文件 | 说明 | 关联 |
|---|---|---|
| `UI_DESIGN.md` | **设计系统技术文档**（原则/色板/字阶/间距/圆角/阴影/动效/栅格/组件清单/a11y/性能契约/与 web/src 映射/开源参考） | 单一设计来源 |
| `tokens.css` | **设计令牌**（CSS 自定义属性，MiMo 橙白体系；与 `web/src/global.css` 互为镜像） | `UI_DESIGN.md` |
| `index.html` | **总览入口**（gallery：色板/字阶/间距 + 页面与组件导航） | 本目录全部示例 |
| `graph-view.html` | **知识图谱规范页**（前后对照 + 规范表 9 条 + 已移除噪音 8 项 + ADR-023 裁决记录） | `web/src/components/graph/` · ADR-023 |
| `note-workspace.html` | **笔记工作区（建议主界面）**：三栏（列表 / 编辑器 / 上下文），680px 行宽，可视化降为右栏标签 | `web/src/views/NoteEditor.tsx` |
| `home-hero.html` | 首页 Hero（大字 + 橙色渐变 CTA + 自包含点阵地球 + 轨道卫星 + 浮动芯片） | `docs/DESIGN.md` §3 |
| `app-shell.html` | 应用外壳（细顶栏 + 侧边栏 + 编辑器 + 右栏；MiMo 半透白 + 极简导航） | `web/src/App.tsx` |
| `bento-dashboard.html` | Dashboard Bento 网格（6 列不等高：今日复习/掌握度雷达/趋势/最近笔记/图谱缩略/错题/概念库/状态/新建） | `DashboardView.tsx` |
| `spotlight-card.html` | 鼠标跟随聚光卡片（v1 基础光晕 + v2 渐变描边） | 通用组件 |
| `marquee.html` | 无缝横向滚动条（3 行：概念/复习队列/学习节奏） | 通用组件 |
| `motion-primitives.html` | 动效基元（FadeInUp / CountUp / Skeleton / Toast / ProgressRing / WaveUnderline / SegmentedControl / Input） | 跨组件复用 |
| `assets/dots-world.png` | 点阵世界贴图（地球自转滚动用，2000×1049） | `home-hero.html` |

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
2. **轨道环必须前后半段分开绘制**（`sin(t)` 判深度），才能让地球遮挡后半段卫星。
   前后切换处 `baseAlpha` 与半径的取值连续，避免闪烁。

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
