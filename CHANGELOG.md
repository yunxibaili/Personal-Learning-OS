# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

（暂无）

## [v0.1.0-rc.3] — 2026-09-05

> 本版本为**纯后端化后的第一个发布候选**。前端载体（`web/`、`ui/`、`shared/types/`、`src-tauri/`）
> 已在本周期内整体移除，本文件同步删除全部失效的前端条目与前端验收口径
> （`vitest` / `tsc --noEmit` / `vite build` 已不存在）。「前端阶段」路线**终止，非延期**，
> 详见 §Removed 与 §Changed。

### Added
- **ADR-028 文档变更抽象层（Revision / Snapshot / Diff / Restore）——与 Git 解耦**：
  - revision source = `current`（vault 直读）/ `snapshot`（历史快照）；`git` source 属后续独立任务，
    本轮**不预留 Adapter 抽象层**（AGENTS §6：无真实复杂度不制造 Provider 层）
  - `app/core/revisions.py`：快照落 `workspace/metadata/revisions/<vault 相对路径>/<YYYYmmddTHHMMSS微秒>-<hash8>.md`，
    **零新增 migration**（SQLite 不在 `EXPORT_DIRS` 也不在 `SYNC_PATTERNS`，落表会让快照既不导出也不同步，
    违反 AGENTS §3 + ADR-005）
  - 快照文件即合法 Markdown：`compose_file({**笔记原 frontmatter, **rev_* 元数据}, body)`，
    剥离 `rev_*` 可无损还原原笔记；目录键用路径而非 `note_id`（db 不同步，跨设备不一致）
  - 写前去抖快照（内容哈希去重 + 300s 窗口）+ 手动打点；每篇上限 50 份按时间序淘汰；
    重命名迁移快照目录；删除笔记**保留**快照；快照失败**绝不阻断**笔记保存（ADR-001）
  - `app/routers/revisions.py` 六个端点：`GET|POST /notes/{id}/revisions`、
    `GET /notes/{id}/revisions/{rev_id}`、`GET /notes/{id}/changes`、`POST /notes/{id}/diff`、
    `DELETE /notes/{id}/revisions`
  - diff 双形态：`hunks`（0-based 左闭右开、只含非 equal 段，供块级高亮）+ `unified`（供人读/导出）
  - 快照**进** `EXPORT_DIRS`（用户数据须可全量导出）、**不进** `SYNC_PATTERNS`（本地便利能力，非跨设备事实）
  - **恢复能力（决策 D 的承诺：保留 = 可恢复）**：
    - `POST /notes/{id}/revisions/{rev_id}/restore`——既有笔记整体回滚（frontmatter + 正文）；
      恢复前先对被覆盖状态打 `origin=restore` 快照，**恢复本身可逆**；与目标一致时 no-op
    - `GET /admin/revisions/orphans` + `POST /admin/revisions/restore`——从孤儿快照重建已删笔记；
      `_create_note_vault` 扩展可选 `meta`/`rel_path` 参数，走与常规创建完全相同的写路径，存量调用方零影响
  - 测试 +80（core 41 / http 25 / 恢复 14）；路由 **93/75 → 102/82**
- **ADR-027 中文 FTS 架构选型 + CJK bigram 实现**（取代 ADR-011，ADR-011 → Superseded）：
  - 四案加权选型：bigram 预分词 70 > trigram+LIKE 67 > jieba 58 > ICU 44；
    证伪 ADR-011 原首选 trigram（<3 字符查询静默 0 命中）；**零新增运行时依赖**
  - `app/core/cjk_bigram.py` 纯切分模块，FTS 写入与查询共用同一切分（短语匹配 ≈ 子串命中）；
    `autolink.tokenize` 复用底层规则（依赖方向 `autolink → cjk_bigram`）
  - migration `010_fts_bigram`（DROP+CREATE `notes_fts`）+ 启动链路自动全量 reindex
  - **删除 `_cjk_search` 全表扫描**（B9 兜底退役，无第二套搜索逻辑）；单字中文 LIKE 兜底
- **MindMap sidecar producer 恢复**（`app/core/mindmap.py` + `app/routers/sync.py`）：
  思维母图随 sync 导出为 sidecar 文件（原 P1-MINDMAP-TRUTH，M8 前置条件）
- **后端 sidecar 打包（PyInstaller onefile）——桌面分发能力（原 P0-2b）**：
  - `server/backend_main.py` + `server/plos_backend.spec`（onefile，15.5MB）：
    workspace 上溯解析、端口 8100 避让 dev 8000、host 恒 127.0.0.1
  - `app/db.py` frozen 分支（打包态 migrations 路径）+ `app/main.py` CORS（`tauri.localhost` / `localhost:5173`）
  - 退出改为**进程树终止**（实测孤儿孙进程残留）

### Removed
- **纯后端化：移除全部前端载体（`chore(pure-backend)`，`3fe8d13`）——本版本最大变更**：
  - `web/`（React + Vite 应用）、`ui/`（HTML 设计系统与可视化组件库）、`shared/types/`（TS 契约层）
    整体删除；`src-tauri/`（Rust 桌面壳）不在本仓库内
  - 随之前端工程资产整体退役：`package.json` 依赖树、`vitest`、`tsc --noEmit`、`vite build`、
    `tsconfig`、`web/.env.desktop`、live-smoke 脚本、`buildNoteTree` 等前端本地实现
  - **保留**：PyInstaller sidecar（`server/backend_main.py` + `server/plos_backend.spec`）——
    桌面分发走后端可执行档，不依赖任何前端构建
  - **影响**：验收口径收敛为后端实测（pytest + OpenAPI + `/health` + 隔离 workspace 冒烟），
    不再存在前端构建/单测门禁；docs 与 CI 已同步（`.github/workflows/ci.yml`、`scripts/test.ps1`）
- 死代码（纯后端化前已清理）：`SyncStatusPanel.tsx`、`dev/ComponentGallery.tsx`、
  死 CSS `.tabbar` / `.dashboard-view` / `.dash-section`
- 依赖审计更正：`marked` 从 REGISTRY 移除（从未安装）；d3-force / cobe / @tiptap/pm 移入「已移除依赖」存档节

### Changed
- **项目路线重基线：前端阶段终止，进入后端稳定阶段（Backend-only Stable Phase）**：
  - P1「UI 打磨」与 `[20]` Bright Baseline **作废（CANCELLED，非改名、非延期）**；
    `docs/PROJECT_STATE.md` §0 由「前端阶段已开启」改为后端稳定阶段，补足此前缺失的纯后端化事实
  - 路线新增节点 `[21]`–`[26]`（`[25]` Backend Stable Baseline = 当前，`[26]` Owner 解冻）；
    前端消费层解冻须 Owner 明确宣布，不得隐式解释
  - `AGENTS.md` §0 当前开发政策同步；§4 补作用域澄清：Git「唯一版本真相」限于应用侧资产，
    `workspace/` 用户数据整体 gitignore，其变更记录由 ADR-028 承载，该层永久禁用 Git 概念与术语
  - ADR-028 状态 → **已接受并封口**；四项残留（Git revision source adapter / 前端 revision UI /
    frontmatter-only 是否触发快照 / 孤儿快照长期 GC）列为新任务，本轮不处理
  - M8（Mobile）维持全线暂停：顺序恒为 PC Stable → M8-000
- `APP_VERSION`：`0.1.0-dev` → `0.1.0-rc.3`
- 文档计数对齐：`docs/backend/README.md` 端点数 93 → **102 route / 82 path**；
  `docs/backend/testing.md` 基线 1020 → **1099 passed**

### Fixed
- 快照时间戳**秒级 → 微秒**（`%Y%m%dT%H%M%S%f`）：同秒内多份快照按 hash8 字典序排序会让「最新」失真——实测踩中
- 文本 diff `difflib.SequenceMatcher(autojunk=False)`：默认启发式把 ≥200 行中频次 >1% 的行判 junk，
  实测 300 行只改 1 行报 changed=150（正确值 1）
- sidecar 退出孤儿孙进程：改为进程树终止

### Docs
- **项目状态收口**：进度唯一登记于 `docs/PROJECT_STATE.md`（单一真相源原则），
  其余文档只引用不自维护；本轮对齐重基线后的实际状态，并按 AGENTS §11 回填 `docs/TASKS.md` 完成报告

### Gate
- pytest **1099 passed**（工作 venv 165.26s / 干净重建 venv 163.82s，双环境均通过）
- OpenAPI：**102 route / 82 path**（递归展开 `_IncludedRouter` 后的真实值；
  fastapi 0.141.1 顶层 `app.routes` 仅 28，属惰性容器表象，勿引为口径）
- `GET /api/v1/health` → 200，`version` = `0.1.0-rc.3` 与 `APP_VERSION` 一致
- 依赖审计：runtime 3（fastapi / uvicorn / python-multipart）+ dev 2（pytest / httpx），
  零未使用、零缺失；PyInstaller 6.22.2 登记为构建期工具
- 孤儿模块 AST 扫描：0（6 个 `core/tracer/examples/*` 为按设计动态加载，非死代码）
- **干净环境重建**：`python -m venv` + 仅 `requirements.txt` / `requirements-dev.txt`
  全新安装（22 个包），全量 pytest 1099 passed
- **sidecar 干净构建**：`PyInstaller plos_backend.spec --noconfirm` →
  `dist/plos-backend.exe` 15,566,443 bytes；隔离 workspace 启动 → `/api/v1/health` 200 →
  `POST /api/v1/notes` 201 → `GET /api/v1/notes` 200 → 进程树终止后端口释放；产物已清理
- 全程隔离 workspace 冷启动；真实 vault 未被触碰

## [v0.1.0-rc.2] — 2026-09-02

> 本节为**补记**：rc.2 打 tag（`f011434`）时未同步 CHANGELOG，属历史遗漏。
> 提交区间 `v0.1.0-rc.1..v0.1.0-rc.2` 共 39 commits，主体为 T-NOTE-TREE（ADR-026 v3，T1+T2+T3）、
> M9-007/008 Visual Engine 接入与 M9 关闭、P1 技术债收敛、项目状态收口（确立 `PROJECT_STATE.md`
> 单一真相源）与 P8 正式收尾。其中前端部分（`web/`、`ui/`、`shared/types/`）已随 rc.3 纯后端化移除，
> 不再逐条转录。

## [v0.1.0-rc.1] — 2026-09-01

### Added
- **T-NOTE-HIER 主/副笔记层级（ADR-024）P0+P1**：
  - P0：frontmatter round-trip（`compose_file(meta,body)` 保任意 key）→ 显式 parent
    读写+校验（`parse_parent`/`set_meta_parent`，自指/orphan/cycle 标 invalid 不阻断保存）
    → 统一 `resolve_hierarchy()`（explicit>inferred，含 cycle 检测）→ reindex 物化
    `links(relation='parent')` → `/graph` 并入权威父边 → `derivePlanets` 显式优先
  - P1：契约 TS（`NoteSummary.parent_id` + `NoteCreateBody.parent`）→ 后端 4 端点
    返回 `parent_id` → `NoteCreate.parent` 一步创建副笔记 → 前端 `buildNoteTree`
    纯函数建树 + `NoteTreeList` 递归层级树 + CSS
  - 守护：hierarchy 12 + derivePlanets 2 + buildNoteTree 6 + notes 5 + boundary 8 + Vault Rebuild 12 = 45 项
  - ADR-024 §2.7 五句话架构不变量契约
- **Vault Rebuild Test**（GPT 评审建议）：删 SQLite → rebuild → 断言 notes/links/hierarchy/FTS 一致，
  验证「Markdown = 唯一事实源」架构不变量（12 项）
- **Documentation Truth Audit**：修复 PROJECT_STATE/TASKS/ADR-024 中的过时数据

### Changed
- `/notes` 响应新增 `parent_id: number | null` 字段
- `POST /notes` 支持 `parent` 参数（创建时一步指定父笔记）
- 左侧列表从平铺改为层级树（缩进 + branch/leaf 图标 + 「＋」创建副笔记按钮）

### Removed
- 未使用依赖：`cobe`、`d3-force`、`@types/d3-force`、`@tiptap/pm`
- `@types/dagre` 从 dependencies 移至 devDependencies

### Fixed
- `compose_file` 原只回写 `tags`，其余 frontmatter key 保存时静默丢弃（ADR-024 地基缺陷）
- `_detect_cycles` 首版对任何成环无限循环（P0-5 守护测试逼出）

### Performance
- `resolve_hierarchy()` 200 笔记基线：avg 160ms（min 149ms, max 175ms）

### Gate
- pytest **873 passed** · vitest **36 passed** · tsc PASS · vite build PASS

### Added
- **M3.5-B Full Omniscience**（ADR-012 Phase B，Knowledge Radar 学习状态真实化）：
  `suggest_for_context` 的 memory 三字段从占位 null 接真实数据——
  mastery（`concept_mastery.effective`）· review_due（`review_queue` status=pending）·
  last_mistake（`mistakes.description` 最近一条）。新增 `_resolve_concept_for_memory()`
  （matches 命中 concept 优先 → 精确标题 → LIKE 唯一命中；**多候选不猜，返回 None**——
  宁可没有也不能把 A 的掌握度标到 B 头上）· `_memory_for_concept()`（三字段独立取值，
  任一缺失即 null 不抛异常）· `KnowledgeRadar` 学习状态区真实渲染（掌握度橙条+百分比 ·
  「今日到期」强调 · 错题单行省略+悬浮；全 null 整区不渲染不占版面）·
  `test_suggest_memory.py` 6 项 · pytest 13（7+6）+ vitest 22 + build 全绿 ·
  实检：真实库造数据 API 返回 mastery=0.361 + 到期 review_due，UI 三行渲染正确

### Added
- **B28 Memories 管理面 API**（AI 自动写入记忆的可见性兜底）：
  `GET /api/v1/memories`（列表 · kind 过滤 + 分页 · total 为过滤后总数）·
  `GET /api/v1/memories/{id}` · `PATCH`（部分改写，409 = 改写后前缀撞车）·
  `DELETE`（硬删）· `core/memories.py` 抽 `_validate_*` / `_row_to_memory` /
  `_dup_conflict` 共用助手（写入面与改写面抛同一批异常，前端只写一套错误处理）·
  **两条通道语义冻结**：消费面 `get_memories` 过滤敏感前缀（不进 prompt），
  管理面 `list_memories`/`get_memory` **不过滤**——管理面过滤会让 `sk-` 前缀
  记忆变成用户看不见、删不掉的暗账，与「用户数据永不锁死」冲突 ·
  不提供 POST（唯一生产者是 B3 Extractor，AGENTS §1 YAGNI）·
  守护先行 51 项（含 Router 不直写 SQL 静态守护）· pytest 581→632

### Added
- **B8 memories 进 Tutor 上下文**（ADR-014 附录 §2.5.1）：tutor_context 新增
  memories 键（top ≤5）· get_memories 复合排序 importance×recency（消除
  importance 主导退化态，now 可注入）· 敏感形态条目排除出上下文（保守默认，
  方向二；prompt sanitize 出口兜底）· 命中刷新 last_used_at（裁决 3 兑现）·
  shared/types/tutor.ts TutorMemory 契约 · 守护先行 8 项 · pytest 550→558

### Added

### Added
- **B3 Extractor v1**（回合后二次 LLM 调用，spec v2 收窄范围）：core/ai/extractor.py
  + core/memories.py（memories 唯一生产者：kind/区间应用层校验、前缀去重、
  last_used_at 裁决 3）· update_message_context（快照回写 extractor 键，同键
  覆盖幂等）· extractor 概念走 ensure_entity_by_title(origin='ai_suggested')
  （C4）· DELETE /api/v1/concepts/{id}（裁决 1：仅 unconfirmed 桩可删）·
  FakeExtractorProvider 关闭 I5 假绿 · learning_events 经 update_mastery（C2）·
  守护先行 17 项 · pytest 524→541 · TABLE_AUDIT (b) 清单清零

### Added

### Added
- **B7 对话持久化 + 最小非流式对话**：core/conversations.py（两零生产者表的
  生产者落地）· POST /api/v1/chat（context→provider→双消息落库，assistant 携
  context_json 快照——上下文透视数据基础）· conversations CRUD 四端点 ·
  B1a 测试盲区修复（URLError 用真实形态 api_key + 泄漏断言）·
  守护先行 9 项 · pytest 507→516

### Added

### Added
- **9.1/B1a OpenAICompatProvider**（无凭据落地，stdlib urllib 零新依赖）：
  ADR-003 协议 POST {base_url}/v1/chat/completions（容忍 base_url 含 /v1）·
  空 api_key 不发 Authorization（本地 Ollama 直连）· 错误映射
  HTTPError→ProviderError / URLError→ProviderTimeout ·
  core/ai/config.py settings 驱动 factory（llm.provider/base_url/api_key/model，
  未知 provider 回退 mock，repr 永不含 api_key）· router /tutor/test 接 factory ·
  守护测试先行 9 项（monkeypatch urllib 层）· pytest 498→507
- **P0 修复（M7-007 收尾）**：vault 冲突副本语义与 mindmap 分化——副本每次
  冲突更新为最近被覆盖的本地版本（实证：连续冲突+本地编辑曾永久丢失 L2，
  违反数据永不锁死红线）；mindmap 保留首份语义（布局可重建）。
  ADR-020 附录 §2.1.2-a 显式记录分化及理由

### Added

### Added
- **M7-007 Vault Conflict Preservation**（B27，方案 a）：apply.py vault 分支
  LWW 升级——冲突时远端胜者写主文件、本地版进 `<name>.md.conflict` 副本
  （副本后缀不在同步白名单，天然隔离不跨设备增殖；已有副本=更早分叉点永不覆盖）·
  E2E runner vault 冲突从显式 no-op 改为单方向收敛断言 ·
  ADR-020 附录 §2.1.2 · SYNC.md 三处目标态转实然 ·
  守护先行 4 tests · pytest 494→498

### Added

### Added
- **T-EXPORT（B11）一键全量导出**：GET /api/v1/export → zip（core/export.py）·
  白名单收集 vault/attachments/mind_maps/eventlogs · settings 脱敏
  （api_key 条目整体排除，非掩码）· 防御性排除 devices.json/manifest.json ·
  守护测试先行 7 项（范围/脱敏/zip 完整性）· EXPORT_MANIFEST 缺口勾销 ·
  pytest 486→493

### Added

### Added
- **P8-003E Review Bridge + Auto Notes**（纯后端）：修复 mistakes 表自 M3
  建表以来零生产者的断链——update_mastery(answer_wrong) 同事务落 mistakes，
  review 答错 → mistakes → Tutor context.mistakes 三跳连通 ·
  乙路线 Auto Notes（ADR-014 附录许可）：auto_notes=true 时以 concept
  标题+别名 FTS5 检索补足笔记名额（显式引用优先、排除已引用、默认关闭）·
  守护测试先行 10 项 · pytest 476→486

### Added
### Added
- **P8-003D Tutor Knowledge Base**（甲路线：显式引用）：POST /api/v1/tutor/context
  （note_ids ≤2 篇确定性片段，注入时 related 10→6 / recent 5→3 预算收缩）·
  TutorPanel 笔记选择器（复用 FTS /search）+ 死 tab 复活（focusConceptId
  跳转目标模式，GraphView「问 Tutor」入口）· suggest_for_context snippet
  从硬编码 None 修为真实片段（extract_snippet 复用）·
  守护测试先行：连通性 5 跳 + 反向断言（未引用笔记全文/api_key/vault 绝对路径
  不得出现）+ 可达性（死 tab 回归）+ 预算边界 · pytest 463→476 ·
  ADR-014 附录 §2.8.1（RAG 禁令部分解除：FTS5 许可，向量/Embedding 永久禁止）

### Added
### Added
- **P8-003D-CodeReview P0 修复**：
  P0-1：设备身份合并（删除 _get_device_id，复用 core/sync/device.py）·
  P0-2：migration 007 补 event_uuid 列 + UNIQUE 索引 ·
  P0-3：notes.py 连接泄漏修复 ·
  6 项测试更新 · pytest 459 · tsc PASS · vite build PASS
- **P8-003D Eventlog Producer**：ADR-020 闭合 ·
  update_mastery() 同事务追加 JSONL 写入 ·
  metadata/eventlogs/<yyyy-mm>.jsonl 按月归档 ·
  eventlog JSON 格式：event_id + concept_id + event_type + dimension + weight + source + detail + device_id + created_at ·
  device_id 生成：环境变量 > 持久化文件 > hostname-uuid ·
  OSError 不阻断学习事件记录 ·
  8 项测试（device_id 3 + write_eventlog 2 + 集成 3）·
  pytest 461 · tsc PASS · vite build PASS
- **P8-003B Mastery Decay**：掌握度时间衰减 ·
  Ebbinghaus 遗忘曲线（tau=14天半衰期）·
  get_effective_now() 动态计算当前掌握度 ·
  last_seen = MAX(learning_events.created_at)（非 next_review）·
  review_today Python 侧 effective_now 排序 ·
  Tutor context 使用衰减后掌握度 ·
  API 输出 effective_now 字段 ·
  Universe 视觉暂保持 effective（Mastery vs Freshness 待设计）·
  14 项测试（衰减函数 + get_effective_now + 时间真实性）·
  pytest 453 · tsc PASS · vite build PASS
- **P8-003C Vault Reindex**：Markdown → SQLite 索引恢复机制 ·
  core/reindex.py 独立模块（reindex_vault 纯函数）·
  扫描 vault/*.md → upsert_note_index + rebuild_note_links + 可选 prune ·
  接口预留 changed_paths 增量模式 · 删除检测默认关闭 ·
  POST /api/v1/admin/reindex 端点（Admin 模式）·
  Sync receive 后自动 reindex hook（Post-sync consistency）·
  13 项单元测试（基础/幂等/删除安全/links/sync hook）·
  pytest 439 · tsc PASS · vite build PASS
- **P8-003A Review Session MVP**：SM-2 复习流程接入真实 UI ·
  ReviewSessionView.tsx（idle→loading→ready→answering→feedback→done 状态机）·
  概念卡片（标题+掌握度+上次结果）· 三按钮评分（😵忘记了/🤔有点模糊/✨记得很清楚）·
  feedback 页（mastery 变化+下次复习日期）· 完成统计（复习数量+记忆保持率）·
  DashboardView 保留快速入口 · CSS 120行复习状态样式 ·
  ReviewItem 增加 effective 字段对齐后端 ·
  不改后端 / 不改 migration / 不加 API / 不加新依赖 ·
  tsc PASS · vitest 23 · pytest 426 · vite build PASS
- **P8-002 Graph V2**：关系探索视图升级 ·
  dagre 层级布局（dagre ^0.8.5 安装，六连问通过）·
  Concept（圆形）/ Note（方形）双视觉节点 ·
  Layer Toggle（Mixed / Concept / Note）·
  Edge 视觉层次（9种 relation 样式：wikilink 细浅线 / prerequisite 粗实线 / related 虚线）·
  MiniMap 导航 · Floating Inspector（复用 Universe 交互模式）·
  hover relation label · domain 过滤 · 隐藏未确认桩 ·
  layout.test.ts 7 项 · vitest 23 · pytest 426 · vite build PASS
- **P8-001C Knowledge Planet**：首页知识星球原型 ·
  Cobe WebGL 点阵地球（5KB/MIT，MiMo 风格）+ 4 条错倾轨道环 ·
  卫星 = 笔记（/api/v1/notes，16 颗上限聚合）·
  数学 z-position 遮挡（isBehind，sandbox 验证）·
  拖动旋转 + hover 放大 + click 指示器 ·
  性能契约：dpr=1 · 280px · 30fps 节流 · IntersectionObserver/visibilitychange 暂停 ·
  prefers-reduced-motion 静态帧 · canvas contain:layout paint size ·
  cobe ^0.6.5 入 REGISTRY · 挂载 DashboardView
- **P8-004 Demo Cleanup**：清除 workspace/db 早期探针残留
  TestConcept（id=1）+ MasteryTest（id=2）+ 关联 4 links + 1 mastery ·
  精确 IN 删除无误伤 · 备份 before-p8-004 · 验证 0 残留 ·
  pytest 426 · vitest 16 · vite build PASS
- **P8-001B Knowledge Universe V2**：Universe 从静态图升级为可探索知识星球 ·
  `lib/universe/layout.ts` 布局纯函数（domain 聚类 + d3-force 确定性输出，separation 分层铁律）·
  PlanetNode 中央聚合星球（concept 数→半径 / mastery→光晕 / 活跃→呼吸 / domain→轨道，不入库）·
  ConceptNode hover 抬升 + weak 状态环 · Floating Inspector 替换右侧大抽屉 ·
  Planet/节点拖动 + viewport 持久化（localStorage，视图非真相源）·
  安装 d3-force 3.0.0（ADR-007 批准）· layout.test.ts 14 项 ·
  vitest 16 · pytest 426 · vite build PASS
- **P8-001A Concept Foundation**：`/api/v1/concepts` CRUD（GET 列表/详情 · POST 创建@201 ·
  PATCH metadata）· `server/app/core/concepts.py` 纯 Core 业务层 ·
  Concept 来源唯一事实字段 `origin`（manual/markdown/ai_suggested），
  source_type 方案废弃（BLOCK 裁决，零 migration 变更）·
  seed_demo.py 35 个纯概念（ML/Optimization/Deep Learning/NLP/CV 五域）·
  ADR-023 Visualization Boundary 冻结 · 测试 425 通过（新增 test_concepts.py 29 项）

### Audit：M7 转入稳定发布基线 ·
  Phase 1 九模块 AST 边界终审（PASS，三处例外合规定性）→ docs/sync/SYNC_BOUNDARY_REPORT.md ·
  Phase 2 Truth Model 审计（白名单=Layer 1 三类 · 禁比 derived state）·
  Phase 3 Recovery 证据收集（断网/半写/tmp 残留/重复同步 + 附加探针）·
  Phase 4 文档冻结 · Phase 5 T-EXPORT 预检 → docs/release/EXPORT_MANIFEST.md +
  RELEASE_AUDIT_M7.md · 零功能变更零语义变更

### Added
- **M7-006 E2E LAN Demo**：真实两进程经回环网络完成完整同步 ·
  Phase 1 SyncPair 双 workspace runner · Phase 2 四场景仿真（单向/双向/
  event merge 去重/mindmap 冲突+resolve）· Phase 3.0 Transport server 侧补齐：
  GET /sync/files/{path} + POST /sync/receive（落盘强制经 SyncApply，
  修正 receive_incoming 直写盘的 Rule 1 违规与 _http_send 死代码）·
  Phase 3.1 全链路 HTTP 同步字节级一致 · Phase 3.2 对端宕机→重试→最终一致 ·
  修正 sender payload 缺失 type 字段的协议失配 · 哈希拒绝语义统一 rejected ·
  12 tests · pytest 390→397

### Added
- **M7-005 Conflict UI**（方案 a：冲突源仅 mindmap artifacts）：core/sync/status.py
  （find_conflicts 实时派生 + resolve_conflict keep_local/keep_remote）·
  routers/sync.py HTTP 层首次建立（GET /sync/status 只读 + POST /sync/resolve
  唯一写动作，Router 只调 core）· shared/types/sync.ts 契约 ·
  components/sync/SyncStatusPanel.tsx 挂载 Dashboard（无新 tab 无弹窗，
  ADR-013/022 合规）· TECH_DESIGN §9 API 表补两行 · 17 tests · pytest 373→390

### Added
- **M7-004.5 Sync Boundary & Recovery Audit**：Sync Core 异常情况审计 ·
  Audit 1 Transport 静态边界（AST 扫描锁定 transport.py 零落盘动作）·
  Audit 2 崩溃恢复（发现并修复 Apply 未 fail-closed 的真实漏洞：写路径异常/
  非法 UTF-8 现统一吸收为 REJECTED；Case A 残留 tmp / Case B 合并中断重试恢复
  均有测试）· Audit 3 恶意输入参数化补全 · Audit 4 重放一致性
  （二次 apply 全 SKIPPED，eventlog "no new events" 语义归并 SKIP）·
  Audit 5 文档同步 · 新增 19 测试 · pytest 354→373

### Added
- **M7-004 Sync Apply Layer**：远端数据进入 workspace 的唯一写入口（core/sync/apply.py）·
  四条冻结规则——唯一写入口 / 双重校验（字节级 SHA-256 重算 + 白名单复检 +
  路径穿越/盘符拒绝）/ eventlog append-merge 按 event_id 幂等去重 /
  mindmap LWW + 首次冲突 `.local.json` 备份 · 确定性 apply（不读墙钟，
  同输入双 workspace 字节级一致）· 27 个新测试（含 core/sync stdlib-only
  边界回归扫描与 Deterministic Apply）· pytest 327→354

### Documentation
- **M7-003.5 Documentation & Architecture Sync Audit**：纯文档同步任务 ·
  CURRENT_STATE 补齐 M7-001.5~M7-003 里程碑与 Next Up（M7-004 Apply 未开工）· 测试计数 251→327 ·
  data-model INDEX 补登 ADR-020/021 数据边界行 · AGENTS §10 文档地图新增 docs/sync/ 条目 ·
  TASKS 总览表同步至当前状态并新增 M7 拆解区 · 新增 docs/diagrams/sync-flow.html（旧图未动）·
  Sync Core Boundary Audit：core/sync 八模块零 FastAPI/sqlite3/router 依赖违规 ·
  附带一处死代码修复：MindMapCanvas.tsx 无消费的 searchingConcept 解构改为空位（恢复 tsc 门禁，零行为变化）

### Added
- **M7-003 Sync Transport**：同步传输层（Transport only，不包含 Apply/Conflict）·
  messages.py（FileRequest/FileData/FileAck/SyncError 消息类型 + parse_message）·
  transfer.py（is_syncable 白名单匹配 + write_file_atomic 原子写入 + validate_hash + encode/decode）·
  transport.py（SyncTransport：execute_plan / serve_file / receive_incoming）·
  31 个测试（Messages 6 + Transfer 12 + Transport 13）·
  sync-transport.md 文档 · 总计 327 passed
- **M7-002 LAN Discovery**：局域网设备发现能力（UDP broadcast）·
  device.py（DeviceInfo + metadata/devices.json 设备身份存储）·
  protocol.py（DISCOVER/ACK/PING/PONG JSON 协议 + parse_packet）·
  discovery.py（discover_peers 广播发现 + start_discovery_listener 监听 + ping_device 心跳）·
  27 个单元测试（DeviceInfo 8 + Protocol 11 + Listener 3 + Integration 4）·
  Discovery 不访问 workspace / vault / events · 只传输 device_id / name / version

### Changed
- **M7-001 Stabilization Audit**：scanner.py glob 匹配 bug 修复（嵌套目录文件现在正确匹配）·
  settings.py 边界违规修复（SQL 提取到 db.py）·
  移除 6 个 unused imports（attachments/mindmap/universe/mastery/test files）·
  KnowledgeRadar.tsx emoji 违规修复（ADR-013）·
  global.css 添加 `--bg-alt` 变量定义
- **项目审查修正**：M0.5 重命名为 M4-A Tutor Context Infrastructure ·
  create_note 原子写入优先级提升为 P2（M7 前必须解决）·
  M2b-002 前增加 MindMap Boundary Audit 建议 ·
  M7 前增加 ADR-020 Sync Conflict Resolution 需求

### Fixed
- **P2 create_note atomic write**：atomic_write_file（write → fsync → rename）·
  create_note / patch_note 改用原子写入 · 防止部分写入导致 vault/SQLite 不一致 ·
  M7 同步前置条件满足

### Added
- **M7-001 Sync Engine Core**：纯 Core，无网络 ·
  manifest.py（FileEntry + Manifest 数据结构）·
  scanner.py（扫描 workspace Truth Source：vault/eventlogs/mind_maps）·
  diff.py（对比两个 Manifest → SyncPlan：upload/download/conflict/skip）·
  17 个单元测试 · 总计 184 tests passed

### Added
- **M7-001 Stabilization Audit**：新增 42 个同步测试（test_sync.py）·
  28 个深度测试（test_sync_deep.py：中文文件名/特殊字符/大文件/嵌套目录）·
  14 个恢复测试（test_sync_recovery.py：幂等性/原子性/确定性/边界条件）·
  docs/audit/M7-001-STABILITY-AUDIT.md · 总计 251 tests passed

### Added
- **M2b-002 Concept Binding**：MindMap 节点绑定 Concept（引用，不改 mastery/event）·
  bind_concept / unbind_concept / search_concepts 三个核心函数 ·
  PATCH /nodes/{nid}/bind + DELETE /nodes/{nid}/bind + GET /concepts/search 三个 API ·
  前端 Concept Binding Panel（选中节点 → 搜索 → 绑定/解绑）·
  ADR-019 Boundary Audit 6 tests（五条铁律完整验证）·
  总计 161 tests passed

### Added
- **ADR-021 MindMap Exchange Format v1**：导入导出格式冻结 ·
  version + type + map (title + nodes + edges) ·
  concept_id 引用验证 · ID 重映射 · 不创建 concept ·
  GET /mindmaps/{id}/export + POST /mindmaps/import ·
  前端 Import/Export 按钮 · 总计 167 tests passed

### Added
- **M4-B Prompt Assembly**：build_prompt() 纯函数 Prompt 编排层 ·
  TutorContext TypedDict（NotRequired 支持不完整上下文）· TutorMode Literal 类型 ·
  四模式 system prompt（explain/hint/review/debug fallback）·
  双重安全过滤（字段名黑名单 + 内容前缀替换）·
  字符级 token 截断（constants.py 冻结常量）·
  16 个纯函数单元测试 · prompt-contract.md 契约文档

### Added
- **ADR-015 Multilingual Knowledge Support**：多语言知识支持原则冻结 ·
  Content language independent · Concept 层 language+aliases ·
  Tutor 输出语言自适应 · Token 估算多语言扩展位 · language-contract.md

### Added
- **Gate 1 AI Boundary Audit**：M4-C 前置安全审计 · 25 个边界测试 ·
  Context Isolation · Prompt Purity · LLM Write Boundary · Provider Isolation ·
  Multilingual Boundary · Edge Cases · 6/6 PASS · M4-C 施工红线冻结

### Added
- **M4-C LLM Provider**：ProviderProtocol 统一接口 · MockProvider 测试用 ·
  TutorService 业务层（Context→Prompt→Provider→Response）·
  Provider 错误类型（Timeout/Error/Unavailable）· 14 个单元测试

### Added
- **M4-D Tutor Panel**：Context-aware Tutor 面板 · TutorPanel.tsx ·
  Concept Context + Mastery Bar + Mistakes + Related ·
  三动作模式（Explain/Hint/Review）· Structured Answer 渲染 ·
  连接 /tutor/test endpoint · npm run build 通过

### Added
- **M4.5 Architecture Visualization**：ADR-017 Architecture Visualization ·
  5 张架构 HTML 图（system-overview · learning-loop · tutor-flow · knowledge-flow · test-pipeline）·
  system-map.yaml 声明式架构定义 · Archify agent skill 安装 ·
  Diagram is a map, not a mirror 原则冻结

### Added
- **M4-E Tutor Evaluation**：Tutor 评价体系 · TUTOR_EVAL_PLAN（5 维度 × 通过标准）·
  TUTOR_CASES（20 案例：4 模式 × 5 场景）· TUTOR_METRICS（结构/安全/语言/学习/反模式）·
  15 个禁止行为自动化测试（test_tutor_prohibition.py）· pytest 126 passed

### Added
- **ADR-018 Knowledge Universe Design**：知识宇宙设计宪法冻结 ·
  节点 = Concept（非 Note）· 颜色 = mastery.effective · 边 = links 表 ·
  禁止游戏化/XP/徽章 · d3-force 布局 + React Flow 渲染

### Added
- **M3b-001 Universe Projection**：core/universe.py 图数据投影层 ·
  GET /api/v1/universe 返回 { nodes, edges } ·
  nodes 包含 concept + mastery 五维数据 ·
  edges 只保留 concept ↔ concept · 6 个测试 · pytest 132 passed

### Added
- **M4.6 Runtime Architecture Map**：runtime-map.html ·
  10 section 完整运行时地图 · 4 条 Story Flow（Create Knowledge · Learning Loop · AI Tutor · Universe）·
  23 API endpoints 全列表 · Frozen Boundary 标注 · Data Truth Flow · Core Module Map

### Added
- **M3b-002 Universe Layout**：KnowledgeUniverse.tsx · ConceptNode.tsx ·
  React Flow 渲染 · mastery → radius(16-32px) + color(灰/橙/深) ·
  domain filter · zoom/pan/controls · ADR-013 合规样式 · npm run build 通过

### Added
- **M3b-003 Interaction + State Detail**：ConceptNode hover tooltip（mastery 四维 + status）·
  KnowledgeUniverse detail panel（click → 右侧 mastery 面板）·
  four dimensions display · Open Note action · ADR-013 合规

### Added
- **M3b-004 Navigation Layer**：Universe 导航层 ·
  View Mode Tabs (All/Weak/Focus) · Domain Tabs ·
  Weak Area View (mastery threshold slider) ·
  Focus Mode (1/2/3 hop neighbor expansion + neighbor list)

### Added
- **ADR-019 MindMap Boundary**：Universe ≠ MindMap 冻结 ·
  五条铁律 · 数据模型 (mind_maps + mind_map_nodes + mind_map_edges) ·
  concept binding is reference

### Added
- **M2b-001 MindMap Canvas**：用户思考空间 CRUD ·
  006_mindmap.sql migration · core/mindmap.py · routers/mindmap.py ·
  MindMapCanvas.tsx (React Flow) · MapNode.tsx (concept badge) ·
  sidebar map list · add node · drag save · connect edges ·
  18 个测试 (含 ADR-019 isolation test) · pytest 150 passed

### Added
- **M4-C Smoke Test**：POST /api/v1/tutor/test 全链路验证端点 ·
  Context→Prompt→MockProvider→Response 闭环测试 · 5 个集成测试

### Added
- **ADR-016 Tutor UI Design**：Tutor 界面设计宪法冻结 ·
  Knowledge Assistant Panel（非聊天机器人）· 禁止清单（avatar/bubble/typing/魔法按钮）·
  三动作模式（Explain/Hint/Review）· 结构化输出格式

### Added
- **M4-Preflight Hardening (H1-H6)**：FTS5 输入清洗（双引号包裹）·
  create_note 校验前移 · learning_events.detail 列（quality only）·
  SM-2 时间参数化（UTC）· 9 新测试 · Dashboard 去 emoji

### Added
- **ADR-014 AI Tutor Architecture**：AI Tutor 架构冻结 · 读写边界铁律 ·
  Context Builder 唯一组装点 · Provider 策略（复用 ADR-003）·
  M4 四阶段拆分（Context API → Prompt → LLM → UI）·
  docs/data-model/tutor-context.md 上下文可见性契约

### Added
- **ADR-013 Frontend Design System**：Minimal Scientific Workspace 设计宪法 ·
  白橙主题冻结 · 三栏布局设计冻结 · 图标/组件/动画约束 ·
  AGENTS §16 AI 前端生成规则 · docs/design/UI_REFERENCE.md 视觉参考边界

### Added
- **M5 Review Loop**：ensure_concept_learning_state() 概念触达自动初始化 ·
  review_today 优先级排序（wrong→low mastery→early due）· 错答提升优先级 ·
  GET /review/history 学习时间线端点 · Dashboard 时间线视图 ·
  004_learning.sql ON DELETE CASCADE 修复 · learning-model.md 数据模型契约冻结

### Added
- **M0.5 AI Context Infrastructure**：AI 开发流程外部长期记忆层——
  `docs/ai/PROJECT_MEMORY.md`（永久记忆 <200行）· `CURRENT_STATE.md`（实时状态快照）·
  `ACTIVE_TASK.md`（工作记忆/子任务范围）· `SESSION_PROTOCOL.md`（AI 启动协议）·
  `ADR_INDEX.md`（12 个 ADR 索引，按需展开）· AGENTS §15 AI Context Loading Rules

## [0.2.0] - 2026-08-26

### Added
- **M3 Learning Graph**：四维掌握度引擎（knowledge/practice/recall/transfer, 权重 0.35/0.30/0.20/0.15）·
  SM-2 独立复习调度器（可替换为 FSRS/Leitner）· 6 API 端点（mastery CRUD + review/today + weak-list）·
  Dashboard 仪表盘（今日复习 + 掌握度进度条）· migration 004（concept_mastery/learning_events/review_queue）
- **M3.5-A Knowledge Radar MVP（全知领域 Phase A）**：GET /knowledge/suggest 上下文匹配端点 ·
  KnowledgeRadar.tsx 组件（debounce 500ms，Ctrl+Shift+K 唤起）· ADR-012 编辑器上下文感知架构
  （Scope Boundary + Evolution Path + Rejected Alternatives）· 零新依赖零新表

### Changed
- **项目里程碑**：M0 ✅ → M1 ✅ → M2 ✅ → M3 ✅ → M3.5-A ✅

### Added
- **M2 双链·反链·图谱**：[[wikilink]] 解析 + concept 桩自动创建/升级 + 统一 links 表索引
  + 反链 API（GET /notes/{id}/backlinks）+ 级联删除 + 图谱读模型（递归 CTE，depth 1~3）
  + React Flow 基础图谱（@xyflow/react 12，只读/单击跳转/双击局部展开/领域过滤）
  + NoteEditor 反链面板 + 全文搜索框（FTS5+LIKE fallback）+ 跨视图聚焦
  + 桩生命周期（migration 003：concepts.status unconfirmed→active）
  + 附件路径守卫（禁止盘符/file://）+ rebuild 幂等
- **测试基础设施**：tests/api/ 三层体系（unit/api/smoke）· scripts/test.ps1 一键入口 ·
  AGENTS §13 测试规范 + §14 Windows 红线（禁止 Invoke-RestMethod UTF-8）
- **M3.5-A Knowledge Radar MVP（全知领域 Phase A）**：GET /knowledge/suggest 上下文匹配端点 ·
  KnowledgeRadar.tsx 组件（debounce 500ms，Ctrl+Shift+K 唤起）· ADR-012 编辑器上下文感知架构
- **架构评审落地**：ADR-009 Entity/Document 边界 · ADR-010 AI Context Architecture
  （Router 禁直连 LLM，RAG 仅作 Builder 数据源）· ADR-011 中文搜索延后
  （unicode61 起步，拒现阶段 jieba）· PRODUCT_PRINCIPLES.md 五条产品原则 ·
  LICENSE Apache-2.0 · 六个月禁令清单显式化
- **项目重定位：Open Learning OS（开源 AI 学习型知识操作系统）**：双语北极星定位/
  三类用户画像/不做清单；CONTRIBUTING.md；根目录 PROJECT_BRIEF.md 决策资料包；
  宪法新增「用户数据永不锁死」「AI 调用边界」「Entity vs Document」红线与设计三问
- **ADR-008 知识图谱数据模型冻结**（M1.5）：Node=类型化 Entity（note/concept，预留
  code_symbol 等）；`[[wiki链接]]` 三级解析规则与附件路径政策；图谱分层铁律入宪法；
  M2 拆分为 M2-A~E 五个子里程碑
- **M1 知识库核心**：notes CRUD（vault/.md 为真相 + sha256 增量索引 + frontmatter tags）·
  附件上传/回读（20MB 白名单）· FTS5 检索端点 · Core 层 knowledge.py 首次入驻 ·
  shared/types 契约目录 + pytest 形状锁定 · TipTap(v3)+KaTeX 数学渲染编辑器 ·
  图片内嵌渲染（@tiptap/extension-image，ECR 获批后接入）· pytest 18 绿
- **M0 双端脚手架**：FastAPI（app 包 + migrations runner + settings/health API + 统一错误契约
  `{error:{code,message}}` + lifespan 启动迁移）· Vite React TS（Zustand + 六视图占位 +
  api client）· workspace 目录自动创建
- 必读文档体系：docs/architecture/principles.md · docs/dependencies/dependency-policy.md ·
  docs/security/network-boundary.md · docs/version-control/git-policy.md（自 POLICY.md 更名）
- 任务列表与完成报告制度 docs/tasks/TASKS.md（里程碑总览/报告模板/挂起区）
- 本地归档区 `_local/` 与实验沙盒 `sandbox/` 约定（仅存本机，gitignore）
- 工程宪法 AGENTS.md（能力复用优先级链、依赖纪律、架构红线、数据所有权分离、
  版本控制规则、架构检查十问、[ARCHITECTURE WARNING] 与 [ENVIRONMENT CHANGE REQUEST] 协议）
- 技术设计基线 docs/TECH_DESIGN.md（架构 / SQLite DDL / 掌握度引擎 /
  AI Tutor 管线 / Mind Map 系统 / 可视化系统 / API / 里程碑）
- ADR-001 存储分层 · ADR-002 思维导图存储 · ADR-003 LLM 接入 · ADR-004 依赖管理 ·
  ADR-005 局域网同步模型（文件真相/manifest 对比/冲突双份/token 配对）·
  ADR-006 移动端技术栈（RN + 混合内核 + 双端一致性门禁）·
  ADR-007 d3-force 单模块例外 · integration-upmark.md 联动计划（挂起）
- docs/dependencies/REGISTRY.md · dependency-policy.md · docs/version-control/git-policy.md ·
  docs/data-model/INDEX.md · docs/environment.md 环境治理 · separation.md 分层架构规范

### Changed
- **项目重定位**为 Open Learning OS：桌面(Tauri)+移动(RN Android 先行)+LAN 同步多端形态；
  浏览器降级为开发视图，App-first 数据规约自第一天生效
- **数据模型统一**：三张旧关系表并入多态 links 表（migration 002，ADR-008）；DDL 补 concepts.origin
- **可视化系统定稿**：§8.1 Knowledge Universe=学习反馈可视化奖励层（掌握三色编码/
  features/universe 模块/universe-layout 设备缓存/动效治理）· §8.2 Learning Trace Engine（M9-M10）
- 里程碑重排：M2 拆分 A~E · M7 LAN Sync · M8 Mobile MVP · M9-M10 可视化
- FastAPI 端口支持 `PORT` 环境变量覆盖（默认 8000，与 UpMark 共存时 8100）
- API 全面版本化：`/api` → `/api/v1`
- 依赖：运行时合计 Python 4（fastapi/uvicorn/python-multipart）+ Web 13；
  Framer Motion 进否决表；d3-force 批准（M3b 安装）
