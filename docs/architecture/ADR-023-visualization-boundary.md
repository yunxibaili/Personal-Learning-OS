# ADR-023: Visualization Boundary (可视化边界冻结)

## 状态
Accepted

## 背景
项目已有三类图谱可视化：
1. Knowledge Universe (M3b) — 概念中心的现实视图
2. Knowledge Graph (M2) — 关系探索视图
3. MindMap (M2b) — 用户自主思维空间

三者在功能、数据源、交互模式上存在重叠风险，需明确边界。

## 决策

### Knowledge Universe
- **核心隐喻**：概念中心的现实视图
- **节点**：仅 Concept（非 Note）
- **边**：links 表中 concept ↔ concept 关系
- **布局**：d3-force 力导向 + domain 聚类
- **视觉编码**：
  - 节点大小 = mastery.effective
  - 节点颜色 = mastery 状态（灰/橙/深）
  - 节点外环 = review due today（橙色脉冲）
  - 边类型 = relation 语义区分
- **交互**：Domain Filter、Weak Area、Focus Mode、Search/Jump
- **禁止**：Note 节点、用户手动编辑布局、游戏化元素

### Knowledge Graph
- **核心隐喻**：关系探索视图
- **节点**：Note + Concept 双层
- **边**：links 表全部关系类型（wikilink/mentions/related/prerequisite）
- **布局**：React Flow 默认 + Hierarchical (dagre) 选项
- **视觉编码**：
  - Note = 方形，Concept = 圆形+mastery环
  - Layer Toggle：Note Layer / Concept Layer / Mixed
- **交互**：双击展开、根节点切换、Domain 过滤、隐藏未确认桩
- **禁止**：mastery 视觉投射（仅 GraphView 内部状态）

### MindMap
- **核心隐喻**：用户自主思维空间
- **节点**：用户自由创建的 MapNode（可 bind Concept）
- **边**：用户自定义关系（mind_map_edges，独立于 links 表）
- **布局**：用户手动拖拽 + 自动辅助（可选）
- **持久化**：.mindmap.json 旁车文件（用户数据，可同步）
- **交互**：CRUD、bind/unbind Concept、Export/Import (.map.json)
- **禁止**：自动生成布局覆盖用户手动位置、mastery 自动改变节点样式

## 数据流边界

| 数据源 | Universe | Graph | MindMap |
|--------|----------|-------|---------|
| concepts | ✅ (仅 concept↔concept) | ✅ (全链接) | ✅ (bind 引用) |
| notes | ❌ | ✅ (含 wikilink) | ❌ |
| links (concept↔concept) | ✅ | ✅ | ❌ |
| links (note↔*) | ❌ | ✅ | ❌ |
| mind_map_nodes/edges | ❌ | ❌ | ✅ |
| mastery | ✅ (视觉核心) | ❌ (仅 tooltip) | ❌ (仅 bind tooltip) |

## 接口契约
- Universe 只消费 `/api/v1/universe` 投影
- Graph 只消费 `/api/v1/graph` 投影
- MindMap 只消费 `/api/v1/mindmaps/*` CRUD

## 违规检测（永久测试锁定）
- `test_universe_no_note_nodes` — Universe 投影不含 note 类型节点
- `test_graph_has_both_layers` — Graph 包含 note + concept 双层
- `test_mindmap_independent_storage` — MindMap 数据不写入 concepts/links 表

## 关联 ADR
- ADR-018: Knowledge Universe Design
- ADR-019: MindMap Boundary
- ADR-008: Knowledge Graph Model
- ADR-022: Product Mode Boundary (Universe = Knowledge Mode 核心)

## 冻结文本（BLOCK 裁决 2026-08-27）
> Concept identity source is defined by origin. Visualization layers must consume origin only.
> No derived source classification field may become persistent state.

## 变更记录
- 2026-08-27: 初版冻结 (P8-001A 完成后)