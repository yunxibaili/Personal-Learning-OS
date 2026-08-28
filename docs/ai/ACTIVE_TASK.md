# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-28 · P8-003D Tutor Knowledge Base 任务卡就绪（两项前置裁定 + 三条补裁已定），等用户确认开工

---

## Task ID

**P8-003D Tutor Knowledge Base**（甲路线：显式引用）

## 前置裁定（全部已定，不再重议）

| # | 裁定 | 内容 |
|---|---|---|
| 裁1 | RAG 禁令 | ADR-014 追加带日期附录 §2.8.1：自 P8 起笔记内容可入 Tutor 上下文——(a) 用户显式引用（ADR-014:114 既有条款，即日生效）；(b) FTS5 自动检索由本附录解除、独立任务实施。**向量/Embedding/LangChain 维持永久禁止**（AGENTS §2.3） |
| 裁2 | 甲/乙路线 | **甲（显式引用）先行**；乙（自动检索）预登记 P8-003E，触发=用户反馈 @ 引用摩擦。甲的构件全部是乙的子集，零浪费 |
| 裁3 | conceptId 接线 | **纳入本任务**。Tutor tab 现为死 tab（App.tsx:35 零 props → conceptId 恒 undefined → 永远空状态，TutorPanel.tsx:143）。不接线则功能不可见——第三次"后端全绿前端看不到"盲区。接线走 **focusConceptId 跳转目标模式**（与 focusNoteId 同构，ui.ts:16-27 先例；属 UI 跳转目标，不违反"业务数据不进 store"） |
| 裁4 | 端点形态 | **新增 `POST /api/v1/tutor/context`**（body: concept_id + note_ids?）。GET /context/{cid} 保留向后兼容；不污染 POST /test 的 smoke 语义；为 M4-B prompt assembly 的 POST 形态铺路。TECH_DESIGN §9 登记 |
| 裁5 | 笔记来源 | **TutorPanel 内自选**（搜索选择器，复用 /api/v1/search，≤2 篇）。不用"自动带当前笔记"——显式性最强，贴合 ADR-014:114「用户明确引用」，不碰 store 业务数据规则 |

## 八项清单（AGENTS §12，含补裁修订）

1. **功能目标**：Tutor 可引用用户显式选择的笔记（≤2 篇）——确定性片段入 context/prompt；接通死 tab（conceptId 接线）；修 `suggest_for_context` 硬编码 `snippet: None`（knowledge.py:429）
2. **架构位置**：Core=`tutor_context.py` 加 `_get_user_notes()`（唯一组装点不变）；Router=新增 POST /tutor/context；Frontend=TutorPanel 选择器 + focusConceptId 消费。**不建检索管线、不动 FTS5、乙路线不做**
3. **Frontend 改动**：ui store 加 `focusConceptId`（跳转目标模式）；NoteEditor「问 Tutor」按钮 + GraphView 节点入口设 focus；TutorPanel 消费后 clearFocus；笔记搜索选择器（≤2）+ 已选 chip；无图标纯文字，ADR-013 合规
4. **Backend 改动**：`POST /tutor/context`（TutorContextRequest: concept_id:int, note_ids:list[int]≤2）；404 concept/note 不存在 · 400 超限；TECH_DESIGN §9 登记
5. **Core 改动**：`_get_user_notes(conn, note_ids)` → notes 表 + 既有文件读取；`_extract_snippet(body, max_chars=600)` 确定性取 frontmatter 后正文开头；`build_tutor_context(conn, concept_id, note_ids=None)` 注入 `notes` 键；注入时 MAX_RELATED 10→6、MAX_RECENT_EVENTS 5→3；suggest_for_context snippet 复用同一提取函数
6. **Data 改动**：零新表零迁移。只读 notes + vault
7. **API 设计**：`POST /api/v1/tutor/context` → 200 响应在现有 context 形状上增 `notes: [{note_id, title, excerpt}]`；错误 `{error:{code,message}}`；shared/types/tutor.ts 增类型；tutor-context.md §2 增带日期条件条目「user_referenced_notes」、§5 预算增记（片段≤600 字符≈300 token，注入时 related/recent 收缩，总预算仍 ≤~1700）
8. **文件变化**：core/tutor_context.py · routers/tutor.py · core/knowledge.py（snippet）· shared/types/tutor.ts · web/src/stores/ui.ts · components/tutor/TutorPanel.tsx · views/NoteEditor.tsx（按钮）· views/GraphView.tsx（入口）· docs（tutor-context.md / ADR-014 附录 / TECH_DESIGN §9）· tests（新 test_tutor_notes.py 或并入现有）· CURRENT_STATE/CHANGELOG/TASKS

## 测试（先于实现写，守护前置）

**连通性 5 跳**（每跳断言 note_id/内容相等）：
`note 文件 → notes 表 → context.notes → prompt（M4-B build_prompt）→ mock Provider 收到的 payload`

**反向断言（本项目首次，防"不该有的混入"）**：
- vault 两篇笔记只引用一篇 → 另一篇内容子串**不得出现**在 context/prompt
- context 序列化不含 api_key / settings / vault 绝对路径

**正向可达性（用户补充采纳——防死 tab 复发）**：
- TutorPanel 传入 note_ids → 必须出现在 context.notes（组件级测试）
- focusConceptId 置值 → TutorPanel 渲染 context 而非空状态（死 tab 回归守护）
- prompt 中笔记片段 token ≤600 字符上限

**边界回归**：不传 note_ids → 行为与现状完全一致；3 篇→400；不存在的 note→404

## Forbidden

- 不引向量库 / jieba / 新 npm 依赖（cobe 之外零新增）
- 不改 ADR-011 分词冻结、不动 FTS5 检索管线
- 不做乙路线自动检索（P8-003E 预登记）
- 不动 mastery / learning_events / 同步链
- 乙路线不做（P8-003E 预登记，触发=用户反馈引用摩擦）

## Acceptance

1. pytest 全绿（463 基线自然增长，预估 +12~18）· build/vitest PASS
2. 死 tab 复活：focusConceptId → TutorPanel 显示 context（人工可验）
3. 五跳连通 + 反向断言 + 可达性断言全部在库
4. 文档同步义务完成（ADR-014 附录 / tutor-context.md / TECH_DESIGN §9）
5. git clean 单 commit

## 下一步队列

P8-003E Tutor Review Bridge（含乙路线预登记）→ Home / UI Polish
