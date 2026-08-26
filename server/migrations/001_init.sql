-- 001_init: 全量初始 schema（docs/TECH_DESIGN.md §4.1）
-- 由 migration runner 以 executescript 执行；schema_migrations 由 runner 记录。

-- 配置（LLM base_url/api_key/model、主题等）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL              -- JSON 字符串或纯文本
);

-- 概念节点：Knowledge Graph 第一等公民
CREATE TABLE concepts (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL UNIQUE,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  summary      TEXT NOT NULL DEFAULT '',
  domain       TEXT NOT NULL DEFAULT '',      -- 自由文本标签：数学/编程/...
  origin       TEXT NOT NULL DEFAULT 'manual', -- manual|ai_suggested（AI 建点淡色过滤，§8.1/ADR-002）
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 关系边
CREATE TABLE edges (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relation   TEXT NOT NULL,                   -- requires|related|contains|contrasts_with
  origin     TEXT NOT NULL DEFAULT 'manual',  -- manual|ai_suggested|accepted
  weight     REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_id, target_id, relation)
);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);

-- 学习状态：每概念一行，首次触达时惰性创建（缓存，可由 events 重放重建）
CREATE TABLE concept_mastery (
  concept_id       INTEGER PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
  understanding    REAL NOT NULL DEFAULT 0,    -- 定义/直觉
  computation      REAL NOT NULL DEFAULT 0,    -- 计算/解题
  proof            REAL NOT NULL DEFAULT 0,    -- 证明/推导
  application      REAL NOT NULL DEFAULT 0,    -- 应用/编程
  overall          REAL NOT NULL DEFAULT 0,
  state            TEXT NOT NULL DEFAULT 'UNKNOWN',
  ease             REAL NOT NULL DEFAULT 2.5,  -- SM-2
  interval_days    REAL NOT NULL DEFAULT 0,
  reps             INTEGER NOT NULL DEFAULT 0,
  lapse_count      INTEGER NOT NULL DEFAULT 0,
  mistake_count    INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  next_review_at   TEXT
);

-- 学习事件：追加式日志，掌握度的唯一来源
CREATE TABLE learning_events (
  id          INTEGER PRIMARY KEY,
  concept_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,   -- study|explain|quiz_correct|quiz_wrong|code_run|visualize|review
  dimension   TEXT NOT NULL DEFAULT 'understanding',
  delta       REAL NOT NULL DEFAULT 0,        -- 实际施加的增量（记录用）
  score       REAL,                           -- quiz 得分 0~1
  detail_json TEXT NOT NULL DEFAULT '{}',     -- {source:"chat"/"note"/..., note_id, conv_id}
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_concept ON learning_events(concept_id, occurred_at);

-- 错误记录
CREATE TABLE mistakes (
  id          INTEGER PRIMARY KEY,
  concept_id  INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  resolved    INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用户记忆（Mem0 风格）：事实/偏好/目标/错误模式
CREATE TABLE memories (
  id           INTEGER PRIMARY KEY,
  kind         TEXT NOT NULL,      -- fact|preference|goal|mistake_pattern
  content      TEXT NOT NULL,
  importance   REAL NOT NULL DEFAULT 0.5,
  confidence   REAL NOT NULL DEFAULT 0.5,
  concepts_json TEXT NOT NULL DEFAULT '[]',   -- ["特征值", ...]
  last_used_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 笔记元数据（正文在 workspace/vault/*.md）
CREATE TABLE notes (
  id           INTEGER PRIMARY KEY,
  path         TEXT NOT NULL UNIQUE,   -- vault 相对路径（POSIX 风格分隔符）
  title        TEXT NOT NULL,          -- 文件名去扩展名
  tags_json    TEXT NOT NULL DEFAULT '[]',
  content_hash TEXT NOT NULL,          -- sha256(body)，增量索引判断
  mtime        REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 笔记 ↔ 概念
CREATE TABLE note_concepts (
  note_id    INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  origin     TEXT NOT NULL DEFAULT 'link',   -- link([[..]])|manual|ai
  PRIMARY KEY (note_id, concept_id)
);

-- 双链边（笔记级）：[[目标标题]]
CREATE TABLE note_links (
  source_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, target_id)
);

-- 对话
CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE messages (
  id              INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,             -- user|assistant
  content         TEXT NOT NULL,
  context_json    TEXT NOT NULL DEFAULT '{}', -- 本轮注入上下文快照（上下文透视功能）
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 全文搜索（独立 FTS5 表，随笔记保存增量维护）
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, note_id UNINDEXED
);
