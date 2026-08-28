# Sync Transport Layer

M7-003 同步传输层文档。M7-006 补齐 server 侧端点并完成真实两进程验证。

## HTTP 端点（M7-006 起）

| 端点 | 方向 | 说明 |
|---|---|---|
| GET /api/v1/sync/files/{path} | B→A serve | 返回 FileData JSON；serve_file 白名单校验，缺失返回 SyncError |
| POST /api/v1/sync/receive | A→B receive | FileData JSON 入站；**强制经 SyncApply 落盘**，应答 FileAck |

Rule 1 铁律在传输场景同样成立：receive 端落盘只经 SyncApply
（白名单复检 + 字节级 hash 重算 + fail-closed），不出现 Router→write_file。

## 概述

Transport 层负责将 SyncPlan（由 diff_manifests 生成）变成可执行的文件交换。

**职责：** 执行 SyncPlan 的文件传输。  
**不负责：** 冲突解决 / Manifest 生成 / Diff 计算 / mastery 修改。

## 数据流

```
Scanner → Manifest → Diff → SyncPlan → Transport → Remote Files
                                    ↓
                              SyncResult
```

## 文件结构

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

## 消息协议（messages.py）

### 消息类型

| 类型 | 方向 | 用途 |
|---|---|---|
| FileRequest | A → B | 请求对端发送指定文件 |
| FileData | B → A | 响应文件内容（base64 编码） |
| FileAck | A → B | 确认文件已接收 |
| SyncError | 任一 | 传输失败通知 |

### 消息格式

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

### 错误码

| 错误码 | 含义 |
|---|---|
| file_not_found | 文件不存在 |
| hash_mismatch | 内容哈希不匹配 |
| path_not_syncable | 路径不在同步白名单 |
| permission_denied | 权限不足 |
| write_failed | 写入失败 |
| network_error | 网络错误 |
| plan_conflict | SyncPlan 中有冲突项 |

## 文件操作（transfer.py）

### 白名单（ADR-020）

允许同步：
- `vault/**/*.md`
- `metadata/eventlogs/**/*.jsonl`
- `mind_maps/**/*.mindmap.json`

禁止同步：
- `db/`（SQLite）
- `metadata/devices.json`（设备身份）
- 其他所有路径

### 原子写入

所有文件写入使用原子写入：

```
write → fsync → rename
```

确保不会产生半写文件或临时文件残留。

### 路径匹配

使用递归路径匹配（`_path_matches`），支持 `**` 通配符，与 scanner.py 一致。

## 传输协调器（transport.py）

### SyncTransport API

```python
class SyncTransport:
    def execute_plan(plan, local_workspace, peer_url=None) -> SyncResult
    def serve_file(workspace, path) -> FileData | SyncError
    def receive_incoming(workspace, file_data) -> FileAck
```

### 本地模式（peer_url=None）

当 `peer_url=None` 时，Transport 在本地模式运行：
- UPLOAD：读取本地文件，返回 TransferResult
- DOWNLOAD：返回占位结果
- CONFLICT：标记为 deferred
- SKIP：标记为 skipped

用于测试和模拟。

### HTTP 模式

当 `peer_url` 指定对端地址时：
- UPLOAD：通过 HTTP POST 发送文件到 `{peer_url}/api/v1/sync/receive`
- DOWNLOAD：通过 HTTP GET 从 `{peer_url}/api/v1/sync/files/{path}` 获取文件

### SyncResult 结构

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

## 安全边界

### 允许

- ✅ 读写 vault/*.md
- ✅ 读写 eventlogs/*.jsonl
- ✅ 读写 mind_maps/*.mindmap.json
- ✅ 验证内容哈希
- ✅ 原子写入

### 禁止

- ❌ 访问 db/（SQLite）
- ❌ 访问 metadata/devices.json
- ❌ 修改 mastery / review_queue
- ❌ 冲突解决（CONFLICT 项留给 M7-005）
- ❌ 文件监听 watcher
- ❌ 后台常驻服务
- ❌ 云同步
- ❌ 加密/账号体系

## M7 边界

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
