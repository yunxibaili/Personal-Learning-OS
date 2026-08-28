# 分层架构规范（Separation of Concerns）

> **强制约束**。任何代码设计必须先做职责划分再实现。违反本文件触发
> `[ARCHITECTURE WARNING]`（AGENTS §7）。宪法摘要见 `AGENTS.md` §12。

日期：2026-08-26 · 状态：Accepted

## 一、四层模型与本仓库映射

```
Frontend  web/          UI 渲染 · 交互 · Zustand 状态 · 路由切换 · 动画 · 可视化 · 只经 HTTP 调 API
Backend   server/app/   main.py + routers/ —— 参数校验 · 业务编排 · API 服务 · 任务调度
Core      server/core/  纯逻辑引擎（knowledge/mastery/tutor/llm/syncengine/tracer）——可单测、不依赖 FastAPI
Data      workspace/    SQLite（仅经 core 内数据访问函数触达）+ Markdown/JSON 文件事实源
```

## 二、职责白名单 / 黑名单

| 层 | 只允许 | 永远禁止 |
|---|---|---|
| Frontend | UI 渲染、交互、状态管理、动画、图形可视化、调 API、展示错误 | 直连 SQLite/文件系统；业务规则；AI 调用；图谱算法；持久化用户核心数据 |
| Backend | API 接口、编排 Core、数据转换、同步服务、权限/配对校验、调度 | UI 代码；页面逻辑；保存前端状态 |
| Core | 核心算法（掌握度/SM-2/图查询/上下文管线/SSE 解析/diff） | import FastAPI；读 HTTP 请求对象；关心 UI |
| Data | schema migration、参数化 SQL、文件原子读写 | 被 Frontend 直接触碰；承载业务判断 |

**唯一合法调用链**：`Frontend → HTTP /api/v1 → Router(校验) → Core(业务) → 数据访问函数 → SQLite/文件`

## 三、接口先行开发流程（每个功能强制）

```
Step1 定义数据结构（表/文件格式变更先进 docs/DATA_MODEL.md §A 变更日志）
Step2 设计 API 契约（路径/schema/错误码，写入 TECH_DESIGN §9）
Step3 实现 Backend + pytest（契约测试锁响应形状）
Step4 实现 Frontend（只消费契约）
Step5 双侧测试 → TASKS 回填报告
```

禁止先写页面再临时拼后端。

## 四、模块隔离细则

### AI 隔离
LLM 请求只允许出现在 `server/core/ai/*`（llm.py/tutor.py/extractor）。UI 组件零直连；
链路恒为 `用户输入 → /api/v1/chat/stream → tutor.py → LLM → SSE 返回`。
**Router 禁止 import llm**——一切提示词组装经 Context Builder（ADR-010），
未来 RAG 仅作为 Builder 的数据源扩展。

### Knowledge Universe 三段式
| 段 | 位置 | 职责 |
|---|---|---|
| graph-core | core/knowledge.py + 递归 CTE | node/edge/relation/图计算/2 层邻居过滤 |
| graph-api | routers/graph.py | GET /api/v1/graph 契约输出 {nodes,edges} |
| graph-ui | GraphView / MindMapView | React Flow + d3-force 视觉编码，零算法 |

禁止在 React 组件里计算图算法；禁止 Backend 返回 UI 结构。

### 同步归属
协议实现只在 `core/syncengine.py`（扫描/hash/diff/conflict）；桌面 router 与手机端都只是
协议客户端/宿主。手机 App 禁止自行改动或另造同步语义（ADR-005 单一真相）。

## 五、共享类型契约

- `shared/types/*.ts` 是 API 响应形状的**唯一权威定义**（Concept/GraphNode/Edge/MasteryRecord/MemoryRecord…）
- Python 侧不复制类型，而以 pytest **契约测试**断言真实响应与 shared/types 一致
- 禁止前端自造一份形状、后端再造一份
- backlog：若手工镜像漂移频繁，引入 openapi-typescript 代码生成（走 Dependency Review）

## 六、错误契约

Backend 输出 `{error: {code, message}}`（HTTP 400 业务错 / 500 不泄堆栈）；
Frontend 仅负责展示与重试交互，**不得**在 UI 里重判业务规则。

## 七、依赖控制

新增依赖沿用 AGENTS §2 六连问 + REGISTRY 登记。分层本身不引入新框架：
分层靠目录约定与测试约束，不靠 DI 容器/装饰器框架。
