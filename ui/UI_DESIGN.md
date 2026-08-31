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

| 组件 | 视觉 | 示例 | 实现映射 |
|---|---|---|---|
| Button | 主/次/幽灵/链接/图标；尺寸 sm/md/lg；药丸可选 | `home-hero.html` · `app-shell.html` | `web/src/components/ui/Button.tsx`（待建） |
| Input | 8px 圆角，42px 高，focus 橙描边 + 外发光 | `motion-primitives.html` | 待建 |
| Textarea | 同 Input；自适应高度 | — | 待建 |
| Select | 自绘下拉（禁浏览器默认） | `motion-primitives.html` | 待建 |
| Checkbox / Radio / Switch | 自绘；switch 滑过用 brand-soft → brand | — | 待建 |
| Tag / Chip | 灰底无描边 / brand-soft 底（激活） | `bento-dashboard.html` | 待建 |
| Avatar | 圆形 32/40/56；首字母 / 域色 | `app-shell.html` | 待建 |
| Badge | 状态色徽章（ok/warn/err/info） | `bento-dashboard.html` | 待建 |
| Tooltip | 黑底白字 8px 圆角 4px 阴影 3 | `bento-dashboard.html` | 待建 |
| Toast | 右上角堆叠，4s 自动消失 | `motion-primitives.html` | 待建 |
| Modal | 居中，遮罩 30% 黑，240ms 进场 | — | 待建 |
| Skeleton | 灰块 1.2s 闪烁（`--surface-2` ↔ `--surface-3`） | `motion-primitives.html` | 待建 |
| Progress | 进度条 / 圆环；品牌橙填充 | `bento-dashboard.html` · `motion-primitives.html` | 待建 |
| Segmented Control | 滑块移动 250ms `--ease` | `motion-primitives.html` | 待建 |
| Tabs | 下划线从左展开 | `app-shell.html` | 待建 |

### 7.2 复合（Composite）

| 组件 | 视觉 | 示例 | 实现映射 |
|---|---|---|---|
| AppShell | 顶栏 64 + 侧边栏 280 + 内容区 | `app-shell.html` | `web/src/App.tsx`（重设） |
| Hero | 12 列，左文 6 / 右图 6，地球 | `home-hero.html` | `components/planet/`（待建） |
| BentoGrid | 不等高网格（1+1+2 / 1+3 等） | `bento-dashboard.html` | `DashboardView.tsx`（重设） |
| SpotlightCard | 鼠标跟随聚光描边（开源 Aceternity 风） | `spotlight-card.html` | 待建 |
| Marquee | 无缝横向滚动（开源 Magic UI 风） | `marquee.html` | 待建 |
| CommandPalette | Ctrl+K，浮层居顶 | v1 未建示例 | `stores/ui.ts` |
| Wikilink | `[[...]]` 黄色高亮 + 墨蓝字 | `app-shell.html`（笔记正文） | `editor/` |
| TutorPanel | 流式对话 + 抽屉 | v1 未建示例 | `components/tutor/` |
| KnowledgePlanet | 点阵球 + 轨道卫星（无概念节点） | `home-hero.html` | `components/planet/` |
| Graph | 力导向/层级，d3-force | v1 未建示例（`bento-dashboard.html` 有缩略） | `components/graph/` |
| ReviewCard | 复习专注模式 | v1 未建示例 | `ReviewSessionView.tsx` |
| MasteryRadar | SVG 雷达四维 | `bento-dashboard.html`（雷达块） | M3 |

### 7.3 动效基元

| 基元 | 视觉 | 示例 |
|---|---|---|
| FadeInUp | IntersectionObserver 触发 0→1 + translateY 16→0 | `motion-primitives.html` |
| CountUp | 数字 0→target，800ms ease-out | `motion-primitives.html` |
| Skeleton | 1.2s 闪烁 | `motion-primitives.html` |
| Toast | 右上滑入 | `motion-primitives.html` |
| ProgressRing | 0→62% 描边动画 | `motion-primitives.html` |
| WaveUnderline | 链接 hover 下划线展开 | `motion-primitives.html` |

---

## 8. 页面骨架（2026-08-30 裁决 A 改写：笔记优先）

> 打开应用即笔记工作区，**取消平级 tab，无独立首页/Dashboard**（裁决 A；
> `bento-dashboard.html` 作废）。图谱/星系/导图/Tutor 为顶栏「← 返回笔记」的浮层态。

| 界面 | 布局 | 核心 | 实现参考 |
|---|---|---|---|
| **笔记工作区（默认主界面）** | 三栏：列表 240 + 编辑器 680 行宽居中 + 右栏 320（大纲/反链/关联/掌握度/雷达）；TopBar 64（搜索/复习徽章/同步） | 编辑器三条硬约束：工具栏只放格式控件 · 行宽 680 · 保存态极小字下沉元信息行 | `note-workspace.html` · `app-shell.html` · `ui-preview.html` |
| **图谱（浮层）** | 全屏画布 + 左浮工具条 + 右浮 Inspector | 形状即语义（ADR-023） | `graph-view.html` |
| **复习（浮层）** | 居中专注卡 + 键盘驱动（1/2/3 三档打分 = SM-2 quality 1/3/5 · Esc 退出；2026-08-31 按实现实况校正，原拟 1–4） | ProgressRing | `motion-primitives.html` |
| **星系（浮层）** | 双形态：全屏单颗 4s 轮换 / 右栏单颗静止 | 地球移植 `home-hero.html`，主笔记=星球 | `home-hero.html` |
| **Tutor（浮层）** | 右栏抽屉 + 流式对话 | Skeleton + 停止按钮 | — |

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
- canvas 卡片版 dpr=1 / Hero dpr≤1.5
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

**作废**：`bento-dashboard.html`（裁决 A 删除仪表盘，§8）；
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

---

**维护人**：UI Design（design-experts · ui-designer）
**验收**：交付后须在 `web/src/global.css` 应用 v1 令牌并跑通 `npm run build` + `npx vitest run`。
