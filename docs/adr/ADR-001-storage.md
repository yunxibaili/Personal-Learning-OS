# ADR-001: 存储分层——Markdown 正文 + SQLite 元数据/索引/状态

日期：2026-08-26 · 状态：Accepted

## Context
系统同时需要：全文搜索、双链/图谱关系、学习状态追踪，以及用户对笔记的直接所有权
（任意编辑器可改、可备份、可迁移）。SiYuan 类"一切入库"与 Obsidian 类"纯文件夹"
各有取舍。

## Decision
三层分工：
1. **`workspace/vault/*.md`**：笔记正文唯一事实源
2. **SQLite（stdlib sqlite3）**：元数据、双链/概念边、掌握度、事件日志、FTS5 索引
   ——全部为可重建的派生数据或追加式日志
3. 启动时全量扫描 + content_hash 校验，不一致即重索引；保存时增量更新单篇索引

## Alternatives Considered
- 全部入库（SiYuan 式）：查询强，但用户丧失直接文件所有权，导出/迁移成本高
- 纯文件夹无 DB：无法支撑掌握度/图谱/FTS5
- PostgreSQL/pgvector：本地单机场景运维过重，违反 Local-first 最小依赖

## Reason
Markdown 保所有权与 AI 可读性；SQLite 保查询与状态；hash 增量索引把一致性成本降到最低。

## Consequences
- 双写（文件+索引）一致性依赖启动扫描与保存钩子，需测试覆盖
- FTS5 中文分词有限，初期接受（unicode61 按字切分可用），瓶颈出现再评估
