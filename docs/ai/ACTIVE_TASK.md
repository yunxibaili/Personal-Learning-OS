# Active Task

> AI 工作记忆：当前正在做什么。无活跃任务时本文件为空模板。
> 每次开始新子任务时填写；完成后清空回模板。

---

## 当前任务

**Milestone**: M5 Review Loop
**Task**: M5-001 Concept Learning State Initialization

**Goal**: 概念首次触达时自动初始化完整学习状态（mastery + review_queue）

**Allowed**:
- `server/app/core/mastery.py` — 新增 `ensure_concept_learning_state()`
- `server/app/routers/notes.py` — stub 创建后调用初始化
- `server/tests/api/test_mastery.py` — 补充初始化测试

**Forbidden**:
- Knowledge Radar (M3.5-A, frozen)
- Graph API (M2-D, stable)
- Frontend / DashboardView
- review_scheduler.py (SM-2 独立模块)
- shared/types/*.ts (契约改需同步)

**Acceptance**:
- 创建含 [[新概念]] 的笔记后，concept_mastery + review_queue 各有一行
- pytest -q → all pass
- CURRENT_STATE.md updated after commit

**Reference**:
- `docs/data-model/learning-model.md` §6 — Concept Learning State Initialization
