# Recovery Guide

> M7 同步恢复指南。

## 原子写入

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

## 扫描恢复

扫描器使用 `os.walk()` 遍历 workspace：

- 跳过隐藏目录（以 `.` 开头）
- 跳过黑名单目录（`db/`、`metadata/devices.json`）
- 跳过无法读取的文件（`OSError` / `PermissionError`）
- 只匹配白名单模式

**恢复**：扫描失败不会修改任何文件，可以安全重试。

## Diff 恢复

Diff 是纯计算，不修改文件：

```
Manifest A + Manifest B → SyncPlan
```

**恢复**：Diff 失败不会产生副作用，可以安全重试。

## 事件日志恢复

事件日志使用 append-only 模式：

```
每次学习事件 → 追加一行 JSON 到 eventlog.jsonl
```

**恢复**：
- 写入中断：只有完整的行才有效
- 重复导入：按 `event_id` 去重
- 文件损坏：从最后一个完整行恢复

## 常见问题

### Q: 同步中断后怎么办？

A: 重新扫描 + 重新 diff。同步操作是幂等的。

### Q: 文件被锁怎么办？

A: `atomic_write_file` 使用 `.tmp` 文件，不会锁定目标文件。

### Q: 磁盘满怎么办？

A: 写入失败会清理 `.tmp` 文件。目标文件保持不变。
