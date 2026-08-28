# ADR-017: Architecture Visualization

**状态**：已批准（2026-08-27）
**决策者**：项目负责人
**关联**：ADR-001（存储）· ADR-013（UI）· ADR-014（AI Tutor）· AGENTS §10（文档同步）

---

## 1. Problem

项目已完成 M0-M5，架构复杂度进入"靠人脑 + 文档维护成本升高"阶段：
- 多条跨域链路（Knowledge → Learning → Review → Tutor）
- AI coding agent 需要空间记忆理解系统
- 新人无法在 30 秒内理解系统全貌
- M3b/M2b 开发需要架构图冻结核心层边界

## 2. Decision

### 2.1 核心原则

```
Diagram is a map, not a mirror.
图解释系统，不复制代码。
```

### 2.2 工具

- **优先**：Archify agent skill（`npx skills add tt-a1i/archify -g`）
- **备选**：手写 HTML + inline SVG（零依赖）
- 仓库只保留产物（`docs/diagrams/*.html`），不保留工具依赖

### 2.3 产物结构

```
docs/
├── architecture/
│   └── ADR-017-architecture-visualization.md
└── diagrams/
    ├── system-map.yaml        ← 声明式节点/边定义
    ├── system-map.html         ← 系统总览（Architecture）
    ├── learning-loop.html      ← 学习闭环（Data Flow）
    ├── tutor-flow.html         ← Tutor 运行时（Sequence）
    ├── knowledge-flow.html     ← 知识流转（Data Flow）
    └── test-pipeline.html      ← 测试流水线（Workflow）
```

### 2.4 图表规范

| 项目 | 约束 |
|---|---|
| 每图节点数 | 8-12 个核心节点 |
| 细节处理 | 放卡片 tooltip，不展开在图中 |
| 更新时机 | 里程碑完成后同步更新 |
| 产物格式 | 自包含 HTML + inline SVG |
| 声明源 | system-map.yaml（人工维护） |

### 2.5 禁止清单

| 禁止 | 理由 |
|---|---|
| 自动生成全部文件关系图 | 产生 400 节点蜘蛛网 |
| Mermaid 巨型图 | 可读性差，无法交互 |
| 装饰性架构图 | 不服务理解 |
| 把所有 class 放进去 | 违反 8-12 节点约束 |
| 代替源码阅读 | 图是地图，不是源码 |

### 2.6 第一批五张图

| 图 | 类型 | 核心节点 |
|---|---|---|
| 系统总览 | Architecture | 四层架构 + Frozen Contracts |
| 学习闭环 | Data Flow | event → mastery → review → replay |
| Tutor 运行时 | Sequence | Context → Prompt → Provider → Response |
| 知识流转 | Data Flow | Markdown → Parser → FTS → Graph → Universe |
| 测试流水线 | Workflow | ADR → Code → pytest → vitest → build → Gate |

## 3. Consequences

### 架构资产

- 仓库获得 5 个可浏览的架构 HTML 文件
- system-map.yaml 作为声明式架构真相源
- AI coding agent 获得空间记忆层

### 对现有模块的影响

- 无代码改动
- 仅新增 `docs/diagrams/` 目录

### 维护规则

- 每个里程碑完成后检查架构图是否过时
- system-map.yaml 与代码同频更新
- 过时的图必须删除或更新，不允许存在误导性图

## 4. References

- Archify: https://github.com/tt-a1i/archify
- ADR-001: Storage Layering
- ADR-013: Frontend Design System
- ADR-014: AI Tutor Architecture
- AGENTS §10: Documentation Sync
