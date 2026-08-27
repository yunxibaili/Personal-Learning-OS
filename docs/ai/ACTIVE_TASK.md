# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M7 完成，进入 P8

---

## Task ID

P8-001A Concept Foundation（执行中）

## Status

M7 同步系统完整 ✅
- M7-001~006.5 全部完成
- 397 tests passed
- E2E LAN Demo 验证通过

进入 P8 Product Experience Polish。

前置条件已满足：
- ADR-008 知识图谱模型冻结
- ADR-018 Knowledge Universe Design
- ADR-019 MindMap Boundary
- ADR-022 Product Mode Boundary
- Sync Truth Model (ADR-020) 冻结

## P8-001A 范围

Backend:
- 新增 `/api/v1/concepts` (GET/POST/PATCH)
- concepts 表添加 `source_type` 列 (note/manual/generated)
- 核心业务逻辑：创建 concept 不产生 learning_event/mastery/review/links

Data:
- seed_demo.py 增强：30+ concepts，多层级 domain（ML/Optimization/Models/Attention）
- 修正 concept/note 边界问题（梯度下降等纯概念不再产生同名笔记）

Test:
- TestConceptCRUD (create/list/detail/patch)
- Boundary test: 确认创建 concept 不产生 learning_event/mastery/review_queue/links

Docs:
- ADR-023 Visualization Boundary
- CURRENT_STATE.md 里程碑更新
- TECH_DESIGN §9 标记 Implemented

## 下一步（P8-001A 完成后）

P8-001B Universe Layout (d3-force + domain clustering)
P8-001C Universe Interaction (hover/sidebar/search)
P8-004 Demo Cleanup
P8-002 Graph V2
P8-003 Unified Home

### ⏸ 视觉语言 Gate（用户裁定，勿提前触发）

**P8-001B 完成后**由用户宣布进入 **P8-FE-001 Visual Language Polish**
（MiMo 克制感：#FAFAF7 纸感底 · 低饱和四状态色 · "知识地图"而非星空——
完整范围与配色表见 docs/tasks/TASKS.md §P8 任务链规划）。
此前禁止做颜色/视觉微调；执行前需过 ADR-013 最小附录（仅 CSS 变量值）。