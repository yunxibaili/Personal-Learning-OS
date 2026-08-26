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
| M3b | Knowledge Universe 视觉层（Galaxy/Explorer/Memory Map，ADR-007） | `[ ]` | — |
| M4 | AI Tutor（provider/流式/上下文管线/extractor/AI导图） | `[ ]` | — |
| M5 | 复习闭环（队列/测验/时间线） | `[ ]` | — |
| M6 | Tauri 桌面打包 | `[ ]` | — |
| M7 | LAN Sync v1（配对/manifest 对比/冲突双份，ADR-005） | `[ ]` | — |
| M8 | Mobile MVP Android（RN+混合内核，ADR-006） | `[ ]` | — |
| M9 | Visual Engine V1（trace/StepPlayer/三模板） | `[ ]` | — |
| M10 | AI 生成可视化 | `[ ]` | — |

## M0 任务拆解（当前）

- [ ] server/：FastAPI 入口（绑 127.0.0.1）+ db.py + migrations/001_init.sql（TECH_DESIGN §4 DDL）+ routers 骨架 + GET/PUT /api/v1/settings
- [ ] web/：Vite React TS + Zustand store 骨架 + global.css + 六视图占位路由切换 + api client
- [ ] 联调：Vite proxy `/api`→8000；两条启动命令验证通过
- [ ] 测试就位：pytest 目录 + 冒烟用例（migration 可跑、/api/v1/settings 读写往返）；vitest 占位
- [ ] 验收自查：对照 TECH_DESIGN §10 M0 标准逐条勾选，回填报告

## 挂起区（有明确触发条件，未排期）

| 计划 | 触发条件 | 文档 |
|---|---|---|
| UpMark 联动 U1 错题登记流入 → U2 双向出题 → U3 题库导入 | 用户显式发起；前置 M3/M4(/M5) 完成 | docs/architecture/integration-upmark.md |

## 完成报告

### T-DOC-001 多端架构修订 + UpMark 联动挂起（2026-08-26）
- **做了什么**：产品定位升级为 Local-first 多端（Tauri 桌面 + RN Android + LAN Sync）；
  新增 ADR-005/006 与 integration-upmark.md；TECH_DESIGN §1/§2/§4.2/§5.4/§9/§10 更新；
  里程碑重排 M7=同步、M8=移动、M9/M10=可视化；AGENTS 冻结表/红线/优先级同步；
  REGISTRY 规划依赖补 RN 系；TASKS 重排并建挂起区
- **改动文件**：docs/architecture/(ADR-005·006·integration-upmark) · TECH_DESIGN · AGENTS ·
  REGISTRY · TASKS · CHANGELOG · data-model/INDEX
- **测试了什么**：

  | 检查 | 预期 | 实际 |
  |---|---|---|
  | 全库 `POLICY.md` 旧引用 | 仅 CHANGELOG 历史行 | 发现 1 处未改名残留 → 已修 |
  | TECH_DESIGN 中旧 M7(Visual) 引用 | 全部改指 M9 | 发现 2 处（§5.1 表、§8 标题）→ 已修 |
  | data-model INDEX concept_demos 触发里程碑 | M9 | 已修 |
  | git push origin main | 远程与本地一致 | ✅ 85fde9b..f6d519d |

- **结果与遗留**：文档体系与已批准决策一致；M0 尚未开工（下一任务）

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
