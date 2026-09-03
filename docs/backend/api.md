# API · 契约

> 权威端点数（OpenAPI introspection）：93 条 route / 75 个 path。
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
