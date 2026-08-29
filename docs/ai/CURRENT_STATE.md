# Current State

> 人类全景状态见 `docs/PROJECT_STATE.md`（唯一状态来源）；本文件是 AI 会话增量快照。

> AI 启动时必读第二份。每次 git commit 后同步更新。
> 上次更新：2026-08-30 · Branch：main ·
> Clean：**no**——B12/B2-B/B13/B17/B18/B21/B22/B24 后端闭环批已完成并提交，待文档登记头部同步

---

## 当前里程碑

M5 ✅ → M4-Preflight ✅ → M4-A ✅ → M4-B ✅ → Gate 1 ✅ → M4-C ✅ → Smoke ✅ → M4-D ✅ → M4.5 ✅ → M4-E ✅ → M3b-001 ✅ → M3b-002 ✅ → M3b-003 ✅ → M3b-004 ✅ → M2b-001 ✅ → M2b-002 ✅ → M2b-003 ✅ → ADR-020 ✅ → P2 Atomic Write ✅ → M7-001 Sync Engine Core ✅ → M7-001 Stabilization ✅ → M7-Nightly Audit ✅ → M7-001.5 Sync Simulation ✅ → ADR-022 ✅ → M7-002 LAN Discovery ✅ → M7-003 Sync Transport ✅ → M7-004 Sync Apply ✅ → M7-005 Conflict UI ✅ → M7-006 E2E LAN Demo ✅ → P8-001A Concept Foundation ✅ → P8-001B Knowledge Universe V2 ✅ → P8-001C Knowledge Planet ✅ → P8-004 Demo Cleanup ✅ → P8-002 Graph V2 ✅ → P8-003A Review Session MVP ✅ → P8-003C Vault Reindex ✅ → P8-003B Mastery Decay ✅ → P8-003D Eventlog Producer ✅ → **P8-003D-CodeReview P0 修复 ✅** → **B2-A 流式输出（SSE）骨架 ✅** → **后端闭环批 B12/B2-B/B13/B17/B18/B21/B22/B24 ✅**

## Last Completed

**后端闭环批（2026-08-30，均已提交 main）**：
- B12 错题本 API：`GET /api/v1/mistakes`（resolved/concept_id 过滤+分页）· `GET /mistakes/stats` · `GET/PATCH(mistake resolved)/DELETE /{id}`；`core/mistakes.py`（10 tests）。
- B2-B OpenAICompatProvider 真 SSE：`stream()` 实现 `stream:true` + 逐条 `data:` 帧解析（取 `choices[0].delta.content`，`[DONE]` 收尾），stdlib 零新依赖（6 tests）。
- B13 Review 历史分析：`GET /review/stats`（total/correct/wrong/accuracy/current_streak/by_concept），`core/review_stats.py`（3 tests）。
- B17 增量 reindex：`reindex_vault(changed_paths=...)` 增量 upsert+删除（含 `_safe_vault_file` 越界守卫）；`POST /admin/reindex` body `changed_paths`（6 tests）。
- B18 大纲反解析：`core/mindmap.build_outline`/`get_map_outline` + `GET /mindmaps/{id}/outline`（4 tests）。
- B21/22/24：`core/timeutil.now_iso` 去重 + 删 review_scheduler 死码；mastery eventlog 失败加日志；`load_or_create_device` 进程内缓存 + 损坏备份 `.corrupt`（3 tests）。
- 验证：pytest **681 passed** · tsc PASS · vitest 23 · vite build PASS。

B8.1 Memory Context Integration 完成（importance × recency 复合排序 + 确定性 tie-breaker + 端到端验证，563→569 passed）。

B7.2 端到端守护 + Ignore 语义收口完成（软删 status=ignored + 集成测试锁死全链路 + EXTRACTOR_PROMPT braces 修复，571→576 passed）。

B3.1 Extractor Integration Audit 完成（合并重复 update_message_context + 11 项集成测试，552→563 passed）。

B3 Extractor v2 完成（memories 生产者 + 概念建议桩 + 快照回写 + update_mastery 链，551→552 passed）。

B8 memories 进 Tutor 上下文完成（复合排序+敏感排除+命中刷新，550→558 passed）。

B7 对话持久化 + 最小非流式对话完成（POST /api/v1/chat，快照落库，507→516 passed）。

P0 修复（vault 冲突副本语义分化，ADR-020 §2.1.2-a）+ 9.1/B1a OpenAICompatProvider（无凭据落地，settings 驱动 factory）。

M7-007 Vault Conflict Preservation 完成（方案 a：vault 冲突 .conflict 副本隔离白名单，ADR-020 附录 §2.1.2）。

T-EXPORT（B11）一键全量导出完成（GET /api/v1/export，守护先行 7 tests）。

P8-003E Review Bridge + Auto Notes 完成（mistakes 断链修复 + 乙路线 auto_notes，纯后端）。

P8-003D Tutor Knowledge Base 完成（甲路线：显式引用 · POST /tutor/context · 死 tab 复活 · 守护测试先行）。

P8-003D-CodeReview P0 修复完成。
P0-1：设备身份合并，删除 _get_device_id()，复用 core/sync/device.py 的 load_or_create_device()。
P0-2：migration 007 补 event_uuid 列 + UNIQUE 索引 + INSERT 写入。
  历史行保持 NULL，不做回填（learning-model.md:219 追加式约束禁止修改已写入的 learning_events 行）。
P0-3：notes.py 连接泄漏修复（try 块内读取 row，finally 块关闭）。
pytest 459 · tsc PASS · vite build PASS。

遗留（见 docs/TECH_DESIGN_REVIEW.md §6.7.3）：
- event_uuid 目前只写不读（同步去重走 jsonl 的 event_id，消费方待 M8）
- load_or_create_device() 无内存缓存，且 devices.json 解析失败时会静默生成新 device_id 并覆盖原文件
- CURRENT_STATE 原写「UPDATE 回填」与实现不符，已更正

P8-003C Vault Reindex 完成。
Markdown → SQLite 索引恢复机制。新增 core/reindex.py（reindex_vault 纯函数）+
POST /admin/reindex 端点 + Sync receive 后自动 reindex hook。
接口预留 changed_paths 增量模式，删除检测默认关闭（prune_missing=False）。
13 项单元测试（基础/幂等/删除安全/links/sync hook）。
pytest 439 · tsc PASS · vite build PASS。

P8-003A Review Session MVP 完成。
SM-2 复习流程接入真实 UI。不新增后端、不改数据模型、不加新依赖。
ReviewSessionView.tsx（idle→loading→ready→answering→feedback→done 状态机）+
DashboardView 保留快速入口 + CSS 120行复习样式。
ReviewItem 增加 effective 字段对齐后端实际返回。
vitest 23 passed · pytest 426 · vite build PASS。

P8-002 Graph V2 完成。
关系探索视图：dagre 层级布局 + Concept（圆形）/ Note（方形）双视觉 +
Layer Toggle（Mixed/Concept/Note）+ Edge 视觉层次（9种 relation 样式）+
MiniMap 导航 + Floating Inspector + hover relation label。
dagre ^0.8.5 安装（六连问通过，REGISTRY 登记）。
vitest 23 passed（layout 7 + universe 14 + ui 2）· pytest 426 · vite build PASS。

P8-001C Knowledge Planet 完成（commit 7918d5e）。
Cobe WebGL 点阵地球（MiMo 风格）+ 4 条错倾轨道卫星（笔记驱动）。
性能契约：dpr=1 · 280px canvas · 30fps 节流 · IntersectionObserver/visibilitychange 暂停。
挂载 DashboardView，拖动旋转 + hover/click 交互。

## 已完成

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 双端脚手架 + migration runner | ✅ |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件/FTS5） | ✅ |
| M2-A~E | 双链·反链·图谱（links/CTE/React Flow） | ✅ |
| M3 | Learning Graph（掌握度/SM-2/Dashboard） | ✅ |
| M3.5-A | Knowledge Radar MVP（上下文匹配+Radar面板） | ✅ |
| M5 | Review Loop（复习队列/优先级/时间线/learning-model） | ✅ |
| M4-A | Tutor Context Infrastructure + API | ✅ |
| Gate 0.5 | M4-Preflight Hardening（H1-H6） | ✅ |
| M4-B | Prompt Assembly（build_prompt + 16 tests） | ✅ |
| ADR-015 | Multilingual Knowledge Support | ✅ |
| Gate 1 | AI Boundary Audit（6/6 PASS） | ✅ |
| M4-C | LLM Provider（Protocol + Mock + Service） | ✅ |
| Smoke | Tutor 全链路验证 | ✅ |
| ADR-016 | Tutor UI Design | ✅ |
| M4-D | Tutor Panel（context panel + modes） | ✅ |
| ADR-017 | Architecture Visualization | ✅ |
| M4.5 | Architecture Visualization Milestone | ✅ |
| M4-E | Tutor Evaluation（评估体系 + 禁止测试） | ✅ |
| ADR-018 | Knowledge Universe Design | ✅ |
| M3b-001~004 | Universe（Projection + Layout + Interaction + Navigation） | ✅ |
| ADR-019 | MindMap Boundary（Universe ≠ MindMap 冻结） | ✅ |
| M2b-001 | MindMap Canvas（CRUD + React Flow） | ✅ |
| M2b-002 | Concept Binding（bind/unbind + search + 前端面板） | ✅ |
| M2b-003 | Export/Import（.map.json + 前端按钮） | ✅ |
| ADR-021 | MindMap Exchange Format v1 | ✅ |
| ADR-020 | Sync Truth Model（三层真值模型冻结） | ✅ |
| P2 | create_note atomic write（write→fsync→rename） | ✅ |
| M7-001 | Sync Engine Core（manifest + scanner + diff） | ✅ |
| Stabilization | M7-001 审计 + 修复（glob bug + settings boundary + tests） | ✅ |
| M7-Nightly | Full Audit Sprint（全量审计） | ✅ |
| M7-001.5 | Sync Simulation Environment（仿真环境） | ✅ |
| ADR-022 | Product Mode Boundary（产品模式边界冻结） | ✅ |
| M7-002 | LAN Discovery（UDP 广播设备发现） | ✅ |
| M7-003 | Sync Transport（消息协议 + 原子传输，无 Apply/Conflict） | ✅ |
| M7-003.5 | Documentation & Architecture Sync Audit（6067332） | ✅ |
| M7-004 | Sync Apply Layer（core/sync/apply.py + 27 tests） | ✅ |
| M7-004.5 | Sync Boundary & Recovery Audit（fail-closed 修复 + 19 tests） | ✅ |
| M7-005 | Conflict UI（SyncStatusPanel + /sync/status,/resolve，方案 a） | ✅ |
| M7-006 | E2E LAN Demo（真实两进程全链路 + Recovery） | ✅ |
| M7-006.5 | Sync Release Audit（稳定发布基线 PASS） | ✅ |
| M7-Preview-001 | Local Demo Preparation（seed_demo.py 已就位，等用户体验） | `[~]` |
| P8-001A | Concept Foundation（/api/v1/concepts + origin 唯一来源 + ADR-023） | ✅ |
| P8-001B | Knowledge Universe V2（Planet + force 聚类 + Inspector + drag 持久化） | ✅ |
| P8-001C | Knowledge Planet（Cobe 地球 + 轨道卫星 + 性能契约，7918d5e） | ✅ |
| P8-004 | Demo Cleanup（清除 TestConcept/MasteryTest 探针残留） | ✅ |
| P8-002 | Graph V2（dagre 层级布局 + 双视觉 + Layer Toggle + Inspector） | ✅ |

## Next Up

> **编号以 `PROJECT_STATE.md §9` 为准。** 本节曾用旧编号
> （B9 = Memory CRUD API / B10 = Memory Agent），与 §9 的
> B9 = 中文 FTS 分词、B10 = 本地 LLM 实测**冲突**；Memory CRUD 已按新编号
> **B28** 落盘，下述列表已重写。

- **B2-A 流式输出（SSE）骨架 + B2-B openai_compat 真 SSE** ✅（2026-08-30）
  - 交付：Provider `stream()` · Mock 确定性分块 · `/chat` SSE `StreamingResponse` ·
    `event:done`/`event:error` · try/finally 落库 · ADR-003 附录 §A · openai_compat SSE 解析
- **B4 自动链接建议 · B5 AI 概念提取 · B6 AI 生成思维导图** ← 剩余 AI 自动链路
- **B1b 真实 Provider 凭据冒烟**（需外部凭据，无法本地验证）
- **B9 中文 FTS 分词（ADR-011 未解决）· B10 本地 LLM（Ollama）实测**（需本地 Ollama）
- **Memory Agent（智能记忆管理——沿用旧编号 B10 的实质内容，未排期）**

**不属于 Next Up**：P8-FE-001 Visual Language Polish 与一切前端任务
——`PROJECT_STATE.md §0` 后端优先政策下无限期冻结，解冻需所有者显式宣布。
M8 Mobile 延后（先 PC 完整化，路线决议见 TASKS §路线决议）。

## Do Not Touch

- `KnowledgeRadar.tsx` — M3.5-A 已冻结，ADR-012 范围
- `GraphView.tsx` — M2-E 稳定，除非修 bug
- `001_init.sql` — 历史兼容，新表走新 migration
- `shared/types/*.ts` — API 契约，改需同步 pytest 契约测试
- `review_scheduler.py` — SM-2 独立模块，替换需开 ADR
- `tutor_context.py` — M4-A 已完成，不改逻辑
- `ai/tutor.py` — M4-B 已完成，只改 constants.py 调参
- `ai/providers/` — M4-C 已完成，新 Provider 走 providers/ 目录

## Frozen Domains

| 领域 | 状态 | 关联 |
|---|---|---|
| Markdown 模型 | Frozen | ADR-001 |
| Graph API | Frozen | M2-D |
| Knowledge Radar | Frozen | M3.5-A, ADR-012 |
| Mastery 引擎 | Frozen | M3, learning-model.md |
| SM-2 调度 | 可替换但需 ADR | review_scheduler.py |
| Frontend Design | Frozen | ADR-013 |
| AI Tutor 边界 | Frozen | ADR-014 |
| Prompt Contract | Frozen | M4-B, prompt-contract.md |
| Multilingual | Frozen | ADR-015 |
| Tutor UI | Frozen | ADR-016 |
| AI Boundary | Frozen | Gate 1 |
| LLM Provider | Frozen | M4-C, ProviderProtocol |
| MindMap Boundary | Frozen | ADR-019 |
| MindMap Exchange Format | Frozen | ADR-021 |
| Sync Truth Model | Frozen | ADR-020 |
| Product Mode Boundary | Frozen | ADR-022 |

## Known Risks

- 中文 FTS 分词未解决（unicode61 按字切分，长句检索有限，ADR-011）
- 移动端同步未启动（M7/M8，ADR-005/006）
- 本地 LLM 未实测（Ollama 路径理论通，未验证）
- Trace 引擎推迟（M9+）
- TipTap 数学扩展为社区维护（@aarkue），非官方

## 架构审查备忘

- 保持四层空间边界：Knowledge → Learning → Thinking → AI
- M7-002 起需要 HTTP manifest exchange + device pairing

## 测试命令

```
pytest -q          → 651 passed
npx vitest run     → 23 passed
npx vite build     → pass
.\scripts\test.ps1 → 全量
```

## 本次会话改动（B2-A 流式输出 SSE）

- `server/app/core/ai/providers/base.py`：`LLMProvider` 协议新增 `stream() -> Iterator[str]`
  （`"".join(stream)==complete` 契约）
- `server/app/core/ai/providers/mock.py`：`MockProvider.stream()`（`DEFAULT_CHUNK_SIZE` 字符确定性分块，
  复用 complete 分派）
- `server/app/core/ai/providers/openai_compat.py`：`stream()` 非流式回退（真 SSE 解析留 B2-B）
- `server/app/core/ai/service.py`：`TutorService.ask_stream()`（生成器，错误映射同 ask）
- `server/app/routers/conversations.py`：`ChatRequest.stream` 参数 + `_chat_stream` SSE 生成器
  （自持连接、try/finally 落库 + extractor、`event:done`/`event:error`）；非流式路径复用
  `_apply_turn_extractor`；路由 `response_model=None` 规避 `dict|StreamingResponse` 契约冲突
- `shared/types/tutor.ts`：`TutorStreamFrame` 流式帧契约类型
- `docs/adr/ADR-003-llm.md`：附录 §A 追认 B1a 非流式偏离 + B2 恢复流式
- 测试：`test_llm_provider.py`（MockProvider.stream 5 + ask_stream 3 + 错误 2）·
  `test_openai_provider.py`（stream 回退 1）· `test_conversations.py`（TestChatStreaming 8）
- 验证：pytest 651 · tsc PASS · vitest 23 · vite build PASS（build --outDir dist-verify）

## 本次会话改动（B7.1 Conversation History）

- `server/app/core/ai/providers/mock.py`：
  MockProvider 默认返回合法 JSON（extractor 需要），含 metadata.mode 检测：
  extractor 调用返回空结果 JSON，Tutor 调用返回人类可读文本。
- `web/src/components/tutor/TutorPanel.tsx`：
  - 移除 conceptId==null 时的早退，SuggestionList 始终可见
  - handleSubmit 后递增 suggestionRefreshKey 触发 SuggestionList 刷新
- `web/src/components/suggestions/SuggestionList.tsx`：
  +refreshKey prop，对话后自动 refetch；错误处理改为 console.error（移除误导性 ADR-014 注释）
- `web/src/components/universe/KnowledgeUniverse.tsx`：
  Floating Inspector 新增 "Ask Tutor" 按钮（openTutorForConcept）
- `server/tests/unit/test_llm_provider.py`：修复 test_default_response 断言对齐新默认响应
- 验证：pytest 569 · tsc PASS · vitest 23 · vite build PASS

## 本次会话改动（B3.2 Concept Suggestion UI）

- `web/src/components/suggestions/SuggestionList.tsx`（新建）：
  AI 概念建议人工确认入口。GET /concepts?status=unconfirmed&origin=ai_suggested →
  显示标题 + 摘要 + Accept/Ignore 按钮 → PATCH status/DELETE → 列表更新。
- `web/src/components/suggestions/SuggestionList.css`（新建）：
  建议列表样式（ADR-013 合规：无装饰、无渐变、无阴影）。
- `web/src/components/tutor/TutorPanel.tsx`：
  挂载 SuggestionList 组件（Answer 段下方）。
- 验证：pytest 569 · tsc PASS · vitest 23 · vite build PASS

## 本次会话改动（B8.1 Memory Context Integration）

- `server/app/core/memories.py`：
  - get_memories() 排序从 `ORDER BY importance DESC` 改为复合排序：
    `ORDER BY importance DESC, last_used_at DESC, created_at DESC, id DESC`
  - 确定性 tie-breaker：importance → last_used_at → created_at → id
  - touch_on_hit 注释更新（B8.1：命中后刷新 recency 排序位）
- `server/tests/unit/test_memories.py`：+3 项测试
  - test_recency_tie_breaker：同 importance 时 last_used_at DESC 排序
  - test_deterministic_tie_breaker：同 importance + 同 last_used_at 时 created_at DESC
  - test_touch_on_hit_updates_last_used_at：touch_on_hit=True 刷新 last_used_at
- `server/tests/integration/test_extractor_integration.py`：+3 项测试
  - test_memory_enters_tutor_prompt：Memory → TutorContext → prompt
  - test_memory_recency_ordering_in_context：TutorContext 中 recency 排序验证
  - test_memory_budget_respected：MAX_MEMORIES 限制验证
- `server/tests/unit/test_memories_context.py`：修复 test_segmented_budget 断言对齐新排序（id DESC）
- 验证：pytest 569 · tsc PASS · vitest 23 · vite build PASS

## 本次会话改动（B3.1 Extractor Integration Audit）

- `server/app/core/conversations.py`：合并两个重复的 update_message_context 为一个
  - extractor 结果存入 `ctx["extractor"]` 键（非直接 merge）
  - 删除重复的第二函数定义
- `server/tests/integration/test_extractor_integration.py`（新建，11 项）：
  - 完整链路 / extractor 失败不影响 answer / 非法 JSON / memory 幂等
  - concept suggestion 生命周期（accept/ignore）/ learning event 链
  - extractor 快照 / secret 排除 / 无重复写入 / E2E
- 验证：pytest 563 · tsc PASS · vitest 23 · vite build PASS

## 本次会话改动（Earth UI 示例入库）

- `ui/`（新建）：UI 示例统一目录。earth-hero.html（MiMo 风格 Canvas 点阵地球 Hero 版）+
  earth-planet-card.html（280px Dashboard 卡片版，对齐 P8-001C 性能契约）+ assets/dots-world.png。
  原型取自 111/earth-effect，按项目约定改造（--brand 橙色生命线 / 卫星=笔记 / 节点=概念+mastery 弱化 / 30fps+reduced-motion）。
- `docs/DESIGN.md`（新建）：地球效果规格冻结（语义映射 / 渲染参数 / 性能契约 / Cobe vs Canvas 2D 方案对比）
- `docs/DESIGN.md`：新增 Earth UI 指向
- `ui/README.md`：示例索引与新增规则
- 需求更新（2026-08-28 二轮）：自转接缝回退闪烁修复（贴图正像+镜像无缝拼接）+
  近地轨道多环（4 条错倾，内环更快）+ 卫星改彩色圆点+墨色拖尾（去掉太阳能板形状）+
  卫星大小随笔记字数增长封顶 MAX_SAT_PX；EARTH_UI.md 规格已同步
- 卫星跳变修复（三轮）：前后半球切换点透明度/大小/拖尾粗细改由深度 sin(t) 连续计算，消硬切跳变
- 111 组件整合（2026-08-28）：app-redesign.html（集成版全页预览，自 111/ui-redesign/prototype.html 入库）+
  ui/react/HeroEarth.tsx（自 111/mimo-clone HeroEarth.tsx 改造为 React 组件：LEO+圆点拖尾+字数定大小+
  无缝贴图+深度连续，strict tsc PASS，浏览器验证通过）；EARTH_UI.md 方案对比扩为三套（Cobe/Canvas 2D/React）

## 本次会话改动（P8-002 Graph V2）

- `web/src/lib/graph/layout.ts`：dagre 层级布局引擎（纯函数，不 import React）。
  dagreLayout(nodes, edges) → 坐标 + 画布尺寸。nodesep/edgesep/ranksep 参数化
- `web/src/lib/graph/layout.test.ts`：7 项测试（空输入/单节点/层级方向/同层/确定性/混合类型）
- `web/src/components/graph/GraphConceptNode.tsx`：圆形概念节点（固定尺寸，mastery 仅 tooltip）
- `web/src/components/graph/GraphNoteNode.tsx`：方形笔记节点（document card 风格）
- `web/src/components/graph/GraphEdge.tsx`：关系边（9种 relation 样式：wikilink 细浅线/prerequisite 粗实线/related 虚线等）
- `web/src/views/GraphView.tsx`：完全重写。dagre 布局 + Layer Toggle（Mixed/Concept/Note）+
  MiniMap + Floating Inspector + hover relation label + domain 过滤
- `web/src/global.css`：+80行 Graph 样式（.gnode concept/note/.gnode-tooltip/.gedge/layer-toggle/inspector）
- `docs/DEPENDENCIES.md`：dagre ^0.8.5 登记
- 验证：tsc PASS · vitest 23 · vite build PASS · pytest 426

## 本次会话改动（P8-003D-CodeReview P0 修复）

- `server/app/routers/notes.py`：修复连接泄漏（line 110），try 块内读取 row，finally 块关闭
- `server/app/core/mastery.py`：删除 _get_device_id()，复用 core/sync/device.py 的 load_or_create_device()
- `server/migrations/007_event_uuid.sql`（新建）：ALTER TABLE learning_events ADD COLUMN event_uuid + UNIQUE 索引
- `server/tests/test_smoke.py`：migration count 6→7
- `server/tests/unit/test_eventlog.py`：移除 _get_device_id/_DEVICE_ID 引用，新增 test_device_identity_shared_with_sync
- 验证：pytest 459 · tsc PASS · vite build PASS

## 本次会话改动（P8-003D Eventlog Producer）

- `server/app/core/mastery.py`：
  新增 _get_device_id()（设备唯一标识生成+持久化）+
  _write_eventlog()（追加 JSONL 到 metadata/eventlogs/<yyyy-mm>.jsonl）+
  update_mastery() 同事务调用 _write_eventlog()（OSError 不阻断）。
  eventlog JSON 格式：event_id + concept_id + event_type + dimension + weight + source + detail + device_id + created_at。
- `server/tests/unit/test_eventlog.py`（新建，8项测试）：
  device_id(3) + write_eventlog(2) + 集成(3)
- 验证：pytest 461 · tsc PASS · vite build PASS

## 本次会话改动（P8-003B Mastery Decay）

- `server/app/core/mastery.py`：新增 decay_effective()（Ebbinghaus 衰减，tau=14天半衰期）+
  get_effective_now()（动态计算当前掌握度，last_seen=MAX learning_events.created_at）+
  _get_last_seen()（UTC-aware 时间解析）
- `server/app/routers/mastery.py`：review_today 改为 Python 侧排序（effective_now）+
  _format_mastery 增加 effective_now 输出 + 所有端点传递 conn
- `server/app/core/tutor_context.py`：_get_mastery() 使用 get_effective_now()（AI Tutor 看到衰减后掌握度）
- `server/tests/unit/test_decay.py`（新建，14项测试）：
  衰减函数(8) + get_effective_now(4) + 时间真实性(2)
- `shared/types/mastery.ts`：MasteryDetail + ReviewItem 增加 effective_now 字段
- 验证：pytest 453 · tsc PASS · vite build PASS

## 本次会话改动（P8-003C Vault Reindex）

- `server/app/core/reindex.py`（新建，~100行）：
  reindex_vault(conn, vault_root, changed_paths=None, prune_missing=False) 纯函数。
  扫描 vault/*.md → upsert_note_index + rebuild_note_links + 可选 prune 删除。
  接口预留 changed_paths 增量模式（MVP 退化为全量）。
- `server/app/routers/notes.py`：新增 admin_router + POST /api/v1/admin/reindex 端点
- `server/app/routers/sync.py`：receive 后触发 reindex_vault（Post-sync consistency hook）
- `server/app/main.py`：注册 admin_router
- `server/tests/unit/test_reindex.py`（新建，13项测试）：
  基础(4) + 幂等(2) + 删除安全(3) + Links(3) + Sync Hook(1)
- 验证：pytest 439 · tsc PASS · vite build PASS

## 本次会话改动（P8-003A Review Session MVP）

- `web/src/views/ReviewSessionView.tsx`（新建，~200行）：
  SM-2 复习流程 MVP。状态机 idle→loading→ready→answering→feedback→done。
  开始复习按钮 → GET /review/today → 概念卡片（标题+掌握度+上次结果）→
  三按钮评分（😵忘记了(1)/🤔有点模糊(3)/✨记得很清楚(5)）→
  POST /review/{id}/answer → feedback（mastery 变化+下次复习日期）→ 下一个/完成。
  完成统计：复习数量+记忆保持率。使用 apiGet/apiPost（架构合规）。
- `web/src/App.tsx`：ReviewQueueView → ReviewSessionView（case "review"）
- `web/src/global.css`：+120行复习状态样式（.review-session/.review-card-main/
  .review-quality-btn/.review-feedback/.review-progress 等）
- `shared/types/mastery.ts`：ReviewItem 增加 effective 字段（对齐后端实际返回）
- 验证：tsc PASS · vitest 23 · vite build PASS · pytest 426

## 本次会话改动（P8-004 Demo Cleanup）

- 清除 workspace/db/learning-os.db 中早期探针残留：
  - `TestConcept`（id=1）+ `MasteryTest`（id=2）
  - 关联删除：links 4行 · concept_mastery 1行
  - 使用精确 `WHERE title IN (...)` 删除，无模糊匹配
- 备份：`learning-os.db.backup-before-p8-004`
- 验证：清理后真实 DB concepts=17 · links=5 · 残留检查=0
- 测试：pytest 426 · vitest 16 · vite build PASS
- 文档：CURRENT_STATE / TASKS / CHANGELOG 同步
- 辅助脚本：`scripts/_cleanup_check.py` / `scripts/_cleanup_delete.py`（一次性，待清理）

## 本次会话改动（P8-001C Knowledge Planet，commit 7918d5e）

- `web/src/components/planet/KnowledgePlanet.tsx`（220行）：
  Cobe 点阵地球（mapSamples=6000 · dpr=1 · 280px）+ 4条错倾轨道环 + 卫星（笔记驱动）。
  性能契约：单 rAF 30fps 节流 · IntersectionObserver/visibilitychange 暂停 ·
  prefers-reduced-motion 静态帧 · canvas contain:layout paint size。
  数学 z-position 遮挡（isBehind 函数）+ hover/click/拖动旋转
- `web/src/global.css`：+55行 Planet 样式（.planet-scene/.planet-ring/.planet-sat 等）
- `web/src/views/DashboardView.tsx`：挂载 KnowledgePlanet（SyncStatusPanel 下方）
- `web/package.json`：cobe ^0.6.5
- `docs/DEPENDENCIES.md`：cobe 登记（含性能边界）
- `docs/TASKS.md`：P8-001C 任务说明

- `web/src/lib/universe/layout.ts`：布局引擎纯函数（separation.md 图谱分层铁律）。
  domainGrouping（径向域中心）· forceLayout（d3-force：forceX/Y 域吸引 + 斥力 + 边弹簧 +
  collide，确定性 jitter，固定迭代）· centralPlanet（统计）· settleOnDrag（拖动重排）·
  computeUniverseLayout 一站式入口
- `web/src/lib/universe/layout.test.ts`：14 项（分组确定性 / force 输出确定性 / 聚类
  生效：同域距离<跨域 / fixed 锁定 / planet 统计 / 空输入）
- `web/src/components/universe/PlanetNode.tsx`：中央聚合星球。concept 数→半径 ·
  mastery 均→光晕 · 活跃→呼吸动画（8-12s）· domain 数→轨道环；非概念实体不入库
- `web/src/components/universe/ConceptNode.tsx`：hover 抬升（translateY -6px + scale 1.04 +
  shadow，150ms）+ weak 状态虚线外圈（mastery<0.3 推导）
- `web/src/components/universe/KnowledgeUniverse.tsx`：接入 computeUniverseLayout；
  ReactFlowProvider 包裹；Floating Inspector（替换 .universe-detail，保留能力）；
  Planet/节点拖动 → fixed map + viewport → localStorage；Focus 周边渐隐（opacity 0.15）
- `web/src/global.css`：planet / inspector / node hover elevation / weak ring 样式
- 依赖：`d3-force` 3.0.0 + `@types/d3-force`（ADR-007 批准，REGISTRY 已更新）
- 验证：tsc PASS · vitest 16 · vite build PASS · pytest 426

## 本次会话改动（P8-001A Concept Foundation）

- `server/app/core/concepts.py`：Concept CRUD 纯 Core 层（create/get/list/update +
  VALID_ORIGINS={manual,markdown,ai_suggested}）；创建 concept 不产生
  learning_event/mastery/review_queue/links（ADR-019/022 边界）
- `server/app/routers/concepts.py`：GET /concepts（domain/origin/status 过滤）·
  GET /{id}（含 mastery）· POST @201 · PATCH metadata；无 DELETE
- `server/app/main.py` + `core/__init__.py`：注册 concepts_router + 导出
- `server/tests/conftest.py`：新增 core_conn fixture（隔离 workspace）
- `server/tests/unit/test_concepts.py`：29 项（CRUD/filter/boundary/核心函数）
- BLOCK 裁决落地：source_type 方案废弃，origin 唯一事实字段；
  无新增 migration（007 删除），DB 与 migration 文件一致
- `scripts/seed_demo.py`：35 纯概念（ML/Optimization/DL/NLP/CV 五域）+ 4 笔记 +
  事件计划；origin=manual；幂等可重跑
- `docs/adr/ADR-023-visualization-boundary.md`：Universe/Graph/MindMap
  边界冻结 + origin-only 冻结文本

## 本次会话改动（M7-006 E2E LAN Demo）

- Phase 1/2：tests/integration/sync/test_e2e_demo.py SyncPair runner +
  四场景（单向/双向/event merge 去重/mindmap 冲突收敛+resolve）+ 幂等重放
- Phase 3.0 Transport completion：
  - routers/sync.py 新增 GET /sync/files/{path}（serve_file 代理）与
    POST /sync/receive（**强制经 SyncApply 落盘**——修正了 M7-003 的
    receive_incoming 直写盘 Rule 1 违规，fail-closed 语义随之统一 rejected）
  - _http_send 清理 sha 死代码；补 sender payload 缺失的 type 字段
    （FileData.from_bytes 契约此前必然拒收，协议从未真正通过）
- Phase 3.1/3.2：Device B 独立 uvicorn 子进程，A 经真实 HTTP 全链路同步
  字节级一致；对端宕机→失败不破坏本地→重试最终一致
- 测试 +12 · pytest 390→397（新增 e2e 7 + transport 断言更新）

## 上一会话改动存档（M7-005 Conflict UI）

- core/sync/status.py 新建：find_conflicts（从 mind_maps/*.local.json artifacts
  实时派生冲突列表 + 内联只读预览）/ resolve_conflict（keep_local/keep_remote，
  删 sidecar 关闭冲突；严格路径校验拒穿越/非法形态）
- routers/sync.py 新建（HTTP 层首次建立）：GET /sync/status 只读 +
  POST /sync/resolve 唯一写动作；Router 只调 core 不触 workspace
- Fix：find_conflicts 初版备份命名推导与 M7-004 Apply 实际产物不一致
  （math.local.json 而非 math.mindmap.json.local.json），测试先行抓出并修正
- Frontend：shared/types/sync.ts 契约 + components/sync/SyncStatusPanel.tsx
  （Compare 展开 Keep Local/Keep Remote），DashboardView 顶部挂载；
  无新 tab 无弹窗（ADR-013/022）；global.css 少量 .sync-* 样式
- 测试 +17（17 status/status API）· pytest 373→390 · build/vitest PASS

## 上一会话改动存档（M7-004.5 Sync Boundary & Recovery Audit）

- 新增 tests/unit/test_sync_boundary_audit.py 19 个测试（五项 Audit 全覆盖）
- **真实漏洞修复**：_apply_events 对写盘异常未 fail-closed——OSError 会穿透
  Apply 闸门抛给调用方；现已统一吸收为 REJECTED，非法 UTF-8 同理
- eventlog "no new events" 语义归并 SKIPPED（重放一致性：二次 apply 全 SKIP）
- Transport 静态边界改为 AST 级扫描（子串扫描会误报 urlopen），锁定
  transport.py 零文件系统动作；此扫描永久入库
- 文档：sync-model.md 新增「边界与恢复」节；CHANGELOG/TASKS 同步

## 上一会话改动存档（M7-004 Sync Apply Layer）

- core/sync/apply.py 新建：SyncApply / ApplyAction / SyncApplyResult / validate_rel_path
  四条冻结规则落地——唯一写入口 · 双重校验（字节级 hash 重算，测试中实证了
  PurePosixPath 对 `C:x` 盘符误判并修复）· eventlog append-merge（event_id 去重，
  缺 id/坏 JSON 行拒绝合入，local 行数永不减少）· mindmap LWW + 首次冲突 `.local.json` 备份
- 确定性：apply 不读墙钟不生成时间戳；TestDeterministicApply 双 workspace 字节级快照比对
- 测试：tests/unit/test_sync_apply.py 27 个（Markdown 5 / Events 5 / MindMap 3 /
  Security 4 组参数化 + 单元 / Determinism 2 / BoundaryAudit stdlib-only 扫描 2）
  总计 pytest 327→354
- 文档：sync-model.md 新增「Apply 层」节；ACTIVE_TASK 回执清空；CHANGELOG/INDEX 同步

## 上一会话改动存档（M7-003.5 Documentation & Architecture Sync Audit）

纯文档任务，零业务代码改动：
- CURRENT_STATE.md：commit 指针 → 117fcca · 补齐 M7-Nightly~M7-003 五行里程碑 · 测试计数 251→327 · 新增 Next Up 区块
- docs/DATA_MODEL.md：补登 ADR-020 Sync Truth Model 数据模型行
- AGENTS.md §10 文档地图：新增 docs/sync/ 条目
- docs/diagrams/sync-flow.html：新增同步管线图（Discovery→Transport→Apply→Workspace），旧图未动
- docs/TASKS.md：总览表同步已完成状态 + 新增 M7 子任务区
- **Sync Core Boundary Audit**：core/sync 八模块仅依赖 stdlib（无 fastapi/sqlite3/router import）；routers/ 尚无 sync 端点——Router→Sync Core 边界留待 M7-004+ 建立

## 上一会话改动存档（M7-001 Stabilization + Audit Sprint）

- scanner.py：替换 _glob_match 为正确的 ** 递归匹配（修复嵌套目录匹配 bug）
- manifest.py：移除死代码 `import os`
- settings.py：移除 `import sqlite3`，SQL 操作提取到 db.py
- db.py：新增 settings 数据访问函数
- attachments.py：移除 unused `import re`
- mindmap.py：移除 unused `Field`
- universe.py：移除 unused `JSONResponse`
- mastery.py：移除 unused `timedelta`
- test_tutor_prohibition.py：移除 unused `import os`
- KnowledgeRadar.tsx：移除 3 个 emoji（ADR-013 合规）
- global.css：添加 `--bg-alt` 变量定义
- test_sync.py：42 个同步测试
- test_sync_deep.py：28 个深度测试（中文/特殊字符/大文件/嵌套目录）
- test_sync_recovery.py：14 个恢复测试（幂等性/原子性/确定性）
- test_smoke.py：expected 集合添加 review_queue
- docs/audit/：M7-001-STABILITY-AUDIT.md + CODE_QUALITY_REPORT.md
- docs/sync/：sync-model.md + conflict-resolution.md + recovery-guide.md
- docs/archive/testing/M7-STABILITY-REPORT.md
- CHANGELOG.md：新增 M7 stabilization 条目
