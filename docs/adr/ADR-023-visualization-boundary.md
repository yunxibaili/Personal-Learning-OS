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
  - 边：`prerequisite` / `requires` 提升一级权重；其余关系统一为最轻层级
    （见下「编码通道预算」）
- **交互**：双击展开、根节点切换、Domain 过滤、隐藏未确认桩
- **禁止**：mastery 视觉投射 —— **唯一例外**是 Concept 的 mastery 环（视觉编码条款）。
  禁止尺寸 / 填充色 / 排序 / 动画等其他任何 mastery 投射。

### MindMap
- **核心隐喻**：用户自主思维空间
- **节点**：用户自由创建的 MapNode（可 bind Concept）
- **边**：用户自定义关系（mind_map_edges，独立于 links 表）
- **布局**：用户手动拖拽 + 自动辅助（可选）
- **持久化**：.mindmap.json 旁车文件（用户数据，可同步）
- **交互**：CRUD、bind/unbind Concept、Export/Import (.map.json)
- **禁止**：自动生成布局覆盖用户手动位置、mastery 自动改变节点样式

### 编码通道预算（横切约束 · 2026-08-29 追加）

**一个维度 = 一个通道。** 同一维度被多个视觉通道重复编码即为过度，是"花哨"的量化判据。

| 维度 | 允许通道 | 禁止 |
|------|---------|------|
| 关系类型 | 单一通道（Graph：线色 2 级；Universe：边类型） | 颜色 + 线宽 + 虚线 叠加 |
| 语义强弱 | 线宽（1px / 1.5px） | 引入新色相 |
| 交互状态 | 品牌橙（hover / selected） | 橙白体系外的第三色相 |
| 掌握度 | Graph：Concept 环 · Universe：节点大小 + 颜色 | Graph 中环以外的任何 mastery 投射 |

- **橙色 = 注意力指针**，只用于两处：① 交互焦点（hover / selected）② mastery 进度。
  **不用于静态分类**（关系类型、领域等）——一旦用于静态元素即被稀释。
- **形状即语义，不靠颜色区分**：Note = 方形，Concept = 圆形。加颜色区分等于再引入一套色相。

## 数据流边界

| 数据源 | Universe | Graph | MindMap |
|--------|----------|-------|---------|
| concepts | ✅ (仅 concept↔concept) | ✅ (全链接) | ✅ (bind 引用) |
| notes | ❌ | ✅ (含 wikilink) | ❌ |
| links (concept↔concept) | ✅ | ✅ | ❌ |
| links (note↔*) | ❌ | ✅ | ❌ |
| mind_map_nodes/edges | ❌ | ❌ | ✅ |
| mastery | ✅ (视觉核心) | ⚠️ (仅 mastery 环 + tooltip) | ❌ (仅 bind tooltip) |

> **Graph / mastery 澄清（2026-08-29 裁决）**：上表原写「仅 tooltip」，与「视觉编码」
> 「Concept = 圆形+mastery环」互斥。裁决取**视觉编码条款**：Graph 允许 mastery 环，
> 但这是 Graph 中 mastery 的**唯一**视觉出口，其余投射（尺寸/填充色/排序/动画）一律禁止。

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
- 2026-08-29: 裁决 Graph/mastery 内部矛盾（数据流表「仅 tooltip」vs 视觉编码「mastery 环」），
  取视觉编码条款；新增「编码通道预算」横切约束；Graph 边视觉由 9 色 3 通道收敛为
  2 级中性灰 1 通道。实现见 `ui/graph-view.html` 规范页。
  **本次为消除文档内部互斥，未放宽任何冻结边界。**