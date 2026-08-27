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
