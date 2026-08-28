# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-28 · P8-003D Tutor Knowledge Base 完成

---

## Task ID

（无活跃任务 — P8-003D 已完成，等用户指定下一个任务）

## Status

P8-003D Tutor Knowledge Base ✅（甲路线：显式引用）

- POST /api/v1/tutor/context（note_ids ≤2 · 片段 ≤600 字符 · 注入时预算收缩）
- TutorPanel：死 tab 复活（focusConceptId 模式）· 笔记选择器（FTS /search）· GraphView「问 Tutor」入口
- suggest_for_context snippet=None 修复（extract_snippet 复用）
- 守护测试先行全部转绿：连通 5 跳 · 反向断言 · 可达性 · 预算边界 · pytest 463→476 · build/vitest PASS
- 文档：ADR-014 附录 §2.8.1 · tutor-context.md §2/§3/§5 增记 · TECH_DESIGN §9

## 下一步队列

P8-003E Tutor Review Bridge（含乙路线 FTS5 自动检索预登记）→ Home / UI Polish
