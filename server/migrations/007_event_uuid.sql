-- 007_event_uuid.sql: 为 learning_events 添加 event_uuid 列（ADR-020 多端同步依赖）
-- event_uuid: 跨设备幂等标识（UUID v4），用于 eventlog 去重

ALTER TABLE learning_events ADD COLUMN event_uuid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_uuid ON learning_events(event_uuid);
