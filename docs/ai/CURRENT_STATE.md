# Current State

> AI 启动时必读第二份。每次 git commit 后同步更新。
> 上次更新：2026-08-27 · Last commit：a382e27 · Branch：main · Clean：yes

---

## 当前里程碑

M3 Learning Graph ✅ · M3.5-A Knowledge Radar ✅ 已完成。
下一阶段候选：M2b（Mind Map）· M3b（Universe）· M4（AI Tutor）· M5（复习闭环）

## 已完成

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 双端脚手架 + migration runner | ✅ |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件/FTS5） | ✅ |
| M2-A~E | 双链·反链·图谱（links/CTE/React Flow） | ✅ |
| M3 | Learning Graph（掌握度/SM-2/Dashboard） | ✅ |
| M3.5-A | Knowledge Radar MVP（上下文匹配+Radar面板） | ✅ |

## Do Not Touch

- `KnowledgeRadar.tsx` — M3.5-A 已冻结，ADR-012 范围
- `GraphView.tsx` — M2-E 稳定，除非修 bug
- `001_init.sql` — 历史兼容，新表走新 migration
- `shared/types/*.ts` — API 契约，改需同步 pytest 契约测试
- `review_scheduler.py` — SM-2 独立模块，替换需开 ADR

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

- M0.5 AI Context Infrastructure 完成（docs/ai/ 5 文件 + AGENTS §15 + CHANGELOG）
