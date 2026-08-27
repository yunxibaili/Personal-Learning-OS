# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · P8-001A Concept Foundation 完成

---

## Task ID

P8-001B Universe V2 Layout（可以开始）

## Status

P8-001A Concept Foundation ✅

已完成：
- `/api/v1/concepts` CRUD（GET/POST/PATCH，无 DELETE）
- Concept 来源唯一事实字段 `origin`（source_type 方案废弃，BLOCK 裁决落地）
- `core/concepts.py` 纯 Core 层；创建 concept 不产生学习状态副作用
- seed_demo.py 35 个纯概念（五域）+ origin=manual
- ADR-023 Visualization Boundary 冻结
- pytest 425 passed · vitest 2 passed · vite build PASS

## 已完成前置

- ADR-008 知识图谱模型冻结
- ADR-018 Knowledge Universe Design
- ADR-019 MindMap Boundary
- ADR-020 Sync Truth Model 冻结
- ADR-022 Product Mode Boundary 冻结
- M7-001~006.5 同步系统完整

## P8-001B 范围（下一步）

- d3-force + domain 中心吸引聚类（ADR-007/023）
- auto-fit 首屏聚焦
- Legend 升级（mastery/review/weak/importance）
- 暂缓：dagre/d3-hierarchy（P8-002）

## 长期沟通规则

所有回复必须使用中文（状态/审计/提交说明/风险/TODO/验收报告）；
代码、文件路径、commit hash 保持英文。

## 路线（P8 后续）

P8-001C Universe Interaction → P8-004 Demo Cleanup → P8-002 Graph V2 → P8-003 Unified Home
