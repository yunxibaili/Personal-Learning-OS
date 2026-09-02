-- 010: notes_fts 重建为 CJK bigram 检索文本（ADR-027，2026-09-02 所有者裁定）
--
-- 背景：FTS5 默认 unicode61 把连续汉字整段当一个 token，中文短语/子串查询
-- 0 命中（ADR-011 延后决策的触发条件已达成）。改由应用侧 cjk_bigram.segment
-- 预分词写入（tokenizer 仍为内置 unicode61，零新依赖）。
--
-- notes_fts 是纯派生索引：DROP + CREATE 后由启动链路（main.lifespan 检测
-- db.FTS_REBUILD_VERSIONS）触发 reindex_vault 全量重建；vault/ 仍是唯一
-- 事实源，本 migration 不涉及任何业务数据迁移。
DROP TABLE IF EXISTS notes_fts;
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, note_id UNINDEXED
);
