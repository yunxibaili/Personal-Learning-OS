# Active Task

> AI 工作记忆：当前正在做什么。权威源：`docs/PROJECT_STATE.md`（状态唯一来源）· `docs/TASKS.md`（任务与报告）。
> 上次更新：2026-08-31 · HEAD `b1ce03b`（184 commits）· Gate：pytest **836** · vitest **28** · tsc PASS · build PASS · CI（`.github/workflows/ci.yml`）

---

## Task ID

**（空 —— 当前无进行中任务）** 项目处于 P8 收尾阶段（政策：`PROJECT_STATE.md` §0.1 + `AGENTS.md` §12 端到端闭环协议）。
昨夜已闭环 P8-006 / P8-007，并修复 BUG-1～5 + CI/SECURITY；今日完成 B 项「文档状态回填」。

## 最近完成（2026-08-31）

- **P8-006 Tutor 三入口闭环** ✅（tutorSeed + tutorReturnView + openTutor/closeTutor；三路径 headless 实测）
- **P8-007 Tutor SSE 流式** ✅（`apiPostStream` 单状态源 `streamText`；Stop 中止保留；删 placeholders 死代码）
- **BUG-1（P0 · 数据不锁死）** ✅ 导出新增 `concepts.json` 快照（概念+掌握度+SM-2+复习队列）→ import 暂存 → `reindex` 恢复（stub 升格 / 快照覆盖占位行 / eventlogs 去重回放）；守护测试 2；场景 C 概念/掌握度 1→1
- **BUG-2** ✅ README 如实标注 Tutor 默认 MockProvider + OpenAI 兼容 / Ollama 配置说明
- **BUG-3** ✅ 端点数 88→89（`app.openapi()` 实测 ×3 处）；README 进度表对齐现实（M2b/M3.5-B/M4/M5-M7）；基线头部改「以实测为准」
- **BUG-4** ✅ 浮层视图/TutorPanel/编辑器全家桶按需分包；**主包 982kB→182kB（gzip 59k）**
- **BUG-5** ✅ 新增 `.github/workflows/ci.yml`（backend pytest / frontend tsc+vitest+build）+ 根级 `SECURITY.md`（摘 AGENTS §19）
- **验证**：场景 A 11/11 · 场景 B 8/8 · 场景 B+C 15/15（含 BUG-1 守护）· `pytest 836` · `vitest 28` · `tsc` · `build` 全绿

## 候选方向（待所有者定序）

| 方向 | 说明 | 前置/风险 |
|---|---|---|
| **A. UI 视觉打磨**（FE-001 已解冻，用户反馈「UI 太劣质」） | 空态设计 · MiSans woff2 子集 · 层次/间距/质感 | 无需前置，需确认范围 |
| **B. 文档状态回填** | ①ACTIVE_TASK/CURRENT_STATE（本文）②README 已对齐 | 已做（本次） |
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
