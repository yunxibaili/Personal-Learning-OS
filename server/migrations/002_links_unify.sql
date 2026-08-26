-- 002_link_unify: 统一关系表（ADR-008），取代三张旧关系表（发布前均为空表）。
-- 旧表结构见 001_init.sql；此处 DROP 属发布前窗口期的破坏性整理，已获批准。

CREATE TABLE links (
  id          INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,      -- 'note'|'concept'（预留 code_symbol|formula|person|resource）
  source_id   INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  relation    TEXT NOT NULL,      -- wikilink|mentions|requires|related|contains|contrasts_with|derived_from|implements
  origin      TEXT NOT NULL DEFAULT 'manual',  -- manual|markdown|ai_suggested|accepted
  weight      REAL NOT NULL DEFAULT 1.0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, target_type, target_id, relation)
);
CREATE INDEX idx_links_source ON links(source_type, source_id);
CREATE INDEX idx_links_target ON links(target_type, target_id);

DROP TABLE IF EXISTS note_links;
DROP TABLE IF EXISTS note_concepts;
DROP TABLE IF EXISTS edges;
