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
| ADR-013 | Frontend Design System（设计宪法） | M3b+ 前端 | Accepted |
| ADR-014 | AI Tutor Architecture（AI Tutor 架构） | M4 AI Tutor | Accepted |
| ADR-015 | Multilingual Knowledge Support（多语言知识支持） | 全局 | Accepted |
| ADR-016 | Tutor UI Design（Tutor 界面设计） | M4-D Tutor UI | Accepted |
| ADR-017 | Architecture Visualization（架构可视化） | M4.5 全局 | Accepted |
| ADR-018 | Knowledge Universe Design（知识宇宙设计） | M3b 前端 | Accepted |
| ADR-019 | MindMap Boundary（思维导图边界冻结） | M2b MindMap | Accepted |
| ADR-020 | Sync Truth Model（同步冲突事实模型） | M7 LAN Sync | Accepted |
| ADR-021 | MindMap Exchange Format v1（思维导图交换格式） | M2b-003 Export/Import | Accepted |
| ADR-022 | Product Mode Boundary（产品模式边界冻结） | 全局 UX 方向 | Accepted |
| ADR-023 | Visualization Boundary（可视化边界冻结） | P8 前端可视化 | Accepted |
| ADR-024 | Note Hierarchy（主/副笔记 parent 关系） | 笔记层级 / frontmatter / 图谱消费 | Accepted |
| ADR-025 | Visual Engine V1（算法执行轨迹可视化） | M9 TraceRun / VisualEngine（IDE 步进，2026-09-01 裁定否决播放器）/ 三 Renderer · 组件入 ui 库 · 只执行预置示例 · 安全模型 | Proposed |

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
- M4 AI Tutor → 读 ADR-003 + ADR-010 + ADR-014
- 多语言支持 → 读 ADR-015
- Tutor UI → 读 ADR-016
- 架构图 → 读 ADR-017
- M3b Knowledge Universe → 读 ADR-018
- M2b MindMap → 读 ADR-002 + ADR-019
- M2b Export/Import → 读 ADR-021
- M7 同步冲突 → 读 ADR-005 + ADR-020
- 产品模式 / UX 方向 → 读 ADR-022
- P8 可视化边界（Universe/Graph/MindMap） → 读 ADR-023
- 笔记层级 / 主副笔记 / frontmatter parent → 读 ADR-024 + ADR-001
- 改 frontmatter 读写 → 读 ADR-024 §3（round-trip 是地基，先修）
- M9 算法轨迹可视化 / trace 契约 / 代码执行安全 → 读 ADR-025
- 改可视化（第四类：非图谱） → 读 ADR-025 §2.5（与 ADR-023 的边界裁决）
- 图谱 / 星系消费层级关系 → 读 ADR-024 §2.2 铁规则 5（单一 resolver，禁止各自推断）
