# ADR-008: 知识图谱数据模型冻结——Node = Entity，统一 links 表

日期：2026-08-26 · 状态：Accepted（M2 实施）
> 即立项文档所称「数据模型冻结检查」；因 ADR-005 已被同步模型占用而顺延编号。

## Context

M2 起系统第一次固化核心数据结构。"图谱的节点到底是什么"决定了未来
Learning Graph / RAG / 推荐是否返工。M1 现状：三张分散关系表
（edges=概念间、note_links=笔记间、note_concepts=笔记↔概念），且仅存 id 对。

## Decision

### 1. 节点 = 类型化实体（Entity），而非文件

```
EntityType v1  = note | concept
EntityType 预留 = code_symbol | formula | person | resource   # Phase 5 启用
```

- note 实体 ↔ `workspace/vault/*.md`（正文真相在外部文件，DB 只存元数据）
- concept 实体是第一等公民：可独立存在，不必依附任何笔记

### 2. 关系统一进单张 `links` 表（多态端点）

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,      -- 'note'|'concept'
  source_id   INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  relation    TEXT NOT NULL,      -- wikilink|mentions|requires|related|
                                  -- contains|contrasts_with|derived_from|implements...
  origin      TEXT NOT NULL DEFAULT 'manual',  -- manual|markdown|ai_suggested|accepted
  weight      REAL NOT NULL DEFAULT 1.0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, target_type, target_id, relation)
);
```

取代并 DROP 三张旧表（均为空表，发布前窗口期）。多态端点不设外键，
完整性由 Core 层维护：删除任一实体时必须级联清理其全部 links。

### 3. `[[wiki链接]]` 解析规则（M2-A 实现）

```
输入 [[标题]]
 ① 命中 concepts.title 或 aliases → link(note → concept, relation='mentions')
 ② 命中 notes.title              → link(note → note,    relation='wikilink')
 ③ 未命中                        → 自动创建 Concept(标题, origin='manual')
                                   并建 mentions 边（图谱随书写自然生长）
重名冲突（note 与 concept 同名）→ 解析优先级 note > concept，并在 UI 标注歧义
```

### 4. 附件路径政策（随本 ADR 一并冻结）

- 媒体只能经上传接口进入 `workspace/attachments/`（uuid 名）
- Markdown 只允许相对 URL `/api/v1/attachments/<name>`；
  **禁止绝对盘符路径（`C:\...`）、`file://`、外部临时 URL 作为长期引用**
- 写入时由 Core 校验拒绝（M2-A 实现）

### 5. 分层铁律（Graph Rendering Separation）

```
Graph UI (React Flow)  —— 只渲染，永远不变成图引擎
Graph Core             —— 拥有 nodes/edges/relations 与全部图计算（Core 层）
Layout Engine          —— 独立模块（M3b 才引入 d3-force）
业务逻辑               —— 只在 backend/core
```

## Alternatives Considered

| 备选 | 否决理由 |
|---|---|
| Node = Note（Obsidian 式） | 概念无法脱离文件存在，Learning Graph 无从谈起 |
| 仅存字符串标题的链接表 | 无法承接掌握度/学习事件的多态关联，M3 必返工 |
| 立即建统一 entities 大表合并 notes+concepts | 过度设计：两类实体字段差异大，当前两表+多态 links 已满足；待第三种实体（code_symbol）落地时再评估 |
| dagre / elkjs 布局库 | M2 只需默认布局；d3-force 已批且排期 M3b |

## Consequences

- 删除实体必须显式清理 links（core 层实现，测试覆盖孤儿清理）
- 多态查询 SQL 稍复杂（带 type 条件）；换取未来实体零改表扩展
- FTS/掌握度等其他子系统不受影响；M3 的 Learning Graph 直接长在 links 上
