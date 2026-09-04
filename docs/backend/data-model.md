# 数据模型 · Data Model

## 事实源分级

| 优先级 | 事实源 | 内容 |
|---|---|---|
| 1（唯一） | `workspace/vault/**/*.md` | Markdown 正文 |
| 1（唯一） | `workspace/vault/**/*.mindmap.json` | 思维导图结构（旁车） |
| 1（唯一） | `workspace/metadata/revisions/**/*.md` | 文档快照（ADR-028，见下） |
| 2（可重建缓存） | `workspace/db/learning-os.db` | 元数据 / 索引 / 学习状态 |
| 2（可重建索引） | `notes_fts` | 全文检索派生索引（DROP+CREATE 后需 reindex） |

SQLite 在任何设备上都只是可重建的本地缓存（ADR-001 / ADR-005）。
db / settings / API key 永不参与同步。

## 数据库：22 张表（`schema_migrations` 之外的业务表 + FTS 影子表）

`init_db()` 跑幂等 migration（`server/migrations/001_init.sql ~ 010_fts_bigram.sql`）。
runner 在 `app/db.py`（纯 SQL，无 ORM）。

```
# 业务表
notes            notes_txt 笔记（文档）/ stub 占位
links            双链 / 反链（[[wikilink]]）
concepts         Concept（纯概念 + 记标记/来源 origin）
concept_mastery  四维掌握度（记忆强度/理解/熟悉/巩固 …）
review_queue     SM-2 复习队列
study_sessions   复习会话
learning_events  学习事件日志（event log，多设备可见）
mistakes         错误本
memories         AI 学习记忆
conversations    对话会话
messages         对话消息（Tutor / chat）
mind_maps        思维导图
mind_map_nodes   导图节点
mind_map_edges   导图边
settings         设置（含 LLM base_url/config）
schema_migrations migration 记录

# FTS5 派生（影子表，由 notes_fts 自动管理）
notes_fts        FTS5 虚拟表（bigram tokenizer，ADR-027）
notes_fts_config notes_fts_content notes_fts_data
notes_fts_docsize notes_fts_idx
```

## Migration 链

`001_init` → `002_links_unify` → `003_concept_status` → `004_learning` →
`005_events_quality` → `006_mindmap` → `007_event_uuid` → `008_study_sessions` →
`009_event_id_rename` → `010_fts_bigram`（CJK 中文 FTS 选型落地，ADR-027 方案 A）。

应用 `010` 后 lifespan 自动触发一次全量 reindex（从 vault 重建 `notes_fts`）。

## Markdown 正文格式

- 正文唯一事实源：`workspace/vault/**/*.md`（开放 Markdown，永不锁死）。
- 双链：`[[wikilink]]`，由 `autolink.py` / `knowledge.py` 解析并维护 `links`。
- 思维导图大纲段：带 `generated:mindmap` 标记的大纲是**派生视图**，禁止手改（ADR-002）。
- 附件：`workspace/attachments/`；元数据/旁车：`workspace/metadata/`、`workspace/mind_maps/`。

## 文档快照（ADR-028）

```
workspace/metadata/revisions/<vault 相对路径>/<YYYYmmddTHHMMSSZ>-<hash8>.md
```

- 快照与笔记正文**都落文件系统，都不进 SQLite** —— SQLite 不在 `EXPORT_DIRS`
  也不在 `SYNC_PATTERNS`，落表会让快照既不进导出包也不参与多端同步，
  违反「用户数据永不锁死」（`AGENTS.md §3`）与 ADR-005。
- **本功能零新增 migration**：`010_fts_bigram` 仍是链尾。
- 目录键是 vault 相对路径而非 `note_id` —— `note_id` 是 SQLite 自增主键，
  db 不同步，跨设备不保证一致。
- 快照**不放在 `vault/` 下**：`reindex.py` 的 `rglob("*.md")` 会把它吞成正式笔记。
- 快照文件本身即合法 Markdown：`compose_file({**笔记原 frontmatter, **rev_* 元数据}, body)`，
  剥离 `rev_*` 后可无损还原原笔记文件。
- 进 `EXPORT_DIRS`（可全量导出），**不进** `SYNC_PATTERNS`（本地便利能力，非跨设备事实）。

## 数据所有权

应用源码（`server/ docs/ scripts/`）与用户数据严格分离 —— `workspace/` 整体 `.gitignore`，
默认在设置中可改路径（`WORKSPACE_DIR` 环境变量可覆盖）。本档案不修改任何用户数据。
