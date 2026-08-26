# 数据模型索引（Data Model Index）

> **规范来源唯一**：完整 DDL、字段语义、索引与 vault 目录约定统一维护在
> `docs/TECH_DESIGN.md` §4。本文件只做变更追踪，避免两处 DDL 漂移。

## 变更日志

| 日期 | 变更 | 关联 |
|---|---|---|
| 2026-08-26 | 初版 11 表 + notes_fts：settings/concepts/edges/concept_mastery/learning_events/mistakes/memories/notes/note_concepts/note_links/conversations/messages | TECH_DESIGN §4 |
| 2026-08-26 | 决策：Mind Map 采用旁车 json，**零新表**（结构与布局由 `*.mindmap.json` 承载） | ADR-002 |
| 2026-08-26 | migration 002：统一 links 表，DROP 三旧关系表；migration 003：concepts 补 `status` 列（stub→confirmed→active→archived 生命周期，origin 仅记来源） | ADR-008/009 · M2 |
| 2026-08-26 | ADR-012 编辑器上下文感知架构（Omniscience Mode · Knowledge Radar）；零新表零新依赖 | ADR-012 · M3.5-A |

## 延后建表（禁止提前创建）

| 表 | 触发条件 |
|---|---|
| blocks | 块级引用功能立项（backlog） |
| embeddings | RAG 立项且概念数 >2000 或匹配质量不足（backlog） |
| concept_demos | 可视化示例保存功能立项（M9 后评估） |
