-- 005_events_quality.sql: 事件完整性（M4-Preflight Hardening）
-- learning_events 增加 detail 列，存储事件特定数据 JSON
-- review_answer 事件: {"quality": 4}
-- 未来其他事件类型可扩展

ALTER TABLE learning_events ADD COLUMN detail TEXT;
