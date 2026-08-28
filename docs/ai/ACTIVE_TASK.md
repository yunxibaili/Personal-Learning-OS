# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-28 · 路线调整：前端冻结，后端优先 · P8-003E 执行中

---

## Task ID

**P8-003E Tutor Review Bridge + Auto Notes**（纯后端）

## 路线调整（D1-D5 已落盘 · 审核收口 2026-08-29 完成 · 两项裁决待确认）

**审核收口（2026-08-29 已执行）**：
- ✅ SYNC.md 三重矛盾统一（vault：实然 LWW，M7-007 目标态双份；mindmap 行对齐 CONFLICT_BACKUP）
- ✅ ADR-020 §2.1 MindMap 行回改（追认 M7-004 CONFLICT_BACKUP，带修订标注）
- ✅ 残留清零：3 处代码注释断链（core/__init__ · db.py · note.ts）+ README/PROJECT_BRIEF/PRODUCT_PRINCIPLES + ADR-017 自引——活文档旧路径 0 处
- ✅ PROJECT_STATE 基线更新（2852866 / 108 commits）· README 焦点行更新

**待项目所有者确认的两项裁决（建议已给出）**：
- 裁决 1（M7-007 与 §9 归属）：建议**入 §9 给位次**（保持解冻条件单一来源）。
  同时接受优先级 pushback：队列调整为 **T-EXPORT（B11，README 背书 + D2 批准 + 体量小）
  先于 M7-007**；M7-007 的显式优先理由 = 修复 ADR-020 既成事实违反的安全网 +
  E2E 显式 no-op 缺口，但不再抢占 T-EXPORT。
- 裁决 2（ADR-020 修订方式）：建议 **ADR-020 内联修订 + 修订标注**（不开 ADR-024）。
  理由：修订性质为追认既成事实 + 细化 Layer 1 冲突策略，三层真值模型本体不动；
  先例 ADR-014 附录 §2.8.1；避免同主题双 ADR。MindMap 行已按此形式修订。

**执行队列（更新版）**：
```
1. 审核收口四项                    ✅ 2026-08-29
2. T-EXPORT 导出脚本（B11）        ← 下一项（裁决 2 不阻塞它）
3. M7-007 Vault Conflict Preservation（等裁决 1/2 确认，含 ADR-020 内联修订）
4. 9.1 AI 闭环（§9 自标最高优先）
5. pairing + manifest（D4：CLI 驱动前置）
6. 术语统一 micro-task
```

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
