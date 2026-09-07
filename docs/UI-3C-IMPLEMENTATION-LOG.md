# OLOS 3C Implementation Log

> 纪律（Owner 指定）：**Blueprint 主文档 `UI-3C-REDESIGN-BLUEPRINT.md` 锁定不改**。
> 所有实施状态、变更、实测证据只写本 log。
> 日期：2026-09-07

---

## 3C-1 Layout Foundation — DONE

**目标**：P0 Grid + Workbench Header + Large→Compact Title + Tab Morph。

| 变更文件 | 目的 |
|---|---|
| `frontend/src/workbench/layout.ts`（新） | 布局引擎 `computeLayout`：优先级 Work Surface > Context > Explorer；让位规则（<1024 抽屉、并置+Context 时 Context 抽屉/隐藏、Compare 窄屏 Sheet） |
| `frontend/src/workbench/layout.test.ts`（新） | 8 项：Focus/Compare/Context-only/Explorer+Context/度量策略 |
| `frontend/src/workbench/Workbench.tsx` | `.wb` 用 `grid-template-areas` + 各 pane 显式 `grid-area`；Header 三区；紧凑标题；Tab 指示器（FLIP + ResizeObserver） |
| `frontend/src/workbench/workbench.css` | 抽屉/单列/Header 三区/指示器/大标题→紧凑；旧 `data-layout` 列规则退场 |

**实测（5 视口 × 5 状态）**
- Context-only Work Surface：1280 **908** / 1440 **1068** / 1920 **1544** / 2560 **2184**（修复前恒为 **264**）
- 1920+ Explorer+Context：`264 / 320` 双列，Surface 1280–1920
- 768：pane 全部抽屉化，Surface 724；Compare → 单列 + 全高 Sheet
- 滚动后：`data-scrolled=true`，H1 **28→22px**，header 标题 opacity 0→1；指示器 78px 跟随

**附带修复**：Work Surface 此前非独立滚动容器（整页滚动）→ 滚动态永不触发。改为 `.wb{height:100vh;overflow:hidden}` + surface 自滚（VS Code/Tana 同构），pane 级 scroll edge 与大标题过渡才成立。

**门禁**：vitest 241 · build/oxlint PASS · 零依赖 · 未碰 backend。

---

## 3C-2 Context v2 — DONE

**目标**：Context = 伴随当前 Work Object 的第二层信息（companion），不是 card column、不是 metadata inspector。

### 变更文件

| 文件 | 目的 |
|---|---|
| `frontend/src/workbench/contextModel.ts`（新） | 纯函数合成：`extractLinkTargets` / `matchConcepts`（精确优先）/ `pickReviewDue`（仅相关弱概念）/ `buildContextModel` |
| `frontend/src/workbench/contextModel.test.ts`（新） | 9 项：链接解析、精确匹配、复习相关性、完整模型、空数据安全 |
| `frontend/src/api/notes.ts` | 补 `getBacklinks(noteId)` 消费端（后端端点已存在，仅前端窄化，**不改后端**） |
| `frontend/src/workbench/Workbench.tsx` | ContextPane v2：区块重组（key=焦点对象）、数据源（weakConcepts / 正文 / relatedNotes / backlinks）、密度门控 |
| `frontend/src/workbench/workbench.css` | `wb-ctx__row` 排版行 + hairline（**无背景/圆角/阴影**）、权重递减层级、recompose 动画（reduced-motion 关闭） |

### 结构与显示门控

- 默认：Current（Work Object）→ 掌握度 → 学习动作（Tutor / 复习）
- Standard（+）：相关概念 / 回链 / 相关笔记 / 复习到期 / 批注
- Research（+）：前提（推导，明确标注）/ Sources

### 时间相关性（防噪音，Owner 关心的点）

- 复习到期 = **弱概念 ∩ 与当前对象相关**，不相关弱概念不进 Context（实测由"全库 0% 噪音"变为仅相关项）
- 前提仅 Research 密度显示，并标注"推导"

### 实测（1920）

- 普通笔记（机器学习）：Current + 尚未建立概念关联 + 回链×1 + 批注空态 + 学习动作
- 概念笔记（梯度下降）：掌握度 **6%** + 相关概念（学习率/Adam优化器）+ 回链 + 复习到期
- **cardishRows = 0**（Context 内无任何条目具备背景/圆角/阴影 → 不是 Card Column）
- 密度切换生效：Minimal 仅学习动作；Research 增加前提/Sources

**门禁**：vitest **250 passed**（+9）· build/oxlint PASS · 零依赖 · 未碰 backend。
**截图**：`tmp/audit-3c2/{context-standard|minimal|research|concept}-1920.png`

---

## 下一阶段（未开始，按 Owner 锁定顺序）

- **3C-3 Compare v2**：共享参照系（标题/节奏/scroll edge 对齐）+ 关系动作（头部 1 primary + 1 关系入口，其余 overflow）
- 之后：Reading typography 中文肉眼校准 → 大屏 margin → Math（本地子集）→ 动效/材质校准 → 视觉回归

## 覆盖事故记录

- #11：`UI-3C-REDESIGN-BLUEPRINT.md` 一度被批准消息覆写并误提交；已用 tmp 副本恢复（含 4 条修正）。
- 对策：Blueprint 锁定 + 本 log 承载状态；提交前必查 `git status`。
