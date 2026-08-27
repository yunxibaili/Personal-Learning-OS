# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M7-Nightly Audit 完成

---

## Task ID

M7-003 Vault Sync（可以开始）

## Status

M7-002 LAN Discovery ✅

前置条件已满足：
- ADR-005 Multi-device Sync ✅
- ADR-020 Sync Truth Model ✅
- ADR-021 MindMap Exchange Format v1 ✅
- ADR-022 Product Mode Boundary ✅
- P2 create_note atomic write ✅
- M7-001 Sync Engine Core ✅
- M7-001 Stabilization Audit ✅
- M7-Nightly Full Audit Sprint ✅
- M7-001.5 Sync Simulation ✅
- M7-002 LAN Discovery ✅

## 下一步

1. ~~M7-001 Sync Engine Core~~ ✅
2. ~~M7 Stabilization~~ ✅
3. ~~M7-Nightly Audit~~ ✅
4. ~~M7-002 LAN Discovery~~ ✅
5. M7-003 Vault Sync
6. M7-004 Event Sync
7. M7-005 Conflict UI

## 关键约束

- 同步只发生在 Layer 1（vault / eventlog / mindmap 文件）
- SQLite 永不同步，各设备本地重建
- Events append-only，按 event id 幂等去重
- MindMap last-write-wins（updated_at + device_id）
- 冲突保留双份 + 用户手动合并
