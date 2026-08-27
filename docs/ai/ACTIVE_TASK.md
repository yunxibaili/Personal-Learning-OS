# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-27 · M7-006 E2E LAN Demo 规划草案，等待用户确认后开工

---

## Task ID

**M7-006 End-to-End LAN Demo**（证明链路，不是新功能）

## Status

DRAFT — 三阶段计划待用户确认

目标（用户冻结）：两个真实进程通过真实网络完成一次完整同步。
不修改 ADR-020 / Apply 语义 / Transport 协议；只证明链路。

## 规划前核实发现的两个缺口（Phase 3 必须补的最小件）

1. **serve 端不存在**：transport.py 客户端请求 `{peer}/api/v1/sync/files/{path}`，
   但全仓没有任何路由实现该端点——FileData 拉取会 404
2. **receive 端不存在 + sha 死代码**：`_http_send` 的 sha256 字段是永远为 ""
   的死代码（`if False else ""`），且对端无接收入口
   → Phase 3 需新增 `GET /sync/files/{path}`（serve，走 transfer.read_file_bytes +
   is_syncable 校验）与 `POST /sync/incoming`（receive，**必须经 SyncApply 落盘**，
   延续唯一写入口铁律）。这不是重构，是把链路最后一节接上；
   `_http_send` 的 sha 字段顺带修正为真实值（一行）

## Phase 1：双 workspace runner（无网络）

- 扩展 tests/integration/sync/ 双设备 harness（M7-001.5 DualWorkspace 已有雏形）：
  每 device 独立 workspace/device_id/manifest/sync core 实例
- 产出可复用的 runner：run_sync_cycle(a_ws, b_ws) =
  scan→diff→(未来: transport)→apply

## Phase 2：四场景逻辑证明（仍无 socket）

| Case | 内容 | 断言 |
|---|---|---|
| 1 | A 建 python.md，单向同步 | B 出现该文件，字节一致 |
| 2 | A 建 math.md + B 建 physics.md 双向新增 | 双方都有两文件 |
| 3 | A event1 + B event2 | 双方合并后 events 一致、event_id 去重 |
| 4 | mindmap 冲突 → resolve keep_local | 备份清空、双方主文件=选择版 |

Case 4 的 resolve 在无 UI 进程里直接调 resolve_conflict（用户动作的等价物）。

## Phase 3：真实 socket 两进程

- 新增 routers/sync 的 serve/receive 两端点（见缺口清单；上传方向强制走
  SyncApply——Rule 1 不豁免）
- 本机回环模拟 LAN：Device B 起 uvicorn（127.0.0.1 随机端口），
  Device A 用 SyncTransport.execute_plan(peer_url=...) 全链路：
  UDP discovery 可达性验证（discovery 已有单测；本环节以 transport+apply 为主）
- 覆盖 recovery：传输中 kill 对端 → 重试 → 最终一致
- 验收断言：A/B workspace 的 Layer 1 文件字节级一致

## Forbidden（继承 + 用户补充）

❌ 登录 / 配对 UI / 手机端 / 云同步 ❌ 自动后台同步 / daemon 常驻
❌ 改 ADR-020 / Apply 语义 / Transport 协议消息格式
❌ UI 变更（Phase 3 也不碰前端）

## Acceptance

pytest 自然增长（预估 +15~25）· vite build PASS · vitest PASS · git clean
每个 Case 有独立测试函数；Phase 3 标记 network 相关测试可在 CI 缺席时 skip。
