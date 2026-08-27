# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M7-005 Conflict UI 完成

---

## Task ID

（无活跃任务 — M7-005 已完成，等用户指定下一个任务）

## Status

M7-005 Conflict UI ✅（方案 a：冲突源仅 mindmap artifacts）

- core/sync/status.py + routers/sync.py + SyncStatusPanel + shared/types/sync.ts
- pytest 373→390 passed · vite build PASS · vitest 2 passed
- 备份命名推导偏差被测试先行抓出并修正（math.local.json vs math.mindmap.json.local.json）

## 下一步队列

1. **M7-006 End-to-end LAN Demo**
2. M7-007 Vault Conflict Preservation（apply.py vault 分支双份机制 + ADR-020 更新）
3. 挂起：Data Model Terminology Cleanup（event_id/event_uuid 术语统一）
