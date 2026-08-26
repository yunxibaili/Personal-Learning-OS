# ADR Index — 架构决策索引

> AI 按需展开，不全读。先看本索引，确认相关再读对应 ADR 全文。

---

| ADR | 标题 | 适用范围 | 状态 |
|---|---|---|---|
| ADR-001 | 存储分层（Markdown + SQLite） | 所有数据相关改动 | Accepted |
| ADR-002 | 思维导图存储（旁车 JSON + 生成大纲） | M2b Mind Map | Accepted |
| ADR-003 | LLM 接入（OpenAI-compatible 裸 HTTP） | M4+ AI Tutor | Accepted |
| ADR-004 | 依赖管理制度化 | 所有依赖改动 | Accepted |
| ADR-005 | 局域网同步模型（文件为真相） | M7 LAN Sync | Accepted |
| ADR-006 | 移动端技术栈（RN + 混合内核） | M8 Mobile | Accepted |
| ADR-007 | d3-force 单模块例外 | M3b Universe 布局 | Accepted |
| ADR-008 | 知识图谱模型冻结（Entity + links） | M2+ 图谱相关 | Accepted |
| ADR-009 | Entity vs Document 边界 | AI Tutor / 检索 | Accepted |
| ADR-010 | AI Context Architecture（单一管线） | M4+ AI Tutor | Accepted |
| ADR-011 | 中文搜索（unicode61 起步） | 搜索相关 | Accepted |
| ADR-012 | Omniscience Mode（上下文感知） | M3.5-A/B | Accepted |

## 快速查阅指南

- 改数据表/SQLite → 读 ADR-001 + ADR-008
- 改图谱相关 → 读 ADR-008 + ADR-009
- 加 AI 功能 → 读 ADR-003 + ADR-010
- 加依赖 → 读 ADR-004 + REGISTRY.md
- 改搜索 → 读 ADR-011
- 改 Knowledge Radar → 读 ADR-012
- M7+ 同步 → 读 ADR-005
- M8+ 移动 → 读 ADR-006
- M3b 可视化 → 读 ADR-007
- M2b 思维导图 → 读 ADR-002
