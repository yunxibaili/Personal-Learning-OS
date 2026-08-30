-- B14 Study Session：连续复习/学习会话。
-- 生产者：POST /api/v1/study/sessions（routers/study.py）→ core/study.py
-- 会话 = 一组概念的用户聚焦复习；不改变 mastery/review（复习仍走 /review/{id}/answer）。

CREATE TABLE study_sessions (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,            -- 会话名
  concept_ids  TEXT NOT NULL DEFAULT '[]', -- JSON 数组（概念 id 集合）
  status       TEXT NOT NULL DEFAULT 'active', -- active|done
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
