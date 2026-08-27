# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · 项目审查后准备 M2b-002

---

## Task ID

M2b-002 Concept Binding（准备阶段）

## Goal

MindMap 节点关联已有 Concept。

关键约束（ADR-019）：
- 概念绑定是引用，不是复制
- 不自动创建 mastery
- 不自动写 learning_event
- 不改 concept / graph relation

## Boundary

- MindMap 节点 concept_id 已在 schema 中（006_mindmap.sql）
- 前端 MapNode 已有 concept badge 显示
- 需要：选择 Concept 的 UI + 关联 API

## Forbidden

- 自动创建 mastery
- 自动写 event
- 改 concept 属性
- 改 graph relation
- 从 Universe 自动生成 MindMap

## 前置建议

M2b-002 开始前做 MindMap Boundary Audit：
检查 ADR-019 五条铁律是否被意外违反。
