# Gate 0 — M4 Preflight Checklist

> M4 AI Tutor 开工前必须通过的全部检查。
> 所有项通过后才能进入 M4 编码。

---

## A. 基础健康

| # | 检查项 | 命令 | 预期 | 实际 | 状态 |
|---|---|---|---|---|---|
| A1 | pytest 全量通过 | `pytest -q` | 38+ passed | | |
| A2 | 前端 build 通过 | `npm run build` | pass | | |
| A3 | vitest 通过 | `npm run test` | pass | | |
| A4 | Health API ok | `GET /api/v1/health` | status=ok, db=true | | |
| A5 | git clean | `git status` | 无未提交代码 | | |
| A6 | Python 依赖冻结 | requirements.txt vs 实际 import | 一致 | | |

## B. 数据层

| # | 检查项 | 方法 | 预期 | 实际 | 状态 |
|---|---|---|---|---|---|
| B1 | Migration 幂等 | health 触发 → 重启 → 再触发 | 4 条记录，不增长 | | |
| B2 | Migration 版本 | 查 schema_migrations | 001+002+003+004 | | |
| B3 | Vault 目录结构 | 查 workspace | db/vault/attachments/metadata/eventlogs | | |

## C. 知识库闭环

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| C1 | Notes CRUD | test_notes.py | 7 pass | |
| C2 | FTS 搜索 | test_notes.py::test_search | 命中标题+正文 | |
| C3 | 双链→反链 | test_m2_smoke.py | backlinks 正确 | |
| C4 | 图谱 API | test_m2_smoke.py | nodes+edges 正确 | |
| C5 | 附件路径守卫 | test_m2_smoke.py | 拒绝绝对路径 | |
| C6 | Vault 真相 | 修改 notes 表 → Markdown 不变 | Markdown 不被覆盖 | |

## D. Learning Loop

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| D1 | Mastery lifecycle | test_mastery.py::test_mastery_lifecycle | event→mastery→queue | |
| D2 | Review 优先级 | test_mastery.py::test_review_priority | wrong > correct | |
| D3 | Review history | test_mastery.py::test_review_history | 返回事件列表 | |
| D4 | Weak concepts | test_mastery.py::test_weak_concepts | 返回弱概念列表 | |
| D5 | Event replay determinism | test_recovery.py（新） | 重放结果一致 | |

## E. AI 边界预检

| # | 检查项 | 方法 | 预期 | 状态 |
|---|---|---|---|---|
| E1 | 无 AI 直接改 mastery | grep 代码 | 不存在 router→update_mastery | |
| E2 | 无 LLM 调用在 core 外 | grep 代码 | LLM 调用仅在 core/ai/ | |
| E3 | Event 是唯一写入路径 | 架构检查 | 所有 mastery 变更经 event | |

## F. Knowledge Radar

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| F1 | suggest 空库 | test_suggest.py | 空结果 | |
| F2 | suggest 匹配 | test_suggest.py | 命中 note+concept | |
| F3 | suggest related | test_suggest.py | 图谱邻居 | |

---

## 结论

| 项目 | 结果 |
|---|---|
| 总检查项 | 22 |
| 通过 | /22 |
| 结论 | PASS / FAIL |
| 日期 | |
| 执行者 | |

**结论 PASS 才能进入 M4。**
