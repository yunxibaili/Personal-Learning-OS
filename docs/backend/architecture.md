# 架构 · Architecture

## 分层职责

四层职责固定，唯一合法调用链：

```
Request → Router(校验) → Core(业务) → 数据访问函数 → SQLite / vault 文件
```

| 层 | 位置 | 职责 | 禁止 |
|---|---|---|---|
| Router | `server/app/routers/*` | HTTP 校验 / 版本前缀 `/api/v1` / 错误码 | UI 代码、持久化核心数据、直连 LLM |
| Core | `server/app/core/*` | 业务规则、图谱算法、同步协议、AI | import FastAPI；LLM 请求只允许 `core/ai/*` |
| Data | `server/app/db.py` | 唯一允许触碰 SQLite 的模块 | 业务逻辑 |
| File/Vault | `workspace/vault/**` | 正文唯一事实源 | —— |

Core 层不 import FastAPI；LLM 请求只在 `core/ai/*`；图谱算法只在 core；同步协议只在 `core/sync/*`。

## 入口与生命周期

- `app.main:app`（模块级）与 `create_app()` 工厂（测试导入用）。
- `lifespan`：启动即 `init_db()` 跑幂等 migration；若应用了 FTS 重建类
  migration（ADR-027 `010_fts_bigram`）则自动触发一次 vault 全量 reindex
  （`notes_fts` 是派生索引，DROP+CREATE 后必须从 vault 重建）。重建失败不阻断启动
  （搜索降级为空结果，后续 sync/reindex 可自愈）。
- 只绑定 `127.0.0.1`（network-boundary 红线，永不 `0.0.0.0`）。
- 端口默认 8000，`PORT` 可覆盖。

## 请求数据流（笔记为例）

```
POST /api/v1/notes
  → routers/notes.py  (Pydantic 校验 → shape 检查)
  → core/knowledge.py (wikilink 解析 / 反链维护 / stub 概念)
  → db.py             (写 SQLite)
  → vault/*.md        (写 Markdown，事实源)
  → response (note JSON)
```

## 关键横切件

- **错误统一**：`{error:{code,message}}`；`RequestValidationError` 剥离 `input`/`url`
  字段（防敏感值回显泄漏面）；`StarletteHTTPException` → `http_{status}`。
- **health**：`GET /api/v1/health`，如实报告 DB 可用性（ok/degraded）。
- **vault watcher**：`core/vault_watcher.py`，监控 vault 变化（admin 路由可启停/查状态）。
- **reindex**：`core/reindex.py`，全量重建 FTS 索引（admin 路由可手动触发）。
- **settings**：`core/ai/config.py`，LLM 配置（OpenAI-compatible base_url + key）驱动，
  代码不感知厂商。

## 模块地图（core）

```
core/
├── knowledge.py # 笔记/概念知识面（最长模块）
├── hierarchy.py # 主/副笔记层级树、图谱读模型
├── autolink.py  # 自动链接建议
├── importer.py  # 笔记导入
├── concepts.py  # 纯概念（Concept）生命周期
├── mindmap.py   # 思维导图结构（.mindmap.json 旁车）
├── mastery.py   # 四维掌握度
├── review_scheduler.py review_stats.py # SM-2 复习调度/统计
├── study.py     # 复习会话
├── memories.py  # AI 学习记忆（+ 事件日志）
├── mistakes.py  # 错误本
├── universe.py  # 知识星系（自研 Canvas 数据面）
├── export.py    # 一键全量导出
├── reindex.py   vault_watcher.py # FTS / 文件源
├── cjk_bigram.py# 中文 FTS 预分词（ADR-027）
├── revisions.py # 文档快照/diff/恢复（ADR-028，workspace/metadata/revisions/）
├── tutor_context.py tutor_types.py # Tutor 上下文组装 + 契约类型
├── timeutil.py  # 时间工具
├── ai/          # LLM 边界：config/constants/errors/service/tutor/extractor
│   └── providers/ # base/mock/openai_compat
├── sync/        # LAN 同步：discovery/pairing/manifest/diff/protocol/scanner/transfer/transport/apply/status/device/messages
└── tracer/      # 代码执行可视化：runner/snapshot/limits + examples（算法示例）
```
