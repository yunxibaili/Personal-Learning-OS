# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-28 · 路线调整：前端冻结，后端优先 · P8-003E 执行中

---

## Task ID

**P8-003E Tutor Review Bridge + Auto Notes**（纯后端）

## 路线调整（用户指令 2026-08-28）

**前端暂时不动，优先完成全部后端。** 后端剩余队列（按序执行）：

```
P8-003E Review Bridge + Auto Notes   ← 当前
M7-007 Vault Conflict Preservation   （apply.py vault 分支 conflict copy + ADR-020 更新）
routers/sync pairing + manifest exchange（TECH_DESIGN §9 已设计未实现）
GET /api/v1/home 聚合端点（Mobile API Prep 决议 / P8-003 Home 数据层）
event_id/event_uuid 术语统一（micro-task）
T-EXPORT 导出脚本（首次公开发布前必须）
（M9 Trace Engine：待用户单独拍板，不自动启动）
```

前端押后项：P8-003 Home Experience · FE-001 Visual Polish · Tutor UI 深化。

## P8-003E 范围（两项，零前端）

### 1. Review Bridge：错答 → mistakes 断链修复
- **发现**：全仓零处 `INSERT INTO mistakes`——mistakes 表自 M3 建表无生产者，
  Tutor context.mistakes 永远为空（第三次"出口无入口"）
- 修复：`update_mastery()` 在 `event_type == "answer_wrong"` 时同事务插入
  mistakes 一行（description 含质量信息，append 型，每次答错一条）
- 效果链：review 答错 → learning_event + mistakes → Tutor context.mistakes

### 2. 乙路线 Auto Notes（ADR-014 附录 §2.8.1.2 已许可，触发条件已满足）
- `tutor_context.py` 加 `_get_auto_notes(conn, concept_id, exclude_ids, limit)`：
  以 concept title + aliases 查 notes_fts（复用 search_notes + sanitize_fts_query）
- POST /tutor/context body 增 `"auto_notes": bool`（**默认 false**——隐私面扩大
  必须显式开启，前端开关押后）
- 显式引用优先：auto 只补 `2 - len(explicit)` 个名额，排除已引用 id
- 反向断言调整：未引用**且未命中**的笔记不得出现

## 测试（守护先行）

- review 答错 → mistakes 行存在 → build_tutor_context().mistakes 非空（三跳连通）
- answer_wrong 经 POST /events 手动提交同样落 mistakes（入口一致性）
- auto_notes=true：concept 关联笔记被命中进 context；显式引用占位后 auto 只补缺；
  无命中 → notes 仅含显式部分
- auto_notes=false（默认）→ 行为与现状完全一致（回归）
- 反向：命中集之外的笔记正文不出现

## Forbidden

不动前端（含 TutorPanel）· 不引向量库/jieba · 不改 ADR-011 ·
不自动启动 M9 · 不动同步链（M7-007 单独任务）

## Acceptance

pytest 476+ 全绿 · build/vitest PASS（前端零改动应保持）· 文档同步
（tutor-context.md / ADR-014 附录触发记录 / TECH_DESIGN §9 如涉及）· 单 commit
