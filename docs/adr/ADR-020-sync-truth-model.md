# ADR-020: Data Synchronization Truth Model

> Status: Approved · Date: 2026-08-27
> 关联：ADR-001 Storage Layer · ADR-005 Multi-device Sync · ADR-019 MindMap Boundary · M7 LAN Sync

---

## 1. Context

ADR-005 冻结了同步范围（白名单/黑名单）和协议 v1（manifest + hash + 三态判断）。
但未定义：**当两台设备同时修改同一数据域时，哪个是最终事实**。

本 ADR 定义同步冲突的 **Truth Model**，是 M7 实现的前置约束。

核心原则：

> 同步不是传文件，而是定义「多个设备产生事实后，哪个是最终事实」。

---

## 2. Decision

### 2.1 数据域分类与同步策略

| 数据域 | 载体 | 同步策略 | 冲突解决 | 说明 |
|---|---|---|---|---|
| Knowledge | `vault/*.md` | 文件同步 | last-write-wins + conflict copy | ADR-005 已定义 |
| Knowledge Metadata | `concepts` / `links` | 不同步 | 从 vault 重建 | SQLite 本地缓存 |
| Learning Events | `eventlogs/*.jsonl` | 追加合并 | append-only | 按 event id 幂等去重 |
| Mastery | `concept_mastery` | 不同步 | 从 events 重建 | 各设备独立重放 |
| Review Queue | `review_queue` | 不同步 | 从 mastery 重建 | 各设备独立重放 |
| MindMap Layout | `mind_maps` / `mind_map_nodes` / `mind_map_edges` | 文件同步 | last-write-wins | ADR-021 格式导出 |
| AI Context | `tutor_memories` / `tutor_conversations` | 不同步 | 单设备私有 | v1 不同步 |

### 2.2 三层事实模型

```
Layer 1: Truth Source（不可变事实）
  vault/*.md
  eventlogs/*.jsonl
  mind_maps/*.mindmap.json

Layer 2: Derived State（可重建状态）
  concepts → 从 vault 解析
  links → 从 vault 解析
  concept_mastery → 从 events 重放
  review_queue → 从 mastery 计算

Layer 3: Local Cache（本地缓存）
  SQLite 全部表
  settings
  API keys
```

同步只发生在 Layer 1。Layer 2 和 Layer 3 在各设备本地重建。

### 2.3 冲突解决规则

#### 2.3.1 Vault Markdown 冲突

```
Device A: note.md modified at T1
Device B: note.md modified at T2
Both synced → conflict
```

解决：
- 保留两份：`note.md`（最新修改者）+ `note.conflict.<device>.<ts>.md`
- 用户通过 UI 选择保留其一或手动合并
- 不自动合并（Markdown 合并复杂度高）

#### 2.3.2 Learning Events 冲突

Events 是 append-only，不存在覆盖冲突。

```
Device A: event {id: "a1", concept: "ML", quality: 5, ts: "2026-08-27T10:00"}
Device B: event {id: "b1", concept: "ML", quality: 2, ts: "2026-08-27T11:00"}
```

解决：
- 两事件都保留（不同 id，不冲突）
- 各设备重放完整事件序列重建 mastery
- 按 event id 幂等去重（同一事件不会重复计算）

#### 2.3.3 MindMap 冲突

MindMap 是用户编辑数据，可能产生真正的冲突。

```
Device A: node position (100, 100) at T1
Device B: node position (300, 300) at T2
```

解决 v1（last-write-wins）：
- 每个 node 记录 `updated_at` 和 `device_id`
- 同步时比较 `updated_at`，较新的覆盖较旧的
- 不做 CRDT（v1 复杂度前置违反 YAGNI）

升级条件（进入 backlog）：
- 真实多端并发编辑 MindMap 频率高到 last-write-wins 造成用户困扰
- 触发 CRDT(Yjs/Automerge) 升级

#### 2.3.4 MindMap 结构冲突

```
Device A: delete node 1
Device B: move node 1 to (300, 300)
```

解决：
- 删除优先（如果设备 A 的删除操作更新，则节点消失）
- 保留被删除节点的位置为 `conflict.deleted` 日志，便于恢复

### 2.4 SQLite 重建协议

各设备收到同步文件后：

```
1. vault/*.md 更新 → 重新解析 → 更新 concepts / links 表
2. eventlogs/*.jsonl 追加 → 重放 events → 更新 concept_mastery → 重建 review_queue
3. mind_maps/*.mindmap.json 更新 → 更新 mind_map_nodes / mind_map_edges 表
```

永远不直接同步 SQLite 文件。

### 2.5 设备注册与身份

```
metadata/devices.json
{
  "devices": [
    {
      "id": "device-a",
      "name": "Desktop",
      "created_at": "2026-08-27T00:00:00Z",
      "last_seen": "2026-08-27T12:00:00Z"
    }
  ]
}
```

- 每设备启动时生成唯一 device_id（UUID）
- device_id 写入 eventlog 和 mindmap node 的 `device_id` 字段
- 用于冲突解决时的 last-write-wins 比较

---

## 3. Consequences

### 正面

- 事实层次清晰：Truth Source → Derived State → Local Cache
- 冲突解决规则明确，不需要猜测
- SQLite 永远不进入同步，避免双主写冲突
- Events append-only，天然支持多设备并发
- MindMap last-write-wins v1 足够简单

### 负面

- MindMap last-write-wins 可能丢失用户编辑（v1 限制）
- Vault 冲突需要用户手动合并
- 重建操作需要计算时间（大知识库可能慢）

### 风险

- eventlog 文件增长（需要归档策略）
- 多设备时钟不同步可能影响 last-write-wins 判断

---

## 4. Implementation Notes

### M7 实现范围

1. 文件同步协议（ADR-005 已定义）
2. eventlog 追加合并 + 幂等去重
3. mindmap last-write-wins（updated_at + device_id）
4. SQLite 重建触发器
5. 冲突 UI（conflict copy 列表）

### 不在 M7 范围

- CRDT（触发条件见 2.3.3）
- WebSocket 实时推送
- 云端中转
- 自动合并

---

## 附录 §2.1.1：MindMap 冲突备份追认（2026-08-28 修订）

§2.1 表中 MindMap 行的「last-write-wins」为 M7 决策时的判断，**原文保持不动**。

M7-004 Sync Apply Layer 实施时，`apply.py _apply_mindmap()` 在 LWW 基础上
追加了**首次冲突备份**：本地版本先落 `mind_maps/<name>.local.json`
（已存在的备份代表更早分叉点，永不覆盖），远端胜者写主文件。
本附录追认该实现为 ADR-020 合规行为——Layer 1/2/3 划分与同步范围未变，
仅细化 MindMap 文件类别的冲突处理细节。

---

## 附录 §2.1.2：vault 冲突副本与同步白名单（2026-08-29 · M7-007 · 方案 a）

vault 冲突处理从 LWW 升级为「远端胜者写主文件 + 本地版进 `<name>.md.conflict`
副本」（副本已存在 = 更早分叉点，永不覆盖；apply.py `_apply_lww` 实现）。

**副本不参与同步**：`.conflict` 后缀不在 SYNC_PATTERNS 白名单（`vault/**/*.md`）
内——天然隔离，避免副本跨设备增殖。选择此方案（a）而非显式修改白名单（b），
因后者属于实现细节超出本 ADR 原文描述，按裁决判据应开 ADR-024；方案 a
不动白名单，零流程成本。status v1 的冲突列表仍仅派生 mindmap 源，
vault .conflict 列出为后续增量。
