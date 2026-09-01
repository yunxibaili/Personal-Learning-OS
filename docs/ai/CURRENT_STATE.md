# Current State

> AI 会话增量快照。**唯一权威状态源 = `docs/PROJECT_STATE.md`**；当前任务见 `docs/ai/ACTIVE_TASK.md`；任务与报告见 `docs/TASKS.md`。
> 上次更新：2026-08-31 · Branch：main · HEAD `b1ce03b` · **184 commits**
> 工作区：干净（仅 `.workbuddy/` 未跟踪，若未 gitignore 请确认；无未提交代码改动）

---

## 当前政策

**P8 收尾阶段**（2026-08-31 裁定，最高优先）：解除前后端修改范围限制，**端到端闭环 + 契约一致性**为最高准则。
红线不变：Markdown Vault 唯一事实源 · 四层调用链 · UI 不承担核心业务/图计算/SM-2/同步核心 · 无理由不新增依赖/表/Provider · 禁 XP/streak/徽章 · 禁自动发送 Tutor 提问。

## 里程碑状态（精简）

| 里程碑 | 状态 |
|---|---|
| M0 脚手架 / M1 知识库 / M2-A~E 双链图谱 / M2b 导图 / M3 Learning Graph / M3b Universe / M3.5-A 雷达 / M3.5-B 全知 / M4 AI Tutor / M5 复习 | ✅ |
| M7 LAN Sync v1（M7-001~008 全链路） | ✅ |
| P8-001A~007（含 C 星球 / 002 Graph V2 / 003A-E / 006 三入口 / 007 SSE 流式） | ✅ |
| 后端 backlog（§9 B1–B29） | ✅ 清零 |
| Phase 0–4 前端阶段 | ✅ 收口 |
| **BUG-1（P0 数据不锁死）/ BUG-2 / BUG-3 / BUG-4 / BUG-5** | ✅ |
| **M6 Tauri 桌面打包** | ✅ 完成（2026-09-01，GNU 工具链，MSI 65MB + NSIS 102MB） |
| **M8 Mobile / M9 Visual Engine / M10 AI 可视化** | ❌ 未开始 |
| P8-Mode-001（ADR-022 附录 A） | ⏳ 挂起（等所有者显式发起） |

## 当前验证（2026-08-31 实测）

- 后端全量 pytest：**836 passed**（含 BUG-1 守护 2）
- 前端：vitest **28 passed**（3 files）· `tsc --noEmit` PASS · `vite build --outDir dist_verify` PASS（**主包 182kB / gzip 59k**）
- CI：`.github/workflows/ci.yml` 已建（backend pytest / frontend tsc+vitest+build）
- 闭环：场景 A 11/11 · B 8/8 · B+C 15/15（BUG-1 后概念/掌握度恢复 1→1）
- 审计：`scripts/contract_audit.py` → OpenAPI **89** 端点（0 路径无测试触及）· shared/types **0 camelCase** 漂移；`export` zip 排除 db/ 与 api_key

## 代码规模（实测）

端点 **89** · Migration 8–9 · ADR **23** · 提交 **184** · 后端 Python ≈ 9.7k 行 · 前端 TS/TSX ≈ 6.4k 行。

## 候选 / 挂起

- 候选：A UI 视觉打磨（FE-001 已解冻，用户反馈「UI 太劣质」）· C M6 Tauri · D M9/M10
- 挂起：P8-Mode-001 · UpMark 联动（U1-U3）· Radar 编辑器内触发（Ctrl+Shift+K）——三者均「所有者显式发起」
- 待决：首版 git tag（建议 `v0.1.0-rc.1`）· BUG-6 httpx2 迁移专项 · BUG-7 attribution（已澄清 MIT，勿再变更）

## Known Risks（沿用，依需更新）

- 中文 FTS 分词未解决（unicode61 按字切分，中文走 CJK bigram 回退，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）· 本地 LLM 实测仅 Ollama qwen3-14b 冒烟（B10）
- TipTap 数学扩展为社区维护（@aarkue）
- M6/M8/M9/M10 未开工；AI Tutor 默认 MockProvider，开箱演示需配真实 LLM

## Do Not Touch（简要；完整见 PROJECT_STATE §11）

`KnowledgeRadar.tsx` · `GraphView.tsx` · `001_init.sql` · `shared/types/*.ts` · `review_scheduler.py` ·
`tutor_context.py` · `ai/tutor.py`（只调 constants.py）· `ai/providers/` · **`learning_events` 历史行 `event_id` 保持 NULL**。

> 注：历史会话报告不再在本文件堆叠——追溯见 git history 与 `docs/archive/`；本文件保持「当前快照」职责。
