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
| 2026-08-27 | learning-model.md 冻结：学习状态数据模型契约（event_uuid 幂等 + source 枚举扩展 + 时间计算规则 + SM-2 可替换声明） | M5 评审 |
| 2026-08-27 | M4-B Prompt Contract 冻结：TutorContext TypedDict + TutorMode Literal + TutorPrompt 输出结构 + token 截断 + 双重安全过滤 | M4-B |
| 2026-08-27 | ADR-015 Language Contract 冻结：Content language independent + Concept aliases + Tutor 语言自适应 | ADR-015 |
| 2026-08-27 | M2b-003 MindMap Exchange Format v1（.map.json 导入导出）：零新表，导图结构真相仍为旁车 json | ADR-021 |
| 2026-08-27 | ADR-020 Sync Truth Model 冻结：三层真值——Layer1 同步层=vault/*.md + eventlogs/*.jsonl + mind_maps/*.mindmap.json；Layer2 本地重建=concepts/links/mastery/review_queue；Layer3 永不同步=settings/API keys/SQLite。零新表，白名单实现在 core/sync/manifest.py SYNC_PATTERNS，黑名单含 db/ 与 metadata/devices.json | ADR-020 · docs/sync/sync-model.md |

## 延后建表（禁止提前创建）

| 表 | 触发条件 |
|---|---|
| blocks | 块级引用功能立项（backlog） |
| embeddings | RAG 立项且概念数 >2000 或匹配质量不足（backlog） |
| concept_demos | 可视化示例保存功能立项（M9 后评估） |
