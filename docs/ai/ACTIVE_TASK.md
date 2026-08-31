# Active Task

> AI 工作记忆：当前正在做什么。权威源：`docs/PROJECT_STATE.md`（状态唯一来源）· `docs/TASKS.md`（任务与报告）。
> 上次更新：2026-08-31 · HEAD `888ecd2`（186 commits）· Gate：pytest **836** · vitest **28** · tsc PASS · build PASS · CI 双绿

---

## Task ID

**P8-FE-001 UI 视觉打磨（进行中）** — 用户反馈「UI 太劣质」，FE-001 解冻（AGENTS §12 端到端闭环协议下的前端任务）。
本日已闭环两轮（HEAD `907ff74` + `888ecd2`），剩余子项待评估/取舍。

### 本轮（2026-08-31）已闭环

- **层次/背景** ✅  body 灰底（`--bg-soft`）+ 编辑器白纸面（`--surface`）+ 列表左内边距 12（与 `ui/app-shell.html` / `note-workspace.html` 对齐）
- **状态色 a11y** ✅  `--ok`/`--warn`/`--err` 作文字全部不达标（最大 3.76:1）；新增 `--ok-text #15803D` (5.02) / `--warn-text #B45309` (5.02) / `--err-text #B91C1C` (6.47)；ui/tokens.css + web/styles/tokens.css + UI_DESIGN.md §2.2 同步更新；20 处 `color: var(--ok|--warn|--err)` 切到 `*-text`
- **原生控件字体** ✅  button/input/select/textarea `font:inherit`（与设计资产对齐）；三个原生按钮（新建/删除/插图·PDF）从 13.33px → 14px
- **空态与按钮层级** ✅  「← 选择或新建一篇笔记」单行小灰字 → 居中两行块（0 笔记：「开始你的第一篇笔记」+ CTA；>0 无选：「选一篇笔记开始」+ 提示）；删除按钮无选时隐藏（数据态=UI态），选中时用新 `.danger` 样式（透明边框 / `--text-3`，hover 才显 `--err-text`）

**验证**：tsc · vitest 28 · vite build · 头戴无头 7 视图（empty/selected/rail×5/review）审计全绿；对比度/字号/层次/CLS 全部达标。

### P8-FE-001 待评估（未动）

- **MiSans woff2 子集加载**：UI_DESIGN §依赖策略明确「P8-FE-001 收口」；当前声明了字体栈但 0 文件加载 → 静默降级苹方/雅黑。下载/子集化/绑入是 ~50-100KB 工作，需工具链（fonttools/pyftsubset 或 cloud subset）；可选包体 + 设计意图兑现两全
- **浮层视图视觉核验**（图谱/星系/导图/Tutor）：基线已采但未目视过；非缺陷性，按需
- **微交互 150-250ms**（hover/active/focus）：当前零动效，符合 ADR-013 铁律，但 hover 反馈偏硬；可选精修

### 候选方向（待所有者定序，仍照 P8 收尾政策）

| 方向 | 说明 | 前置/风险 |
|---|---|---|
| A | UI 视觉打磨（**进行中**） | — |
| C | M6 Tauri 桌面打包（唯一「未闭环」正式里程碑） | 重依赖（Rust 工具链） |
| D | M9 Visual Engine / M10 AI 生成可视化（规格完备未开工） | 体量最大，与「先内容后视觉」铁律冲突 |
| 挂起 | P8-Mode-001 · UpMark 联动 · Radar 编辑器内触发（等显式发起） | — |

## 候选方向（待所有者定序）

| 方向 | 说明 | 前置/风险 |
|---|---|---|
| **A. UI 视觉打磨**（**进行中**） | 层次/状态色 a11y/按钮字体/空态已闭环；剩余 MiSans woff2 / 微交互可选精修 | 子集化工具链（pyftsubset） |
| **C. M6 Tauri 桌面打包** | 唯一标「未闭环」正式里程碑 | 重依赖（Rust 工具链） |
| **D. M9 Visual Engine / M10** | 规格完备未开工 | 体量最大，与「先内容后视觉」铁律冲突 |
| 挂起 | **P8-Mode-001**（等所有者显式发起）· UpMark 联动 · Radar 编辑器内触发 | — |

## 待所有者决策

- 首版 git tag：**暂建议 `v0.1.0-rc.1`**，版本号与时机待定。
- BUG-6（httpx2 迁移）：按定性留依赖审计专项，29 个测试文件、非本轮。
- BUG-7（React Flow attribution）：@xyflow/react v12 为 **MIT**，「需 Pro 才能隐藏」为过时信息，无合规风险，是否显示属产品选择。

## 红线（不变）

Markdown Vault = 用户数据唯一事实源 · 四层调用链 · UI 不承担核心业务/图计算/SM-2/同步核心 ·
无理由不新增依赖/表/Provider · 禁 XP/streak/徽章（ADR-022）· 禁自动发送 Tutor 提问（预填≠自动发送）。
