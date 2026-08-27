# Current State

> AI 启动时必读第二份。每次 git commit 后同步更新。
> 上次更新：2026-08-27 · Last commit：5336832 · Branch：main · Clean：yes

---

## 当前里程碑

M5 ✅ → M4-Preflight ✅ → M4-A ✅ → M4-B ✅ → Gate 1 ✅ → M4-C ✅ → Smoke ✅ → M4-D ✅ → M4.5 ✅ → M4-E ✅ → M3b-001 ✅ → M3b-002 ✅ → M3b-003 ✅ → M3b-004 ✅ → **M2b-001 ✅** → M2b-002

## Last Completed

M3b-001 Universe Projection + M3b-002 Universe Layout + M3b-003 Interaction + M3b-004 Navigation Layer + M2b-001 MindMap Canvas 已完成。
ADR-018 Knowledge Universe + ADR-019 MindMap Boundary 已冻结。
MindMap: 006_mindmap.sql + core/mindmap.py + routers/mindmap.py + MindMapCanvas.tsx + 18 tests。
pytest 150 passed · npm run build 通过。

## 已完成

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 双端脚手架 + migration runner | ✅ |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件/FTS5） | ✅ |
| M2-A~E | 双链·反链·图谱（links/CTE/React Flow） | ✅ |
| M3 | Learning Graph（掌握度/SM-2/Dashboard） | ✅ |
| M3.5-A | Knowledge Radar MVP（上下文匹配+Radar面板） | ✅ |
| M5 | Review Loop（复习队列/优先级/时间线/learning-model） | ✅ |
| M4-A | Tutor Context Infrastructure（docs/ai/ + AGENTS §15 + context builder） | ✅ |
| M4-A | Tutor Context API（context builder + router + 5 tests） | ✅ |
| Gate 0.5 | M4-Preflight Hardening（H1-H6） | ✅ |
| M4-B | Prompt Assembly（build_prompt + 16 tests） | ✅ |
| ADR-015 | Multilingual Knowledge Support | ✅ |
| Gate 1 | AI Boundary Audit（6/6 PASS） | ✅ |
| M4-C | LLM Provider（Protocol + Mock + Service + 14 tests） | ✅ |
| Smoke | Tutor 全链路验证（tutor/test endpoint + 5 tests） | ✅ |
| ADR-016 | Tutor UI Design（knowledge tool, not chatbot） | ✅ |
| M4-D | Tutor Panel（context panel + modes + build pass） | ✅ |
| ADR-017 | Architecture Visualization（5 diagrams + yaml） | ✅ |
| M4.5 | Architecture Visualization Milestone | ✅ |
| M4-E | Tutor Evaluation（评估体系 + 禁止测试） | ✅ |
| ADR-018 | Knowledge Universe Design | ✅ |
| M3b-001 | Universe Projection（GET /universe） | ✅ |
| M3b-002 | Universe Layout（React Flow + mastery encoding） | ✅ |
| M3b-003 | Interaction + State Detail（tooltip + detail panel + click） | ✅ |
| M3b-004 | Navigation Layer（domain tabs + weak area + focus mode） | ✅ |
| ADR-019 | MindMap Boundary（Universe ≠ MindMap 冻结） | ✅ |
| M2b-001 | MindMap Canvas（CRUD + React Flow + ADR-019 isolation） | ✅ |

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

## Known Risks

- 中文 FTS 分词未解决（unicode61 按字切分，长句检索有限，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）
- 本地 LLM 未实测（Ollama 路径理论通，未验证）
- Trace 引擎推迟（M9+）
- TipTap 数学扩展为社区维护（@aarkue），非官方
- create_note 原子写入未保证（P2，M7 Sync 前必须解决）

## 架构审查备忘

- M2b-002 前建议做 MindMap Boundary Audit（检查 ADR-019 铁律）
- M7 前需要 ADR-020 Sync Conflict Resolution（Markdown/Event/SQLite 三套同步策略）
- 保持四层空间边界：Knowledge → Learning → Thinking → AI

## 测试命令

```
pytest -q          → 150 passed
npx vitest run     → 2 passed
npx vite build     → pass
.\scripts\test.ps1 → 全量
```

## 本次会话改动

- ConceptNode.tsx：hover tooltip（mastery 四维 + status）
- KnowledgeUniverse.tsx：onNodeClick + detail panel（右侧 260px）
- global.css：tooltip + detail panel + universe-body 样式
- ViewKey 增加 "universe"
- App.tsx：Universe tab 集成
- npm run build 通过
