# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · ADR-020 完成，准备 M7

---

## Task ID

M7 LAN Sync（准备阶段）

## Goal

实现局域网文件同步，基于 ADR-005 + ADR-020 冻结的 Truth Model。

关键约束：
- 同步只发生在 Layer 1（vault / eventlog / mindmap 文件）
- SQLite 永不同步，各设备本地重建
- Events append-only，按 event id 幂等去重
- MindMap last-write-wins（updated_at + device_id）
- 冲突保留双份 + 用户手动合并

## 前置条件

- create_note 原子写入（P2，M7 前必须解决）
- eventlog 文件格式验证
- mindmap 文件同步格式验证

## Forbidden

- SQLite 直接同步
- 自动合并 Markdown
- CRDT（触发条件未达）
- 云端中转
