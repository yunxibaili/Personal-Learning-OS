# Sync Boundary Final Audit Report（M7-006.5）

> 审计日期：2026-08-27 · 基线：e75a16a · 方法：AST 全量扫描（import + Call 节点）
> 结论：**PASS（附三处已定性例外）**

## 1. 模块清单与扫描结果

| 模块 | 行数 | 三方依赖 | 违规导入 | 文件系统动作 |
|---|---|---|---|---|
| apply.py | 290 | 无 | 无 | 无（统一走 transfer.write_file_atomic） |
| device.py | 87 | 无 | 无 | mkdir/write_text —— **例外 E-1** |
| diff.py | 179 | 无 | 无 | 无 |
| discovery.py | 195 | 无 | 无 | 无 |
| manifest.py | 112 | 无 | 无 | open("rb") 只读哈希 —— **例外 E-2** |
| messages.py | 177 | 无 | 无 | 无 |
| protocol.py | 160 | 无 | 无 | 无 |
| scanner.py | 113 | 无 | 无 | 无 |
| status.py | 165 | 无 | 无 | unlink —— **例外 E-3** |
| transfer.py | 166 | 无 | 无 | （唯一 IO 核模块，write_file_atomic 所在地） |
| transport.py | 352 | 无 | 无 | 无（M7-004.5 起 AST 级测试锁定） |

## 2. 三处例外的定性

| # | 位置 | 动作 | 定性 |
|---|---|---|---|
| E-1 | device.py `load_or_create_device` | 创建 `metadata/devices.json` | 合规：设备自身身份文件属 **ADR-020 Layer 3**（永不同步），不在 Rule 1 管辖范围（该规则约束"远端数据进入 workspace"） |
| E-2 | manifest.py `file_sha256` | `open(path,"rb")` 只读 | 合规：纯读取，无写入 |
| E-3 | status.py `resolve_conflict` | 删除冲突 sidecar artifact | 合规：M7-005 用户批准的裁决动作；删除的是 Apply 产物备份，非 Truth Source 内容 |

## 3. 边界不变量确认

- `core/sync/*` 零三方依赖（stdlib only），项目内依赖仅 `rel:` 相对导入
- HTTP 触达点仅 routers/sync.py，且 Router→core 代理、无直接文件/DB 访问
- 落盘唯一入口：`transfer.write_file_atomic`（原子写 write→fsync→rename）
- 永久回归护栏：
  - `tests/unit/test_sync_apply.py::TestSyncCoreBoundaryAudit`（stdlib-only 扫描）
  - `tests/unit/test_sync_boundary_audit.py::TestTransportBoundary`（AST 落盘动作扫描）

## 4. 后续审计触发条件

新增 sync 模块 / 引入任何 import / 出现新持久化路径时重跑本扫描；
建议 M7-007 与 P8 各执行一次。
