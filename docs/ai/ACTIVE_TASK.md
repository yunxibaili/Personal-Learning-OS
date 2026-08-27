# Active Task

> AI 工作记忆：当前正在做什么。

---

## Task ID

M4-A Tutor Context API

## Goal

实现 `GET /api/v1/tutor/context/{concept_id}`，返回 AI 可消费的结构化学习上下文。
不接 LLM。不生成回答。纯数据读取层。

## Allowed Changes

- `server/app/core/tutor_context.py` — Context Builder（新文件）
- `server/app/routers/tutor.py` — Tutor Router（新文件）
- `server/app/main.py` — 挂载 tutor_router
- `shared/types/tutor.ts` — 契约类型
- `server/tests/test_tutor_context.py` — 测试
- `docs/ai/CURRENT_STATE.md` — 更新状态
- `docs/tasks/TASKS.md` — 回填报告

## Forbidden Changes

- ❌ LLM Provider / llm.py
- ❌ Prompt Template / tutor.py 中的 prompt
- ❌ Chat UI
- ❌ Embedding / Vector DB / RAG
- ❌ Agent / Function Calling
- ❌ 修改 mastery schema
- ❌ 修改 Graph API
- ❌ 修改 knowledge.py / mastery.py / review_scheduler.py

## Acceptance Criteria

- `GET /api/v1/tutor/context/{concept_id}` 返回完整上下文
- Concept 不存在返回 404
- Response 不包含 api_key / settings / raw markdown
- 最多返回 5 条 mistakes、10 个 related
- pytest 全量通过
- npm run build 通过
