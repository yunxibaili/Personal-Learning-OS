# Active Task

> AI 工作记忆：当前正在做什么。

---

## Task ID

M3b-002 Universe Layout Engine

## Goal

前端 d3-force + React Flow 布局。
Backend 已完成（GET /universe），下一步是前端渲染。

## Boundary

- Graph API / mastery.py 不修改
- 新增 universe projection layer（已完成 M3b-001）
- d3-force 只做布局计算（ADR-007）
- React Flow 做渲染（ADR-013）

## Forbidden

- Knowledge Radar — M3.5-A 已冻结
- Tutor — M4 已冻结
- Learning Event schema — frozen
- 3D / 粒子 / 星空 / 游戏化
