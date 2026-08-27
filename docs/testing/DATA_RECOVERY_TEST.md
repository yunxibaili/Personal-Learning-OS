# Data Recovery Test

> 数据恢复测试方案。验证「Markdown = Truth, SQLite = Projection」架构的健壮性。

---

## 原理

```
workspace/
├── vault/           ← Markdown 真相（永不删除）
├── attachments/     ← 附件（永不删除）
├── metadata/eventlogs/  ← 事件日志（永不删除）
└── db/learning-os.db    ← 可重建的投影
```

删除 DB → 重启 → DB 自动重建 → 数据恢复。

---

## Case 1: DB 重建（Gate 0）

**测试文件**: `server/tests/test_recovery.py`

流程:
```
1. 创建 workspace
2. 写入: note, concept, link, event
3. 删除: learning-os.db
4. 重启 app（TestClient 重新初始化）
5. 验证: note 存在, concept 存在, link 存在
```

**预期**: 所有数据从 vault + metadata 重建。

---

## Case 2: Mastery 重建（M6/M7 前）

暂缓。当前 M5 虽然有 `ensure_concept_learning_state()`，
但还没有正式的 `rebuild_learning_state()` 入口。

未来需要:
```
def rebuild_learning_state():
    events = replay_all_events()
    for event in events:
        update_mastery(event)
    rebuild_review_queue()
```

---

## Case 3: 多设备同步（M7）

暂缓。ADR-005 定义了同步模型：
- event log 是同步单元
- 接收方 replay event → 本地重建 mastery
- 测试需要两台设备或模拟

---

## 执行

```bash
cd server
.\.venv\Scripts\python.exe -m pytest tests/test_recovery.py -v
```
