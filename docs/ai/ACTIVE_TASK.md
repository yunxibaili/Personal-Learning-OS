# Active Task

> AI 工作记忆：当前正在做什么。
> **单一真相源原则（2026-09-02 所有者裁定）**：进度真相唯一登记于 `docs/PROJECT_STATE.md` §10.3；
> 本文件只维护「当前正在进行的任务」，完成后即将本文件交接给下一个任务，历史进 git。
> 任务定义与完成报告存档：`docs/TASKS.md`。

> 上次更新：2026-09-02 · HEAD `12030ff` · 工作区干净

---

## 当前任务

### ✅ [0] 项目整理 / 状态收口——已完成（2026-09-02，所有者确认通过）
### ✅ [5]-[7] T-NOTE-TREE T1/T2/T3——已完成（2026-09-02）

多级层级树全量交付：GET /notes/tree（depth 剪枝 + root_id 懒加载 + truncated）+
前端 3 层默认展开/折叠偏好/「…」懒加载 + Gate 全绿（pytest 977 · vitest 161 ·
tsc 0 · build PASS）+ 真实 vault 4 层链 E2E 16/16。
报告：`TASKS.md` §T-NOTE-TREE。语义注记：orphan/cycle「不进树」落地为
「不悬挂为 child、以根保持可见」（供所有者复核，见报告）。

### ✅ [2]-[4] M9-007 接入 / M9-008 验收 / M9 关闭——已完成（2026-09-02）

**M9-007/008 已交付**（详细报告：`TASKS.md` §T-M9-007/008）：
ui 库逐字节回灌 web/ + 图谱 Inspector 入口 + VisualizeOverlay 业务壳 + visualize 事件
+ pytest 967 / vitest 155 / tsc PASS / build PASS / 无头自检 17/17。
ADR-025 状态 → Accepted。M9 正式关闭。

### ✅ [8] P8 正式收尾 / v0.1.x——已完成（2026-09-02）

删除优先检查（SyncStatusPanel/ComponentGallery/死 CSS 清除）· 依赖审计通过
（零未使用零缺失，REGISTRY 更正 marked/d3-force/cobe 记录）· CHANGELOG v0.1.0-rc.2 ·
tag `v0.1.0-rc.2`。

### ✅ [9] P1-1 MindMap API 边界治理——完成（2026-09-02，所有者批准后实现）

评审（十问）+ 所有者裁定（Q7 升级 / Q9 暂缓）→ 实现完成：
6 处裸 fetch → `lib/api.ts`（ApiError 归一化）+ 拖拽坐标
`PositionSaveQueue`（drag-end flush + 1s trailing debounce 兜底）+
失败处理补齐（原添加节点/连线不查响应、拖拽失败静默 → 全部显式上报）。
新增纯逻辑测试 11 项。Gate：pytest 977 · vitest 172 · tsc PASS · build PASS。
范围红线遵守：未动 sidecar/Sync/SQLite 行为、未新增 shared/types/mindmap.ts
（记为后续契约治理候选）、未动 wrapper/i18n/searchingConcept。
完整报告见 `TASKS.md` §P1-1。

**当前无进行中任务**——[10] P1-5 已裁定（2026-09-02 所有者四组弹窗：A settings 接 UI /
B mistakes 接 UI / C conversations 最小 UI / D sync 延 M8 / E-H backend-only；
详见 PROJECT_STATE §12）。待执行 = **[10a] 设置 UI → [10b] 错题本 UI → [10c] 会话历史 UI**
（A 是 P1-4 MockProvider 演示的硬前置，先做）。其后：[11] MockProvider → [12] FTS →
[13] i18n → [14] M8 可行性（含 D 组 sync 管理 UI 形态裁定）→ [15] M8 MVP。

<details>
<summary>历史：[0] 收口任务定义（已完成，存档）</summary>

#### [0] 项目整理 / 状态收口（2026-09-02 所有者裁定）

**任务性质**：只做状态对齐，**禁止功能开发**。依据 2026-09-02 交接报告（三路只读调研 +
实测），把全部文档对齐到 HEAD `12030ff` 的实际状态。

**目标原则**：建立「以后只允许有一个地方定义现在做到哪了」——
进度真相唯一登记于 `docs/PROJECT_STATE.md`，其他文档只能引用/补充。

**范围**（全部为文档）：

| 项 | 处置 |
|---|---|
| Git / HEAD / tag / branch | 确认：`main` · `12030ff` · tag `v0.1.0-rc.1`→`13fa1bc` · 无未推送提交 · 工作区干净 |
| `docs/PROJECT_STATE.md` | 唯一进度真相：文首加单一真相源原则；§1/§2.6/§3/§4/§8/§9.1/§10/§12/§13 全面对齐实测；§12 重写为技术债 P1/P2 分级；§10.3 登记路线 |
| `docs/ai/CURRENT_STATE.md` | 重写为薄快照：删自维护进度表/数字，改为引用 PROJECT_STATE + 速查 + 易误判清单 |
| `docs/ai/ACTIVE_TASK.md` | 本文件：只维护当前任务；删除过时候选表与 RC Gate 清单（历史在 git） |
| `docs/TASKS.md` | 执行队列按所有者 09-02 路线重排；修正 P8-001B/C / P8-003 /「未提交」三处与代码矛盾；头部加真相源声明 |
| `README.md` | 里程碑表对齐；「当前进度」改引用 |
| `AGENTS.md` | 头部过期「后端优先」横幅清理；§9 冻结表去 marked/d3-force；快速参考 vitest 表述更正 |
| ADR | 007 标 Superseded（d3-force 已卸载）· 018 标 Superseded（Galaxy 取代）· 016 目录树修正 · ADR_INDEX 同步 |
| CHANGELOG | [Unreleased] 加 Docs 收口条目 |

**明确不做**：任何功能代码 · `web/dist-handoff-check/` 清理（等环境删除守卫恢复后手动删，
已确认为 untracked 空壳，不影响 Git 状态）· ADR-013 §2.12 裁决（等所有者）· 技术债的实际修复（归 [1]）。

</details>

---

## 路线（2026-09-02 所有者裁定，照录）

```text
[0] 项目整理 / 状态收口 ← 当前
[1] 技术债重新分级与处置（清单见 PROJECT_STATE §12）
[2] M9-007 Visual Engine 接入 web/
[3] M9-008 真实验收
[4] M9 正式关闭
[5] T-NOTE-TREE T1（契约 + GET /notes/tree）
[6] T-NOTE-TREE T2（前端三级展开 + 懒加载）
[7] T-NOTE-TREE T3（守护测试 + 真实 vault ≥3 层 E2E）
[8] P8 正式收尾 / v0.1.x
[9] 再决定 M8 Mobile / 其他方向
```

裁定理由（所有者原话要点）：M9 基本全部完成只差接入与验收，是最自然的第一个开发任务；
T-NOTE-TREE 是下一阶段产品能力，不插队打断 M9 收尾；M8 现在开会把项目拉回大功能开发，不碰。

---

## 红线（不变）

Markdown Vault = 用户数据唯一事实源 · 四层调用链 · UI 不承担核心业务/图计算/SM-2/同步核心 ·
无理由不新增依赖/表/Provider · 禁 XP/streak/徽章（ADR-022）· 禁自动发送 Tutor 提问（预填≠自动发送）。
