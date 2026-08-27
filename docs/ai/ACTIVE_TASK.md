# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M7-003.5 Doc Sync Audit 完成（commit 6067332）· M7-004 已批准待开工

---

## Task ID

**M7-004 Sync Apply Layer + Boundary Audit**

## Status

READY（用户已批准，带 4 条冻结规则）

前置条件已满足：
- ADR-005 / ADR-020 / ADR-021 / ADR-022 ✅
- P2 create_note atomic write ✅
- M7-001 / Stabilization / Nightly Audit / M7-001.5 / M7-002 / M7-003 ✅
- M7-003.5 Documentation & Architecture Sync Audit ✅（commit 6067332）
- pytest 327 passed · vite build PASS · vitest 2 passed（实测于 6067332）

---

## 目标

实现安全同步落盘层：`server/app/core/sync/apply.py`，SyncPlan → ApplyResult。

## 冻结规则（用户制定，开工前不得违反）

### Rule 1：Apply 必须是唯一写入口
- 禁止 transport.py 直接 open()/write() 落盘
- 结构：`Transport → apply.py(SyncApply) → atomic_write_file → workspace`
- core/sync 保持 stdlib-only（无 fastapi/sqlite/router），M7-003.5 审计基线不得回退

### Rule 2：Apply 双重校验（不信任 remote）
```
receive FileData → validate path → validate hash → is_syncable 复检 → atomic write
```
- remote 声称的 hash 不作数，必须对收到的字节重算
- 拒绝：db/、settings、metadata/devices.json、路径穿越 ../、绝对路径

### Rule 3：eventlog 追加合并（禁止 LWW / replace）
- `eventlogs/*.jsonl` 是 append-only truth（ADR-020）：local + remote → 按 event id 去重 → merged
- **命名钉死：去重键统一叫 `event_id`**（与 docs/sync/conflict-resolution.md、recovery-guide.md 一致；
  learning-model.md 的 `event_uuid` 指 DB 列名——DB 尚无此列，M7-004 不建列、不改 DB，
  jsonl 层一律 event_id。如需统一术语另开 micro-task）

### Rule 4：mindmap LWW + conflict copy
- `mind_maps/*.json` 允许 LWW（updated_at + device_id），但冲突时保留双份：
  `<name>.local.json` / `<name>.remote.json`，主文件为胜者——用户布局不可静默丢失（ADR-019 用户空间）

## 分文件语义

| 类型 | 策略 |
|---|---|
| vault/*.md | LWW + 原子替换 |
| metadata/eventlogs/*.jsonl | append merge + event_id 去重 |
| mind_maps/*.json | LWW + conflict backup |

## 测试要求（新增 ≥43 个，目标 pytest 370+）

- TestApplyMarkdown：overwrite / atomicity / hash check
- TestApplyEvents：merge / dedupe / empty / 乱序行
- TestApplyMindMap：lww / conflict copy 命名
- TestSecurity：reject db / reject settings / reject devices.json / reject `../` traversal
- 边界回归：core/sync 八模块 import 扫描仍 stdlib-only

## Allowed

- server/app/core/sync/apply.py（新建）
- server/tests/api/test_sync_apply.py 或 tests/ 下对应新测试文件
- docs/sync/sync-model.md 补 Apply 节；docs/data-model/INDEX.md 变更行；CURRENT_STATE / CHANGELOG / TASKS 回填

## Forbidden

- 修改 ADR-020 / Truth Model / Discovery / Transport 协议
- 修改 diff.py manifest.py scanner.py messages.py transfer.py transport.py 既有逻辑
- 触碰 SQLite / learning_events 表结构 / mastery 逻辑
- routers/ 新增 sync HTTP 层（归 M7-004 之后，本任务不含）

## Acceptance

1. pytest 370+ 全绿 · npx vite build pass · vitest 通过
2. 四条冻结规则各有对应测试证明
3. 文档同步义务完成（AGENTS §10）

## 下一步队列（本任务之后）

M7-004.5 Sync Security Audit → M7-005 Conflict UI → M7-006 End-to-end LAN Demo
