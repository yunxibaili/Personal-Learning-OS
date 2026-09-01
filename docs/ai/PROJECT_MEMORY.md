# Project Memory — AI 长期记忆

> 永久不变的信息。AI 启动时必读第一份。
> 当前状态见 `CURRENT_STATE.md`，活跃任务见 `ACTIVE_TASK.md`。
> 本文件 <200 行；超出时精简，不加内容。

---

## Identity

Open Learning OS：开源、本地优先、AI 驱动的学习型知识操作系统。
核心价值不是记录信息，而是帮助用户学会信息。

## Architecture Truth

- Markdown = 用户数据唯一事实源（workspace/vault/*.md）
- SQLite = 可重建的索引/缓存（元数据、图谱、学习状态）
- AI = 辅助者，不自动修改用户知识
- Local-first：所有功能默认离线可用

## Four-Layer Architecture

```
Frontend  web/          React + TS + Zustand，只经 HTTP 调 API
Backend   server/app/   FastAPI routers，参数校验 + 编排
Core      server/core/  纯逻辑引擎，可单测，不依赖 FastAPI
Data      workspace/    Markdown 文件 + SQLite（仅经 core 触达）
```

唯一合法调用链：`Frontend → /api/v1 → Router → Core → 数据访问 → SQLite/文件`

## Stack（冻结）

| 层 | 技术 |
|---|---|
| Frontend | React 18 · TypeScript · Vite · Zustand · TipTap v3 · React Flow · KaTeX |
| Backend | Python 3.12 · FastAPI · uvicorn |
| Storage | sqlite3(stdlib) + FTS5 · Markdown · JSON sidecar |
| Desktop | Tauri v2（M6 已完成，Windows MSI/NSIS 安装包） |
| Mobile | React Native + Expo（M8 起） |

禁止：ORM · CSS 框架 · LangChain · 向量数据库 · D3 全家桶（d3-force 例外，M3b）

## Product Pillars（优先级排序）

1. Knowledge Graph — concepts + links + Entity/Document 分离
2. Learning Memory — 四维掌握度 + SM-2 + mistakes
3. AI Tutor — 记忆感知上下文管线，Router 禁直连 LLM
4. Visual Learning Engine — Trace → 模板渲染动画（M9+）

## Data Model Summary

| 表 | 用途 |
|---|---|
| concepts | 知识节点（第一等公民） |
| notes | 笔记元数据（正文在 vault/*.md） |
| links | 统一关系表（多态端点，ADR-008） |
| concept_mastery | 四维掌握度（dimensions JSON + effective） |
| learning_events | 学习事件日志（追加式，可重放） |
| review_queue | SM-2 复习排期 |
| mistakes | 错误记录 |
| memories | 用户记忆（fact/preference/goal） |
| settings | KV 配置（LLM key 不回传明文） |

DDL 完整版见 `TECH_DESIGN.md §4`；变更追踪见 `docs/DATA_MODEL.md §A`。

## Core Innovation Boundary

开发精力只投入：Knowledge Graph · Learning Memory · AI Tutor · Visual Engine。
其余（UI polish · 配置系统 · 插件框架）不为它们牺牲核心。

## Frozen Decisions（禁止回潮）

- Electron → Tauri
- SQLAlchemy → stdlib sqlite3
- LangChain → 手写管线
- openai SDK → stdlib urllib SSE
- Tailwind → 单一 global.css
- D3 全家桶 → React Flow + d3-force（ADR-007）
- 向量数据库 → FTS5（触发条件：概念数 >2000）

## Git 纪律（2026-08-31 加入，详见 AGENTS §18 §2.1/§2.2）

- **每轮任务完成必须 `git push origin main`**。积压在本地 = 单点风险，无副本。
- **必须入库**：源码 · 契约（`shared/types`）· **测试** · **文档** ·
  `package-lock.json` · `web/public/**`
- **永不入库**：`workspace/`（用户数据）· `.env*` 与密钥 · `dist*/`
  与 `coverage/` · `node_modules/` `.venv/` · `_local/` · `sandbox/`
- 「不自动 push」的规则**只作用于导入的第三方repository**，不是本项目仓库。
- 推送失败必须报告用户并说明未推送提交数，不得静默跳过。
