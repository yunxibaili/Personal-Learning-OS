# Gate 0 — M4 Preflight Checklist

> M4 AI Tutor 开工前必须通过的全部检查。
> 所有项通过后才能进入 M4 编码。

---

## A. 基础健康

| # | 检查项 | 命令 | 预期 | 实际 | 状态 |
|---|---|---|---|---|---|
| A1 | pytest 全量通过 | `pytest -q` | 52+ passed | 52 passed | ✅ |
| A2 | 前端 build 通过 | `npx vite build` | pass | built in 1.72s | ✅ |
| A3 | vitest 通过 | `npx vitest run` | pass | 2 passed | ✅ |
| A4 | Health API ok | `GET /api/v1/health` | status=ok, db=true | 已在 test_smoke.py 覆盖 | ✅ |
| A5 | git clean | `git status` | 无未提交代码 | 工作区干净 | ✅ |
| A6 | Python 依赖冻结 | requirements.txt vs 实际 import | 一致 | 已手动确认 | ✅ |

## B. 数据层

| # | 检查项 | 方法 | 预期 | 实际 | 状态 |
|---|---|---|---|---|---|
| B1 | Migration 幂等 | health 触发 → 重启 → 再触发 | 5 条记录，不增长 | 5 条记录 | ✅ |
| B2 | Migration 版本 | 查 schema_migrations | 001+002+003+004+005 | 001-005 | ✅ |
| B3 | Vault 目录结构 | 查 workspace | db/vault/attachments/metadata/eventlogs | 5 目录 | ✅ |

## C. 知识库闭环

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| C1 | Notes CRUD | test_notes.py | 7 pass | ✅ |
| C2 | FTS 搜索 | test_notes.py::test_search | 命中标题+正文 | ✅ |
| C3 | 双链→反链 | test_m2_smoke.py | backlinks 正确 | ✅ |
| C4 | 图谱 API | test_m2_smoke.py | nodes+edges 正确 | ✅ |
| C5 | 附件路径守卫 | test_m2_smoke.py | 拒绝绝对路径 | ✅ |
| C6 | Vault 真相 | 修改 notes 表 → Markdown 不变 | Markdown 不被覆盖 | ✅ |
| C7 | FTS5 特殊字符 | test_rebuild.py::test_search_fts_special_chars | 不再 500 | ✅ |

## D. Learning Loop

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| D1 | Mastery lifecycle | test_mastery.py::test_mastery_lifecycle | event→mastery→queue | ✅ |
| D2 | Review 优先级 | test_mastery.py::test_review_priority | wrong > correct | ✅ |
| D3 | Review history | test_mastery.py::test_review_history | 返回事件列表 | ✅ |
| D4 | Weak concepts | test_mastery.py::test_weak_concepts | 返回弱概念列表 | ✅ |
| D5 | Event replay determinism | test_rebuild.py::test_event_replay_determinism | 重放结果一致 | ✅ |
| D6 | DB rebuild from vault | test_rebuild.py::test_db_rebuild_from_vault | migrate 幂等 | ✅ |

## E. AI 边界预检

| # | 检查项 | 方法 | 预期 | 状态 |
|---|---|---|---|---|
| E1 | 无 AI 直接改 mastery | grep 代码 | 不存在 router→update_mastery | 已审查 | ✅ |
| E2 | 无 LLM 调用在 core 外 | grep 代码 | LLM 调用仅在 core/ai/ | 已审查 | ✅ |
| E3 | Event 是唯一写入路径 | 架构检查 | 所有 mastery 变更经 event | 已审查 | ✅ |

## F. Knowledge Radar

| # | 检查项 | 测试用例 | 预期 | 状态 |
|---|---|---|---|---|
| F1 | suggest 空库 | test_suggest.py | 空结果 | ✅ |
| F2 | suggest 匹配 | test_suggest.py | 命中 note+concept | ✅ |
| F3 | suggest related | test_suggest.py | 图谱邻居 | ✅ |

## G. M4-Preflight Hardening（H1-H6）

| # | 检查项 | 验证方法 | 状态 |
|---|---|---|---|
| H1 | FTS5 输入清洗 | sanitize_fts_query 双引号包裹 + test_search_fts_special_chars | ✅ |
| H2 | create_note 校验前移 | has_forbidden_media_path 检查在 write_text 前 | ✅ |
| H3 | Event detail 列 | migration 005 + update_mastery(detail) + submit_answer 写入 quality | ✅ |
| H4 | SM-2 时间注入 | sm2_schedule(now=FIXED_NOW) + test_sm2 6 用例 | ✅ |
| H5 | 测试覆盖 | test_sm2.py (6) + test_rebuild.py (3) = 9 新测试 | ✅ |
| H6 | Dashboard 去 emoji | 无 emoji + #e6a817→var(--brand) | ✅ |

---

## 结论

| 项目 | 结果 |
|---|---|
| 总检查项 | 31 |
| 通过 | 31/31 |
| 跳过 | 0 |
| 结论 | **PASS** |
| 日期 | 2026-08-27 |
| 执行者 | AI + 用户 |

### 测试计数

- pytest: 52 passed（+14 from Gate 0）
- vitest: 2 passed
- build: pass

### Gate 0.5 通过。M4 可以开工。
