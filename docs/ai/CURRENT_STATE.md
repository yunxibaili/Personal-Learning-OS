# Current State

> **AI 会话启动快照。单一真相源原则（2026-09-02 所有者裁定）**：
> 进度/里程碑/验证数字的唯一权威 = **`docs/PROJECT_STATE.md`**——本文件**不再维护**
> 自己的进度表或统计数字，只保留会话所需的速查与纪律引用。
> 当前任务见 `docs/ai/ACTIVE_TASK.md`；任务定义与完成报告存档见 `docs/TASKS.md`。
>
> 上次更新：2026-09-02（状态收口）· Branch `main` · HEAD `12030ff` · 工作区干净

---

## 一分钟上手

1. **项目现在做到哪了** → `docs/PROJECT_STATE.md`（§10.3 闭环完成度 + 当前路线）
2. **现在在做什么任务** → `docs/ai/ACTIVE_TASK.md`
3. **某个功能怎么实现的** → `docs/TECH_DESIGN.md`（应然）+ 实际代码（实然，冲突时以代码为准先核实）
4. **能改什么不能改什么** → 本文件 Do-Not-Touch 节 + `PROJECT_STATE.md` §11

## 当前政策（速记）

**P8 收尾阶段**（2026-08-31 裁定，最高优先，取代一切历史范围限制）：
**端到端闭环 + 契约一致性**为最高准则；跨层修改须真实原因，禁借任务扩权。
红线不变：Markdown Vault 唯一事实源 · 四层调用链 · UI 不承担核心业务/图计算/SM-2/同步核心 ·
无理由不新增依赖/表/Provider · 禁 XP/streak/徽章 · 禁自动发送 Tutor 提问。

**路线（2026-09-02 所有者裁定）**：[0] 状态收口 → [1] 技术债分级处置 →
[2-4] M9-007/008/关闭 → [5-7] T-NOTE-TREE T1-T3 → [8] P8 收尾 → [9] M8 决策。
详见 `PROJECT_STATE.md` §10.3。

## 环境与命令速查

| 事项 | 命令 |
|---|---|
| 后端 | `cd server && uvicorn app.main:app --host 127.0.0.1 --port 8000`（`GET /api/v1/health` 验证） |
| 前端 | `cd web && npm run dev`（:5173，`/api` 代理到 8000） |
| 前端测试 | `cd web && npx vitest run` · `npx tsc --noEmit` · `npx vite build --outDir <全新目录>` |
| 后端测试 | `cd server && pip install -r requirements-dev.txt`（本机 venv 默认未装！）→ `pytest -q` |
| Windows 删除守卫 | 遇 `[SAFE_DELETE_FAIL_CLOSED]`：构建用全新 outDir；环境守卫故障时无 AI 侧绕法 |
| 端口 | FastAPI :8000（恒 127.0.0.1）· Vite :5173 · `PORT`/`API_PORT`/`WORKSPACE_DIR` 可覆盖 |

## Do Not Touch（简要；完整见 PROJECT_STATE §11）

`KnowledgeRadar.tsx` · `GraphView.tsx` · `001_init.sql` · `shared/types/*.ts` · `review_scheduler.py` ·
`tutor_context.py` · `ai/tutor.py`（只调 constants.py）· `ai/providers/`（新 Provider 走 providers/ 目录）·
**`learning_events` 历史行 `event_id` 保持 NULL**（按追加式约束不回填，不要"修复"）。

## 易误判清单（历史资料 vs 现状）

- **Dashboard 不存在**：已删（裁决 A）；7 平级 tab 已删；`universe` 视图渲染 `GalaxyView`（自研 Canvas 星系），非 d3-force 版
- **d3-force / cobe / marked 依赖不存在**（v0.1.0-rc.1 移除或从未安装）
- **M9-002~006 已完成**（tracer/API/ui 库组件）；只差 M9-007 接入 web/ 与 M9-008 验收
- **M6 桌面打包已完成**（MSI/NSIS）
- **P8-001B/001C（旧 Universe/Planet）已完成后又删除**，勿恢复
- **AGENTS.md 头部如仍见「后端优先」字样**：该政策已被 §0/§0.1 取代，仅历史留存
- 进度/数字冲突时：`git log` + 代码核实 → 回改文档 → **以 `PROJECT_STATE.md` 为准**

> 注：历史会话报告不再在本文件堆叠——追溯见 git history 与 `docs/archive/`；本文件保持「当前快照」职责。
