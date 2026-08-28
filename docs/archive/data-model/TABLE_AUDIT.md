# Table Audit — 空表盘点（D5 微任务产出）

> 日期：2026-08-28 · 基线：e3f76ff · 方法：migration DDL 清单 × 全仓 grep
> （INSERT=生产者 / FROM=消费者）× 真实 workspace db 行数 三方对照
> 起因：三次串行发现"建表无生产者"断链（eventlogs → event_uuid → mistakes），
> 本盘点一次性关闭此类问题（PM 裁决 D5）。

## 结论：14 张活表全部定界，零死表

### (a) 有生产者且有消费者 — 11 张 ✅

| 表 | 生产者 | 消费者 | 运行时行数 |
|---|---|---|---|
| settings | db.py（数据访问函数） | routers/settings | 2 |
| concepts | routers/concepts · knowledge.ensure_entity_by_title | 全局 | 18 |
| notes | routers/notes（写盘+索引） | 全局 | 5 |
| notes_fts | knowledge.upsert_note_index | search/suggest | 5 |
| links | knowledge.rebuild_note_links · concepts router | graph/tutor/universe | 5 |
| concept_mastery | mastery.update_mastery | universe/tutor/dashboard | 4 |
| learning_events | mastery.update_mastery（含 eventlog 双写） | review/universe/dashboard | 9 |
| review_queue | mastery.ensure_concept_learning_state · routers/mastery | review/tutor | 3 |
| mistakes | **mastery.py:160（P8-003E 刚补的桥）** | tutor_context | 0* |
| mind_maps / mind_map_nodes / mind_map_edges | core/mindmap.py | mindmap router/export | 0** |
| schema_migrations | db.migrate | migration runner | 7 |

\* mistakes 生产者 P8-003E 才接通，行数为 0 属预期（等真实答错发生）。
\** mindmap 有完整功能链路，0 行是用户尚未创建导图，非断链。

### (b) 缺生产者待补 — 3 张（均零行、零消费者，但设计在案）

| 表 | 设计承诺 | 现状 | 建议排期 |
|---|---|---|---|
| memories | TECH_DESIGN §6.3：extractor 产出 memories 直接落库；ADR-010：importance×新近度 top5 进 context | extractor（M4-C/D）未实现落库；tutor_context 也无 memories 数据源——**生产者/消费者双缺** | extractor 补课 micro-task（可与 P8-003E 后续合并） |
| conversations | TECH_DESIGN §6.2⑥：对话落库 + §9 GET/POST /conversations | Tutor 当前为无状态单轮（M4-D） | 对话历史功能立项时（前端解冻后，UI 是其消费前提） |
| messages | 同上：context_json 快照落 messages（上下文透视 UI 依赖） | 同上 | 同上 |

### (c) 死表待删 — 0 张

三张空表全部有在案设计承诺（TECH_DESIGN §4 DDL + §6），不删。
历史遗留表 edges / note_concepts / note_links 已被 migration 002 显式 DROP，
不在运行时——历史清理已闭环。

## 对 T-EXPORT 范围的联动结论（D2）

EXPORT_MANIFEST 现有定义（vault + attachments + metadata/eventlogs + settings 去密钥）
**不含** conversations / messages / memories——三者当前为空且 TECH_DESIGN §4.2
标注"单设备内容，v1 不参与同步"，导出范围无需因此收窄。
**附条件**：未来对话历史落地时，T-EXPORT 范围必须复议（对话属用户数据，
"数据不锁死"红线适用）。此条件已足矣，无需现在动作。

## 流程规矩（自下一个 migration 生效）

**任何 migration 新增表，必须在同一提交中登记生产者位置**
（哪个模块、哪个函数、哪次调用写入）；无生产者的表不得合入。
登记位置：`docs/data-model/INDEX.md` 变更行 + 代码内注释。
本规矩已写入 INDEX.md 顶部规则区。
