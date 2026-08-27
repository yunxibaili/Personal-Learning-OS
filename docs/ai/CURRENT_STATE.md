# Current State

> AI 启动时必读第二份。每次 git commit 后同步更新。
> 上次更新：2026-08-27 · Last commit：be4580a · Branch：main · Clean：yes

---

## 当前里程碑

M5 ✅ → M4-Preflight ✅ → M4-A ✅ → M4-B ✅ → Gate 1 ✅ → M4-C ✅ → Smoke ✅ → M4-D ✅ → M4.5 ✅ → M4-E ✅ → M3b-001 ✅ → M3b-002 ✅ → M3b-003 ✅ → M3b-004 ✅ → M2b-001 ✅ → M2b-002 ✅ → M2b-003 ✅ → ADR-020 ✅ → P2 Atomic Write ✅ → M7-001 Sync Engine Core ✅ → M7-001 Stabilization ✅ → **M7-Nightly Audit ✅**

## Last Completed

M7-Nightly Full Audit Sprint 完成。
6 Phase 审计：架构边界（3 Router 违规记录为 tech debt）· ADR 冻结检查（7/7 PASS）·
代码质量（修复 10 问题，记录 8 tech debt）· 同步深度测试（28 tests）· 恢复测试（14 tests）·
文档清理（sync docs + CHANGELOG + stability report）。
pytest 251 passed · vite build PASS。

## 已完成

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 双端脚手架 + migration runner | ✅ |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件/FTS5） | ✅ |
| M2-A~E | 双链·反链·图谱（links/CTE/React Flow） | ✅ |
| M3 | Learning Graph（掌握度/SM-2/Dashboard） | ✅ |
| M3.5-A | Knowledge Radar MVP（上下文匹配+Radar面板） | ✅ |
| M5 | Review Loop（复习队列/优先级/时间线/learning-model） | ✅ |
| M4-A | Tutor Context Infrastructure + API | ✅ |
| Gate 0.5 | M4-Preflight Hardening（H1-H6） | ✅ |
| M4-B | Prompt Assembly（build_prompt + 16 tests） | ✅ |
| ADR-015 | Multilingual Knowledge Support | ✅ |
| Gate 1 | AI Boundary Audit（6/6 PASS） | ✅ |
| M4-C | LLM Provider（Protocol + Mock + Service） | ✅ |
| Smoke | Tutor 全链路验证 | ✅ |
| ADR-016 | Tutor UI Design | ✅ |
| M4-D | Tutor Panel（context panel + modes） | ✅ |
| ADR-017 | Architecture Visualization | ✅ |
| M4.5 | Architecture Visualization Milestone | ✅ |
| M4-E | Tutor Evaluation（评估体系 + 禁止测试） | ✅ |
| ADR-018 | Knowledge Universe Design | ✅ |
| M3b-001~004 | Universe（Projection + Layout + Interaction + Navigation） | ✅ |
| ADR-019 | MindMap Boundary（Universe ≠ MindMap 冻结） | ✅ |
| M2b-001 | MindMap Canvas（CRUD + React Flow） | ✅ |
| M2b-002 | Concept Binding（bind/unbind + search + 前端面板） | ✅ |
| M2b-003 | Export/Import（.map.json + 前端按钮） | ✅ |
| ADR-021 | MindMap Exchange Format v1 | ✅ |
| ADR-020 | Sync Truth Model（三层真值模型冻结） | ✅ |
| P2 | create_note atomic write（write→fsync→rename） | ✅ |
| M7-001 | Sync Engine Core（manifest + scanner + diff） | ✅ |
| Stabilization | M7-001 审计 + 修复（glob bug + settings boundary + tests） | ✅ |

## Do Not Touch

- `KnowledgeRadar.tsx` — M3.5-A 已冻结，ADR-012 范围
- `GraphView.tsx` — M2-E 稳定，除非修 bug
- `001_init.sql` — 历史兼容，新表走新 migration
- `shared/types/*.ts` — API 契约，改需同步 pytest 契约测试
- `review_scheduler.py` — SM-2 独立模块，替换需开 ADR
- `tutor_context.py` — M4-A 已完成，不改逻辑
- `ai/tutor.py` — M4-B 已完成，只改 constants.py 调参
- `ai/providers/` — M4-C 已完成，新 Provider 走 providers/ 目录

## Frozen Domains

| 领域 | 状态 | 关联 |
|---|---|---|
| Markdown 模型 | Frozen | ADR-001 |
| Graph API | Frozen | M2-D |
| Knowledge Radar | Frozen | M3.5-A, ADR-012 |
| Mastery 引擎 | Frozen | M3, learning-model.md |
| SM-2 调度 | 可替换但需 ADR | review_scheduler.py |
| Frontend Design | Frozen | ADR-013 |
| AI Tutor 边界 | Frozen | ADR-014 |
| Prompt Contract | Frozen | M4-B, prompt-contract.md |
| Multilingual | Frozen | ADR-015 |
| Tutor UI | Frozen | ADR-016 |
| AI Boundary | Frozen | Gate 1 |
| LLM Provider | Frozen | M4-C, ProviderProtocol |
| MindMap Boundary | Frozen | ADR-019 |
| MindMap Exchange Format | Frozen | ADR-021 |
| Sync Truth Model | Frozen | ADR-020 |

## Known Risks

- 中文 FTS 分词未解决（unicode61 按字切分，长句检索有限，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）
- 本地 LLM 未实测（Ollama 路径理论通，未验证）
- Trace 引擎推迟（M9+）
- TipTap 数学扩展为社区维护（@aarkue），非官方

## 架构审查备忘

- 保持四层空间边界：Knowledge → Learning → Thinking → AI
- M7-002 起需要 HTTP manifest exchange + device pairing

## 测试命令

```
pytest -q          → 251 passed
npx vitest run     → 2 passed
npx vite build     → pass
.\scripts\test.ps1 → 全量
```

## 本次会话改动

- scanner.py：替换 _glob_match 为正确的 ** 递归匹配（修复嵌套目录匹配 bug）
- manifest.py：移除死代码 `import os`
- settings.py：移除 `import sqlite3`，SQL 操作提取到 db.py
- db.py：新增 settings 数据访问函数
- attachments.py：移除 unused `import re`
- mindmap.py：移除 unused `Field`
- universe.py：移除 unused `JSONResponse`
- mastery.py：移除 unused `timedelta`
- test_tutor_prohibition.py：移除 unused `import os`
- KnowledgeRadar.tsx：移除 3 个 emoji（ADR-013 合规）
- global.css：添加 `--bg-alt` 变量定义
- test_sync.py：42 个同步测试
- test_sync_deep.py：28 个深度测试（中文/特殊字符/大文件/嵌套目录）
- test_sync_recovery.py：14 个恢复测试（幂等性/原子性/确定性）
- test_smoke.py：expected 集合添加 review_queue
- docs/audit/：M7-001-STABILITY-AUDIT.md + CODE_QUALITY_REPORT.md
- docs/sync/：sync-model.md + conflict-resolution.md + recovery-guide.md
- docs/testing/M7-STABILITY-REPORT.md
- CHANGELOG.md：新增 M7 stabilization 条目
