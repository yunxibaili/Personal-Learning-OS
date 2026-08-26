# Session Protocol — AI 启动协议

> AI 每次新会话的行为规则。与 AGENTS §15 配合使用。

---

## 启动顺序

```
1. 读 docs/ai/PROJECT_MEMORY.md     ← 永久记忆（<200行）
2. 读 docs/ai/CURRENT_STATE.md      ← 当前状态
3. 读 docs/ai/ACTIVE_TASK.md        ← 活跃任务（如有）
4. 按需查阅 docs/ai/ADR_INDEX.md    ← 仅展开相关 ADR
```

## 行为规则

### 开始前

- 确认 CURRENT_STATE.md 存在且最新
- 确认 ACTIVE_TASK.md 有无活跃任务
- 如有活跃任务，确认 Allowed/Forbidden 列表
- 如无活跃任务，等用户指定再动手

### 编码中

- 一次只处理一个子任务
- 不改 Allowed 列表外的文件
- 不改 Forbidden 列表中的文件
- 遇到 [ARCHITECTURE WARNING] 触发条件 → 停止并报告

### 完成后

1. `pytest -q` → 全绿
2. `npm run build` → 通过
3. git commit（conventional 风格）
4. 更新 `CURRENT_STATE.md`（last commit + 本次改动）
5. 清空 `ACTIVE_TASK.md`（回模板）

## 禁止行为

- 扫描整个 `docs/` 目录
- 重新阅读全部 ADR
- 读取历史聊天记录
- 在没有 CURRENT_STATE 的情况下开始编码
- 一次负责整个里程碑（必须拆子任务）

## 子任务拆分规则

每个里程碑拆为独立子任务，每个子任务：

```
Milestone: M3 Learning Graph
Task: M3-001 mastery schema
Allowed: [具体文件列表]
Forbidden: [不能碰的文件]
Acceptance: [验收标准]
```

拆分粒度：一个子任务 ≈ 一个 PR / 一次会话可完成的工作量。
