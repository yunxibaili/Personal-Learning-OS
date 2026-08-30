-- 009_event_id_rename.sql: event_uuid → event_id 术语统一
-- SQLite 列名与 JSONL 字段名统一为 event_id（消除双名歧义）

ALTER TABLE learning_events RENAME COLUMN event_uuid TO event_id;
DROP INDEX IF EXISTS idx_events_uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_id ON learning_events(event_id);
