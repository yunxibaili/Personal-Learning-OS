# Sync — 多端同步系统

> 同步系统设计与操作指南。合并自原 `docs/sync/` 下的多份文档。
冻结契约见 `adr/ADR-005-multi-device-sync.md` 与 `adr/ADR-020-sync-truth-model.md`。

---

## 目录

1. [Sync Model](#1-sync-model)
2. [Sync Transport Layer](#2-sync-transport-layer)
3. [Conflict Resolution](#3-conflict-resolution)
4. [Recovery Guide](#4-recovery-guide)
5. [Sync Boundary Final Audit Report（M7-006.5）](#5-sync-boundary-final-audit-report-m7-006-5)

---

## 1. Sync Model

> M7 同步模型文档。ADR-005/020 冻结。

### 三层真值模型（ADR-020）

```
Layer 1: Truth Source（同步层）
├── vault/*.md              ← Markdown 笔记
├── metadata/eventlogs/*.jsonl  ← 学习事件日志
└── mind_maps/*.mindmap.json    ← 思维导图结构

Layer 2: Derived State（本地重建层）
├── concepts                ← 从 vault 提取
├── links                   ← 从 wikilink 解析
├── concept_mastery         ← 从 learning_events 重建
└── review_queue            ← 从 mastery + SM-2 计算

Layer 3: Local Cache（永不同步层）
├── settings                ← 应用配置
├── API keys                ← 密钥
└── SQLite 文件             ← 本地缓存数据库
```

### 同步范围

#### 白名单（SYNC_PATTERNS）
- `vault/**/*.md`
- `metadata/eventlogs/**/*.jsonl`
- `mind_maps/**/*.mindmap.json`

#### 黑名单（SYNC_BLACKLIST）
- `db/` — SQLite 数据库
- `metadata/devices.json` — 设备标识

### 同步流程

```
设备 A                          设备 B
  │                               │
  ├── scan_workspace()            │
  │   └── Manifest A              │
  │                               ├── scan_workspace()
  │                               │   └── Manifest B
  │                               │
  ├── diff_manifests(A, B)        │
  │   └── SyncPlan                │
  │       ├── UPLOAD (A 有 B 无)   │
  │       ├── DOWNLOAD (B 有 A 无) │
  │       ├── SKIP (相同)          │
  │       └── CONFLICT (都修改)    │
  │                               │
  └── 执行 SyncPlan ──────────────┘
```

### 冲突解决策略

| 文件类型 | 策略 | 说明 |
|---|---|---|
| vault/*.md | 保留双份 + 手动合并 | 用户决定 |
| eventlogs/*.jsonl | Append-only + event id 去重 | 自动合并 |
| mind_maps/*.mindmap.json | Last-Write-Wins (v1) | updated_at + device_id |

### 幂等性保证

- 扫描：相同 workspace → 相同 Manifest（忽略 mtime 微小差异）
- Diff：相同 Manifest 对 → 相同 SyncPlan
- 事件日志：按 event id 去重，重复导入不产生重复事件

### Apply 层（M7-004，core/sync/apply.py）

远端数据进入本地 workspace 的**唯一写入口**。四条冻结规则：

1. **唯一写入口**——transport 只交字节；落盘链路固定为
   `Transport → SyncApply.apply_file → write_file_atomic → workspace`
2. **双重校验（不信任 remote）**——闸门顺序固定：
   路径规范化（拒绝对穿越/绝对路径/盘符/反斜杠）→ `is_syncable` 白名单复检 →
   对收到的字节重算 SHA-256 → 分类落盘。remote 声明的哈希仅作传输层用途，
   Apply 层一律重算
3. **eventlog 追加合并**——local 全量保留 + remote 新增行按 `event_id` 幂等去重；
   缺 event_id 或 JSON 损坏的行拒绝合入；local 行数永不因 merge 减少
4. **mindmap LWW + 冲突备份**——远端胜出写入主文件；首次冲突时把本地内容
   备份为 `<name>.local.json`（已存在的备份代表更早分叉点，永不覆盖）。
   备份不在同步白名单内（设备本地私有）

术语约定：jsonl 同步契约的去重键统一叫 **`event_id`**；
`event_uuid` 是 learning-model.md 预留的 DB 列名（尚未建列），
两者如需统一归未来的 Data Model Terminology Cleanup 任务。

#### 分文件语义

| 类型 | 策略 | ApplyAction |
|---|---|---|
| vault/**/*.md | 相同则跳过 · 不同/新建则 LWW 原子替换 | WRITTEN / SKIPPED |
| metadata/eventlogs/*.jsonl | append merge + event_id 去重 | MERGED |
| mind_maps/*.mindmap.json | LWW + `.local.json` 冲突备份 | CONFLICT_BACKUP / WRITTEN |
| 校验失败（任何类型） | 拒绝且不落盘 | REJECTED |

#### 确定性（Deterministic Apply）

Apply 不读墙钟、不生成时间戳、不做随机决策。同一输入集对相同初始状态
apply 两次，workspace 字节级一致——这是 LAN 多设备与失败重试正确性的前提。

### 边界与恢复（M7-004.5 审计冻结）

- **静态边界**：transport.py 禁止任何文件系统落盘动作（AST 级扫描测试锁定）；
  mutation 只属于 apply.py，写盘只经 transfer.write_file_atomic
- **Fail-closed**：写路径任何异常（含 OSError、非法 UTF-8）都被吸收为
  REJECTED 结果，不得穿透 Apply 闸门抛给调用方
- **半写保护**：merge 计算与落盘分离——先在内存合成 merged_text，
  再单次原子替换；写失败时本地 jsonl 保持原样，重试同一输入即可完整恢复
- **崩溃残留**：`.sync_tmp_*` 临时文件残留不影响旧文件有效性，也不影响后续 apply
- **坏行保留**：eventlog 中已存在的损坏行不会被 merge 丢弃或覆盖——
  修复交给用户/recovery 流程，同步层永不静默改写历史
- **备份不可变**：mindmap 冲突的 `.local.json` 备份一经写入永不被后续 apply 覆盖

---

## 2. Sync Transport Layer

M7-003 同步传输层文档。M7-006 补齐 server 侧端点并完成真实两进程验证。

### HTTP 端点（M7-006 起）

| 端点 | 方向 | 说明 |
|---|---|---|
| GET /api/v1/sync/files/{path} | B→A serve | 返回 FileData JSON；serve_file 白名单校验，缺失返回 SyncError |
| POST /api/v1/sync/receive | A→B receive | FileData JSON 入站；**强制经 SyncApply 落盘**，应答 FileAck |

Rule 1 铁律在传输场景同样成立：receive 端落盘只经 SyncApply
（白名单复检 + 字节级 hash 重算 + fail-closed），不出现 Router→write_file。

### 概述

Transport 层负责将 SyncPlan（由 diff_manifests 生成）变成可执行的文件交换。

**职责：** 执行 SyncPlan 的文件传输。  
**不负责：** 冲突解决 / Manifest 生成 / Diff 计算 / mastery 修改。

### 数据流

```
Scanner → Manifest → Diff → SyncPlan → Transport → Remote Files
                                    ↓
                              SyncResult
```

### 文件结构

```
server/app/core/sync/
├── manifest.py      # FileEntry + Manifest（M7-001）
├── scanner.py       # 扫描 workspace 生成 Manifest（M7-001）
├── diff.py          # 对比 Manifest → SyncPlan（M7-001）
├── device.py        # DeviceInfo + 设备身份存储（M7-002）
├── protocol.py      # Discovery 通信协议（M7-002）
├── discovery.py     # 局域网设备发现（M7-002）
├── messages.py      # 同步传输消息类型（M7-003）← NEW
├── transfer.py      # 低级文件传输操作（M7-003）← NEW
└── transport.py     # 传输协调器（M7-003）← NEW
```

### 消息协议（messages.py）

#### 消息类型

| 类型 | 方向 | 用途 |
|---|---|---|
| FileRequest | A → B | 请求对端发送指定文件 |
| FileData | B → A | 响应文件内容（base64 编码） |
| FileAck | A → B | 确认文件已接收 |
| SyncError | 任一 | 传输失败通知 |

#### 消息格式

所有消息为 JSON，通过 HTTP 传输。

```json
{
  "type": "file_data",
  "path": "vault/ml.md",
  "content": "base64...",
  "sha256": "abc123...",
  "size": 1024
}
```

#### 错误码

| 错误码 | 含义 |
|---|---|
| file_not_found | 文件不存在 |
| hash_mismatch | 内容哈希不匹配 |
| path_not_syncable | 路径不在同步白名单 |
| permission_denied | 权限不足 |
| write_failed | 写入失败 |
| network_error | 网络错误 |
| plan_conflict | SyncPlan 中有冲突项 |

### 文件操作（transfer.py）

#### 白名单（ADR-020）

允许同步：
- `vault/**/*.md`
- `metadata/eventlogs/**/*.jsonl`
- `mind_maps/**/*.mindmap.json`

禁止同步：
- `db/`（SQLite）
- `metadata/devices.json`（设备身份）
- 其他所有路径

#### 原子写入

所有文件写入使用原子写入：

```
write → fsync → rename
```

确保不会产生半写文件或临时文件残留。

#### 路径匹配

使用递归路径匹配（`_path_matches`），支持 `**` 通配符，与 scanner.py 一致。

### 传输协调器（transport.py）

#### SyncTransport API

```python
class SyncTransport:
    def execute_plan(plan, local_workspace, peer_url=None) -> SyncResult
    def serve_file(workspace, path) -> FileData | SyncError
    def receive_incoming(workspace, file_data) -> FileAck
```

#### 本地模式（peer_url=None）

当 `peer_url=None` 时，Transport 在本地模式运行：
- UPLOAD：读取本地文件，返回 TransferResult
- DOWNLOAD：返回占位结果
- CONFLICT：标记为 deferred
- SKIP：标记为 skipped

用于测试和模拟。

#### HTTP 模式

当 `peer_url` 指定对端地址时：
- UPLOAD：通过 HTTP POST 发送文件到 `{peer_url}/api/v1/sync/receive`
- DOWNLOAD：通过 HTTP GET 从 `{peer_url}/api/v1/sync/files/{path}` 获取文件

#### SyncResult 结构

```json
{
  "total": 5,
  "succeeded": 3,
  "failed": 1,
  "skipped": 1,
  "conflicts": 0,
  "results": [
    {"path": "vault/a.md", "action": "upload", "success": true, "message": "sent 1024 bytes"},
    {"path": "vault/b.md", "action": "skip", "success": true, "message": "identical"}
  ]
}
```

### 安全边界

#### 允许

- ✅ 读写 vault/*.md
- ✅ 读写 eventlogs/*.jsonl
- ✅ 读写 mind_maps/*.mindmap.json
- ✅ 验证内容哈希
- ✅ 原子写入

#### 禁止

- ❌ 访问 db/（SQLite）
- ❌ 访问 metadata/devices.json
- ❌ 修改 mastery / review_queue
- ❌ 冲突解决（CONFLICT 项留给 M7-005）
- ❌ 文件监听 watcher
- ❌ 后台常驻服务
- ❌ 云同步
- ❌ 加密/账号体系

### M7 边界

```
M7-001  Sync Core (scanner + diff)         ✅
M7-001.5 Simulation                        ✅
M7-002  Discovery (UDP broadcast)          ✅
M7-003  Transport (file exchange)          ✅ ← 当前
M7-004  Vault Sync Apply (落盘逻辑)        待定
M7-005  Conflict Resolution UI             待定
```

M7-003 只做传输，不做落盘决策。M7-004 将处理：
- 接收文件的落盘时机
- 文件覆盖策略
- 本地修改保护

---

## 3. Conflict Resolution

> M7 冲突解决策略。ADR-020/021 冻结。

### 冲突类型

#### Type 1: Vault 冲突

两个设备都修改了同一个 `vault/*.md` 文件。

**策略**：保留双份 + 用户手动合并。

```
vault/note.md          ← 设备 A 的版本
vault/note_[conflict].md  ← 设备 B 的版本（待合并）
```

**原因**：Markdown 内容冲突无法自动解决，强制用户参与。

#### Type 2: EventLog 冲突

两个设备都产生了学习事件。

**策略**：Append-only + event id 幂等去重。

```
eventlog.jsonl:
  {"event_id": "abc", ...}  ← 设备 A 产生
  {"event_id": "def", ...}  ← 设备 B 产生
  {"event_id": "abc", ...}  ← 重复，跳过
```

**原因**：事件是只追加的，合并就是拼接 + 去重。

#### Type 3: MindMap 冲突

两个设备都修改了同一个 mindmap。

**策略**：Last-Write-Wins v1。

```json
{
  "updated_at": "2026-08-27T12:00:00Z",
  "device_id": "device-a"
}
```

比较 `updated_at`，更新的胜出。平局时比较 `device_id` 字典序。

**原因**：思维导图是用户思考空间，冲突概率低，LWW 足够。

### 未来演进

- v2: CRDT 用于 MindMap（需要 ADR）
- v2: 三方合并用于 Vault（需要 ADR）
- 当前：简单策略 + 用户干预

---

## 4. Recovery Guide

> M7 同步恢复指南。

### 原子写入

所有 vault 文件写入使用 `atomic_write_file()`：

```
1. 写入 .tmp 临时文件
2. fsync 确保数据落盘
3. os.replace 原子替换目标文件
```

**保证**：
- 步骤 1/2 失败：目标文件不受影响
- 步骤 3 失败：文件要么完整，要么不存在
- 不会留下 `.tmp` / `.partial` / `.corrupt` 文件

### 扫描恢复

扫描器使用 `os.walk()` 遍历 workspace：

- 跳过隐藏目录（以 `.` 开头）
- 跳过黑名单目录（`db/`、`metadata/devices.json`）
- 跳过无法读取的文件（`OSError` / `PermissionError`）
- 只匹配白名单模式

**恢复**：扫描失败不会修改任何文件，可以安全重试。

### Diff 恢复

Diff 是纯计算，不修改文件：

```
Manifest A + Manifest B → SyncPlan
```

**恢复**：Diff 失败不会产生副作用，可以安全重试。

### 事件日志恢复

事件日志使用 append-only 模式：

```
每次学习事件 → 追加一行 JSON 到 eventlog.jsonl
```

**恢复**：
- 写入中断：只有完整的行才有效
- 重复导入：按 `event_id` 去重
- 文件损坏：从最后一个完整行恢复

### 常见问题

#### Q: 同步中断后怎么办？

A: 重新扫描 + 重新 diff。同步操作是幂等的。

#### Q: 文件被锁怎么办？

A: `atomic_write_file` 使用 `.tmp` 文件，不会锁定目标文件。

#### Q: 磁盘满怎么办？

A: 写入失败会清理 `.tmp` 文件。目标文件保持不变。

---

## 5. Sync Boundary Final Audit Report（M7-006.5）

> 审计日期：2026-08-27 · 基线：e75a16a · 方法：AST 全量扫描（import + Call 节点）
> 结论：**PASS（附三处已定性例外）**

### 1. 模块清单与扫描结果

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

### 2. 三处例外的定性

| # | 位置 | 动作 | 定性 |
|---|---|---|---|
| E-1 | device.py `load_or_create_device` | 创建 `metadata/devices.json` | 合规：设备自身身份文件属 **ADR-020 Layer 3**（永不同步），不在 Rule 1 管辖范围（该规则约束"远端数据进入 workspace"） |
| E-2 | manifest.py `file_sha256` | `open(path,"rb")` 只读 | 合规：纯读取，无写入 |
| E-3 | status.py `resolve_conflict` | 删除冲突 sidecar artifact | 合规：M7-005 用户批准的裁决动作；删除的是 Apply 产物备份，非 Truth Source 内容 |

### 3. 边界不变量确认

- `core/sync/*` 零三方依赖（stdlib only），项目内依赖仅 `rel:` 相对导入
- HTTP 触达点仅 routers/sync.py，且 Router→core 代理、无直接文件/DB 访问
- 落盘唯一入口：`transfer.write_file_atomic`（原子写 write→fsync→rename）
- 永久回归护栏：
  - `tests/unit/test_sync_apply.py::TestSyncCoreBoundaryAudit`（stdlib-only 扫描）
  - `tests/unit/test_sync_boundary_audit.py::TestTransportBoundary`（AST 落盘动作扫描）

### 4. 后续审计触发条件

新增 sync 模块 / 引入任何 import / 出现新持久化路径时重跑本扫描；
建议 M7-007 与 P8 各执行一次。

