# Sync Model

> M7 同步模型文档。ADR-005/020 冻结。

## 三层真值模型（ADR-020）

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

## 同步范围

### 白名单（SYNC_PATTERNS）
- `vault/**/*.md`
- `metadata/eventlogs/**/*.jsonl`
- `mind_maps/**/*.mindmap.json`

### 黑名单（SYNC_BLACKLIST）
- `db/` — SQLite 数据库
- `metadata/devices.json` — 设备标识

## 同步流程

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

## 冲突解决策略

| 文件类型 | 策略 | 说明 |
|---|---|---|
| vault/*.md | 保留双份 + 手动合并 | 用户决定 |
| eventlogs/*.jsonl | Append-only + event id 去重 | 自动合并 |
| mind_maps/*.mindmap.json | Last-Write-Wins (v1) | updated_at + device_id |

## 幂等性保证

- 扫描：相同 workspace → 相同 Manifest（忽略 mtime 微小差异）
- Diff：相同 Manifest 对 → 相同 SyncPlan
- 事件日志：按 event id 去重，重复导入不产生重复事件

## Apply 层（M7-004，core/sync/apply.py）

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

### 分文件语义

| 类型 | 策略 | ApplyAction |
|---|---|---|
| vault/**/*.md | 相同则跳过 · 不同/新建则 LWW 原子替换 | WRITTEN / SKIPPED |
| metadata/eventlogs/*.jsonl | append merge + event_id 去重 | MERGED |
| mind_maps/*.mindmap.json | LWW + `.local.json` 冲突备份 | CONFLICT_BACKUP / WRITTEN |
| 校验失败（任何类型） | 拒绝且不落盘 | REJECTED |

### 确定性（Deterministic Apply）

Apply 不读墙钟、不生成时间戳、不做随机决策。同一输入集对相同初始状态
apply 两次，workspace 字节级一致——这是 LAN 多设备与失败重试正确性的前提。

## 边界与恢复（M7-004.5 审计冻结）

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
