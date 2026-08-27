-- 006_mindmap.sql: MindMap 三表（ADR-019, M2b）
-- mind_maps: 地图元数据
-- mind_map_nodes: 节点（concept_id nullable，允许临时节点）
-- mind_map_edges: 边（独立于 links 表，用户自定义关系）

CREATE TABLE mind_maps (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE mind_map_nodes (
  id          INTEGER PRIMARY KEY,
  map_id      INTEGER NOT NULL REFERENCES mind_maps(id) ON DELETE CASCADE,
  concept_id  INTEGER REFERENCES concepts(id) ON DELETE SET NULL,
  label       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  position_x  REAL NOT NULL DEFAULT 0,
  position_y  REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mm_nodes_map ON mind_map_nodes(map_id);

CREATE TABLE mind_map_edges (
  id          INTEGER PRIMARY KEY,
  map_id      INTEGER NOT NULL REFERENCES mind_maps(id) ON DELETE CASCADE,
  source      INTEGER NOT NULL REFERENCES mind_map_nodes(id) ON DELETE CASCADE,
  target      INTEGER NOT NULL REFERENCES mind_map_nodes(id) ON DELETE CASCADE,
  relation    TEXT NOT NULL DEFAULT 'related',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mm_edges_map ON mind_map_edges(map_id);
