# ADR-030 · UX-002 Current Conversation UI State（当前会话 UI 状态的持久化例外）

- 状态：**Accepted**（2026-09-06 Owner 于 UX-002 State Contract 验收时批准；本 ADR 是该裁决的正式落地文本。**实现仍待单独授权**）
- 日期：2026-09-06
- 决策者：项目所有者
- 关联：`ADR-029`（Frontend Consumer Architecture）§6.1 · `AGENTS.md` §330 · ③ UX Observation（`UX-002`）
- 性质：**ADR-029 §6.1 的一个极小例外**，不是对 ADR-029 的修订，也不改变 Consumer 三定律（L1/L2/L3）。
- 冲突登记：无。本 ADR 不修改 `ADR-029`、`AGENTS.md` 或任何既有条款；如需改写须 Owner 单独授权。

---

## 0. 一句话核心

> **只把「当前正在看哪一个 Conversation」这一个 UI 指针存进 `sessionStorage`；Conversation 与 message 的真相仍在 backend。**

---

## 1. 为什么需要

③ Real Tutor Chat UX Observation 实测（2026-09-06）：

```text
用户在某会话中发消息
        ↓
刷新浏览器（或切到其他 tab 再切回）
        ↓
ChatPanel 回到 no_conversation
        ↓
必须手动从会话列表里重新找一条
```

根因：`ChatPanel` 的 `useReducer` 初始状态恒为 `{status:"no_conversation", conversationId:null}`，
mount 时只调 `listConversations()`，不恢复任何会话。

**定性（Owner）**：后端已把 Conversation 做成持久化实体，前端还没有把「当前 Conversation」做成持久化 UI 状态。

---

## 2. 决策

```text
sessionStorage
└── current_conversation_id = <number>
```

**只允许这一项。**

| 项 | 决策 |
| --- | --- |
| 存储位置 | `sessionStorage` |
| canonical storage key | `current_conversation_id` |
| 值 | 会话 id（数字字符串） |
| 写入方 | ChatPanel（**不是** `client.ts`） |

---

## 3. 为什么是 sessionStorage

| 维度 | localStorage | sessionStorage |
| --- | --- | --- |
| 刷新页面 | 保留 | 保留 |
| **离开 Tutor tab 后重新进入**（TutorView 卸载 / 重挂，同一浏览器 document） | 保留 | 保留 |
| **浏览器标签页关闭 / 浏览器重启** | 保留 | 丢失 |
| 多标签页共享 | 共享（A 页删会话 → B 页 stale） | 隔离（无 stale 冲突） |
| 语义 | 用户偏好 / 长期记忆 | 当前 UI transient 状态 |

UX-002 要解决的是**刷新 / Tutor 卸载重挂后的当前 UI 状态**，不是用户长期偏好；
不需要跨浏览器重启保持；使用 `sessionStorage` 可避免多 tab 共享同一 current ID 产生 stale，
也**不把前端持久化扩张成长期状态系统**。

---

## 4. 为什么不是持久化核心数据

`AGENTS.md:330` 禁止 Frontend「持久化核心数据」。本决策不构成违反，理由：

- 持久化的只是**一个 id 指针**，不是内容；
- Conversation 与 message 的**持久化由 backend 管理**（当前实现为 SQLite）；
  前端不保存其内容，只保存 ID 指针，每次恢复都要回源校验；
- 指针失效时**自动清除并降级为空态**，前端不持有任何不可回源的状态。

**后端仍是 Conversation / message 的真相。前端只记住「在看哪一个」。**

---

## 5. 与 ADR-029 §6.1 的关系

`ADR-029 §6.1` 原文：

> **禁止**在 wrapper 内做：重试策略、缓存、请求去重、业务态推断、本地持久化。这些属 L1/L3 越界，**需要时另立决策**。

因此：

1. **持久化代码不得写入 `client.ts`**（wrapper）。实现置于独立极小模块（如 `api/currentConversation.ts`），
   并须带注释声明「本模块位于 ADR-029 §6.1 所禁的 wrapper 之外」。
2. **本 ADR 就是 §6.1 所说的「另立决策」**。
3. `ADR-029 (L344)` 已登记 ADR-026「localStorage 偏好」为有效设计输入但**不进 MVP** —— 本决策不继承该先例。

---

## 6. 冻结契约

### 6.1 恢复时机

```text
TutorView mount
   ↓
读 sessionStorage
   ├─ 无 key → 空态（现状不变）
   └─ 有 key → listConversations()（本已存在，无新增请求）
                 ├─ id 在列表中 → select + reload messages
                 ├─ id 不在列表中 → 清 key → 空态（不报错）
                 └─ 请求失败 → 保留 key + 显示错误（不静默）
```

**校验方式：复用已有的 `listConversations()` 做成员校验。**
不新增 `GET /conversations/{id}`（实测该 path 只注册 DELETE，`GET` 返回 405），
也不把 `GET /conversations/{id}/messages` 的 404 当作正常恢复机制。

### 6.2 更新时机（冻结）

| 事件 | 操作 |
| --- | --- |
| 新建成功 | 写入新 ID |
| 切换成功 | 写入目标 ID |
| 删除当前 | 清除 |
| 删除非当前 | 不动 |
| 开始生成 / done / error / stopped | **不动** |
| Tutor 卸载 | 不动 |
| stale ID | 清除 |

> **硬约束：生成生命周期不得修改 `current_conversation_id`。**

### 6.3 失效处理

| 情况 | 动作 | 用户可见 |
| --- | --- | --- |
| id 不存在 | 清 key → 空态 | 空态文案，不报错（属正常清理） |
| 列表请求失败 | **保留 key** | 显示错误，**不静默** |
| 消息请求失败 | **保留 key** | 显示错误，**不静默** |

> 恢复路径**不得**沿用 `ChatPanel.tsx:130-132` `reloadMessages()` 的静默 catch
> （注释「回放失败不阻断」）。③ 实测中该静默路径导致失败表现为「消息区永远空白、零反馈」。

### 6.4 禁止持久化

```text
messages  title  draft  mode  conceptId  auto_notes  streamingText  scroll position
```

以上一律**不持久化**。**离开 Tutor tab 后重新进入**时，TutorView 的 conceptId / 选中笔记 / auto_notes 仍会重置 ——
这是另一份 state，**不在本 ADR 范围**，不得据此扩权。

---

## 7. 明确不做

- 新增任何后端端点
- 改动 `client.ts`
- 多标签页同步
- 恢复 TutorView 的上下文选择状态
- 触碰 `UX-004` / `UX-008`（Stop / Failure 的消息语义）

---

## 8. 与 UX-004 / UX-008 的解耦

`UX-004 + UX-008` 已由 Owner 合并登记为：

> **Stop / Failure 的消息语义尚未形成稳定的持久化 contract。**

该问题涉及 message lifecycle（是否引入 `stopped` 状态、由谁判定），**尚未裁决**。

本 ADR 通过 §6.2 的硬约束（done / error / stopped 一律不动 key）保证：
**UX-002 的实现不会把 message lifecycle 的设计提前拉进来**，两者保持干净隔离。

---

## 9. 落地形态（实现阶段，待单独授权）

```text
NEW   frontend/src/api/currentConversation.ts      ← 极小模块，只读写一个 key
MOD   frontend/src/features/tutor/ChatPanel.tsx    ← mount 恢复 + 4 个写入点
NEW   frontend/src/api/currentConversation.test.ts
```

---

## 10. 验收测试点

1. 无 key → 空态，不发多余请求
2. 有 key + 有效 id → 刷新后恢复该会话与其消息
3. 有 key + id 已被删除 → 清除 key → 空态，**不报错**
4. `listConversations` 失败 → 保留 key + 显示错误（非静默）
5. 删除当前会话 → key 被清除；再刷新 → 空态
6. **离开 Tutor tab 再重新进入** → current conversation 仍被恢复（concept 选择允许重置）
7. 发送失败 / Stop → **key 不变**
