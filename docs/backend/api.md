# API · 契约

> 权威端点数（OpenAPI introspection）：102 条 route / 82 个 path。
> 所有版本化前缀 `/api/v1/*`。响应错误统一 `{error:{code,message}}`。

## 通用约定

- 版本前缀：`/api/v1/*`
- 错误形状：
  - 校验失败 `400`：`{"error":{"code":"invalid_body","message":"..."}}`（剥离 input/url 防敏感值回显）
  - HTTP 错误：`{"error":{"code":"http_{status}","message":"..."}}`
- SSE 流式：`POST /api/v1/chat`、`POST /api/v1/tutor/test` 等，事件帧契约与 `core/tutor_types.py` 对齐（见 `routers/conversations.py`）。
- 时间为 ISO 时间；ID 以字符串/整数按 schema 定义。

## 端点清单（router → 功能）

### notes & links（`routers/notes.py` + `routers/links.py`，prefix `/api/v1/notes`）
- `GET /notes` `POST /notes` `POST /notes/batch` `POST /notes/import`
- `GET /notes/tree` `GET /notes/{note_id}` `PATCH /notes/{note_id}` `DELETE /notes/{note_id}`
- `GET /notes/{note_id}/backlinks` `GET /notes/{note_id}/link-suggestions`

### revisions / changes / diff（`routers/revisions.py`，prefix `/api/v1/notes`）

> ADR-028：与 Git 解耦的文档变更抽象层。revision source = `current` | `snapshot`
> （`git` 为后续独立任务）。不提供 branch / commit / merge 语义。

- `GET /notes/{note_id}/revisions` — 版本列表，首位 `current` 虚拟项，其余快照时间倒序（`limit` 1–200，越界 422 `invalid_limit`）
- `POST /notes/{note_id}/revisions` — 手动打点；内容未变返回 `created: false` / `reason: "unchanged"`
- `GET /notes/{note_id}/revisions/{rev_id}` — 读指定版本内容（`rev_id="current"` 读 vault 当前内容）
- `GET /notes/{note_id}/changes` — 当前 vs 最新快照的变更概览；无快照时 `compared_against: null`、stats 全零
- `POST /notes/{note_id}/diff` — body `{from_ref:{source,ref}, to_ref:{source,ref}}` →
  `{stats, hunks, unified}`；`source` 非法 400 `invalid_source`，ref 无法解析 404 `revision_not_found`
- `DELETE /notes/{note_id}/revisions` — 清理该笔记全部快照
- `POST /notes/{note_id}/revisions/{rev_id}/restore` — 恢复到指定快照（frontmatter+正文整体回滚）；
  恢复前先对被覆盖状态打 `origin=restore` 快照 → 恢复本身可逆；
  `rev_id="current"` 400 `invalid_target`；与目标一致时 `restored: false` / `reason: "unchanged"`

### admin · 孤儿快照（`routers/revisions.py`，prefix `/api/v1/admin`）

> 决策 D 收尾：删除笔记**保留**快照，故必须提供可恢复路径，否则保留只是只读考古。

- `GET /admin/revisions/orphans` — 快照目录存在但 notes 行已消失的路径
  （`{path, snapshot_count, latest_rev_id, latest_created_at}`）
- `POST /admin/revisions/restore` — body `{path}` → 从该路径**最新**快照重建笔记
  （title 取 stem，path 原样保留，支持嵌套路径）；笔记已存在 409、无快照 404、
  路径越界 400 `invalid_path`；走与常规创建相同的写路径（校验/防覆盖/索引/链接/父边）

**diff 两种形态**（前端各取所需）：

- `hunks`：`{op: equal|insert|delete|replace, old_start, old_end, new_start, new_end}`，
  0-based 左闭右开，**只含非 equal 段**，供块级高亮
- `unified`：unified diff 文本，供人读与导出

> 术语：`source` = revision source（`current`/`snapshot`）；`origin` = 快照触发方式（`auto`/`manual`）。

### admin（`routers/notes.py`，prefix `/api/v1/admin`）
- `GET /admin/watcher/status` `POST /admin/watcher/start` `POST /admin/watcher/stop`
- `POST /admin/reindex`

### attachments（`routers/attachments.py`）
- `POST /attachments` `GET /attachments/{name}`

### search（`routers/search.py`，prefix `/api/v1`）
- `GET /search`

### concepts（`routers/concepts.py`）
- `GET /concepts` `GET /concepts/domains` `GET /concepts/{concept_id}`
- `POST /concepts` `POST /concepts/extract` `PATCH /concepts/{concept_id}` `DELETE /concepts/{concept_id}`

### knowledge / suggest（`routers/suggest.py`，prefix `/api/v1/knowledge`）
- `GET /knowledge/suggest`

### mastery / review（`routers/mastery.py` + `routers/study.py`）
- `GET /mastery` `GET /mastery/{concept_id}` `GET /mastery/weak/list`
- `GET /review/today` `GET /review/stats` `GET /review/history`
- `POST /review/{concept_id}/answer`

### study（`routers/study.py`）
- `GET /study/sessions` `GET /study/sessions/{session_id}`
- `GET /study/sessions/{session_id}/queue`
- `POST /study/sessions` `POST /study/sessions/{session_id}/finish`
- `DELETE /study/sessions/{session_id}`

### graph & home & universe
- `GET /graph` `GET /home` `GET /universe`

### mindmap（`routers/mindmap.py`）
- `GET /mindmaps` `POST /mindmaps` `POST /mindmaps/import`
- `GET /mindmaps/{map_id}` `GET /mindmaps/{map_id}/export` `GET /mindmaps/{map_id}/outline`
- `POST /mindmaps/concepts/search` `POST /mindmaps/suggest`
- `POST /mindmaps/{map_id}/nodes|edges` `PATCH|DELETE .../nodes/{node_id}` `DELETE .../edges/{edge_id}`
- `POST`/`DELETE` `.../nodes/{node_id}/bind`

### tutor / conversations / events（`routers/tutor.py` + `conversations.py`）
- `GET /tutor/context/{concept_id}` `POST /tutor/context` `POST /tutor/test`
- `GET /conversations` `POST /conversations` `DELETE /conversations/{conversation_id}`
- `GET /conversations/{conversation_id}/messages`
- `POST /chat` `POST /events`

### memories（`routers/memories.py`）
- `GET /memories` `GET /memories/maintenance` `GET /memories/{memory_id}`
- `POST` `PATCH` `DELETE` `/memories/{memory_id}`

### mistakes（`routers/mistakes.py`）
- `GET /mistakes` `GET /mistakes/stats` `GET /mistakes/{mistake_id}`
- `PATCH /mistakes/{mistake_id}` `DELETE /mistakes/{mistake_id}`

### sync（`routers/sync.py`）
- `GET /sync/discover` `GET /sync/manifest` `GET /sync/status` `GET /sync/peers`
- `GET /sync/files/{file_path}`
- `POST /sync/pair` `POST /sync/plan` `POST /sync/receive` `POST /sync/resolve`
- `DELETE /sync/peers/{device_id}`

### trace（`routers/trace.py`）
- `GET /trace/examples` `GET /trace/examples/{example_id}`
- `POST /trace/run`

### export & settings
- `GET /export`
- `GET /settings` `PUT /settings`

### misc
- `GET /health`

> 端点数与契约以 `app.openapi()` 为准（CI 中的 `scripts/contract_audit.py` 做机器可审计的
> endpoint→test 1:1 映射）。
