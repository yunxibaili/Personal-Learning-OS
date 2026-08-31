# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-31 · **Phase 4 完成**（动效核对 + a11y 对比度归零 + 性能实测 + 原型入口清理）

---

## Task ID

**Phase 4 完成**（2026-08-31 · 4 视图对比度 0 处不达标 · LCP 468ms · CLS 0.0003）

## 当前任务

**前端阶段 Phase 0–4 全部完成**（2026-08-30 解冻 → 2026-08-31 收口）。

| Phase | 内容 | 状态 |
|---|---|---|
| 0 | 令牌归一 + 全局基线 | ✅ |
| 1 | 基础组件层 + 动效基元 | ✅ |
| 2 | AppShell 笔记优先三栏 | ✅ |
| 3 | 视图重做（编辑器/复习/图谱/Tutor/星系） | ✅ |
| 4 | 动效核对 + a11y + 性能收口 + 清原型入口 | ✅ |

**待项目所有者决定**（我不自行处置）：
1. **死代码删除**：`universe/`（KnowledgeUniverse + ConceptNode + PlanetNode，
   旧星系实现）、`universe/prototype/`（5 文件）、`planet/`（1 文件）——
   清掉 `#preview`/`#planet` 后已无人引用，共约 9 个文件
2. **本地知识库 + RAG**（属后端 AI 层，见 TASKS.md「前端阶段不做」）
3. `web/dist_verify/`、`web/dist_verify2/`（我的构建验证残留，未跟踪，可删）

**B10 本地 LLM（Ollama）实测 ✅**（2026-08-30：qwen3-14b 端到端，think 剥离修复见 §9.1）

## 近期完成

- **Phase 4 动效 + a11y + 性能 ✅**（2026-08-31）
  - 动效 6 基元核对：Phase 1 已落地，与 `ui/motion-primitives.html` 一致、CSS 齐备
  - a11y 对比度：4 视图**全部 0 处不达标**
    - `--text-3` `#A3A3A3`(2.52:1) → `#737373`(4.74:1)
    - 新增 `--brand-text #C2410C`(5.18:1)；`--brand` 降级为仅图形/填充
    - 修正 `UI_DESIGN.md` §2.2 笔误：旧写「3.6:1」，实测 2.84:1
  - a11y 结构：skip-link + 各视图 `h1` + `header/main/aside` landmark
  - 性能：**LCP 468ms**、**CLS 0.0003**（修前 0.0454）、离屏暂停生效、
    dpr=3 屏实测钳到 1.50、reduced-motion 下星系静止
  - 清理 `#preview`/`#planet` 原型入口与连带 import
- **Phase 3 ⑤ 星系（多星球系统）✅**（2026-08-31）
  - 层级来源 = 方案 A：从 wikilink 拓扑推断（项目所有者裁定）
  - 13 项语义单测全过：覆盖出度阈值/单向不认/排他归属/嵌套收编/16 上限/概念排除等
  - 双形态：全屏巡览 4s·可暂停·可手动点选 / 右栏单颗静止·dpr=1
  - 公转 72s/圈、橙色仅 mastery 弧与选中态
  - 顺带修掉 `GraphNode.refId` 契约违约（6 文件 22 处改 `ref_id`）

### 范围（收窄定案，v1 只做两类产出）

| 产出 | 处置 |
|---|---|
| memories | ✅ 做（唯一真零生产者表） |
| concept_suggestions | ✅ 做（复用 concepts 表：origin=ai_suggested + status=unconfirmed 即待确认队列，不新建表） |
| learning_events | 经 mastery.update_mastery(source='ai_extractor') 落——绝不裸 INSERT（C2：否则 eventlog 双写缺失→同步后事件消失） |
| mistakes | ❌ 不做（mastery.py:160 已是唯一生产者） |
| note_links | ❌ 不做（links.origin 枚举三处不一致，独立 micro-task 先统一） |

### 架构（修正 C1/C5）

1. `core/conversations.py` 新增 `update_message_context(message_id, extractor: dict)`
   ——extractor 结果写进本轮 assistant 消息 context_json 的 `extractor` 键
   （重放/重试覆盖同键 = 天然幂等）
2. **memories 落库是真写路径**（不止快照）：`core/memories.py` 新增
   `upsert_memory(...)` 应用层校验（表零 CHECK 不动 migration）：
   kind ∈ {fact, preference, goal, mistake_pattern} · importance/confidence ∈ [0,1]
   · 去重 = content 归一化前 50 字符相同视为重复，跳过
3. concept 建议：`ensure_entity_by_title` 后 origin 恒为 ai_suggested、
   status=unconfirmed（C4：origin='accepted' 非法，已从 spec 与
   TECH_DESIGN:546 删除）；Accept → 只改 status；Ignore → 删除 unconfirmed 桩
4. learning_events 全部走 `mastery.update_mastery(source='ai_extractor')`（C2）
5. 事务边界（裁决 3）：挂载 /chat 内 provider 调用后、落消息前，同请求同事务；
   超时上限 **30s**（裁决 2），超时静默跳过
6. **I5 假绿关闭**：FakeExtractorProvider 注入固定合法 JSON，强制覆盖
   「解析成功 → memories 落库 → 概念桩 → 快照含 extractor 键」全路径

### 裁决记录（5 项，2026-08-29）

1. Ignore = 删除 unconfirmed 桩（不引入 rejected 枚举）；补 VALID_STATUS 常量
2. extractor 超时 30s
3. memories.last_used_at：写入时=created_at；B8 接入时命中更新
4. origin='accepted' 删除 ✅
5. ADR-014 附录 §2.3.1 追认 ✅（本轮已落盘）

### 依赖前置（本轮已处理）

- fast_model 债清偿：LLMConfig.fast_model + ADR-014 附录 §2.6.1
- 工作区脏状态修复完成（scrub 剥离重写 + settings/export 共享判定）——524 passed
- 文档真值修正：PROJECT_STATE B1/B11 行 · TECH_DESIGN §6.1 状态表 · §6.3:546

### 守护测试清单（实现前先写红）

1. FakeExtractorProvider 全路径：memories 行存在 + 非法 kind/importance 拒绝
   + 前缀去重
2. concept 桩：ai_suggested/unconfirmed；Accept→active；Ignore→删除
3. update_mastery 链：eventlog 双写存在
4. assistant 快照含 extractor 键（重放幂等）
5. 非法 JSON → 静默跳过，answer 不受影响
6. api_key 不进 extractor 输出与落库（真实形态 key）

## 近期完成

**9.1/B1a OpenAICompatProvider** ✅（无凭据 · 盲区修复 · B1b 押后）

## 近期完成

**M7-007 Vault Conflict Preservation** ✅（B27 · 方案 a · P0 语义分化修复 · 498→507）

## 上上任务

**T-EXPORT（B11）** ✅ 完成（GET /api/v1/export · 493 passed）

## 上一任务存档

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
