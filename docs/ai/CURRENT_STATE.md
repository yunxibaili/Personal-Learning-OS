# Current State

> AI 启动时必读第二份。每次 git commit 后同步更新。
> 上次更新：2026-08-27 · Last commit：48e9b16 · Branch：main · Clean：yes

---

## 当前里程碑

M5 Review Loop ✅ 已完成。路线：M5 ✅ → M4 → M3b → M2b

## Last Completed

M5 Review Loop completed.
Commit: 48e9b16
Next: M4 AI Tutor preparation

## 已完成

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 双端脚手架 + migration runner | ✅ |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件/FTS5） | ✅ |
| M2-A~E | 双链·反链·图谱（links/CTE/React Flow） | ✅ |
| M3 | Learning Graph（掌握度/SM-2/Dashboard） | ✅ |
| M3.5-A | Knowledge Radar MVP（上下文匹配+Radar面板） | ✅ |
| M5 | Review Loop（复习队列/优先级/时间线/learning-model） | ✅ |

## Do Not Touch

- `KnowledgeRadar.tsx` — M3.5-A 已冻结，ADR-012 范围
- `GraphView.tsx` — M2-E 稳定，除非修 bug
- `001_init.sql` — 历史兼容，新表走新 migration
- `shared/types/*.ts` — API 契约，改需同步 pytest 契约测试
- `review_scheduler.py` — SM-2 独立模块，替换需开 ADR

## Frozen Domains

| 领域 | 状态 | 关联 |
|---|---|---|
| Markdown 模型 | Frozen | ADR-001 |
| Graph API | Frozen | M2-D |
| Knowledge Radar | Frozen | M3.5-A, ADR-012 |
| Mastery 引擎 | Frozen | M3, learning-model.md |
| SM-2 调度 | 可替换但需 ADR | review_scheduler.py |

## Known Risks

- 中文 FTS 分词未解决（unicode61 按字切分，长句检索有限，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）
- 本地 LLM 未实测（Ollama 路径理论通，未验证）
- Trace 引擎推迟（M9+）
- TipTap 数学扩展为社区维护（@aarkue），非官方

## 测试命令

```
pytest -q          → 36 passed
npm run build      → pass
.\scripts\test.ps1 → 全量
```

## 本次会话改动

- ADR-013 Frontend Design System 冻结（Minimal Scientific Workspace · 白橙主题 · 三栏布局设计冻结）
- AGENTS §16 Frontend Generation Rules（AI 前端生成约束）
- docs/design/UI_REFERENCE.md 视觉参考边界
- docs/design/LEARNING_LOOP.md 学习循环设计
- global.css 主题迁移：暗色→白橙（仅变量替换，布局不变）
- M0.5 AI Context Infrastructure 完成（docs/ai/ 5 文件 + AGENTS §15 + CHANGELOG）
- learning-model.md 冻结（含 event_uuid 幂等设计 + source 枚举扩展 + 时间计算规则）
- M5-001：ensure_concept_learning_state() 概念首次触达自动初始化 mastery + review_queue
- M5-002：review_today 优先级排序（wrong→low mastery→early due）+ review/history 端点
- M5-003：Dashboard 复习视图（M3 已实现，本轮确认）
- M5-004：Dashboard 学习时间线（最近 15 条事件）
