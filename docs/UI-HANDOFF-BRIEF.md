# OLOS UI 交接简报（给外部 AI 评审用）

日期：2026-09-07 · 代码基线：**`ddbdf12`**（已 push，worktree clean）
目的：让外部 AI 在**不改代码**的前提下，理解项目状态 + 前端风格要求，并对截图给出视觉判断。

---

## 1. 项目是什么

Open Learning OS（OLOS）= **local-first 的 Adaptive Learning Workbench（自适应学习工作台）**。

- 数据真相：**Markdown 文件**；SQLite 是可重建缓存；前端只是 API consumer。
- 领域能力（后端已有，前端消费）：notes / wikilinks / backlinks / hierarchy / concepts / mastery（四维+衰减）/ review（SM-2）/ mistakes / tutor（SSE 流式）/ search（FTS5+CJK）/ graph / trace（算法可视化）。
- 产品差异化链路：**Reading → Annotation → Concept → Mastery → Review → Tutor** 必须在同一工作台内零切换完成。

## 2. 当前进度（都已 commit + push）

| 阶段 | 内容 | 状态 |
|---|---|---|
| Design Research / SPEC / ADR | Apple HIG + 竞品 + 5 个开源源码仓库研究；ADR-031（Learning Workbench） | ✅ |
| Source-first 移植 | `frontend/src/components/ios27/`（Button/SegmentedControl/Toolbar/Sheet/SearchBar/ContextMenu，MIT，clsx 已剥离，零新依赖 + tokens bridge） | ✅ |
| Content Layer | NoteReader（迷你 markdown）、CodeSurface（语法 token 分层）、Math（四定界符、无 `￥`、canonical 保留）、表格 | ✅ |
| 3C-1 Layout Foundation | 布局引擎 `layout.ts`（Work Surface 优先、让位 pane）、Header 三区、大标题→紧凑、Tab morph | ✅ |
| 3C-2 Context v2 | `contextModel.ts` 合成（概念精确匹配/回链/相关弱概念/密度门控）；条目=排版行+hairline（cardishRows=0） | ✅ |
| 3C-3 Compare v2 | 共享参照系 + 关系动作（头部 1 primary + 1 关系入口，其余 overflow） | ⬜ 未做 |
| Typography 中文校准 / 大屏 margin / Math 真排版 / 动效材质校准 / 视觉回归 | — | ⬜ 未做 |

**门禁现状**：vitest 250 passed · tsc build PASS · oxlint PASS · **npm 依赖增量 = 0** · **后端零改动**。

## 3. 前端风格要求（硬性）

**设计语言**：Dynamic Spatial Learning UI。
优先级：`Content > Hierarchy > Interaction > Context > Material > Motion > Decoration`。

**一级原则**：`One object in focus. Everything else stays close, contextual, and reversible.`

**层边界（最高约束）**
- **Content Layer**（Note/Reading/Code/Math/Table/List/Quote/Graph 内容/Context 内容）：base/raised；**禁止 Liquid Glass、glass-on-glass、装饰渐变/glow**。
- **Functional Layer**（Rail/TopBar/Toolbar/Palette/Popover/Sheet/Menu/Peek）：才允许玻璃/浮起/spring。
- **Immersive Layer**（Galaxy/Graph/Algorithm）：可有局部 token 子树，不得污染全局。

**已冻结、不得推翻**
- CodeSurface：非玻璃/非渐变/非 glow、12px 圆角、深色局部 token 子树、9 类语法 token、Copy→Copied、横向滚动、比正文更宽（breakout）。
- Math：四定界符（`$..$` `$$..$$` `\(..\)` `\[..\]`）、反斜杠保留、`￥` 伪影 = 0、canonical Markdown 不变（不得用 CSS 掩盖解析问题）。
- Glass 不再增加；accent（橙）只作注意力指针，resting 态不滥用；无 disabled 控件；hover 禁 scale 1.05；transform→spring、颜色/透明度→duration curve；reduced-motion 语义降级（movement→minimized，信息不丢）。
- 依赖红线：React/TS/CSS/SVG/Canvas/Web API；禁 MUI/AntD/Chakra/shadcn/Radix/Tailwind/Framer；KaTeX 需单独批准才装。

**空间模型**
- 布局优先级：`Work Surface > Context > Explorer > Decorative margin`；Explorer/Context 是**可让位 pane**（<1024 抽屉；同时开启且 Surface<720 → Context 让位；Compare 窄屏单列+Sheet）。
- 680 = **Reading Measure 目标**（≥1920 可放宽 760），不是无条件物理最小宽度。
- 大屏多出的空间 = **Contextual Margin**：边注 → Peek 落点 → 回链/小纲 → 第二 Work Object；**禁止用卡片填空**。

**Context 验收（3C-2 已按此做）**
不是 sidebar、不是 card column；必须具备 anchor / density / temporal relevance / hide-show / recomposition。三档密度：Minimal（Current+Mastery+Tutor）/ Standard（+相关概念/回链/相关笔记/复习到期/批注）/ Research（+前提/Sources）。

**Peek / Compare（待 3C-3）**
- Peek：edge-aware（边距 ≥320 进边距，不遮正文）+ Open / Open Right / Ask Tutor / Esc。
- Compare：不是 split view，要有共享参照系（标题对齐、section 节奏、scroll edge 同高、active 侧前置、divider 极静默）；头部只 1 primary + 1 关系入口，其余 overflow。

## 4. 已知问题 / 待外部意见

1. **中文排版**：17/1.75 + 标题 700，工程合规，但中文标题是否仍带"网页感"——需肉眼判断（建议对比 Bear / Craft）。
2. **2560 空间感**：目前 reader 保持 680–760，剩余为大 margin；是否真的"高级"还是"空"，需看图。
3. **Compare** 目前仍是并排两列（缺共享参照系），3C-3 待做——最容易滑向 VS Code split。
4. **Math** 目前是"原样 LaTeX + 排版 surface"，非真排版；路线建议：先本地子集渲染（零依赖），不足再提 KaTeX 提案。
5. **批注** 仍是内存态（持久化需 Phase 4 的 annotations 表 + 锚点）。

## 5. 截图清单（`tmp/handoff/images/`，均为当前实现）

| 文件 | 场景 |
|---|---|
| `01-current-reading-1920.png` | 当前阅读面（1920） |
| `02-current-reading-2560.png` | 当前阅读面（2560） |
| `03-context-concept-1920.png` | Context v2：概念笔记（掌握度/相关概念/回链/复习） |
| `04-context-standard-1920.png` | Context 标准密度 |
| `05-context-minimal-1920.png` | Context 极简密度 |
| `06-context-research-1920.png` | Context 研究密度 |
| `07-peek-1920.png` | Peek（当前：锚定 source，覆盖阅读列 44%，仅 2 动作，Ask Tutor 未做） |
| `08-compare-1920.png` | Compare（当前仍是并排两列，缺共享参照系） |
| `09-focus-1920.png` | Review Focus（S4） |
| `10-context-2560.png` | 2560 下的 Context |
| `11-codesurface.png` | CodeSurface（本地语法 token 分层） |
| `12-math-display.png` | Math display（保留原 LaTeX） |
| `13-reading-768-mobile.png` | 768 移动式布局 |
| `14-benchmark-page.png` | 基准页 `?design=apple-source-reference` |

## 6. 给外部 AI 的三个问题（建议直接照问）

1. 这些截图里，**最不像 Apple 的三处**是哪里？请指出具体元素与像素级理由。
2. 2560 的多余空间：**应该承载什么**（边注/Peek/回链/第二对象）？给出优先级与理由。
3. 中文标题与正文：是否仍有"网页感"？若是，建议的字号/字重/字距/行距组合是什么？

## 7. 纪律（重要）

- Blueprint 主文档 `docs/UI-3C-REDESIGN-BLUEPRINT.md` **冻结不改**；状态/变更写 `docs/UI-3C-IMPLEMENTATION-LOG.md`。
- 外部 AI 只给**建议与证据**，不得直接改代码/加依赖/改后端；任何视觉修改后必须出截图 + 5 视口（1280/1440/1920/2560/768）复核。
