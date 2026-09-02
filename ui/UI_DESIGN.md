# UI Design System — Open Learning OS

> 视觉与交互设计系统。视觉语言对齐 **mimo.mi.com**（白空间 + 橙色生命线 + 大字 + 点阵地球）。
> 单一来源：`ui/tokens.css`（CSS 变量） + 本文档（语义/规则/边界）。
> 与 `web/src/global.css` 互为镜像；改动先改令牌，再同步本文件，最后通知前端实现。
>
> 状态：v1 · 2026-08-29 · 同步 tokens.css v1
> 关联：`docs/DESIGN.md`（学习循环 + UI 边界）· `AGENTS.md` §2.3（禁 CSS 框架 / 第二状态库）· `PRODUCT_PRINCIPLES.md`（五条）· `docs/adr/`（ADR-019/020/021/023）

---

## 0. 速查

| 项 | 令牌 | 用途 |
|---|---|---|
| 主品牌 | `--brand #FF6B35` | 主 CTA、强调态、进度激活、轨道卫星 |
| 渐变末端 | `--brand-2 #F7931E` | 按钮渐变、英雄渐变 |
| 品牌底 | `--brand-soft #FFF1EA` | 选中态、提示徽章 |
| 双链高亮 | `--hl #FBF1CF` | `[[wikilink]]` 行内荧光笔、命中标记 |
| 页面底 | `--bg-soft #F5F5F5` | MiMo 同款页面灰底（替代纯白更耐看） |
| 卡片 | `--surface #FFFFFF` + `--border #ECECEC` | 卡片表面 |
| 正文 | `--text #171717` | 主文 |
| 副文 | `--text-2 #525252` | 描述、辅助 |
| 辅色 | `--ink #35618F` | 次级强调 / 链接（项目原 靛墨蓝，降为辅） |
| 字体 | `MiSans → Inter → 系统栈` | 中文 MiSans/苹方/雅黑；西文 Inter/Segoe |
| 圆角 | `--r-lg 10px` | 卡片默认；按钮 8/999 |
| 入场曲线 | `--ease cubic-bezier(0.16, 1, 0.3, 1)` | MiMo 标志曲线 |
| 容器 | `--container 1200px` / 阅读 `--container-sm 960px` | 页面/阅读 |

---

## 1. 设计原则（执行顺序）

1. **白空间优先**。内容是主角，装饰只服务于层级。先排版，再配色，最后加动效。
2. **橙色生命线**。整站仅一个暖色焦点（品牌橙），其他全为黑白灰 + 双链荧光笔黄；禁止多色拼接 / 紫渐变 / 蓝渐变。
3. **单一焦点**。每屏一个视觉中心：首页 = 地球，Dashboard = 今日复习，Bento = 掌握度雷达。眼睛不需要找。
4. **可读性 > 美观**。阅读正文 14.5–15.5px / 行高 1.7–1.85；卡片标题 16–20px，禁用全大写长段。
5. **动效服务于状态**。hover/focus/进入/离开 = 150–250ms；地球/聚光 = 30fps 限帧；`prefers-reduced-motion: reduce` → 全部停。
6. **诚实显示数据**。掌握度数字 = 真实计算；禁用伪造进度条、假活跃、虚标。
7. **审美边界**（继承 `docs/DESIGN.md` §2 Avoid）：禁 Notion 营销页、禁 AI 套壳、禁数据驾驶舱、禁游戏化（无等级/连签/徽章）、禁 SaaS 落地页。

---

## 2. 色彩系统

### 2.1 品牌 / 中性 / 状态 三层

| 层 | 令牌组 | 用法 |
|---|---|---|
| **品牌** | `--brand / --brand-2 / --brand-deep / --brand-soft / --brand-tint / --brand-line` | 主 CTA、强调、激活、轨道卫星、复习进度 |
| **中性** | `--bg / --bg-soft / --surface / --border / --text / --text-2 / --text-3` | 结构、文本、分割（占比 ≥ 90%） |
| **状态** | `--ok / --warn / --err / --info` | 仅反馈（toast / 表单校验 / mastery 状态徽章） |

### 2.2 关键对比与可达性

实测值（WCAG 相对亮度公式，2026-08-31 复核；旧版「3.6:1」为笔误，实际 2.84:1）：

| 前景 | 背景 | 比值 | 结论 |
|---|---|---|---|
| 主文 `--text #171717` | `--bg-soft #F5F5F5` | 15.4:1 | AAA |
| 副文 `--text-2 #525252` | `#FFFFFF` | 7.81:1 | AAA |
| 辅助 `--text-3 #737373` | `#FFFFFF` | 4.74:1 | AA ✅ |
| 品牌文字 `--brand-text #C2410C` | `#FFFFFF` | 5.18:1 | AA ✅ |
| `--text-inv #FFFFFF` | `--brand-text #C2410C` | 5.18:1 | AA ✅ |
| 成功·文字 `--ok-text #15803D` | `#FFFFFF` | 5.02:1 | AA ✅ |
| 警告·文字 `--warn-text #B45309` | `#FFFFFF` | 5.02:1 | AA ✅ |
| 错误·文字 `--err-text #B91C1C` | `#FFFFFF` | 6.47:1 | AAA ✅ |
| 双链高亮 `--hl #FBF1CF` 底 + `--ink #35618F` 字 | — | 8.1:1 | AAA |
| ~~`--brand #FF6B35` 作文字~~ | `#FFFFFF` | 2.84:1 | ✘ 不足 AA |
| ~~`--ok #22C55E` 作文字~~ | `#FFFFFF` | 2.28:1 | ✘ 不足 AA |
| ~~`--warn #F59E0B` 作文字~~ | `#FFFFFF` | 2.15:1 | ✘ 不足 AA |
| ~~`--text-3` 旧 `#A3A3A3`~~ | `#FFFFFF` | 2.52:1 | ✘ 不足 AA |

**令牌分工（2026-08-31 定）**：

- `--brand #FF6B35`（2.84:1）**只作图形/填充/描边**——轨道卫星、进度填充、
  圆点指示器、focus 环、激活态下划线。图形按 WCAG 1.4.11 需 3:1，
  本值 2.84 用于**纯装饰图形**可接受，但不得承载语义文本。
- `--brand-text #C2410C`（5.18:1）——**品牌色凡作文字或作白字底色，一律用它**：
  激活标签、eyebrow、chip.brand、主按钮/徽章底色。
- `--brand-deep #D8501F` 保留作按压态；在 `--brand-soft` 底上仅 3.74:1，
  **不可作正文**（复习徽章等小字改用 `--brand-text`）。
- 状态色作文字一律用 `--ok-text / --warn-text / --err-text`（2026-08-31 补）：
  原 `--ok / --warn / --err` 白底仅 2.28 / 2.15 / 3.76:1，**作 12–14px 小字不达 AA**。
  原色保留作图形/填充（badge 底、icon 描边），文字态切换为 `*-text`。

**规则**：禁止 <14px 字号使用 `--brand` 单色作正文；需配深底（按钮白字用
`--brand-text` 作底）或 700 字重（≥18px 且此时仍需 ≥3:1，即用 `--brand-text` 更稳）。

### 2.3 配色禁忌

- ✘ 多色品牌（紫/蓝/青渐变）
- ✘ 深色科技感背景（除明确暗色场景）
- ✘ 彩虹 / 荧光 / 霓虹
- ✘ 大面积纯品牌色块（除 Hero 按钮）
- ✘ 卡片 1px 内描边 + 阴影叠加（取一）

---

## 3. 字体系统

### 3.1 字体栈

```
display:  MiSans → Inter → -apple-system → Segoe UI → 系统
body:     MiSans → Inter → -apple-system → Segoe UI → PingFang SC → 微软雅黑 → 系统
mono:     Geist Mono → JetBrains Mono → Fira Code → Consolas
num:      Geist / Inter （数字等宽，行内数字更稳）
```

> **依赖策略**：项目禁 CSS 框架，字体走系统栈。**不绑入任何 webfont 文件**——
> 用户本机装了 MiSans 就命中 MiSans，没装则静默降级苹方/雅黑，**不出现 FOIT/FOUT 闪烁**。
>
> ⚠️ **MiSans 不可子集化 / 不可嵌入（2026-08-31 核授权后裁定，路径 C）**：
> 原计划「小米官网 woff2 离线包 + 子集化后绑入 `web/public/fonts/`」已废弃，理由：
> 1. 授权条款禁止「修改或制作衍生版本」——**子集化即衍生**；
> 2. 「嵌入系统 / 软件 / APP」属灰区，官方要求「自行咨询作者」，而 `@font-face` 即嵌入；
> 3. 官方许可是**可撤销**的全球版权许可，把长期依赖押在上面不符合 local-first 的数据主权原则。
>
> 若未来确需自托管中文字体，改用 **SIL OFL 1.1** 授权字族（如思源黑体 SC / Noto Sans SC），
> OFL 明确允许子集化、再发布、嵌入。届时须同步修订本节的字体栈与设计意图。

### 3.2 字阶（模块化 1.250 · Major Third）

| 令牌 | 尺寸 | 字重 | 行高 | 用途 |
|---|---|---|---|---|
| `--fs-7xl` | 60px | 700 | 1.05 | Hero 主标题（桌面） |
| `--fs-6xl` | 48px | 700 | 1.1 | Hero 主标题（中等屏） / 页面 H1 |
| `--fs-5xl` | 36px | 600 | 1.15 | 页面 H2 |
| `--fs-4xl` | 30px | 600 | 1.2 | 大区段 |
| `--fs-3xl` | 24px | 600 | 1.25 | 区段 |
| `--fs-2xl` | 20px | 600 | 1.3 | 卡片 H |
| `--fs-xl` | 18px | 500 | 1.4 | 段首 |
| `--fs-lg` | 16px | 400 | 1.55 | 阅读正文 |
| `--fs-md` | 15px | 400 | 1.6 | 卡片正文 |
| `--fs-base` | 14px | 400 | 1.5 | 项目基线（编辑器/列表） |
| `--fs-sm` | 13px | 500 | 1.4 | 按钮/标签 |
| `--fs-xs` | 12px | 500 | 1.35 | 微标签 / 计数 |

### 3.3 排版规则

- 标题字距 `--tracking-tight -0.02em`；正文 0；全大写微标签 `--tracking-caps 0.08em`。
- 段落最大宽 720px（`--container-sm`），行长 50–75 字符最佳。
- 中文与西文间自动 1/4 空格（编辑器层处理，非 CSS 责任）。
- 标题禁用感叹号；禁用"行业黑话+emoji"组合（"🚀 立即开始"）。

---

## 4. 间距与栅格

### 4.1 间距（4px 基准 · 几何级数）

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 120
```

- 卡片内边距：16/20/24 三档
- 卡片之间：16/20/24
- 区段上下：48/64/80
- 页面外边距：≥ 96px（桌面）/ 24px（移动端）

### 4.2 容器与栅格

- 内容最大宽 1200px（`--container`），居中
- 阅读最大宽 960px（`--container-sm`），笔记编辑 / 文档
- 12 列响应栅格；列间 24px；gutter 24px
- 断点：`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`（与 web/src 保持一致）

### 4.3 布局骨架

| 容器 | 用途 |
|---|---|
| `--nav-h 64px` | 顶栏（半透白 + backdrop-blur 12px） |
| `--rail-w 280px` | 应用侧边栏；可缩 240 / 展开 320 |
| 内容区 | `calc(100vh - var(--nav-h))`；最小宽 720 |
| 弹层最大宽 | 480 / 640 / 800 三档 |

---

## 5. 圆角、描边、阴影

### 5.1 圆角

- 按钮：8px（主）/ 999px（药丸/标签）
- 卡片：10px（默认）/ 16px（大卡片 / 弹层）
- 输入框：8px
- 头像：50%
- 标签 chip：999px

### 5.2 描边

- 默认 `--border #ECECEC`（比项目旧 `#E5E5E5` 更轻，与页面灰底 `#F5F5F5` 拉出层次）
- 强调态 `--border-strong #D4D4D4`
- 品牌描边仅在 brand-soft 底上用 `--brand-line #F5C7B0`

### 5.3 阴影

克制使用：阴影 = 浮起信号，不要叠满。

| 令牌 | 用途 |
|---|---|
| `--shadow-1` | 行内/极弱浮起 |
| `--shadow-2` | 卡片默认（与 1px 描边二选一） |
| `--shadow-3` | popover / dropdown |
| `--shadow-4` | modal / dialog |
| `--shadow-glow` | 仅品牌按钮 hover（MiMo 标志） |

---

## 6. 动效系统

### 6.1 时长与曲线

| 用途 | 时长 | 曲线 |
|---|---|---|
| 颜色 / 透明度 hover | 150ms | `--ease-out` |
| 浮起 / 阴影 | 250ms | `--ease`（MiMo 标志曲线） |
| 展开 / 折叠 | 250ms | `--ease` |
| 弹层进场 | 250ms | `--ease` |
| 弹层出场 | 150ms | `--ease-in` |
| 数字滚动 | 800ms | `--ease-out` |
| 地球 / 聚光 | 30fps 限帧 | 线性 |

### 6.2 性能契约（继承 P8-001C）

- **限帧**：`--frame-ms = 1000/30`；地球 / 聚光 / 动效 rAF 节流
- **dpr 上限**：Hero 1.5；卡片 1
- **离屏暂停**：`IntersectionObserver` + `document.hidden` 停 rAF
- **降级**：`prefers-reduced-motion: reduce` → 全部 `--dur` = 0
- **禁止**：循环内 `getComputedStyle`、逐帧 DOM 重建、`box-shadow` 动画（用 transform/opacity）

### 6.3 微交互清单

- 按钮：hover 抬升 -1px + `--shadow-glow`；active 抬升 0
- 卡片：hover 描边由 `--border` → `--border-strong` + 抬升 -2px
- 链接：颜色 `--text` → `--ink`（无下划线，hover 加 `--hl` 底色块）
- 输入框：focus 描边 `--border` → `--brand`，外发光 0 0 0 3px `rgba(255,107,53,.15)`
- 切换 / Tab：下划线从左展开 250ms `--ease`

---

## 7. 组件清单

每个组件配：用途 / 视觉 / 交互 / 状态 / 与 `web/src` 实现映射。

### 7.1 基础（Base）

> **示例路径注（2026-09-01）**：`app-shell.html` · `bento-dashboard.html` · `spotlight-card.html` ·
> `marquee.html` 四个示例页已归档至 `archive/legacy-gallery-html-2026-09-01/`，下表以
> `归档·<文件名>` 简写指代该目录下的同名文件。它们不再代表现行设计方向，
> 仅作历史参考——归档理由见该目录 `README.md`。
>
> **2026-09-02 修正**：其中 `spotlight-card.html` 已以「空状态聚光引导」的**新形态解禁**，
> 新稿回到 `ui/` 根目录。归档目录里保留的是**内容卡形态的旧稿**，该形态仍被否决。
> 二者同名但不同物：本文件提到 `spotlight-card.html` 时指根目录解禁版，
> 提到 `归档·spotlight-card.html` 时指被否决的旧稿。依据 ADR-013 §2.13。

| 组件 | 视觉 | 示例 | 实现映射 |
|---|---|---|---|
| Button | 主/次/幽灵/链接/图标；尺寸 sm/md/lg；药丸可选 | `home-hero.html` · `归档·app-shell.html` | `web/src/components/ui/Button.tsx`（待建） |
| Input | 8px 圆角，42px 高，focus 橙描边 + 外发光 | `motion-primitives.html` | 待建 |
| Textarea | 同 Input；自适应高度 | — | 待建 |
| Select | 自绘下拉（禁浏览器默认） | `motion-primitives.html` | 待建 |
| Checkbox / Radio / Switch | 自绘；switch 滑过用 brand-soft → brand | — | 待建 |
| Tag / Chip | 灰底无描边 / brand-soft 底（激活） | `归档·bento-dashboard.html` | 待建 |
| Avatar | 圆形 32/40/56；首字母 / 域色 | `归档·app-shell.html` | 待建 |
| Badge | 状态色徽章（ok/warn/err/info） | `归档·bento-dashboard.html` | 待建 |
| Tooltip | 黑底白字 8px 圆角 4px 阴影 3 | `归档·bento-dashboard.html` | 待建 |
| Toast | 右上角堆叠，4s 自动消失 | `motion-primitives.html` | 待建 |
| Modal | 居中，遮罩 30% 黑，240ms 进场 | — | 待建 |
| Skeleton | 灰块 1.2s 闪烁（`--surface-2` ↔ `--surface-3`） | `motion-primitives.html` | 待建 |
| Progress | 进度条 / 圆环；品牌橙填充 | `归档·bento-dashboard.html` · `motion-primitives.html` | 待建 |
| Segmented Control | 滑块移动 250ms `--ease` | `motion-primitives.html` | 待建 |
| Tabs | 下划线从左展开 | `归档·app-shell.html` | 待建 |

### 7.2 复合（Composite）

| 组件 | 视觉 | 示例 | 实现映射 |
|---|---|---|---|
| AppShell | 顶栏 64（半透白 blur）+ 内容区；视图切换为浮层态，**无平级侧边栏** | `note-workspace.html` · `ui-preview.html` | ✅ `components/shell/AppShell.tsx`（Phase 2 已实现）<br>⚠️ 旧示例 `归档·app-shell.html` 的**平级侧栏导航**已否决，仅顶栏尺寸/层次仍沿用 |
| Hero | 12 列，左文 6 / 右图 6，地球 | `home-hero.html` | `components/planet/`（待建） |
| ~~BentoGrid~~ | 不等高网格（1+1+2 / 1+3 等） | `归档·bento-dashboard.html` | ⛔ **已否决**：裁决 A 删除独立仪表盘，学习数据分散到该出现处。<br>⚠️ **有限复用（2026-09-02）**：`orbit-tree.html` 的卫星网格**只取**「尺寸 = 重要性」的网格原则与 tile `col/row` span（含 `grid-auto-flow: dense` 补位），**弃用**独立仪表盘定位与 MiMo 风视觉——即复用**网格体系**而非**组件定位**。判定依据见该页 §「为什么能用（与归档理由不冲突）」 |
| SpotlightCard | 鼠标跟随聚光（开源 Aceternity 风）；**仅限空状态引导** | `spotlight-card.html`<br>旧稿 `归档·spotlight-card.html` | ✅ **2026-09-02 解禁 · 限定范围**：仅用于「无内容可读 + 单一 CTA」的空状态 / 首次引导 / 加载失败兜底，三条门禁见 ADR-013 §2.13。**在内容卡上使用聚光仍 ⛔ 否决**——旧稿正是该形态 |
| ~~Marquee~~ | 无缝横向滚动（开源 Magic UI 风） | `归档·marquee.html` | ⛔ **已否决**：ADR-013 禁装饰性动效 |
| CommandPalette | Ctrl+K，浮层居顶 | v1 未建示例 | `stores/ui.ts` |
| Wikilink | `[[...]]` 黄色高亮 + 墨蓝字 | `归档·app-shell.html`（笔记正文） | `editor/` |
| TutorPanel | 流式对话 + 抽屉 | v1 未建示例 | `components/tutor/` |
| KnowledgePlanet | 点阵球 + 轨道卫星（无概念节点） | `home-hero.html` | `components/planet/` |
| **OrbitTree**（原 NoteTree） | 左栏主/副笔记单父树，层级 = **轨道**（2026-09-02 重塑）：① 轨道展开 `grid-template-rows 0fr→1fr`，非 `display:none` ② 卫星 `transition-delay: calc(var(--i) * 45ms)` stagger 入轨 ③ 星球点 6px 实心 → 16px 轨道环（`border`+`padding` 过渡，`background-clip: content-box`，无 SVG）④ 空轨道 = 虚线圈 ⑤ orphan 保留不删，warn 虚线环（形状即语义）⑥ 橙只给选中，不用于静态分类 | [`orbit-tree.html`](./orbit-tree.html)（旧名 `note-tree.html`，2026-09-02 更名） | `NoteListView`（回灌替换平铺列表；层级走 `resolve_hierarchy()`，ADR-024）。**注意**：后端契约 `GET /notes/tree` 与 web 组件 `NoteTreeList`/`buildNoteTree` **不随本次更名**——那两者属契约层与 web 实现层，与 ui 规范页同名不同物 |
| Graph | 力导向/层级，d3-force | v1 未建示例（`归档·bento-dashboard.html` 有缩略） | `components/graph/` |
| ReviewCard | 复习专注模式 | v1 未建示例 | `ReviewSessionView.tsx` |
| MasteryRadar | SVG 雷达四维 | `归档·bento-dashboard.html`（雷达块） | M3 |

### 7.3 动效基元

| 基元 | 视觉 | 示例 |
|---|---|---|
| FadeInUp | IntersectionObserver 触发 0→1 + translateY 16→0 | `motion-primitives.html` |
| CountUp | 数字 0→target，800ms ease-out | `motion-primitives.html` |
| Skeleton | 1.2s 闪烁 | `motion-primitives.html` |
| Toast | 右上滑入 | `motion-primitives.html` |
| ProgressRing | 0→62% 描边动画 | `motion-primitives.html` |
| WaveUnderline | 链接 hover 下划线展开 | `motion-primitives.html` |

### 7.4 M9 视觉引擎组件（2026-09-01 新增 · 仅 ui 库）

> **位置**：[`visual-engine/`](./visual-engine/)（ui 库）。
> **样式定稿处**：[`visual-engine.html`](./visual-engine.html)（ui 库根目录）。
> 任何样式疑问以它为准——6 示例真实 TraceRun 内联于此，组件 CSS 是它的等值转写。
> **对外演示页**：`visual-engine-demo.html`（ui 库根目录）。样式直引
> `visual-engine/visual-engine.css` —— 演示的是**组件真实样式**，不是另抄一遍；
> 数据与脚本由 `visual-engine/sync-demo-html.mjs` 从定稿处幂等注入，改定稿后重跑即同步。
> **未合并进 `web/`** —— `web/src/components/ui/index.ts` 按所有者裁定不导出 M9 组件，
> 避免出现「ui 库一套样式、项目里另一套」的双份来源。回灌时机归 **M9-007**。
> **旧实现已归档**：`archive/visual-engine-tsx-2026-09-01/`（样式定稿前的 TSX 稿，冻结不再维护）。
> **契约来源**：`docs/adr/ADR-025-visual-engine-v1.md` v3（唯一事实源，本文档只记 UI 层决策）。

#### 7.4.1 心智模型：调试器，不是播放器

用户在这里是**逐步追问**，不是**观看动画**。因此：

| 有 | 无 |
|---|---|
| Step Into / Over / Out / Continue / Back / Restart | ❌ 播放三角 |
| 步号 `n / total`、栈深、当前行 | ❌ 进度条、时间轴、自动播放 |
| 键盘方向键 + 空格 + R | ❌ 倍速、循环播放 |

**为什么不用播放器**：学习者的真实动作是「这行为什么走到这里」——需要**随时后退对比**，
播放器的单向时间轴做不到；而 `Back` 在 trace 数据上是 O(1) 的（后退只是索引 −1），
成本几乎为零。这条与 VS Code / Python Tutor / Thonny 的步进派一致
（VS Code 亦以 continue→over→into→out→restart 为主序）。

**键位刻意偏离 VS Code（F5/F10/F11/Shift+F11）**：F 键会被浏览器抢走（F5 刷新、F11 全屏），
且笔记本上需配合 Fn。改用 ↓ → ↑ 空格 ← R，单手可达、无需说明。

#### 7.4.2 组件清单

| 组件 | 职责 | 视觉要点 |
|---|---|---|
| `VisualEngine` | 组合壳；模板路由 + 键盘绑定 + `onVisualize` 只发一次 | 三段：工具栏 / 代码窗 / 可视化区 |
| `DebugToolbar` | 6 个步进按钮 + 步号 + 栈深 | primary = 单步进入；ghost = 后退/重开；disabled 由 `canStep()` 判定 |
| `CodePane` | 代码 + gutter（行号 + 热力条）+ 当前行 + 调用者行 + 行内变量 | 等宽 13px；`scrollIntoView` 跟随当前行 |
| `ArrayView` | 数值数组柱状图（模板 `array`） | SVG viewBox 320×168；变化项橙描边 |
| `FrameStackView` | 调用栈（模板 `framestack`） | 栈顶在**最上**、带橙框；`marginLeft: i*10` 表达递归深度 |
| `GeneralView` | 兜底：数组 chips + 帧列表 | 无专属可视化时的诚实降级 |

**纯逻辑模块**（零依赖、可单测、项目内可复用）：`stepping.ts`（`nextStepIndex` / `canStep` / `stackDepth`）、
`derive.ts`（`formatValue` / `computeHitCounts` / `inlineValuesForLine` / `changedKeys` / `pickNumericArray` / `changedIndices` / `normalizeHeights`）、
`highlight.ts`（`tokenizePython` / `tokenizePythonLine`，跨行字符串状态机）。

#### 7.4.3 编码通道预算（ADR-025 §3.6 · 一个维度只占一个通道）

通道复用会让「当前行」「变化量」「深度」三件事互相干扰，读者分不清哪个信号在说话。

| 维度 | 通道 | 说明 |
|---|---|---|
| 当前执行行 | 品牌橙底 | **唯一**暖色行；其他行不得用橙 |
| 调用者行 | 中性墨蓝底 | 次级指向，不与橙抢注意力 |
| 命中次数 | gutter 竖条**透明度** | 不用长度不用色相 |
| 变量变化 | 橙色**描边** | 非填充，避免与当前行混淆 |
| 递归深度 | 卡片 **y 偏移**（`marginLeft`） | 位置即深度 |
| 数组值大小 | 柱**高度** | 长度语义 |
| 栈顶帧 | 橙色**边框** | 与调用者行的墨蓝区分 |

#### 7.4.4 纪律

- **样式单一来源**：`visual-engine.css` 全部取值来自 `tokens.css`，无裸值、无硬编码色。
- **ADR-013 硬约束**：无 gradient / backdrop-filter / 装饰 SVG / 卡片套卡片 >2 层 / 图标库 / emoji 图标。
- **CLS**：可视化区定高（不 `return null` 造成跳动）；`contain: layout paint`。
- **Python 语义**：渲染 `None` / `True` / `False`，**不是** JS 的 `null` / `true` / `false`；不调用用户 `repr()`。

#### 7.4.5 验证

```bash
# 纯逻辑单测（68 项）
cd web && ./node_modules/.bin/vitest run --dir ../ui/visual-engine

# 组件类型自检（ui/ 无 node_modules，react 类型经 paths 指向 web/）
cd ui/visual-engine && ../../web/node_modules/.bin/tsc --noEmit -p tsconfig.check.json

# HTML 原型冒烟（36 项断言，跑真实 tracer 产出的 TraceRun）
node ui/visual-engine.smoke.js

# 空态规范页冒烟（48 项断言，守门禁 2 与聚光实现约束）
node ui/empty-states.smoke.js
```

### 7.5 空态与首次引导（2026-09-02 新增 · 仅 ui 库）

> **规范页**：[`empty-states.html`](./empty-states.html)（唯一来源）。
> **组件规格**：[`spotlight-card.html`](./spotlight-card.html)（聚光卡本体 + 内容卡反例）。
> **约束来源**：ADR-013 §2.13（Spotlight 例外 — 仅限空状态引导）。

**空状态分两类，处理方式不同**：

| 类型 | 特征 | 处理 |
|---|---|---|
| **加载中** | 数据未到 | **Skeleton 骨架屏**（容器定高 → 零 CLS） |
| **真的没有内容** | 数据已到且为空 | 纯文字说明；仅当**同时**满足「无内容可读 + 唯一出口 + 可 hover」时才允许聚光引导 |

**三条门禁（缺一不可）**：① 界面无内容列表/正文/图表（分支为 `empty`/`onboarding`/`error`，非 `loaded`）
② 卡内 `button` 数 = 1（关闭与辅助链接不计）③ 仅 hover 触发，整段包在
`@media (hover:hover) and (prefers-reduced-motion:no-preference)` 内。

**全量审计结论**（`web/src` 12 个空态分支）：**1 个直接允许**（`NoteEditor.tsx:278` 首篇 onboarding）、
**4 个补一个 CTA 后允许**（Galaxy 空态/错误 · MindMap 空态 · Review 临界）、**7 个禁止**
（其中 3 处是加载态应走 Skeleton；其余为右栏 / 知识雷达 / 搜索浮层等有内容可读的界面）。
完整逐条判定见 `empty-states.html` ①。

**编码通道预算**：引导 = 聚光（中心 `rgba(255,107,53,.13)`、38% 处 .04、62% 全透明；半径 320/460px）·
主 CTA = `--brand-deep` 底 + 白字（4.13:1 AA，**不用** `--brand` 的 2.84:1）·
次信息 = `--text-2` 说明行 · 分区 = 1px 描边（不用阴影）。

**接线状态（2026-09-02 所有者裁定）**：**只出规范，不写入 `web/` 业务代码**。
首选落点 `galaxy/GalaxyCanvas.tsx:741`（`!planet`）当前**无 CTA**，接线时须先补唯一按钮，否则门禁 2 不过。
动效基元落点清单见 `empty-states.html` ④，同为本轮只出规范。

---

## 8. 页面骨架（2026-08-30 裁决 A 改写：笔记优先）

> 打开应用即笔记工作区，**取消平级 tab，无独立首页/Dashboard**（裁决 A）。
> 图谱/星系/导图/Tutor 为顶栏「← 返回笔记」的浮层态。
>
> **`bento-dashboard.html` 已于 2026-09-02 解禁回 `ui/` 根目录**（旧稿仍在归档作否决证据）：
> 只取「尺寸 = 重要性」的网格原则与 tile span，**弃用**「独立仪表盘」定位与 MiMo 风视觉
> （gradient / backdrop-filter / 多色 palette 全部去掉）。它现在是**网格组件**，不是页面骨架。

| 界面 | 布局 | 核心 | 实现参考 |
|---|---|---|---|
| **笔记工作区（默认主界面）** | 三栏：列表 240 + 编辑器 680 行宽居中 + 右栏 320（大纲/反链/关联/掌握度/雷达）；TopBar 64（搜索/复习徽章/同步） | 编辑器三条硬约束：工具栏只放格式控件 · 行宽 680 · 保存态极小字下沉元信息行 | `note-workspace.html` · `ui-preview.html`（`归档·app-shell.html` 的平级侧栏已否决，仅外壳尺寸可参考） |
| **图谱（浮层）** | 全屏画布 + 左浮工具条 + 右浮 Inspector | 形状即语义（ADR-023） | `graph-view.html` |
| **复习（浮层）** | 居中专注卡 + 键盘驱动（1/2/3 三档打分 = SM-2 quality 1/3/5 · Esc 退出；2026-08-31 按实现实况校正，原拟 1–4） | ProgressRing | `motion-primitives.html` |
| **星系（浮层）** | 双形态：全屏单颗 4s 轮换 / 右栏单颗静止 | 地球移植 `home-hero.html`，主笔记=星球 | `home-hero.html` |
| **Tutor（浮层）** | 右栏抽屉 + 流式对话 | Skeleton + 停止按钮 | — |

### 8.1 页面 × 组件坐标表（2026-09-02 实测）

> 回答四件事：**什么页面 · 什么位置 · 放什么组件 · 多大 · 什么时候触发**。
> 坐标为 **1264×900 视口**下的文档坐标（`scroll` 归零时 `getBoundingClientRect()` 取整，单位 px）。
> 布局改动后必须重测，不要照抄：坐标是**实测值**，不是设计意图。
> 自检口径：`ui-preview.html` 全页 `canvas` 数 = **1**（只有 §hero 那一颗）；
> `note-workspace.html` 全页 `canvas` 数 = **0**。

#### 笔记工作区 `note-workspace.html`（视口 1264 · 文档高 1754）

| 区域 | 组件 | 选择器 | 实测坐标 / 尺寸 | 触发条件 |
|---|---|---|---|---|
| 左栏 · 笔记列表 | `NoteList` + `Filter` | `.rail-left` | (0, 64) 240×505 | 常驻；`.rail-filter` 输入即时过滤，命中项不改布局高度（CLS 0） |
| 中栏 · 编辑器 | `Editor`（行宽 680） | `.editor` | (240, 64) 689×505 | 常驻；`.editor-inner` (240, 64) 674×835 |
| 右栏 · 上下文 | 大纲 / 反链 / 掌握度 | `.rail-right` | (929, 64) 320×505 | 常驻；无内容时留空容器不塌陷 |
| 主笔记标题 | `NoteHead` | `.note-head` · `h1` | (272, 104) 610×57；`h1` 610×36 | 打开笔记即渲染。**右上角曾放 88px Mini Star，2026-09-02 移除** |
| 统计行 | `StatLine` | `.stat-row` | (272, 193) 610×79 | 常驻；无数据显示 `0`，不隐藏整行 |
| 关联笔记 chip | `Chip` | `#chipsRow` · `.chip` | (272, 288) 610×27；单 chip 51×27 | 关联 ≥1 条才渲染；点击 = 选中 / 再点取消 |
| 概览卡片网格 | `Card` + `ProgressRing` | `.cards-grid` · `.card` | (272, 347) 610×279；单卡 297×128 | 常驻（≥1 张）；与 chip **双向锚** |
| ~~右上角星球~~ | ~~`Mini Star`~~ | — | — | **已取消**（2026-09-02）：卫星不再映射笔记，且笔记区不放任何持续运动的图形（ADR-013 §2.10） |

**视觉层级（自上而下，全部静态）**：标题 → stats → chip → 卡片。**零 canvas、零 rAF。**

#### 整合预览 `ui-preview.html`（视口 1264 · 文档高 8217）

| 区域 | 组件 | 选择器 | 实测坐标 / 尺寸 | 触发条件 |
|---|---|---|---|---|
| §hero · 点阵地球 | `DotEarth` | `canvas[data-dot-earth]`（`.de-wrap`） | (672, 515) **460×460** | 页面加载即挂载（`bootAll` 扫选择器）；离屏 / 标签隐藏 → 停 rAF；`reduced-motion` → 只画静态一帧；**≤1080px 整块 `display:none`** |
| §hero · 文案与 CTA | `HeroCopy` + `Button` | `#heroDemo .copy` | (82, 655) 531×180 | 常驻 |
| §2 · 主笔记概览 | `NoteOverview` | `.note-overview` | (185, 1924) 880×503 | 常驻 |
| §2 · 统计行 | `StatLine` | `#overview .stat-line` | (217, 2033) 816×59 | 常驻 |
| §2 · chip 行 | `Chip` | `#ovChips` | (217, 2108) 816×27 | 点击 = 选中 / 再点取消 |
| §2 · 卡片网格 | `Card` + `ProgressRing` | `#ovGrid` · `.demo-card` | (217, 2155) 816×240；单卡 402×114 | 与 chip 双向锚；**本节无星球组件** |
| §4 · Bento 网格 | `BentoGrid` | `#bento .bento-mini` | (50, 3023) 1150×416 | 常驻；`.t.review` 2×2 span：(66, 3039) 553×252 |
| §5 · 聚光卡 | `Spotlight` | `#spotlight .sl` | (70, 3650) 359×194 | 仅 `(hover: hover)` 且非 `reduced-motion`；**hover 才显形**，不 hover 时 `opacity:0` |
| §6 · 空态对照 | `Skeleton` / `Spotlight` | `#empty .es-grid` | (50, 4033) 1150×207 | 常驻展示；loading 走 Skeleton，**不走聚光** |

#### 落位裁决（2026-09-02）

1. **点阵地球只进主页 Hero。** 需要 ≥320px 才读得出点阵（Hero 用 460px → 地球直径 230px、点距 3.29px）；
   笔记区装不下（300px 压标题、150px 点阵糊到 1.07px），两条路都堵死 —— 见 `dot-earth.html` §②。
2. **笔记区不放任何星球。** 「卫星 = 笔记」映射取消后，88px 的 `Mini Star` 一起撤。
   实现保留在 `mini-star.html`，**当前无页面消费**；将来列表行 / 卡片角标需要小星，从那里取，不要新写。
3. **彩色卫星 ≤ 6 颗**，超出回退中性灰 `#525252` + 橙描边，改用位置与轨道区分。
   颜色**只作身份标识**，不承载掌握度 / 状态 / 时间等第二重语义。
4. **Hero 的卫星不再代表笔记。** 点选只派发 `dot-earth:pick`，宿主自行决定绑什么；组件不内置笔记语义。

---

## 9. 可访问性

- **对比度**：正文 ≥ 4.5:1；大号 ≥ 3:1（已验证 §2.2）
- **键盘**：所有交互元素 `tab` 可达；focus ring 2px brand
- **语义**：标题层级 h1→h6 单调；按钮用 `<button>`，链接用 `<a>`，禁用 div 模拟
- **动效**：`prefers-reduced-motion: reduce` → 全部停
- **触摸目标**：≥ 44×44px
- **语言**：`html lang="zh-CN"`；中英数字间自动空格（编辑器层）

---

## 10. 性能契约（与 P8-001C 一致 · 冻结）

- 单 rAF · 30fps 节流（`--frame-ms = 1000/30`）
  - **唯一例外：点阵地球 `dot-earth.html` 用 60fps**（自转仅 ~7px/秒，30fps 下每帧走 0.23px，点阵会读成「一格一格」）；代价由预缩放贴图 + 预烘焙叠加层抵消
  - 节流判断必须留 **6ms 容忍窗口**（`FRAME_TOL`）——60Hz 帧间隔抖动 16.6–16.9ms，硬比 `FRAME_MS` 会整帧跳过，33/50ms 交替，这正是「掉帧、不连贯」的根因
- canvas 卡片版 dpr=1 / Hero dpr≤1.5 / 点阵地球 dpr≤2（与 `home-hero.html` 一致）
- 容器 `contain: layout paint size`
- `IntersectionObserver` + `visibilitychange` 不可见即停
- `prefers-reduced-motion: reduce` → 静态一帧
- 循环内禁 `getComputedStyle` / 逐帧 DOM 重建 / `box-shadow` 动画
- 卫星渲染上限 16 颗（地球）

---

## 11. 与 web/src 映射

> **状态（2026-08-31 核实）**：Phase 0 令牌归一已完成，下表所有令牌**均已落地**，
> `ui/tokens.css` 与 `web/src/styles/tokens.css` 逐行镜像。
> `web/src/global.css` 顶部仅保留 Phase 0 旧令牌别名（`--bg-secondary` →
> `--surface-2`、`--text-primary` → `--text` 等），计划一个版本后删除。

| 设计令牌 | 值 | web/src 状态 |
|---|---|---|
| `--brand` | `#FF6B35` | ✅ 已落地（`web/src/styles/tokens.css`），**仅图形/填充/描边** |
| `--brand-text` | `#C2410C` | ✅ 已落地（Phase 4 新增；品牌色作文字/白字底用） |
| `--text-3` | `#737373` | ✅ 已落地（Phase 4 由 `#A3A3A3` 提升对比度至 4.74:1） |
| `--bg-soft` | `#F5F5F5` | ✅ 已落地 |
| `--border` | `#ECECEC` | ✅ 已落地 |
| `--text` | `#171717` | ✅ 已落地 |
| `--hl` | `#FBF1CF` | ✅ 已提升为全局令牌 |
| `--ink` | `#35618F` | ✅ 已提升为全局辅色 |

| 组件 | web/src 位置 | 状态 |
|---|---|---|
| 基础组件（Button/Input/Tag/Badge/Skeleton/Toast/Progress…） | `components/ui/basics.tsx` · `primitives.tsx` · `Toast.tsx` | ✅ Phase 1 |
| 复合组件（Select/Modal/Tooltip/SegmentedControl/Tabs/Switch） | `components/ui/controls.tsx` · `Select.tsx` | ✅ Phase 1 |
| 动效基元（FadeInUp/CountUp/ProgressRing/WaveLink） | `components/motion/index.tsx` | ✅ Phase 1 |
| AppShell 三栏（TopBar + ContextRail） | `components/shell/` | ✅ Phase 2 |
| 星系（多星球系统） | `components/galaxy/GalaxyCanvas.tsx` | ✅ Phase 3 ⑤ |
| 组件活文档 | `dev/ComponentGallery.tsx`（`#gallery`，dev-only） | ✅ Phase 1 |

**作废**：`bento-dashboard.html`（裁决 A 删除仪表盘，§8；2026-09-01 归档）·
`app-shell.html`（平级侧栏违背笔记优先 IA）· `marquee.html`（ADR-013 禁装饰动效）
——三者归档至 `archive/legacy-gallery-html-2026-09-01/`，理由见该目录 `README.md`。
`spotlight-card.html` **部分作废**：内容卡形态作废（旧稿留档作证据），
空状态引导形态已于 2026-09-02 解禁回根目录，见 §7.2 与 ADR-013 §2.13；
`components/universe/` 旧星系与 `components/planet/` 已被 `components/galaxy/` 取代
（代码待项目所有者决定是否删除）。

> **同步纪律**：改 `tokens.css` → 改本文件 §0/§2/§3 → 改 `web/src/global.css` → 跑 `npm run build`。
> 不允许 ui/ 内部与 web/ 颜色值漂移。

---

## 12. 选型与参考（开源）

视觉/组件灵感来源（实现为自包含 HTML，**不引入依赖**）：

| 来源 | 用法 | 链接 |
|---|---|---|
| **mimo.mi.com** | 整体视觉语言（白空间 + 橙 + 大字 + 地球） | https://mimo.mi.com/ |
| **shadcn/ui** | 组件 API 形态、tokens 结构、a11y 模式 | https://github.com/shadcn-ui/ui |
| **Aceternity UI** | SpotlightCard / BentoGrid 模式 | https://ui.aceternity.com/ |
| **Magic UI** | Marquee / Text Reveal / Shimmer Button | https://magicui.design/ |
| **React Bits** | 微交互模式参考 | https://reactbits.dev/ |
| **Uiverse** | 社区 UI 元素灵感（按需挑选） | https://uiverse.io/ |
| **Linear** | 命令面板、列表、键盘驱动 | https://linear.app/ |
| **Obsidian** | 侧边栏 + 双链 + 信息密度 | https://obsidian.md/ |
| **VS Code** | 工作区 + 状态栏 + 键盘提示 | — |

> 上述均为**视觉/结构灵感**，代码 100% 自写；项目禁 CSS 框架（AGENTS §2.3），禁第二状态库。

---

## 13. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-08-29 | 初版。统一令牌到 MiMo 橙白体系；新增 5 个组件页（Home Hero / App Shell / Bento Dashboard / Spotlight / Marquee）+ 1 个动效基元页 + 总览导航页。`ui/README.md` 索引同步。 |
| v1.1 | 2026-08-31 | **a11y 与一致性收口**：① §2.2 对比度改为**实测表**（原「品牌橙 3.6:1」为笔误，实测 2.84:1）；② 新增 `--brand-text #C2410C`（5.18:1）供品牌色作文字/白字底；`--brand` 降级为仅图形/填充；`--text-3` 由 `#A3A3A3`(2.52:1) 改为 `#737373`(4.74:1)；③ §11 映射表由「待同步」改为「已落地」真实状态，并补组件落地位置；④ §8 已按裁决 A 改写为笔记优先（原「六页面骨架」）。 |
| v1.2 | 2026-09-01 | **新增 §7.4 M9 视觉引擎组件**：6 个组件 + 3 个纯逻辑模块落地 `visual-engine/`，**仅入 ui 库不合并 `web/`**（`web/src/components/ui/index.ts` 按裁定不导出）；旧 TSX 归档至 `archive/visual-engine-tsx-2026-09-01/`；登记心智模型（调试器非播放器）、7 条编码通道预算、键位偏离 VS Code 的理由、三条验证命令。**旧画廊 HTML 归档**：`app-shell.html` / `bento-dashboard.html` / `spotlight-card.html` / `marquee.html` 移入 `archive/legacy-gallery-html-2026-09-01/`（四项与设计裁决冲突，§7.1/§7.2 已标 `归档·` 与 ⛔ 已否决）；总览页 `index.html` 对归档项加 `is-archived` 灰显 + 新增 M9 Visual Engine 卡片。 |
| v1.3 | 2026-09-02 | **Spotlight 解禁（限定范围）**：`spotlight-card.html` 以「空状态聚光引导」新形态回到 `ui/` 根目录——仅限「无内容可读 + 单一 CTA」的空状态 / 首次引导 / 加载失败兜底；内容卡形态仍 ⛔ 否决（旧稿留档作证据）。ADR-013 新增 **§2.13**，为 §2.7「禁 gradient」的**唯一**例外，写明三条门禁（空状态 / 单一出口 / 可撤销）与实现约束（聚光强度 ≤ .13、250ms、单 rAF + 30fps 节流、CTA 用 `--brand-deep` 白字 4.13:1）。§7.1 路径注、§7.2 组件表、§11 作废清单同步。**ui 库启用/归档分层清理**：`index.html` 拆为「组件 / 页面 / 归档」三区——前两区只放现行启用项，归档区集中 3 张 `is-archived` 卡片并指向 `ui/archive/<批次>-<日期>/`；导航加入口。修复归档文件内 8 处返回链接死链（`./index.html` / `./UI_DESIGN.md` → `../../`），全库扫描 14 个 HTML 零死链。 |
| v1.4 | 2026-09-02 | **左栏规范页重塑为「星系层级」**：`note-tree.html` → **`orbit-tree.html`**（守护脚本同步改名 `orbit-tree.smoke.js`）。§7.2 组件表 NoteTree 行改写为 **OrbitTree**，层级表达由「缩进 + chevron 旋转」改为**轨道**：轨道展开 `grid-template-rows 0fr→1fr`（取代 `display:none`，使高度可过渡）、卫星 `transition-delay: calc(var(--i) * 45ms)` stagger 入轨、星球点 6px 实心经 `border`+`padding` 过渡展开成 16px 轨道环（`background-clip: content-box`，无 SVG 无图片）、空轨道用虚线圈（刻意不复制 spotlight 渐变）、orphan 改 warn 虚线环（形状即语义，ADR-023）。橙仍只给选中，不用于静态分类。**BentoGrid 判定精确化**：§7.2 该行 ⛔ 已否决结论不变，但补记**有限复用**——`orbit-tree.html` 只取「尺寸 = 重要性」的网格原则与 tile span，弃用独立仪表盘定位与 MiMo 风视觉，即复用**网格体系**而非**组件定位**。**M9 定稿处补登记**：§7.4 此前只写 `visual-engine/` 目录与 `visual-engine-demo.html`，从未具名 `visual-engine.html`——而它才是样式定稿处（6 示例真实 TraceRun 内联于此）。已补「样式定稿处」行。**守护脚本两条陈旧断言按事实修正**（非删除）：D10 原找「不取」而新文案作「弃用」；F1 原把 `--i`/`--sat-cols`/`--bento-cols` 判为幽灵 token，但三者是 `style="--x:…"` 就地传参的**页面局部参数**——「幽灵」改为「tokens.css 没有、且页面内也找不到任何赋值点」，并补 F1b 要求局部参数必须被 `var()` 真实消费。实跑 **72/72**。引用同步：`index.html`（含缩略图改画星球环 / 卫星点 / 虚线 orphan 环）、`ui-preview.html`（补 orbit-tree / empty-states / visual-engine-demo 三个 tab）、`README.md`。**未动** `docs/adr/ADR-026-note-tree.md` 与 `web/src/components/notes/buildNoteTree.ts`——二者指后端契约 `GET /notes/tree` 与 web 组件 `NoteTreeList`，与 ui 规范页同名不同物。 |

| v1.5 | 2026-09-02 | **点阵地球定稿 + 笔记区去星球化**。新增 **§8.1「页面 × 组件坐标表」**（1264 视口实测：`note-workspace` 7 区 / `ui-preview` 9 区，含选择器、坐标尺寸、触发条件）与 4 条落位裁决。**§10 性能契约补两条**：点阵地球是 30fps 的**唯一登记例外**（用 60fps：自转 ~7px/秒，30fps 下每帧仅 0.23px，点阵读成「一格一格」）；节流判断必须留 **6ms 容忍窗口**——60Hz 帧间隔抖动 16.6–16.9ms，硬比 `FRAME_MS` 会整帧跳过导致 33/50ms 交替，此即「掉帧、不连贯」的根因（纯 JS 模拟：27.6fps / 16% 帧落在 50ms → 59.5fps / 全部 16.6–17ms）。**组件侧**：`dot-earth.html` 为定稿处，`ui-preview.html` §hero 是唯一落位（460px / 4 轨 / 4 星，脚本由 `sync-dot-earth.mjs` 幂等同步，防内联副本漂移）；地球直径 `EARTH_D` 0.60 → **0.50**；卫星半径按绝对观感定档 `地球半径 × 0.085–0.160`（照抄 `home-hero.html` 的比例会缩到 3.4–6.8px）；**卫星不做真遮挡**——一律画在地球之上，用连续 alpha（0.95 / 0.725 / 0.525）+ 半径表达远近，轨道环仍分前后半段。**笔记区按所有者裁定移除整个星球系统**：「优化器就不用显示卫星系统了……这个点阵地球就是主页的固定动画」——`note-workspace.html` 与 `ui-preview.html` §2 的 `.star-card` 退回单列 `.note-head`，「卫星笔记」→「关联笔记」，**零 canvas、零 rAF**，只留 chip ↔ 卡双向锚；`mini-star.html` 退为规范页（当前无页面消费）。**彩色卫星封边**：≤6 颗用域调色板，>6 回退中性灰 `#525252`，颜色只作身份标识不承载第二重语义。守护脚本：dot-earth **137/137** · ui-preview **148/148** · note-workspace **63/63**；`audit-ui-health.mjs` 零死链、13/13 根目录 html 全部登记。 |

---

**维护人**：UI Design（design-experts · ui-designer）
**验收**：交付后须在 `web/src/global.css` 应用 v1 令牌并跑通 `npm run build` + `npx vitest run`。
