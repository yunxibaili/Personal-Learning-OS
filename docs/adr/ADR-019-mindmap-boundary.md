# ADR-019: MindMap Boundary

> Status: Approved · Date: 2026-08-27
> 关联：ADR-008 Knowledge Graph · ADR-018 Knowledge Universe · M2b MindMap

---

## 1. Context

系统已有 Knowledge Universe（M3b 完成），即将启动 M2b MindMap。

两个功能天然容易冲突：

```
Knowledge Universe = 系统生成的知识状态地图
MindMap = 用户主动组织知识的思考空间
```

如果不提前冻结边界，两者会退化为两个"看起来一样的知识图"。

---

## 2. Decision

### 2.1 定位冻结

| | Universe | MindMap |
|---|---|---|
| 谁生成 | 系统 | 用户 |
| 数据源 | concepts + links + mastery | mind_map_nodes + mind_map_edges |
| 目的 | 观察知识状态 | 思考整理 |
| 布局 | 自动（d3-force / React Flow） | 用户控制（手动坐标） |
| 节点 | Concept | Map Node（concept_id nullable） |
| 边 | knowledge links | 用户关系（自定义） |
| 影响 mastery | 否 | 否 |
| 改变知识结构 | 否 | 否 |

### 2.2 五条冻结规则

1. **MindMap != Universe**：两套独立组件，不共享节点/边渲染逻辑
2. **MindMap 不改变 mastery**：地图操作不触发 learning_event
3. **MindMap 不生成 learning event**：拖动/连线/编辑不写入 events 表
4. **Concept binding 是引用，不是复制**：map_node.concept_id → concepts.id，单向引用
5. **用户布局属于用户数据**：mind_map_nodes.position_x/y 存入 DB，参与同步（M7）

### 2.3 数据模型

```sql
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
```

### 2.4 Concept Binding 语义

```
Map Node ──concept_id──▶ Concept

  - 引用，不是复制
  - concept 被删除 → concept_id → NULL（ON DELETE SET NULL）
  - Map Node 的 label/note 独立于 concept.title/summary
  - 不自动同步 concept 属性变化
```

### 2.5 不做的事（M2b 边界）

- 不做自动从 Universe 生成 MindMap
- 不做 MindMap → concept 自动生成
- 不做 MindMap 节点的 mastery 显示
- 不做多 Map 间同步
- 不做协作编辑

---

## 3. Consequences

### 代码结构

```
web/src/
├── components/universe/    ← Universe 专用（M3b 已完成）
│   ├── KnowledgeUniverse.tsx
│   └── ConceptNode.tsx
├── components/mindmap/     ← MindMap 专用（M2b 新增）
│   ├── MindMapCanvas.tsx
│   ├── MapNode.tsx
│   └── MapEdge.tsx
```

### 数据层

- 新增 3 张表：mind_maps / mind_map_nodes / mind_map_edges
- 新增 migration：005_mindmap.sql
- 新增 router：routers/mindmap.py
- 新增 core：core/mindmap.py

### 对现有模块的影响

- Universe 组件不修改
- concepts 表不修改
- mastery / learning_events 不修改
- links 表不修改（MindMap 用独立的 mind_map_edges）

---

## 4. References

- ADR-008: Knowledge Graph Model（concepts + links 统一关系表）
- ADR-018: Knowledge Universe Design（Universe 定位冻结）
- M2b MindMap 里程碑（TECH_DESIGN §10）
