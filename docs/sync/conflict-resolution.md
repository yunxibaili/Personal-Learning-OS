# Conflict Resolution

> M7 冲突解决策略。ADR-020/021 冻结。

## 冲突类型

### Type 1: Vault 冲突

两个设备都修改了同一个 `vault/*.md` 文件。

**策略**：保留双份 + 用户手动合并。

```
vault/note.md          ← 设备 A 的版本
vault/note_[conflict].md  ← 设备 B 的版本（待合并）
```

**原因**：Markdown 内容冲突无法自动解决，强制用户参与。

### Type 2: EventLog 冲突

两个设备都产生了学习事件。

**策略**：Append-only + event id 幂等去重。

```
eventlog.jsonl:
  {"event_id": "abc", ...}  ← 设备 A 产生
  {"event_id": "def", ...}  ← 设备 B 产生
  {"event_id": "abc", ...}  ← 重复，跳过
```

**原因**：事件是只追加的，合并就是拼接 + 去重。

### Type 3: MindMap 冲突

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

## 未来演进

- v2: CRDT 用于 MindMap（需要 ADR）
- v2: 三方合并用于 Vault（需要 ADR）
- 当前：简单策略 + 用户干预
