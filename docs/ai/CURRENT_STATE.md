# Current State

> AI 启动时必读第二份。每次 git commit 后同步更新。
> 上次更新：2026-08-27 · Last commit：pending · Branch：main · Clean：no

---

## 当前里程碑

M5 ✅ → M4-Preflight ✅ → M4-A ✅ → M4-B ✅ → **Gate 1 ✅** → M4-C → M4-D → M3b → M2b

## Last Completed

Gate 1 AI Boundary Audit 已完成。6/6 项 PASS。
M4-C LLM Provider 已解锁。

pytest 92 passed。

## Gate 1 — AI Boundary Audit

状态: ✅ PASS (6/6)
日期: 2026-08-27
详情: docs/testing/GATE-1-ai-boundary.md

## 已完成

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 双端脚手架 + migration runner | ✅ |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件/FTS5） | ✅ |
| M2-A~E | 双链·反链·图谱（links/CTE/React Flow） | ✅ |
| M3 | Learning Graph（掌握度/SM-2/Dashboard） | ✅ |
| M3.5-A | Knowledge Radar MVP（上下文匹配+Radar面板） | ✅ |
| M5 | Review Loop（复习队列/优先级/时间线/learning-model） | ✅ |
| M0.5 | AI Context Infrastructure（docs/ai/ + AGENTS §15） | ✅ |
| M4-A | Tutor Context API（context builder + router + 5 tests） | ✅ |
| Gate 0.5 | M4-Preflight Hardening（H1-H6） | ✅ |
| M4-B | Prompt Assembly（build_prompt + 16 tests） | ✅ |
| ADR-015 | Multilingual Knowledge Support | ✅ |
| Gate 1 | AI Boundary Audit（6/6 PASS） | ✅ |

## Do Not Touch

- `KnowledgeRadar.tsx` — M3.5-A 已冻结，ADR-012 范围
- `GraphView.tsx` — M2-E 稳定，除非修 bug
- `001_init.sql` — 历史兼容，新表走新 migration
- `shared/types/*.ts` — API 契约，改需同步 pytest 契约测试
- `review_scheduler.py` — SM-2 独立模块，替换需开 ADR
- `tutor_context.py` — M4-A 已完成，不改逻辑
- `ai/tutor.py` — M4-B 已完成，只改 constants.py 调参

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
| AI Boundary | Frozen | Gate 1 |

## Known Risks

- 中文 FTS 分词未解决（unicode61 按字切分，长句检索有限，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）
- 本地 LLM 未实测（Ollama 路径理论通，未验证）
- Trace 引擎推迟（M9+）
- TipTap 数学扩展为社区维护（@aarkue），非官方
- create_note 原子写入未保证（Known Risk，记录未修）

## 测试命令

```
pytest -q          → 92 passed
npx vitest run     → 2 passed
npx vite build     → pass
.\scripts\test.ps1 → 全量
```

## 本次会话改动

- test_ai_boundary.py：25 个 AI 边界测试
- Gate 1 AI Boundary Audit 报告：6/6 PASS
- M4-C 施工红线冻结
