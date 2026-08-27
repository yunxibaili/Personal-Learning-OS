# Test Matrix — 模块→测试映射

> 修改某模块时，必须跑哪些测试。AI 开发时必读。

---

## 使用方法

1. 找到你要修改的模块
2. 查「必须跑」列
3. 全部通过才能 commit

---

## 后端模块

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

## 前端模块

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
| App Layout | `web/src/App.tsx` | 布局 | `npm run build` + `npm run test` |

## 共享类型

| 模块 | 文件位置 | 修改触发 | 必须跑的测试 |
|---|---|---|---|
| shared/types/*.ts | `shared/types/` | API 契约 | `npm run build` + `pytest`（契约测试） |

---

## 交叉影响规则

```
改 core      → 必须跑对应 API 测试 + unit 测试
改 router    → 必须跑对应 API 测试
改 shared/   → 必须跑前端 build + 后端 pytest
改 migration → 必须跑 test_smoke.py（迁移幂等）
改 CSS       → 必须跑 npm run build
```

---

## 禁止

- ❌ 只跑单个测试文件就 commit
- ❌ 改了 core 不跑 API 测试
- ❌ 改了 shared/types 不跑 build
- ❌ 跳过 regression checklist
