# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-28 · 路线调整：前端冻结，后端优先 · P8-003E 执行中

---

## Task ID

**P8-003E Tutor Review Bridge + Auto Notes**（纯后端）

## 路线调整（用户指令 2026-08-28 + PM 裁决 D1-D4）

**前端暂时不动，优先完成全部后端。** 执行队列（PM 拍板版）：

```
1. 空表盘点（D5 微任务）            ✅ 2026-08-28 → docs/DATA_MODEL.md
2. M7-007 Vault Conflict Preservation   ← 下一项（先补安全网再扩同步面）
3. T-EXPORT 导出脚本（D2：承诺兑现，首次公开发布前置；盘点确认范围无需收窄）
4. pairing + manifest exchange（D4：必须带 CLI/脚本驱动调用路径，否则降级至前端解冻后）
5. event_id / event_uuid 术语统一（micro-task）
   ── 以下阻塞于前端解冻 ──
   /home 聚合端点（D1：前端冻结期零消费方，移出活跃队列）
```

**裁决记录**：
- D1 /home → 移出活跃队列（撞"漂亮空壳"铁律：零消费方）
- D2 T-EXPORT → 批准插队（PRODUCT_PRINCIPLES §1 一键导出承诺兑现；极便宜：
  zip(vault+eventlogs+mind_maps) + settings 去 key）
- D3 M7-007 先于 pairing → 认可且理由写死：conflict preservation 是安全网，
  pairing 扩大同步面；先补网再扩面，与"守护先行"同原则
- D4 pairing → 带 CLI 驱动才启动（无调用路径的端点=入口无出口）
- D5 空表盘点 → 已完成；**新规矩自下一 migration 生效：新表必须同提交登记
  生产者位置，无生产者不合入**（已写入 data-model/INDEX.md 顶部）
- ⚠️ 风险要求：M7-007 与 pairing 连续动 ADR-020——各自完成后必须重跑同步
  测试套件并重新核验三层模型（Layer1/2/3）仍成立

**盘点结果摘要（D5）**：14 张活表零死表；memories（extractor 双缺）·
conversations/messages（对话历史未立项）三张属 (b) 缺生产者待补、设计在案；
T-EXPORT 范围确认无需收窄。详见 docs/DATA_MODEL.md。

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
