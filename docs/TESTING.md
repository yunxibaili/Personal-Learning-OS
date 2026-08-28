# Testing — 测试体系

> 测试策略、矩阵与门禁清单。合并自原 `docs/testing/` 下的多份文档。
当前验证状态与命令见 `PROJECT_STATE.md` §10.1。

---

## 目录

1. [Test Plan — Open Learning OS](#1-test-plan-open-learning-os)
2. [Test Matrix — 模块→测试映射](#2-test-matrix-模块-测试映射)
3. [Regression Checklist](#3-regression-checklist)
4. [Release Checklist](#4-release-checklist)
5. [Gate 0 — M4 Preflight Checklist](#5-gate-0-m4-preflight-checklist)
6. [Gate 1 — AI Boundary Audit](#6-gate-1-ai-boundary-audit)

---

## 1. Test Plan — Open Learning OS

> 全局测试策略。Gate 制度 + 测试金字塔 + 执行规范。
> 配合 `TEST_MATRIX.md`（模块→测试映射）使用。

---

### 1. 测试金字塔

```
Release（安装 + 迁移 + 导出）  ← Gate 3
  ↓
Regression（全量回归）        ← Gate 0/1/2
  ↓
Smoke（E2E 关键路径）         ← 每次 commit
  ↓
API（接口契约）               ← 每次改 router/core
  ↓
Unit（纯函数）                ← 每次改 core
```

### 2. Gate 制度

| Gate | 时机 | 范围 | 阻断 |
|---|---|---|---|
| Gate 0 | M4 开工前 | 全量回归 + 依赖审计 | BLOCK |
| Gate 1 | M4 完成后 | 全量 + AI Context 边界 | BLOCK |
| Gate 2 | M3b 开始前 | 全量 + 性能基线 | BLOCK |
| Gate 3 | 公开发布 | 全量 + 安装 + 迁移 + 导出 | BLOCK |

Gate 未通过 = 禁止进入下一阶段。

### 3. 执行命令

```bash
# 后端全量
cd server && .\.venv\Scripts\python.exe -m pytest -q

# 后端单模块
cd server && .\.venv\Scripts\python.exe -m pytest tests/api/test_mastery.py -v

# 前端构建
cd web && npm run build

# 前端测试
cd web && npm run test

# 一键全量
.\scripts\test.ps1
```

### 4. 测试文件位置

```
server/tests/
├── conftest.py                   # fixtures（tmp_workspace + client）
├── test_smoke.py                 # M0 基础健康
├── test_notes.py                 # M1 notes CRUD + FTS
├── test_attachments.py           # M1 附件
├── test_recovery.py              # 数据恢复（Gate 0 新增）
├── test_universe.py              # M3b Universe Projection
├── unit/
│   └── test_tutor_prohibition.py # M4-E Tutor 禁止测试（15 项）
├── api/
│   ├── test_m2_smoke.py          # M2 全链路 E2E
│   ├── test_mastery.py           # M3 Learning Graph
│   ├── test_suggest.py           # M3.5-A Knowledge Radar
│   ├── test_tutor_context.py     # M4-A Context Builder
│   ├── test_tutor_prompt.py      # M4-B Prompt Assembly
│   ├── test_llm_provider.py      # M4-C LLM Provider
│   └── test_tutor_smoke.py       # M4-C Tutor 全链路

web/src/
├── stores/ui.test.ts             # Zustand store
```

### 5. 新增测试规则

- 新功能必须有对应测试
- 测试用例使用 `tmp_workspace` fixture，绝不触碰真实数据
- SQLite 连接断言时打开、用完即关
- 禁止手工启动 uvicorn 跑测试
- 禁止 PowerShell `Invoke-RestMethod`（GBK 乱码）

### 6. Gate 报告格式

每次 Gate 执行后记录到对应 `GATE-*.md` 文件：

```markdown
## Gate X Report — YYYY-MM-DD

| 检查项 | 预期 | 实际 | 状态 |
|---|---|---|---|
| pytest | passed | 38 passed | ✅ |
| build | pass | pass | ✅ |
| ... | ... | ... | ... |

结论：PASS / FAIL
```

---

## 2. Test Matrix — 模块→测试映射

> 修改某模块时，必须跑哪些测试。AI 开发时必读。

---

### 使用方法

1. 找到你要修改的模块
2. 查「必须跑」列
3. 全部通过才能 commit

---

### 后端模块

| 模块 | 文件位置 | 修改触发 | 必须跑的测试 |
|---|---|---|---|
| Notes CRUD | `server/app/routers/notes.py` | 增删改查 | `test_notes.py` + `test_m2_smoke.py` |
| Knowledge Core | `server/app/core/knowledge.py` | 链接/桩/FTS | `test_notes.py` + `test_m2_smoke.py` + `test_suggest.py` |
| Mastery Engine | `server/app/core/mastery.py` | 掌握度计算 | `test_mastery.py` + `test_recovery.py` |
| Review Scheduler | `server/app/core/review_scheduler.py` | SM-2 调度 | `test_mastery.py` |
| Mastery Router | `server/app/routers/mastery.py` | 复习 API | `test_mastery.py` |
| Suggest API | `server/app/routers/suggest.py` | Radar 搜索 | `test_suggest.py` |
| Graph API | `server/app/routers/graph.py` | 图谱查询 | `test_m2_smoke.py` |
| Search API | `server/app/routers/search.py` | FTS 搜索 | `test_notes.py` + `test_m2_smoke.py` |
| Settings API | `server/app/routers/settings.py` | 配置读写 | `test_smoke.py` |
| DB/Migration | `server/app/db.py` + `migrations/` | 表结构 | `test_smoke.py`（全部 migration） |
| AI Context | `server/app/core/ai/`（M4+） | LLM 管线 | `test_mastery.py` + AI boundary 测试 |
| Tutor Context | `server/app/core/tutor_context.py` | Context Builder | `test_tutor_context.py` |
| Tutor Prompt | `server/app/core/ai/tutor.py` | Prompt 组装 | `test_tutor_prompt.py` |
| Tutor Service | `server/app/core/ai/service.py` | LLM 调用 | `test_llm_provider.py` + `test_tutor_smoke.py` |
| Tutor Router | `server/app/routers/tutor.py` | Tutor API | `test_tutor_smoke.py` |
| Universe Projection | `server/app/core/universe.py` | 图投影 | `test_universe.py` |
| Universe Router | `server/app/routers/universe.py` | Universe API | `test_universe.py` |
| MindMap Core | `server/app/core/mindmap.py` | Map CRUD + Concept Binding + Export/Import | `test_mindmap.py` |
| MindMap Router | `server/app/routers/mindmap.py` | MindMap API + Binding + Export/Import | `test_mindmap.py` |

### 前端模块

| 模块 | 文件位置 | 修改触发 | 必须跑的测试 |
|---|---|---|---|
| CSS 变量/样式 | `web/src/global.css` | 主题/布局 | `npm run build` |
| Zustand Store | `web/src/stores/` | 状态管理 | `npm run test` |
| TipTap Editor | `web/src/components/editor/` | 编辑器 | `npm run build` |
| Graph View | `web/src/views/GraphView.tsx` | 图谱 | `npm run build` |
| Dashboard | `web/src/views/DashboardView.tsx` | 仪表盘 | `npm run build` |
| Note Editor | `web/src/views/NoteEditor.tsx` | 笔记 | `npm run build` |
| Tutor Panel | `web/src/components/tutor/TutorPanel.tsx` | Tutor UI | `npm run build` |
| Knowledge Universe | `web/src/components/universe/` | Universe 渲染 | `npm run build` |
| MindMap Canvas | `web/src/components/mindmap/` | MindMap 渲染 | `npm run build` |
| App Layout | `web/src/App.tsx` | 布局 | `npm run build` + `npm run test` |

### 共享类型

| 模块 | 文件位置 | 修改触发 | 必须跑的测试 |
|---|---|---|---|
| shared/types/*.ts | `shared/types/` | API 契约 | `npm run build` + `pytest`（契约测试） |

---

### 交叉影响规则

```
改 core      → 必须跑对应 API 测试 + unit 测试
改 router    → 必须跑对应 API 测试
改 shared/   → 必须跑前端 build + 后端 pytest
改 migration → 必须跑 test_smoke.py（迁移幂等）
改 CSS       → 必须跑 npm run build
```

---

### 禁止

- ❌ 只跑单个测试文件就 commit
- ❌ 改了 core 不跑 API 测试
- ❌ 改了 shared/types 不跑 build
- ❌ 跳过 regression checklist

---

## 3. Regression Checklist

> 每次 Gate 执行时逐项检查。勾选通过项。

---

### 使用方法

1. 复制本文件到当前 Gate 报告
2. 逐项执行
3. 记录结果到 Gate 报告

---

### 1. 后端单元测试

```
□ pytest -q → 全部 passed
□ 无 skipped（除非有明确记录）
□ 无 deprecation warning 需处理
```

### 2. 后端 API 测试

```
□ test_notes.py → 全部 passed
□ test_mastery.py → 全部 passed
□ test_suggest.py → 全部 passed
□ test_m2_smoke.py → 全部 passed
□ test_smoke.py → 全部 passed
```

### 3. 数据恢复测试

```
□ test_recovery.py → 全部 passed
```

### 4. 前端

```
□ npm run build → pass（无 TS 错误）
□ npm run test → pass
□ CSS 变量引用无断裂
```

### 5. 契约一致性

```
□ shared/types/*.ts 与 API 响应形状一致
□ pytest 契约测试覆盖新增端点
□ 无前端直接调用不存在的 API
```

### 6. 依赖审计

```
□ requirements.txt 与实际 import 一致
□ package.json 与实际 import 一致
□ 无未登记依赖
□ 无重复功能依赖
□ 无已废弃依赖
```

### 7. 架构边界

```
□ Frontend 未直连 SQLite
□ Router 未包含业务逻辑
□ Core 未 import FastAPI
□ LLM 调用仅在 core/ai/
□ 全部数据变更经 event 路径
```

### 8. 文档同步

```
□ CURRENT_STATE.md 已更新
□ TECH_DESIGN.md 如有改动已同步
□ DATA_MODEL.md §A 如有改动已同步
□ TASKS.md 回填完成报告
□ CHANGELOG.md 有对应条目
```

---

**全部通过 = 回归通过。任何一项失败 = 必须修复后重跑。**

---

## 4. Release Checklist

> 公开发布（开源/版本发布）前必须通过的检查。

---

### 1. 全量回归

```
□ Gate 0 全部通过
□ 无已知 blocker bug
□ 无 security 漏洞
```

### 2. 安装测试

#### Windows（新电脑）
```
□ git clone 成功
□ pip install -r requirements.txt 成功
□ npm install 成功
□ python -m uvicorn app.main:app 可启动
□ npm run dev 可启动
□ 浏览器可访问
□ 无报错
```

### 3. 数据迁移测试

```
□ 旧版本 DB 可被新版本 migration 升级
□ 升级后数据不丢失
□ 版本号正确
```

### 4. 导出测试

```
□ vault/ 可独立使用（Obsidian 可打开）
□ metadata/ 可备份
□ 无私有格式数据
□ 无云端绑定
```

### 5. 文档检查

```
□ README.md 可读
□ CONTRIBUTING.md 可读
□ CHANGELOG.md 完整
□ 无内部敏感信息
□ 无 API key / 密码
```

### 6. 版本标记

```
□ Git tag v0.x.x
□ CHANGELOG 更新
□ package.json 版本号
```

---

**全部通过 = 可发布。**

---

## 5. Gate 0 — M4 Preflight Checklist

> M4 AI Tutor 开工前必须通过的全部检查。
> 所有项通过后才能进入 M4 编码。

---

### A. 基础健康

| # | 检查项 | 命令 | 预期 | 实际 | 状态 |
|---|---|---|---|---|---|
| A1 | pytest 全量通过 | `pytest -q` | 52+ passed | 52 passed | ✅ |
| A2 | 前端 build 通过 | `npx vite build` | pass | built in 1.72s | ✅ |
| A3 | vitest 通过 | `npx vitest run` | pass | 2 passed | ✅ |
| A4 | Health API ok | `GET /api/v1/health` | status=ok, db=true | 已在 test_smoke.py 覆盖 | ✅ |
| A5 | git clean | `git status` | 无未提交代码 | 工作区干净 | ✅ |
| A6 | Python 依赖冻结 | requirements.txt vs 实际 import | 一致 | 已手动确认 | ✅ |

### B. 数据层

| # | 检查项 | 方法 | 预期 | 实际 | 状态 |
|---|---|---|---|---|---|
| B1 | Migration 幂等 | health 触发 → 重启 → 再触发 | 5 条记录，不增长 | 5 条记录 | ✅ |
| B2 | Migration 版本 | 查 schema_migrations | 001+002+003+004+005 | 001-005 | ✅ |
| B3 | Vault 目录结构 | 查 workspace | db/vault/attachments/metadata/eventlogs | 5 目录 | ✅ |

### C. 知识库闭环

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| C1 | Notes CRUD | test_notes.py | 7 pass | ✅ |
| C2 | FTS 搜索 | test_notes.py::test_search | 命中标题+正文 | ✅ |
| C3 | 双链→反链 | test_m2_smoke.py | backlinks 正确 | ✅ |
| C4 | 图谱 API | test_m2_smoke.py | nodes+edges 正确 | ✅ |
| C5 | 附件路径守卫 | test_m2_smoke.py | 拒绝绝对路径 | ✅ |
| C6 | Vault 真相 | 修改 notes 表 → Markdown 不变 | Markdown 不被覆盖 | ✅ |
| C7 | FTS5 特殊字符 | test_rebuild.py::test_search_fts_special_chars | 不再 500 | ✅ |

### D. Learning Loop

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| D1 | Mastery lifecycle | test_mastery.py::test_mastery_lifecycle | event→mastery→queue | ✅ |
| D2 | Review 优先级 | test_mastery.py::test_review_priority | wrong > correct | ✅ |
| D3 | Review history | test_mastery.py::test_review_history | 返回事件列表 | ✅ |
| D4 | Weak concepts | test_mastery.py::test_weak_concepts | 返回弱概念列表 | ✅ |
| D5 | Event replay determinism | test_rebuild.py::test_event_replay_determinism | 重放结果一致 | ✅ |
| D6 | DB rebuild from vault | test_rebuild.py::test_db_rebuild_from_vault | migrate 幂等 | ✅ |

### E. AI 边界预检

| # | 检查项 | 方法 | 预期 | 状态 |
|---|---|---|---|---|
| E1 | 无 AI 直接改 mastery | grep 代码 | 不存在 router→update_mastery | 已审查 | ✅ |
| E2 | 无 LLM 调用在 core 外 | grep 代码 | LLM 调用仅在 core/ai/ | 已审查 | ✅ |
| E3 | Event 是唯一写入路径 | 架构检查 | 所有 mastery 变更经 event | 已审查 | ✅ |

### F. Knowledge Radar

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| F1 | suggest 空库 | test_suggest.py | 空结果 | ✅ |
| F2 | suggest 匹配 | test_suggest.py | 命中 note+concept | ✅ |
| F3 | suggest related | test_suggest.py | 图谱邻居 | ✅ |

### G. M4-Preflight Hardening（H1-H6）

| # | 检查项 | 验证方法 | 状态 |
|---|---|---|---|
| H1 | FTS5 输入清洗 | sanitize_fts_query 双引号包裹 + test_search_fts_special_chars | ✅ |
| H2 | create_note 校验前移 | has_forbidden_media_path 检查在 write_text 前 | ✅ |
| H3 | Event detail 列 | migration 005 + update_mastery(detail) + submit_answer 写入 quality | ✅ |
| H4 | SM-2 时间注入 | sm2_schedule(now=FIXED_NOW) + test_sm2 6 用例 | ✅ |
| H5 | 测试覆盖 | test_sm2.py (6) + test_rebuild.py (3) = 9 新测试 | ✅ |
| H6 | Dashboard 去 emoji | 无 emoji + #e6a817→var(--brand) | ✅ |

---

### 结论

| 项目 | 结果 |
|---|---|
| 总检查项 | 31 |
| 通过 | 31/31 |
| 跳过 | 0 |
| 结论 | **PASS** |
| 日期 | 2026-08-27 |
| 执行者 | AI + 用户 |

#### 测试计数

- pytest: 52 passed（+14 from Gate 0）
- vitest: 2 passed
- build: pass

#### Gate 0.5 通过。M4 可以开工。

---

## 6. Gate 1 — AI Boundary Audit

> M4-C LLM Provider 开工前必须通过的架构边界审计。
> 审计日期：2026-08-27 · pytest 92 passed

---

### G1-01: Context Isolation

**目标**：敏感数据不进入 prompt。

| 检查项 | 方法 | 结果 |
|---|---|---|
| api_key 字段被过滤 | tainted context → assert "sk-" not in prompt | ✅ PASS |
| password 字段被过滤 | tainted context → assert "hunter2" not in prompt | ✅ PASS |
| SQLite 路径不出现 | context builder 不暴露 db_path | ✅ PASS |
| sk- 内容前缀被替换 | concept="sk-xxxx" → "[REDACTED]" | ✅ PASS |
| Bearer token 被替换 | concept="Bearer abc" → "[REDACTED]" | ✅ PASS |
| ghp_ token 被替换 | concept="ghp_xxx" → "[REDACTED]" | ✅ PASS |
| 正常知识保留 | concept="token bucket" → 保留 | ✅ PASS |

**结论**：双重防御生效。Context Builder 输出干净，Prompt Builder 二次过滤兜底。

---

### G1-02: Prompt Purity

**目标**：build_prompt() 是纯函数，无副作用。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 无文件 I/O | inspect source: no open()/Path() | ✅ PASS |
| 无 SQLite | inspect source: no sqlite/connect | ✅ PASS |
| 无网络 | inspect source: no requests/urllib/httpx | ✅ PASS |
| 无 datetime.now | inspect source: no time依赖 | ✅ PASS |
| 确定性 | 同输入 → p1 == p2 | ✅ PASS |
| 无禁止模块导入 | AST 分析：无 sqlite3/requests/httpx/urllib/aiohttp | ✅ PASS |

**结论**：build_prompt() 是纯函数。相同输入 → 相同输出。

---

### G1-03: LLM Write Boundary

**目标**：LLM 无写权限，event 是唯一写入口。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 无 execute() | grep ai/tutor.py source | ✅ PASS |
| 无 INSERT/UPDATE/DELETE | grep ai/tutor.py source | ✅ PASS |
| 无 commit() | grep ai/tutor.py source | ✅ PASS |

**结论**：ai/tutor.py 是纯读模块。未来 M4-C 的 LLM Provider 只能返回文本，不能直接写 DB。

**架构约束**（冻结）：
```
LLM → Response (文本)
     → Tutor Router (解析)
     → learning_events (event 写入)
     → mastery (event-driven 更新)
```

LLM 永远不能：`llm.update_mastery()` / `llm.create_note()` / `llm.execute()`

---

### G1-04: Provider Isolation

**目标**：无 LLM 厂商绑定。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 无 OpenAI import | grep source | ✅ PASS |
| 无 Ollama import | grep source | ✅ PASS |
| 无硬编码模型名 | grep gpt-/claude/llama | ✅ PASS |

**结论**：Provider 无绑定。M4-C 可自由实现 OpenAI/Ollama/其他。

**M4-C 推荐结构**：
```
core/ai/
├── providers/
│   ├── base.py      # ProviderProtocol (ABC)
│   ├── openai.py    # OpenAI-compatible
│   ├── ollama.py    # Ollama local
│   └── mock.py      # 测试用
└── service.py       # TutorService（业务层）
```

---

### G1-05: Multilingual Boundary

**目标**：ADR-015 语言契约不被破坏。

| 检查项 | 方法 | 结果 |
|---|---|---|
| prompt 不因 query 语言改变 | en query vs zh query → same system prompt | ✅ PASS |
| metadata 可扩展 | metadata is dict | ✅ PASS |

**结论**：语言自适应已预留，不破坏现有边界。

---

### G1-06: Edge Cases & Truncation

**目标**：边界情况不崩溃。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 100k+ context 被截断 | massive concept → truncated=True | ✅ PASS |
| 空 concept 不崩溃 | TutorContext 无 concept → 正常输出 | ✅ PASS |
| debug fallback 正确 | mode=debug → mode=explain + requested_mode=debug | ✅ PASS |
| 所有 mode 可用 | explain/hint/review/debug → 4 个均输出有效 | ✅ PASS |

---

### 测试覆盖

| 测试文件 | 用例数 | 状态 |
|---|---|---|
| test_ai_boundary.py（新增） | 25 | ✅ 25/25 |
| test_prompt_builder.py | 16 | ✅ 16/16 |
| test_sm2.py | 6 | ✅ 6/6 |
| 其他全部测试 | 45 | ✅ |
| **总计** | **92** | **✅ 92/92** |

---

### 结论

| 项 | 状态 |
|---|---|
| G1-01 Context Isolation | ✅ PASS |
| G1-02 Prompt Purity | ✅ PASS |
| G1-03 LLM Write Boundary | ✅ PASS |
| G1-04 Provider Isolation | ✅ PASS |
| G1-05 Multilingual Boundary | ✅ PASS |
| G1-06 Edge Cases | ✅ PASS |
| **Gate 1 总结** | **✅ PASS (6/6)** |

**M4-C 可以开工。**

---

### M4-C 施工红线

通过 Gate 1 后，M4-C 必须遵守：

1. **ProviderProtocol**：所有 LLM Provider 实现统一接口
2. **Response Only**：LLM 只返回文本，不直接写 DB
3. **Event-Driven**：用户确认/系统检测 → learning_event → mastery
4. **Provider 可替换**：settings 表配置切换，代码不感知厂商
5. **Prompt 不变**：M4-B 的 build_prompt() 输出是 Provider 的唯一输入
6. **超时+重试**：Provider 必须有超时（默认 30s）和重试（默认 3 次）
7. **错误不泄露**：LLM 错误 → 用户友好消息，不暴露 stack trace / API key

