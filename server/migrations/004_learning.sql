-- 004_learning.sql: Learning Graph 三表（M3，评审修正版）
-- concept_mastery: 四维掌握度（dimensions JSON）+ effective 派生值
-- learning_events: 学习事件（含 source 来源追踪）
-- review_queue: 复习队列（含 last_result）

-- 删除 001_init 中的旧表（IF NOT EXISTS 不会重建列结构）
DROP TABLE IF EXISTS review_queue;
DROP TABLE IF EXISTS learning_events;
DROP TABLE IF EXISTS concept_mastery;

CREATE TABLE concept_mastery (
    concept_id    INTEGER PRIMARY KEY REFERENCES concepts(id),
    dimensions    TEXT NOT NULL DEFAULT '{"knowledge":0,"practice":0,"recall":0,"transfer":0}',
    effective     REAL NOT NULL DEFAULT 0,
    next_review   TEXT,
    ease_factor   REAL NOT NULL DEFAULT 2.5,
    interval      INTEGER NOT NULL DEFAULT 0,
    review_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE learning_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id    INTEGER NOT NULL REFERENCES concepts(id),
    event_type    TEXT NOT NULL,
    dimension     TEXT,
    weight        REAL NOT NULL DEFAULT 1.0,
    source        TEXT NOT NULL DEFAULT 'manual',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_concept ON learning_events(concept_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON learning_events(event_type);

CREATE TABLE review_queue (
    concept_id    INTEGER PRIMARY KEY REFERENCES concepts(id),
    due_at        TEXT NOT NULL,
    priority      REAL NOT NULL DEFAULT 0.5,
    status        TEXT NOT NULL DEFAULT 'pending',
    last_result   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_due ON review_queue(due_at);
CREATE INDEX IF NOT EXISTS idx_review_status ON review_queue(status);
