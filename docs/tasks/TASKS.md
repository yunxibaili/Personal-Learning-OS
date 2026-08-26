# 任务列表与执行报告（Task Tracker）

> **制度（强制）**：
> 1. 任何开发任务开始前在此登记「计划」；完成后必须回填「完成报告」——
>    含做了什么、改动文件、**测试了什么（逐条列出实际执行的测试命令与预期/实际结果）**、遗留问题。
> 2. 未回填报告的任务视为未完成，不得开始依赖它的下一项任务。
> 3. 里程碑收尾三件事：依赖审计（REGISTRY 审计表）· CHANGELOG 条目 · Git tag。
>
> 状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成（附报告锚点）

## 里程碑总览（映射 TECH_DESIGN §10）

| 任务 | 内容 | 状态 | 完成报告 |
|---|---|---|---|
| M0 | 双端脚手架 + migration runner + 必读文档体系就位 | `[~]` 进行中 | — |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件） | `[ ]` | — |
| M2 | 双链·反链·FTS5·React Flow 图谱 | `[ ]` | — |
| M2b | Mind Map 编辑器（旁车 json + 生成大纲） | `[ ]` | — |
| M3 | Learning Graph（掌握度/状态机/SM-2/Dashboard） | `[ ]` | — |
| M4 | AI Tutor（provider/流式/上下文管线/extractor/AI导图） | `[ ]` | — |
| M5 | 复习闭环（队列/测验/时间线） | `[ ]` | — |
| M6 | Tauri 桌面打包 | `[ ]` | — |
| M7 | Visual Engine V1（trace/StepPlayer/三模板） | `[ ]` | — |
| M8 | AI 生成可视化 | `[ ]` | — |

## M0 任务拆解（当前）

- [ ] server/：FastAPI 入口（绑 127.0.0.1）+ db.py + migrations/001_init.sql（TECH_DESIGN §4 DDL）+ routers 骨架 + GET/PUT /api/settings
- [ ] web/：Vite React TS + Zustand store 骨架 + global.css + 六视图占位路由切换 + api client
- [ ] 联调：Vite proxy `/api`→8000；两条启动命令验证通过
- [ ] 测试就位：pytest 目录 + 冒烟用例（migration 可跑、/api/settings 读写往返）；vitest 占位
- [ ] 验收自查：对照 TECH_DESIGN §10 M0 标准逐条勾选，回填报告

## 完成报告模板（复制使用）

```markdown
### <任务号> 完成报告（YYYY-MM-DD）
- 做了什么：
- 改动文件：
- 测试了什么：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | | | |
- 结果与遗留：
```
