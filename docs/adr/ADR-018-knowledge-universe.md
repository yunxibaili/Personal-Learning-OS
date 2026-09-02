# ADR-018: Knowledge Universe Design

**状态**：**Superseded（2026-09-02 状态收口标记）**——原批准 2026-08-27
**决策者**：项目负责人
**关联**：ADR-007（d3-force，同批失效）· ADR-008（Graph Model）· ADR-013（UI Design）· M3b

> **⚠️ 本 ADR 的设计已随实现演进被取代，仅作历史记录。**
> ① 原 d3-force React Flow 版 Universe（`lib/universe/layout.ts` + PlanetNode/ConceptNode）
> 已整包删除（`dd4f40c`，2026-08-31）；② 现 `universe` 视图渲染 **Galaxy 多星球系统**
> （自研 Canvas 2D，`GalaxyCanvas.tsx`），其节点语义为 **主笔记=星球 / 副笔记=卫星**
> （Note 而非 Concept，与本 ADR §2.1「Node = Concept」相反——该语义变更由
> 2026-08-30「笔记优先」裁决与 2026-08-31 星系裁定确立）；③ 可视化边界现以
> **ADR-023**（Note 方/Concept 圆、橙=注意力指针）与 **ADR-024**（层级权威 parent）
> 为准。本文的「防止可视化偏离核心价值」精神由 ADR-013/023 继承。

---

## 1. Problem

M3b Knowledge Universe 需要将知识图谱可视化为可导航空间。
需要冻结节点、边、颜色、动态行为的设计约束，防止可视化偏离核心价值。

## 2. Decision

### 2.1 节点

```
Node = Concept（不是 Note）
```

来源：`concepts` 表（ADR-008 第一等公民）。

禁止：
- 以 Note 为节点（Note 是内容载体，Concept 是知识对象）
- 以文件名为节点
- 自动拆分段落为节点

### 2.2 节点颜色

来源：`concept_mastery.effective`

```
灰色   = 未学习（mastery = null 或 0）
橙色   = 当前学习（0 < effective < 0.7）
深色   = 已掌握（effective ≥ 0.7）
红色   = 薄弱点（mistakes 最近出现）
```

禁止：
- 以笔记数量为颜色
- 以创建时间为颜色
- 游戏化等级 / XP / 徽章

### 2.3 边

来源：`links` 表（ADR-008 统一关系表）

```
边权重 = link.weight（如有）
边样式 = link.relation（reference / depends_on / related 等）
```

禁止：
- embedding similarity（保持反向依赖原则）
- 自动推断关系（必须有显式 links 记录）
- 向量数据库查询结果

### 2.4 布局

- 使用 d3-force（ADR-007 唯一例外）做物理计算
- 渲染走 React Flow + SVG/CSS（ADR-013 合规）
- 节点 8-12 个核心可见，其余按需展开

### 2.5 动态行为

允许：
- mastery 变化 → 节点颜色渐变（150ms transition）
- review 状态变化 → 节点边框样式
- 选中节点 → 显示 concept context 卡片
- 点击节点 → 跳转 NoteEditor 或 TutorPanel

禁止：
- 游戏化等级 / XP 系统
- 成就徽章
- 排行榜
- 粒子动画 / 星空背景
- 3D 渲染

### 2.6 与现有模块的关系

```
Knowledge Universe (Frontend)
    ↓ reads
Concept + Links + Mastery (Core)
    ↓ reads
SQLite (Data)
```

Universe 是纯前端可视化层，不新增后端 API，不修改 Core 逻辑。

### 2.7 数据来源

| 数据 | 来源 | 用途 |
|---|---|---|
| 节点 | `concepts` | 概念实体 |
| 边 | `links` | 关系 |
| 颜色 | `concept_mastery.effective` | 掌握度 |
| 薄弱点 | `mistakes` | 最近错误 |
| 复习状态 | `review_queue.next_review` | 复习优先级 |

## 3. Consequences

### 代码结构

```
web/src/
├── components/universe/
│   ├── KnowledgeUniverse.tsx   ← 主容器（React Flow + domain filter + detail panel）
│   └── ConceptNode.tsx         ← 节点渲染（mastery → radius + color + hover tooltip）
```

### 对现有模块的影响

- 新增 `components/universe/` 目录
- 复用 React Flow 渲染层
- 复用 d3-force 布局计算（ADR-007）
- 不修改 Core 层

### 测试要求

- `npm run build` 通过
- 视觉审查：不违反 ADR-013/018

## 4. References

- ADR-007: d3-force 单模块例外
- ADR-008: Knowledge Graph Model
- ADR-013: Frontend Design System
- Obsidian Graph View（参考实现）
