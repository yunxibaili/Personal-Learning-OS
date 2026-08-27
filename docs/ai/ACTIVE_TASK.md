# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M2b-002 完成，准备 M2b-003

---

## Task ID

M2b-003 Export/Import（准备阶段）

## Goal

MindMap 的导入导出能力。

关键约束：
- 导出 = JSON 序列化（nodes + edges + concept_id 引用）
- 导入 = 重建 Map + nodes + edges（不创建 concept，只引用）
- 不改 mastery / learning_events
- concept_id 是引用，导入时必须已存在

## Boundary

- 导出格式：标准 JSON（含 map metadata + nodes + edges）
- 导入验证：concept_id 引用必须已存在，否则跳过绑定
- 不支持跨设备自动同步（M7 时处理）

## Forbidden

- 自动创建 concept
- 自动修改 mastery
- 自动产生 learning_event
- 跨设备自动同步
