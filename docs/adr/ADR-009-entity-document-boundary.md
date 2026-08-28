# ADR-009: Entity vs Document Boundary（实体与文档边界）

日期：2026-08-26 · 状态：Accepted（约束 M2 起全部实现）

## Context

`高斯消元.md` 里写着 高斯消元、矩阵、行变换——**这些才是知识对象**；
.md 文件只是承载它们的纸。若不划清边界，AI Tutor 会退化成"关键词搜笔记"，
而不是"理解用户学到什么"。

## Decision

1. **Markdown = 内容载体（Document）**：用户书写与阅读的界面单元，可删可改
2. **Entity = 知识对象（Knowledge Object）**：图谱节点，类型化
   （v1: note|concept；预留 code_symbol|formula|person|resource，见 ADR-008）
3. 抽取方向恒定单向：`Markdown --extract--> Entity Graph`，永不反向生成内容
4. Concept 可以独立于任何笔记存在（AI 桩、UpMark 导入均合法）
5. 删除笔记 ≠ 删除其提及的 Concept；但必须级联清理指向它的 links（Core 层实现）
6. **Tutor 与一切检索面向 Entity + Learning Memory**，文件全文搜索只是辅助入口
7. 命名空间重叠策略沿用 ADR-008：[[标题]] 解析优先级 note > concept，UI 标注歧义

## Alternatives Considered

- Node = Note（Obsidian 式）：概念无法脱离文件，Learning Graph 无从构建
- 不做区分、边表直接存字符串标题：多态实体无法承接掌握度/事件，M3 必返工

## Reason

保护核心差异化："AI 知道你学什么"依赖实体级记忆，文件级记忆做不到。

## Consequences

- 搜索产品同时存在两个入口：FTS 文本搜索（找回笔记）与实体检索（找知识）——二者语义不同
- 实体孤儿清理逻辑成为 Core 必测项
