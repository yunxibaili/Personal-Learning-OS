# Active Task

> AI 工作记忆：当前正在做什么。权威源：`docs/PROJECT_STATE.md`（状态唯一来源）· `docs/TASKS.md`（任务与报告）。
> 上次更新：2026-09-01 · HEAD `3b49bd8`（193 commits）+ 未提交 P1+审计 · Gate：pytest **865** · vitest **36** · tsc PASS · build PASS · CI 双绿

---

## Task ID

**T-NOTE-HIER 主/副笔记层级（ADR-024）P0+P1 完成 + Vault Rebuild Test + Doc Truth Audit**（2026-09-01 · pytest 865 · vitest 36 · tsc/build PASS）。
**当前无进行中任务**——项目处于 P8 收尾阶段（政策：`PROJECT_STATE.md` §0.1 + `AGENTS.md` §12 端到端闭环协议）。

### 核心裁决（ADR-024，不可协商）

- **存储**：child-side 单父 `parent: "[[父笔记标题]]"`，事实源在 Markdown frontmatter。
  零新表零 migration；`links(relation='parent')` 仅作派生索引（reindex 全量重算）。
- **五条铁规则**：① 事实源在 Markdown ② 只写 child 的 `parent`、不持久化 `children`
  ③ 严格单父（forest，底层允许多级链、UI 先展一层）④ 显式 parent 权威、wikilink
  推断降为 legacy fallback ⑤ `/graph`、`/universe`、review 统一走 `resolve_hierarchy()`
- **失败语义**：parent 不存在 → **保留原值 + 标记 invalid，绝不自动删除**；自指/成环
  → 标记 invalid；删 parent 文件 → child 不静默删，降级 orphan。

### 执行计划（P0 最小闭环）

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0-1 | frontmatter round-trip（保任意 key · 真删除 · 稳定顺序） | ✅ 完成（`compose_file(meta,body)`） |
| P0-2 | 显式 `parent` 读写 + 校验（orphan / 自指 / cycle） | ✅ 完成（`parse_parent`/`set_meta_parent` + `NotePatch.parent`；自指走「保存+标 invalid」，红线 4） |
| P0-3 | 统一 `resolve_hierarchy()`（explicit > inferred） | ✅ 完成（`hierarchy.py`；**修复原 `_detect_cycles` 无限循环**） |
| P0-4 | `/graph`、`/universe` 统一消费 resolver | ✅ 完成（reindex 物化 `links(relation='parent')` + `/graph` 并入权威父边；web `derivePlanets` 显式优先） |
| P0-5 | round-trip / rebuild 守护测试 12 项（**P0 验收标准**） | ✅ 完成（`tests/unit/test_hierarchy.py` 12 项 + galaxy 2 项） |

**不在 P0**：左侧嵌套树 UI（用户原始诉求，地基后做）· 稳定 note ID（独立 ADR，P1）· 星系视觉改造。

### 已知地基缺陷（P0-1 要修的雷）

`core/knowledge.py::compose_file(tags, body)` **只回写 `tags`**，其余 frontmatter key
在保存时静默丢弃。不先修这条，加任何字段都会再踩一次。

### 本轮（2026-08-31）已闭环

- **层次/背景** ✅  body 灰底（`--bg-soft`）+ 编辑器白纸面（`--surface`）+ 列表左内边距 12（与 `ui/app-shell.html` / `note-workspace.html` 对齐）
- **状态色 a11y** ✅  `--ok`/`--warn`/`--err` 作文字全部不达标（最大 3.76:1）；新增 `--ok-text #15803D` (5.02) / `--warn-text #B45309` (5.02) / `--err-text #B91C1C` (6.47)；ui/tokens.css + web/styles/tokens.css + UI_DESIGN.md §2.2 同步更新；20 处 `color: var(--ok|--warn|--err)` 切到 `*-text`
- **原生控件字体** ✅  button/input/select/textarea `font:inherit`（与设计资产对齐）；三个原生按钮（新建/删除/插图·PDF）从 13.33px → 14px
- **空态与按钮层级** ✅  「← 选择或新建一篇笔记」单行小灰字 → 居中两行块（0 笔记：「开始你的第一篇笔记」+ CTA；>0 无选：「选一篇笔记开始」+ 提示）；删除按钮无选时隐藏（数据态=UI态），选中时用新 `.danger` 样式（透明边框 / `--text-3`，hover 才显 `--err-text`）

**验证**：tsc · vitest 28 · vite build · 头戴无头 7 视图（empty/selected/rail×5/review）审计全绿；对比度/字号/层次/CLS 全部达标。

- **微交互 150ms** ✅（`3182465`）`.note-list li` / `.note-list button` / `.editor-toolbar button`
  加 `--dur-fast` + `--ease-out` 过渡；仅 color/背景/边框/transform，禁 box-shadow 动画；
  全局 `prefers-reduced-motion` 兜底；焦点环已由 `*:focus-visible` 覆盖，未重复加

### P8-FE-001 已裁决/收尾

- **MiSans woff2 → 用户裁定 C（维持现状）**：核授权后确认子集化方案**站不住**——
  ① 猫啃网核验 MiSans「不允许修改或制作衍生版本」，子集化=衍生=禁止
  ② woff2 嵌入属灰区，「请自行咨询作者」③ 官方协议是**可撤销**的全球版权许可
  ④ 本机 `C:\Windows\Fonts\` 0 个 MiSans → 当前静默降级苹方/雅黑。
  **UI_DESIGN.md §依赖策略已如实改写**：废弃 woff2 离线包、记录三条授权理由、
  给出 OFL 备选路径（思源黑体 SC）。**FE-001 收尾。**
- **浮层视图视觉核验**（图谱/星系/导图/Tutor）：基线已采未目视，非缺陷性，按需再做

## 候选方向（待所有者定序，仍照 P8 收尾政策）

| 方向 | 说明 | 前置/风险 |
|---|---|---|
| **A. UI 视觉打磨** | 层次 ✅ / 状态色 a11y ✅ / 按钮字体 ✅ / 空态 ✅ / 微交互 ✅；MiSans 已裁定 C 收尾 | **已收尾**（浮层目视按需） |
| **B. 主/副笔记层级（T-NOTE-HIER）** | ✅ **P0+P1 完成（2026-09-01）**：P0（resolver + reindex + graph）+ P1-1（左侧层级树 `buildNoteTree` + `NoteTreeList` + CSS + `NoteCreate.parent` 一步创建副笔记）；遗留：稳定 note ID（独立 ADR） | — |
| **C. M6 Tauri 桌面打包** | 唯一标「未闭环」正式里程碑 | 重依赖（Rust 工具链） |
| **D. M9 Visual Engine / M10 AI 生成可视化** | 规格完备未开工 | 体量最大，与「先内容后视觉」铁律冲突 |
| 挂起 | **P8-Mode-001**（等所有者显式发起）· UpMark 联动 · Radar 编辑器内触发 | — |

## 待所有者决策

- 首版 git tag：**暂建议 `v0.1.0-rc.1`**，版本号与时机待定。
- BUG-6（httpx2 迁移）：按定性留依赖审计专项，29 个测试文件、非本轮。
- BUG-7（React Flow attribution）：@xyflow/react v12 为 **MIT**，「需 Pro 才能隐藏」为过时信息，无合规风险，是否显示属产品选择。

## 红线（不变）

Markdown Vault = 用户数据唯一事实源 · 四层调用链 · UI 不承担核心业务/图计算/SM-2/同步核心 ·
无理由不新增依赖/表/Provider · 禁 XP/streak/徽章（ADR-022）· 禁自动发送 Tutor 提问（预填≠自动发送）。
