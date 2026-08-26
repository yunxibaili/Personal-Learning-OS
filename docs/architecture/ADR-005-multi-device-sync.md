# ADR-005: 局域网同步模型——文件为真相，SQLite 仅本地缓存

日期：2026-08-26 · 状态：Accepted（M7 实施）

## Context

产品形态升级为多端（Tauri 桌面 + React Native 手机）。设备间需要同步知识库与学习状态。
经典难题：SQLite 双主复制冲突率高；自研块级同步协议复杂度爆炸；引入第三方云同步违背 Local-first。

## Decision

### 同步范围（白名单）

| 内容 | 载体 |
|---|---|
| 笔记正文 | `vault/**/*.md` |
| 思维导图 | `vault/**/**.mindmap.json` |
| 附件 | `attachments/**` |
| 学习状态 | `metadata/eventlogs/<yyyy-mm>.jsonl`（learning_events 追加日志） |
| 设备注册表 | `metadata/devices.json` |

### 永不同步（黑名单）

`db/`（SQLite 全部表）、settings、API key、`manifest.json`（本机指纹缓存，每设备私有）。

### 协议 v1（HTTP，无 WebSocket）

1. 配对：桌面生成一次性配对码/二维码 → 手机换取长期 bearer token（仅 LAN 内有效）
2. 双方交换 manifest：`{path: {sha256, mtime, device}}`
3. 差量三态判断：单方新/变更 → 直接传输；**双方都改 → 冲突**
4. 冲突处理 v1：保留双份 `<name>.conflict.<device>.<ts>.<ext>` + 解决列表 UI（保留其一/手动合并）
5. 触发方式：手动按钮 + 应用启动/回到前台自动对比一次（不做后台常驻）

### 学习状态跨端机制

- 写入 learning_events 表的同一事务内，追加一行 JSON 到当月 eventlog 文件（含 device_id 与全局唯一 event id）
- 各端拉取日志后按序回放 delta 重建 concept_mastery；回放以 event id 幂等去重
- memories/conversations 属单设备内容，v1 不同步（对话导出 json 进 backlog）

### 明确推迟

WebSocket 实时推送 · CRDT(Yjs/Automerge) · 后台常驻同步 —— 进入 backlog，
CRDT 触发条件：真实多端并发编辑同一文件的冲突频率高到解决列表成为负担。

## Alternatives Considered

| 方案 | 否决理由 |
|---|---|
| 直接复制/双向同步 SQLite | 双主写冲突不可控；本项目已确立 DB=可重建缓存，无需同步 |
| 内嵌 Syncthing | 强外部依赖 + 独立 GUI 心智；其文件夹对同步无法理解我们的 eventlog 回放语义 |
| Yjs/Automerge 现在就上 | 个人双设备非实时协作场景，CRDT 复杂度前置违反 YAGNI |
| 自建云服务器中转 | 违背 Local-first 与零云端原则 |

## Reason

文件是已有的事实源（ADR-001）；manifest+hash 对比是 git 同款心智、约 300 行可实现；
事件日志天然追加式，与 §5「掌握度可重放推导」既有设计零冲突。

## Consequences

- 所有需要跨端的状态今后必须设计成文件形态（新表/新功能需自查此红线）
- eventlog 回放要求事件应用逻辑保持纯函数性（同输入同输出，禁止读墙钟做语义判断）
- 家庭 LAN 内明文 HTTP + token 认证，v1 接受；文档明示边界（见 network-boundary.md）
