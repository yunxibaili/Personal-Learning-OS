# 功能档案 · Features

> 每个功能按统一模板记录。**状态**仅允许：`ACTIVE` / `PARTIAL` / `EXPERIMENTAL` / `DEPRECATED` / `REMOVED`。
> 当前不存在的功能不写 ACTIVE。前端相关（Tauri/UI/Vue/React 运行时）已移除。

## 1. 笔记（vault CRUD / Document）

- **背景**：本地优先知识库；Markdown 为正文唯一事实源（ADR-001）。
- **作用**：笔记的增删改查、wikilink 双链解析、树形层级、批量/导入。
- **实现**：`routers/notes.py` → `core/knowledge.py`（wikilink/反链/stub 概念）· `core/hierarchy.py`（主/副笔记树）· `core/importer.py`· `core/autolink.py`。
- **数据**：`notes` + `links`＋ vault `*.md`。
- **API**：`GET|POST /notes` `PATCH|DELETE /notes/{id}` `GET /notes/tree` `GET /notes/{id}/backlinks` `GET /notes/{id}/link-suggestions` `POST /notes/batch|import`。
- **测试**：`tests/test_notes.py` `tests/api/test_note_tree.py` `tests/unit/test_hierarchy.py`。
- **状态**：`ACTIVE`

## 2. 附件

- **作用**：上传/读取导入二进制附件（图片等），存 `workspace/attachments/`。
- **实现**：`routers/attachments.py`。
- **数据**：`workspace/attachments/`；`attachments` 相关表（migration）。
- **API**：`POST /attachments` `GET /attachments/{name}`。
- **状态**：`ACTIVE`

## 3. 搜索（FTS5 + CJK bigram）

- **背景**：中文检索在既有 FTS5 上召回差；ADR-027 选型落地应用侧预分词（bigram）。
- **作用**：基于 `notes_fts` 的全文检索（含中文），并支持 reindex 自愈。
- **实现**：`routers/search.py` → `core/cjk_bigram.py`（预分词）· `core/reindex.py`（重建）。
- **数据**：`notes_fts`（派生索引）+ `notes_fts_*` 影子表。
- **API**：`GET /search`。
- **测试**：`tests/unit/test_cjk_bigram.py` `tests/api/test_m2_smoke.py`（FTS 重建冒烟）。
- **状态**：`ACTIVE`

## 4. 自动链接 / 建议

- **作用**：基于笔记内容提出双链建议（`/api/v1/knowledge/suggest`）。
- **实现**：`routers/suggest.py` → `core/autolink.py`。
- **API**：`GET /knowledge/suggest`。
- **测试**：`tests/api/test_suggest.py`。
- **状态**：`ACTIVE`

## 5. 概念 / 知识抽取（Concept）

- **背景**：Entity vs Document（ADR-009）：Markdown 是内容载体，Concept/Entity 是知识对象。
- **作用**：Concept 生命周期（stub 待提升 → 显式概念）；来源字段 `origin`（manual/markdown/ai_suggested）。
- **实现**：`routers/concepts.py` → `core/concepts.py` + `core/ai/extractor.py`（辅助抽取，失败不影响主链路）。
- **数据**：`concepts`（含 domain、origin、aliases）。
- **API**：`GET|POST /concepts` `GET /concepts/domains` `POST /concepts/extract` `PATCH|DELETE /concepts/{id}`。
- **测试**：`tests/api/test_concept_extractor.py` `tests/unit/test_concepts.py`。
- **状态**：`ACTIVE`

## 6. 掌握度 / 学习记忆（Mastery）

- **背景**：长期记忆；四维掌握度 + SM-2 复习。
- **作用**：概念掌握度读写、弱项清单；SM-2 复习调度与历史统计。
- **实现**：`routers/mastery.py` `routers/study.py` → `core/mastery.py` · `core/review_scheduler.py` · `core/review_stats.py`。
- **数据**：`concept_mastery` `review_queue` `study_sessions`。
- **API**：`GET /mastery` `GET /mastery/{id}` `GET /mastery/weak/list` `GET /review/today|stats|history` `POST /review/{id}/answer` `GET|POST /study/sessions*`。
- **测试**：`tests/api/test_mastery.py` `tests/api/test_study.py` `tests/unit/test_sm2.py` `tests/unit/test_decay.py` `tests/unit/test_review_bridge.py`。
- **状态**：`ACTIVE`

## 7. 知识图谱（Graph 读模型）

- **背景**：双链/概念组成的知识图谱；分层铁律 UI 仅渲染、图计算归 Core（ADR-008）。
- **作用**：图谱读模型（节点/边/关系），供 `/api/v1/graph`。
- **实现**：`routers/graph.py` → `core/hierarchy.py`。
- **API**：`GET /graph`。
- **测试**：`tests/api/test_mindmap.py`（部分）。
- **状态**：`ACTIVE`

## 8. 思维导图（MindMap）

- **背景**：结构化知识；结构唯一事实源是 `*.mindmap.json` 旁车（ADR-002 / 019 / 021）。
- **作用**：导图节点/边 CRUD、概念绑定、大纲（派生视图）、导出/导入 roundtrip、概念搜索/建议。
- **实现**：`routers/mindmap.py` → `core/mindmap.py`。
- **数据**：`mind_maps` `mind_map_nodes` `mind_map_edges` ＋ `*.mindmap.json`。
- **API**：`GET|POST /mindmaps` `POST /mindmaps/import` `GET /mindmaps/{id}/*` `POST /mindmaps/concepts/search|suggest` `* /mindmaps/{id}/nodes|edges|bind`。
- **测试**：`tests/api/test_mindmap.py` `test_mindmap_sidecar.py` `test_mindmap_suggest.py` `tests/integration/sync/test_sync_simulation.py`。
- **状态**：`ACTIVE`

## 9. AI Tutor / 对话（chat）

- **背景**：上下文感知 Tutor（ADR-010 / 014）；真实问答需配置 LLM（默认 MockProvider 返回占位文本）。
- **作用**：Tutor 上下文组装（概念/掌握度/错误摘要）、SSE 流式 + 停止、对话持久化。
- **实现**：`routers/tutor.py` `routers/conversations.py` → `core/ai/tutor.py` · `core/tutor_context.py` · `core/tutor_types.py` · `core/ai/providers/{base,mock,openai_compat}`。
- **数据**：`conversations` `messages`。
- **API**：`GET /tutor/context/{id}` `POST /tutor/context|test` `GET|POST /conversations` `GET /conversations/{id}/messages` `POST /chat`。
- **测试**：`tests/api/test_tutor_context.py` `tests/test_tutor_smoke.py` `tests/api/test_conversations.py` `tests/unit/test_tutor_notes.py` `test_tutor_prohibition.py` `test_prompt_builder.py` `test_secret_guards.py` `test_ai_boundary.py`。
- **状态**：`ACTIVE`（LLM 问答需外部配置；provider 抽象在 `core/ai`）

## 10. 学习记忆 / 事件日志（AI Memories）

- **背景**：把学习经历沉淀为可检索记忆；事件日志多设备可见（ADR-005）。
- **作用**：AI 记忆管理、维护、导入导出；事件日志（`learning_events`）。
- **实现**：`routers/memories.py` → `core/memories.py`。
- **数据**：`memories` `learning_events`。
- **API**：`GET /memories*` `GET /memories/maintenance` `PATCH|DELETE /memories/{id}` `POST /events`。
- **测试**：`tests/api/test_memories_api.py` `tests/api/test_suggest_memory.py` `tests/unit/test_memories*.py` `test_eventlog.py`。
- **状态**：`ACTIVE`

## 11. 错误本（Mistakes）

- **作用**：记录学习练习错误，进入复习闭环。
- **实现**：`routers/mistakes.py` → `core/mistakes.py`。
- **数据**：`mistakes`。
- **API**：`GET /mistakes*` `PATCH|DELETE /mistakes/{id}`。
- **测试**：`tests/api/test_mistakes.py`。
- **状态**：`ACTIVE`

## 12. 知识星系 / Universe

- **背景**：视觉学习引擎（VC 管线 Trace→模板渲染，ADR-017/023/025）；后端提供数据面。
- **作用**：提供 universe 结构数据（星系/域聚类）。
- **实现**：`routers/universe.py` → `core/universe.py`。
- **API**：`GET /universe`。
- **测试**：`tests/test_universe.py`。
- **状态**：`ACTIVE`（数据面；渲染在前端已移除）

## 13. 代码执行可视化（Trace）

- **背景**：教学/IDE 步进可视化（Visual Learning Engine）。
- **作用**：提交代码执行并产出逐步轨迹快照（子进程隔离 + 超时），内置算法示例。
- **实现**：`routers/trace.py` → `core/tracer/{runner,snapshot,limits}` + `examples/*`。
- **数据**：示例清单；运行时轨迹。
- **API**：`GET /trace/examples*` `POST /trace/run`。
- **测试**：`tests/api/test_trace_api.py` `tests/unit/test_trace_contract.py` `test_tracer_poc.py`。
- **状态**：`PARTIAL`（后端轨迹/步进已就绪；渲染管线在 `web/`，已移除——见 M9 历史）

## 14. LAN 多设备同步（Sync）

- **背景**：多端可见连续学习（ADR-005/006/020）；SQLite 只是本地缓存。
- **作用**：Discover→Pair→Manifest→Diff→Transport→Apply→Reindex 闭环；冲突消解与恢复。
- **实现**：`routers/sync.py` → `core/sync/{discovery,pairing,manifest,diff,protocol,scanner,transfer,transport,apply,status,device,messages}`。
- **数据**：同步走文件（md/旁车/eventlogs jsonl）；`sync` 相关状态在 DB。
- **API**：`GET /sync/discover|manifest|status|peers|files/{path}` `POST /sync/pair|plan|receive|resolve` `DELETE /sync/peers/{id}`。
- **测试**：`tests/api/test_sync_http.py` `tests/integration/sync/test_e2e_demo.py` `test_sync_closed_loop.py` `test_sync_simulation.py` `tests/unit/test_sync*.py`。
- **状态**：`ACTIVE`

## 15. 工作区管理 / Home

- **作用**：主页聚合数据面。
- **实现**：`routers/home.py` → `core/home.py`。
- **API**：`GET /home`。
- **测试**：`tests/api/test_home.py`。
- **状态**：`ACTIVE`

## 16. 一键全量导出（Export）

- **背景**：用户数据永不锁死；始终保留一键全量导出能力（MD+附件+JSON 元数据）。
- **作用**：vault + 附件 + 导图 + 事件日志 + 概念/掌握度快照（脱敏）打包导出。
- **实现**：`routers/export.py` → `core/export.py`。
- **API**：`GET /export`。
- **测试**：`tests/unit/test_export.py` `tests/integration/sync/test_sync_simulation.py`。
- **状态**：`ACTIVE`

## 17. 设置 / LLM 配置

- **作用**：读写设置（含 LLM base_url/key，仅存 `workspace/db/`）。
- **实现**：`routers/settings.py` → `core/ai/config.py` · `core/ai/constants.py`。
- **数据**：`settings`。
- **API**：`GET|PUT /settings`。
- **测试**：`tests/api/test_m2_smoke.py`（部分）。
- **状态**：`ACTIVE`

## 18. Admin / vault watcher & reindex

- **作用**：生产巡检：view watcher 启停/状态、手动触发全量 reindex。
- **实现**：`routers/notes.py`（admin_router）→ `core/reindex.py` · `core/vault_watcher.py`。
- **API**：`POST /admin/reindex` `GET|POST /admin/watcher/status|start|stop`。
- **测试**：`tests/unit/test_reindex.py` `test_vault_rebuild.py` `test_vault_watcher.py` `tests/test_rebuild.py`。
- **状态**：`ACTIVE`

## 19. 健康检查（Health）

- **作用**：`GET /api/v1/health` 如实报告 DB 可用性（ok/degraded）。
- **实现**：`app/main.py`。
- **测试**：`tests/test_smoke.py`。
- **状态**：`ACTIVE`

---

> 功能清单以当前存在并会被维护的代码为准；历史 milestone（M0~M9）见 [history](history.md)。
