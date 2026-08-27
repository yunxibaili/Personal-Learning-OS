# 任务列表与执行报告（Task Tracker）

> **制度（强制）**：
> 1. 任何开发任务开始前在此登记「计划」；完成后必须回填「完成报告」——
>    含做了什么、改动文件、**测试了什么（逐条列出实际执行的测试命令与预期/实际结果）**、遗留问题。
> 2. 未回填报告的任务视为未完成，不得开始依赖它的下一项任务。
> 3. 里程碑收尾**四件事**：依赖审计（REGISTRY 审计表）· 环境删除测试 + 删除优先检查
>    （docs/environment.md §五）· CHANGELOG 条目 · Git tag。
>
> 状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成（附报告锚点）

## 里程碑总览（映射 TECH_DESIGN §10）

| 任务 | 内容 | 状态 | 完成报告 |
|---|---|---|---|
| M0 | 双端脚手架 + migration runner + 必读文档体系就位 | `[x]` 完成 | [T-M0](#t-m0-m0-脚手架完成2026-08-26) |
| M1 | 知识库核心（CRUD/TipTap/LaTeX/附件） | `[x]` 完成 | [T-M1](#t-m1-m1-知识库核心完成2026-08-26) |
| M2-A | Markdown 链接解析器（[[标题]] 三级解析/自动建桩/附件路径守卫，ADR-008） | `[x]` 完成 | [T-M2](#t-m2-m2-双链反链图谱完成2026-08-26) |
| M2-B | Link 索引与反链 API（统一 links 表/级联清理） | `[x]` 完成 | [T-M2](#t-m2-m2-双链反链图谱完成2026-08-26) |
| M2-C | 搜索 UI（FTS5 结果跳转） | `[x]` 完成 | [T-M2](#t-m2-m2-双链反链图谱完成2026-08-26) |
| M2-D | Graph Read Model（GET /api/v1/graph 递归 CTE） | `[x]` 完成 | [T-M2](#t-m2-m2-双链反链图谱完成2026-08-26) |
| M2-E | React Flow 基础图谱（仅渲染，无动画无 d3-force） | `[x]` 完成 | [T-M2](#t-m2-m2-双链反链图谱完成2026-08-26) |
| M2b | Mind Map 编辑器（旁车 json + 生成大纲） | `[~]` M2b-001~003 ✅，大纲反解析挂起 | — |
| M3 | Learning Graph（掌握度/状态机/SM-2/Dashboard） | `[x]` 完成 | [T-M3](#t-m3-m3-learning-graph-完成2026-08-26) |
| M3b | Knowledge Universe 视觉层（Galaxy/Explorer/Memory Map，ADR-007） | `[x]` 完成（M3b-001~004） | 见 CURRENT_STATE |
| M3.5-A | Knowledge Radar MVP（全知领域 Phase A：FTS+Graph+Radar 面板，ADR-012） | `[x]` 完成 | [T-M3.5A](#t-m35a-m35-a-knowledge-radar-mvp-完成2026-08-26) |
| M3.5-B | Full Omniscience（全知领域 Phase B：+mastery+review+mistakes，前置 M3/M5） | `[ ]` | — |
| M4 | AI Tutor（provider/流式/上下文管线/extractor/AI导图） | `[x]` 完成（M4-A~E + Gate 1，ADR-014/015/016） | 见 CURRENT_STATE |
| M5 | 复习闭环（队列/测验/时间线） | `[x]` 完成 | [T-M5](#t-m5-m5-复习闭环完成2026-08-27) |
| M6 | Tauri 桌面打包 | `[ ]` | — |
| M7 | LAN Sync v1（配对/manifest 对比/冲突双份，ADR-005） | `[~]` M7-001~004 ✅，M7-005 未开工 | 见下方 M7 拆解 |
| M8 | Mobile MVP Android（RN+混合内核，ADR-006） | `[ ]` | — |
| M9 | Visual Engine V1（trace/StepPlayer/三模板） | `[ ]` | — |
| M10 | AI 生成可视化 | `[ ]` | — |

## M7 LAN Sync 任务拆解（当前）

> 详细设计：docs/sync/sync-model.md · sync-transport.md · ADR-020（真值模型）

- [x] ADR-020 Sync Truth Model（三层真值模型冻结）
- [x] M7-001 Sync Engine Core（manifest/scanner/diff，纯 Core 无网络）
- [x] M7-001 Stabilization Audit（glob bug 修复 + settings 边界修复）
- [x] M7-Nightly Full Audit Sprint
- [x] M7-001.5 Sync Simulation Environment
- [x] ADR-022 Product Mode Boundary
- [x] M7-002 LAN Discovery（UDP 广播发现/PING 心跳，27 tests）
- [x] M7-003 Sync Transport（messages/transfer/transport，31 tests · 总计 327 passed）
- [x] **M7-004 Sync Apply Layer + Boundary Audit** ✅：
  core/sync/apply.py（唯一写入口 · 双重校验 · eventlog append-merge event_id 去重 ·
  mindmap LWW + conflict backup）· tests/unit/test_sync_apply.py 27 个 · pytest 327→354
  完成报告：见 CURRENT_STATE「本次会话改动」与 docs/sync/sync-model.md §Apply 层
- [x] M7-004.5 Sync Boundary & Recovery Audit ✅（19 tests · 发现并修复 Apply 未
  fail-closed 漏洞 · pytest 354→373）完成报告：见 CURRENT_STATE 与
  docs/sync/sync-model.md §边界与恢复
- [x] M7-005 Conflict UI ✅（SyncStatusPanel @ Dashboard · GET /sync/status +
  POST /sync/resolve（方案 a：仅 mindmap 冲突源）· pytest 373→390）
  完成报告：见 CURRENT_STATE 与 shared/types/sync.ts 契约
- [x] M7-006 End-to-end LAN Demo ✅（Phase 1 runner · Phase 2 四场景 ·
  Phase 3.0 serve/receive 端点补齐 + Rule 1 收缰 · Phase 3.1 真实两进程字节级一致 ·
  Phase 3.2 宕机重试恢复 · pytest 390→397）完成报告：见 CURRENT_STATE
- [x] M7-006.5 Sync Release Audit ✅（AST 边界终审 PASS · Truth Model/Recovery 证据归档 · T-EXPORT 预检）产出 docs/sync/SYNC_BOUNDARY_REPORT.md · docs/release/EXPORT_MANIFEST.md · docs/release/RELEASE_AUDIT_M7.md
- [ ] M7-007 Vault Conflict Preservation（用户登记的待办）：apply.py vault 分支
  增加 conflict copy · 更新 ADR-020 与 sync-model.md · 补恢复测试——
  弥合「文档承诺 vault 双份保留 vs Apply 现为 LWW」的缺口（M7-003.5 发现；
  E2E Case 中 vault 冲突项当前为显式 no-op，见 test_e2e_demo.py）
- [ ] routers/sync HTTP 层（manifest exchange + pairing，随 Apply 之后的任务建立）

## M7-Preview-001 Local Demo Preparation（进行中）

- [x] scripts/seed_demo.py（只增不改 · 幂等可重跑 · 白名单内刷新）
- [x] 种子数据：5 篇 ML 笔记 + 纯概念桩（学习率/损失函数/注意力机制）+
  掌握度层次分布 + 复习队列 3 条待复习 · 刻意不预置 MindMap/冲突 artifact
  （留给用户亲手体验创建流程）
- [ ] 用户实际启动体验（Dashboard/Knowledge/Universe/MindMap/Tutor 三入口），
  记录产品问题
- 发现缺口待裁定：
  ① TECH_DESIGN §9 的 GET/POST /concepts CRUD 未实现——概念只能经 wikilink
  stub 产生，与笔记同名的主题无法成为概念节点。建议纳入 M7-008 或 P8。
  ② workspace/db 存在早年探针残留 TestConcept / MasteryTest（含 mastery 行），
  属测试脏数据，待用户确认后清除。

## P8 任务链规划（2026-08-27 用户裁定：先内容结构，后视觉语言）

```
P8-001A Concept Foundation      ✅ 已完成（origin 唯一来源 + /concepts CRUD，2026-08-27）
        ↓
P8-001B Universe V2 Layout      分层布局 · Domain 聚类 · 节点语义（下一步）
        ↓
P8-001C Universe Interaction    Focus / Weak / 路径高亮等交互
        ↓
P8-003 Home Experience          Dashboard 升级为 Learning OS Home
        ↓
P8-FE-001 Visual Language Polish ← 纯前端阶段（MiMo 克制感参考）
```

### 排序铁律（用户原话归纳）

1. 让 Universe 有东西看 → 2. 让节点关系有意义 → 3. 让首页像产品 →
4. 最后统一视觉语言。顺序反过来就是"漂亮的空壳"。

### P8-FE-001 Visual Language Polish（范围冻结，到点开工）

Allowed：CSS · 组件结构调整 · 动画/间距/字体层级 · 颜色系统 · 空状态 · 页面转场
Forbidden：改数据库 / Core / API / 同步逻辑

颜色方向参考 MiMo 的克制感（非复制）：

| 元素 | 方向 |
|---|---|
| 背景 | `#FAFAF7` 纸张感（弃纯白）· 主文字 `#1C1C1C` · 辅助文字 `#8A8A8A` |
| Concept 状态色 | 低饱和四色：正常=淡灰蓝 · 薄弱=淡琥珀 · 新概念=淡绿 · 重点=淡紫灰 |
| Universe | "知识地图"而非"星空宇宙"：浅背景+微阴影+轻边框+hover 提升；禁发光/粒子/旋转/3D |

⚠️ 执行前置条件：ADR-013 冻结了白橙主题与背景变量——配色切换需在开工时
以最小 ADR 附录形式过审（只改 CSS 变量值与允许色列表，不动布局纪律）。
触发提醒点：**P8-001B 完成后由用户宣布进入纯前端阶段**。

## 路线决议（2026-08-27 用户裁定）：M8 Mobile 延后

新路线（取代 TECH_DESIGN §10 的 M8 直进顺序）：

```
M7 收尾（006.5 Release Audit → 007 Vault Conflict → 008 Sync Polish）
    ↓
P8 PC Productization（PC 端完整学习工作台）
    ↓
Mobile API Preparation（只留 API 边界，不做客户端）
    ↓
M8 React Native
```

理由：价值密度仍在 PC 端；避免"PC 功能复制 UI/维护两套体验"。
Mobile 触发条件未变（ADR-006），但前置改为 P8 完成 + Mobile API 层就绪。

P8 PC Productization 候选范围（届时按 §12 八项清单逐项立项）：
1. Knowledge Mode / Learning Mode 落地（ADR-022 从设计到实现；禁 XP/streak/等级）
2. Dashboard 升级为 Learning OS Home（Today / Review / Weak Areas / Recent / Universe 预览）
3. Tutor 三入口闭环（Note→Explain · Review 错答→Hint · Universe 弱项→Tutor）

Mobile API Preparation 原则（提前冻结，防跑偏）：
- **不新建 /api/v1/mobile|app 独立端点族**——现有 /api/v1（notes/mastery/review/
  universe/graph）本就是 shared/types 契约层，App 直接复用即可；
  仅在确有聚合需求时补一个 GET /api/v1/home（recent_notes+weak_concepts+
  review_count 聚合读），符合 YAGNI 与单一契约原则（AGENTS §2.3）
- App 永不直接触文件：Mobile → API → Sync Core → Truth Source（ADR-005/020 已保证）

## M0 任务拆解

- [x] server/：FastAPI 入口（绑 127.0.0.1）+ db.py + migrations/001_init.sql（TECH_DESIGN §4 DDL）+ routers 骨架 + GET/PUT /api/v1/settings
- [x] web/：Vite React TS + Zustand store 骨架 + global.css + 六视图占位路由切换 + api client
- [x] 联调：Vite proxy `/api/v1`→8000；两条启动命令验证通过
- [x] 测试就位：pytest 目录 + 冒烟用例（migration 可跑、/api/v1/settings 读写往返）；vitest 占位
- [x] 验收自查：对照 TECH_DESIGN §10 M0 标准逐条勾选，回填报告

## M3.5-A 任务拆解（Knowledge Radar MVP）

- [ ] ADR-012 落盘（Context-Aware Knowledge Assistance Architecture）
- [ ] Core: `suggest_for_context()` 函数（FTS匹配 + concept LIKE + graph邻居 + memory占位）
- [ ] Router: `GET /api/v1/knowledge/suggest` 路由 + 参数校验
- [ ] Types: `shared/types/suggest.ts` 契约类型
- [ ] Frontend: `KnowledgeRadar.tsx` 组件（debounce + 三区域渲染 + 点击跳转）
- [ ] Frontend: NoteEditor 集成（showRadar状态 + Ctrl+Shift+K + 段落提取）
- [ ] Frontend: CSS 样式
- [ ] Tests: `test_suggest.py`（空库/匹配/邻居/参数校验）
- [ ] Docs: TECH_DESIGN §9/§10 + TASKS + CHANGELOG + REGISTRY + data-model INDEX
- [ ] 验收：pytest全绿 + vitest通过 + build成功

## 挂起区（有明确触发条件，未排期）

| 计划 | 触发条件 | 文档 |
|---|---|---|
| UpMark 联动 U1 错题登记流入 → U2 双向出题 → U3 题库导入 | 用户显式发起；前置 M3/M4(/M5) 完成 | docs/architecture/integration-upmark.md |

## 完成报告

### T-DOC-001 多端架构修订 + UpMark 联动挂起（2026-08-26）
- **做了什么**：产品定位升级为 Local-first 多端（Tauri 桌面 + RN Android + LAN Sync）；
  新增 ADR-005/006 与 integration-upmark.md；TECH_DESIGN §1/§2/§4.2/§5.4/§9/§10 更新；
  里程碑重排 M7=同步、M8=移动、M9/M10=可视化；AGENTS 冻结表/红线/优先级同步；
  REGISTRY 规划依赖补 RN 系；TASKS 重排并建挂起区
- **改动文件**：docs/architecture/(ADR-005·006·integration-upmark) · TECH_DESIGN · AGENTS ·
  REGISTRY · TASKS · CHANGELOG · data-model/INDEX
- **测试了什么**：

  | 检查 | 预期 | 实际 |
  |---|---|---|
  | 全库 `POLICY.md` 旧引用 | 仅 CHANGELOG 历史行 | 发现 1 处未改名残留 → 已修 |
  | TECH_DESIGN 中旧 M7(Visual) 引用 | 全部改指 M9 | 发现 2 处（§5.1 表、§8 标题）→ 已修 |
  | data-model INDEX concept_demos 触发里程碑 | M9 | 已修 |
  | git push origin main | 远程与本地一致 | ✅ 85fde9b..f6d519d |

- **结果与遗留**：文档体系与已批准决策一致；M0 尚未开工（下一任务）

### T-DOC-002 全库文档审计 + 任务列表可见性（2026-08-26）
- **做了什么**：21 个入库文件全量核对；修复 3 处错误（表数 11→12、proxy `/api`→`/api/v1`、
  §2.2 模块图统一为 server/app/ 包布局与 README 启动命令一致）；README 新增「当前进度」
  看板入口；AGENTS §11 增补强制规则——每次会话干活前必读 TASKS、收工前必同步
- **改动文件**：TECH_DESIGN · TASKS · AGENTS · README
- **测试了什么**：

  | 检查 | 预期 | 实际 |
  |---|---|---|
  | POLICY.md 残留引用 | 仅历史记录 | ✅ 2 处均为合法历史/报告行 |
  | 无版本 `/api/*` 本项目引用 | 0 | ✅ UpMark 自家接口除外（应保留） |
  | TODO/TBD/M2c/§13 游离标记 | 0 | ✅ |
  | M3b/M10/concepts.origin/api-v1 跨文档一致 | 全部对齐 | ✅ TECH_DESIGN·TASKS·REGISTRY·ADR-007·separation |
  | AGENTS 文档地图 ↔ 实际文件 | 一一存在 | ✅ 14 项全在（git ls-files 核对） |

- **结果与遗留**：文档基线可视为完整；M0 编码未开工

### T-M0 M0 脚手架完成（2026-08-26）

**1. 文件变化列表**（26 新增 + 3 更新）
- Backend：`requirements.txt` `requirements-dev.txt` `app/{__init__,main,db}.py` `app/core/__init__.py` `app/routers/{__init__,settings}.py` `migrations/001_init.sql` `tests/{conftest,test_smoke}.py`
- Frontend：`package.json` `vite.config.ts` `tsconfig.json` `index.html` `src/{main.tsx,App.tsx,global.css}` `src/lib/api.ts` `src/stores/{ui.ts,ui.test.ts}` `src/views/placeholders.tsx`
- 文档：`README.md`(PORT 说明) · 本文件 · `CHANGELOG.md`

**2. 依赖清单**
- Python 运行时：fastapi、uvicorn（仅 2 个）；开发：pytest、httpx
- Web 运行时：react、react-dom、zustand（仅 3 个）；开发：vite、typescript、vitest、@vitejs/plugin-react、@types/*
- TipTap/KaTeX/xyflow/d3-force/marked **均未安装**（按 REGISTRY 触发时机，后续里程碑引入）

**3. 启动方式验证**
- `uvicorn app.main:app --reload --port 8000` ✅（默认绑 127.0.0.1）
- `$env:PORT='8111'` + `python -m app.main` → 监听 8111 ✅（PORT 覆盖实测）
- `npm run dev` → 5173 ✅（host 显式 127.0.0.1，修复 localhost→::1 不一致问题）

**4. Migration 结果**
- `001_init` 应用成功：12 表 + notes_fts + 索引全部创建
- 幂等复跑：`schema_migrations` 计数不变，返回空增量 ✅
- workspace 自动创建：`db/ attachments/ metadata/(eventlogs/) vault/` ✅

**5. API 测试结果**

| 请求 | 结果 |
|---|---|
| GET /api/v1/health | `{status:"ok",db:true}` |
| PUT /api/v1/settings | `{ok:true}` |
| GET /api/v1/settings | api_key 返回 `******`，响应全文无明文密钥 ✅ |
| PUT 非字符串值 | 400 `{error:{code:"invalid_body"}}` |
| GET 未知路由 | 404 `{error:{code:"http_404"}}` |

**6. pytest 结果**
- `python -m pytest -q` → **6 passed**（health/migration幂等/workspace布局/settings往返+脱敏/非法值/404形态）
- vitest → **2 passed**（ui store 切换）
- `npm run build` → tsc --noEmit 通过 + vite 构建成功（gzip 47KB）

**7. 已知问题**
- starlette 提示 TestClient 的 httpx 用法未来弃用（建议 httpx2）——当前无影响，升级时跟进
- npm allow-scripts 对 esbuild postinstall 有审批提示——构建已实测可用；若异常执行 `npm approve-scripts`
- 六视图占位合并为单文件 `views/placeholders.tsx`（偏离 8 项清单的 6 文件拆分）：占位期更简，各里程碑原地实现后再自然拆分
- FastAPI 返回注解不能写 `dict | JSONResponse`（会尝试建响应模型报错）——已在 settings router 规避

**8. 下一阶段建议**
进入 **M1 知识库核心**：notes CRUD API + vault md 读写 + FTS 索引管线 + TipTap/KaTeX/math-extension 安装（届时在 REGISTRY 打钩确认）。开工前照例输出 §12 八项清单。

### T-DOC-003 环境治理规则入库（2026-08-26）
- **做了什么**：新增 docs/environment.md（版本基线/目录归属法/sandbox 规则/收尾四件事/
  [ENVIRONMENT CHANGE REQUEST] 协议/环境变量表）；.gitignore 补 sandbox/ 与 server/.cache/；
  AGENTS §7.1 ECR 协议、§11 收尾扩为四件事；network-boundary 同步两区边界说明
- **改动文件**：docs/environment.md(新) · .gitignore · AGENTS · network-boundary · 本文件 · CHANGELOG
- **测试了什么**：

  | 检查 | 预期 | 实际 |
  |---|---|---|
  | git status 干净、无未归属目录 | 无 temp/backup 类目录 | ✅ |
  | .gitignore 新条目生效 | sandbox//server/.cache 不再可跟踪 | ✅（git check-ignore 通过语义核对） |

- **结果与遗留**：M0 的 pip/npm 安装均在已批准的八项清单内，符合新规精神；
  自此任何清单外安装必须先走 ECR

### T-M1 M1 知识库核心完成（2026-08-26）

**1. 文件变化列表**（14 新增/实装 + 6 文档更新）
- Backend：`app/core/knowledge.py`(Core 首驻) · `routers/{notes,attachments,search}.py` · `tests/{test_notes,test_attachments}.py` · `main.py` 挂载
- Frontend：`views/NoteEditor.tsx`(实装) · `components/editor/TiptapEditor.tsx` · `lib/api.ts`(类型化+upload) · App/占位表/css
- 契约：`shared/types/note.ts` + tsconfig/vite `@shared` 别名
- 依赖：+6 npm（tiptap v3 线×3、tiptap-markdown、math-ext、katex）· +1 pip（python-multipart）

**2. 依赖清单**：REGISTRY 运行时表新增 tiptap-markdown(0.9.x)、python-multipart；TipTap 家族升级 v3 线（TECH_DESIGN §3.1 注记）

**3. 启动方式验证**：同 M0 双命令 + dev 联调实测

**4. Migration 结果**：无新 migration（复用 001）

**5. API 测试结果**

| 请求 | 结果 |
|---|---|
| POST /notes → GET detail → PATCH(内容+tags) → PATCH 改名 → DELETE | 全通过；文件与索引同步增删改 |
| POST 重名 | 409 duplicate_title |
| GET /search?q= | FTS5 命中正文词；缺 q 返 400 missing_q |
| POST /attachments (png/pdf/exe) | png/pdf 通过并可回读字节一致；exe 400 bad_type |

**6. pytest 结果**：**18 passed**（smoke 6 + notes 8 + attachments 4）；vitest 2 passed；build 通过（bundle 946KB，见已知问题）
**端到端**：经 5173 代理建「Taylor Expansion」→ FTS 搜到 → vault .md UTF-8 正确落盘 ✅（测试数据已清理）

**7. 已知问题**
- **图片内嵌渲染**：~~暂缓~~ **已解决（同日）**——[ENVIRONMENT CHANGE REQUEST] 获批，
  `@tiptap/extension-image@3.30.5` 接入；插图按钮启用，md 往返为 `![alt](url)`
- TipTap 从拟定的 v2 升为 **v3 线**：两个已批准依赖的现行 peer 契约均要求 v3，钉死 v2 需引入停更旧版——已在 REGISTRY/TECH_DESIGN 显式记录
- bundle 946KB（KaTeX 字体为主）：后续用动态 import 分包优化
- FTS5 默认 tokenizer 对中文分词有限（ADR-001 已知项），搜索 UI 在 M2 时评估 trigram/tokenize 方案
- PowerShell 管道写 UTF-8 源码会乱码——一律使用 Write 工具（流程教训）

**8. 下一阶段建议**
M2 双链·反链·图谱：`[[标题]]` 解析进 note_links、反链查询、GraphView(React Flow 安装触发)。

### T-M1R M1 Final Review + 数据模型冻结（2026-08-26）
- **做了什么**：M1 收口复核通过（TipTap/MD真相/图片闭环/分层/依赖登记全项达标）；
  新增 ADR-008 冻结图谱数据模型——**Node=类型化 Entity**（v1: note/concept，
  预留 code_symbol 等）、三张旧关系表统一为多态 `links` 表（migration 002 已应用）、
  `[[wiki链接]]` 三级解析规则（未命中自动建 concept 桩 origin=manual）、附件路径政策冻结；
  宪法新增「图谱分层铁律」；M2 拆分为 A–E 五个子里程碑；@xyflow/react 批准为 M2-E 渲染件
  （仅渲染不含计算），d3-force 维持 M3b 触发
- **改动文件**：ADR-008(新) · migrations/002(新) · TECH_DESIGN §4.1/§4.2/§6.3/§7.4/§8.1/§10 ·
  AGENTS 红线 · test_smoke · TASKS · CHANGELOG
- **测试了什么**：

  | 检查 | 预期 | 实际 |
  |---|---|---|
  | migration 002 应用于真实 workspace | links 建立且三旧表移除 | ✅ init_db applied |
  | pytest 全量 | 18 passed（含新表集断言+幂等=2） | ✅ |

- **结果与遗留**：等待用户指令「开始 M2」后按 §12 输出八项清单

### T-DOC-004 战略重定位为开源项目 + 决策资料包（2026-08-26）
- **做了什么**：项目定位升级为「Open Learning OS——开源、本地优先的 AI 学习型知识操作系统」；
  README 双语定位+用户画像+不做清单；TECH_DESIGN §1 重构（北极星/三层数据架构/战略 Phase 映射）、
  §10 新增 Future Roadmap 延后清单（云端/插件/i18n/Docker/T-EXPORT 数据导出承诺）；
  宪法新增红线「用户数据永不锁死」与设计三问；新建 CONTRIBUTING.md；
  根目录生成 PROJECT_BRIEF.md 决策资料包（11 节全量填写，待定项显式标注）
- **改动文件**：README · TECH_DESIGN · AGENTS · CONTRIBUTING.md(新) ·
  PROJECT_BRIEF.md(新) · 本文件 · CHANGELOG
- **测试了什么**：

  | 检查 | 预期 | 实际 |
  |---|---|---|
  | 三层数据架构 ↔ 现有表映射 | vault/concepts+links/mastery 族一一对应，零返工 | ✅ |
  | Brief 中所有引用文件存在 | 14 项路径可达 | ✅ |
  | 待定项显式标注（许可证/时间/硬件/目标勾选） | 不冒充已决策 | ✅ |

- **结果与遗留**：等待指令「开始 M2」（届时输出 M2-A 八项清单）；
  许可证选择建议在首次公开发布前定（MIT 或 Apache-2.0）

### T-DOC-005 架构评审落地：边界冻结 + 产品原则 + 许可证（2026-08-26）
- **做了什么**：按负责人评审意见新增 ADR-009（Entity/Document 边界）、ADR-010（AI Context
  Architecture：Router 禁直连 LLM）、ADR-011（中文搜索 unicode61 起步、jieba 延后）、
  PRODUCT_PRINCIPLES.md 五条产品原则；LICENSE 定为 Apache-2.0 并入库；
  Knowledge Universe 重定位为「学习反馈可视化奖励层」（掌握三色编码/features-universe 模块/
  universe-layout 设备缓存/动效治理）；Trace 引擎更名 Learning Trace Engine；
  M2-B 更名 Entity Resolver、M2-C/E 收窄；宪法补 AI 调用边界与 Entity 边界两条红线；
  六个月禁令显式化
- **改动文件**：ADR-009/010/011(新) · PRODUCT_PRINCIPLES.md(新) · LICENSE(新) ·
  TECH_DESIGN §8/§10 · AGENTS · separation · REGISTRY · README · PROJECT_BRIEF · CHANGELOG
- **测试了什么**：

  | 检查 | 预期 | 实际 |
  |---|---|---|
  | schema 影响 | ADR-009/010 零表变更（links 已满足） | ✅ |
  | 新依赖 | 零 | ✅ |
  | 待定项清理 | 许可证销号 | ✅ PROJECT_BRIEF §11 |

- **结果与遗留**：进入 M2（A→E 顺序实施）；图片 ECR 已批件已装

### T-M2 M2 双链·反链·图谱完成（2026-08-26）

**1. 文件变化列表**（10 新增/实装 + 7 文档更新）
- Backend Core：`knowledge.py` 扩展（extract_wikilinks/resolve_title/ensure_entity_by_title/promote_stub_to_note/rebuild_note_links/cascade_drop_entity/local_graph/backlinks_of_note/search LIKE fallback）
- Backend Routers：`links.py`(新) · `graph.py`(新) · `notes.py`(hook+guard) · `main.py`(挂载)
- Migration：`003_concept_status.sql`（concepts.status 列，stub 生命周期）
- Frontend：`shared/types/graph.ts`(新) · `views/GraphView.tsx`(实装) · `views/NoteEditor.tsx`(反链面板+搜索框+跨视图聚焦) · `stores/ui.ts`(focusNoteId) · `global.css`(graph/搜索/反链样式) · `App.tsx`(import swap)
- 测试：`tests/api/test_m2_smoke.py`(新，10 步全流程) · `tests/api/__init__.py` · `tests/unit/__init__.py`
- 脚本：`scripts/test.ps1`(新，一键测试入口)
- 文档：AGENTS §13/§14 · TECH_DESIGN §4.1 DDL · data-model INDEX · TASKS

**2. 依赖清单**：@xyflow/react@12.11.5（M2-E 渲染件，仅渲染无计算）

**3. 启动方式验证**：同 M1 双命令 + dev 联调

**4. Migration 结果**：003_concept_status 应用成功（concepts 补 status 列，unconfirmed/confirmed/active/archived）

**5. API 测试结果**

| 请求 | 结果 |
|---|---|
| POST /notes（含 [[链接]]） | 201，自动建 concept 桩，links 表写入 |
| POST 同名笔记 | 桩升级为笔记链接（promote_stub_to_note） |
| GET /notes/{id}/backlinks | 正确返回所有 note→note 反链 |
| GET /graph?root_type=note&root_id=N&depth=2 | 递归 CTE 返回 nodes/edges，learning 占位 |
| GET /graph?root_type=alien | 400 bad_params |
| GET /search?q= | FTS5 + LIKE fallback 大小写无关 |
| POST 附件路径 C:\... | 400 bad_attachment_path |
| DELETE /notes/{id} | 级联清理 links，无孤立记录 |
| rebuild 两次 | 幂等（先删后写 + 唯一约束） |

**6. pytest 结果**：**19 passed**（smoke 6 + notes 8 + attachments 4 + m2_smoke 1）；vitest 2 passed；build 通过

**7. 已知问题**
- FTS5 默认 tokenizer 对中文分词有限（ADR-011 已知项，unicode61 起步）
- GraphView 布局为简单网格（M3b 接入 d3-force 后升级）
- SQLite 并发锁：测试 fixture 需内联 open/close，不能跨 API 调用持有连接

**8. 下一阶段建议**
M2b Mind Map 编辑器（旁车 json + 大纲生成）或 M3 Learning Graph（掌握度/SM-2）

### T-M3.5A M3.5-A Knowledge Radar MVP 完成（2026-08-26）

**1. 文件变化列表**（5 新增 + 5 文档更新）
- Backend Core：`knowledge.py:suggest_for_context()`（FTS匹配 + concept LIKE + graph邻居 + memory占位）
- Backend Router：`routers/suggest.py`(新) · `main.py`(挂载)
- Types：`shared/types/suggest.ts`(新)
- Frontend：`components/KnowledgeRadar.tsx`(新) · `views/NoteEditor.tsx`(Ctrl+Shift+K + 段落提取) · `global.css`(radar样式)
- Docs：`ADR-012-omniscience-mode.md`(新) · TECH_DESIGN §9/§10 · TASKS · data-model INDEX · CHANGELOG

**2. 依赖清单**：零新依赖（FTS5 + recursive CTE 已有能力）

**3. API 设计**

| 方法&路径 | 说明 |
|---|---|
| GET /api/v1/knowledge/suggest?q=&note_id=&limit= | 上下文匹配+图谱邻居+memory占位 |

**4. pytest 结果**：**26 passed**（M2 19 + M3.5-A 7）；vitest 2 passed；build 通过

**5. 已知问题**
- query 提取算法较简单（段落/选文），未来可加 Context Extractor 拆词（ADR-013 候选）
- suggest API 无缓存，大规模笔记库需评估（ADR-014 候选）
- Radar 面板限制 matches<=5, related<=5（宁少勿错原则）

**6. 下一阶段建议**
回到主线 M3 Learning Graph（掌握度/SM-2/Dashboard）


### T-M3 M3 Learning Graph 完成（2026-08-26）

- **做了什么**：M3 全部交付——四维掌握度引擎、SM-2 独立调度器、6 个 API 端点、Dashboard 仪表盘、migration 004
- **改动文件**：
  - `server/app/core/mastery.py`（145行）——compute_effective, update_mastery, get_or_create_mastery, get_all_mastery, get_weak_concepts
  - `server/app/core/review_scheduler.py`（55行）——sm2_schedule（quality/ease/interval/review_count → next_review），独立模块可替换为 FSRS/Leitner
  - `server/app/routers/mastery.py`（176行）——GET /mastery, GET /mastery/{id}, POST /events, GET /review/today, POST /review/{id}/answer, GET /mastery/weak/list
  - `server/migrations/004_learning.sql`——concept_mastery(dimensions JSON), learning_events(source), review_queue(last_result)
  - `server/tests/api/test_mastery.py`——8 个 API + 3 个 unit 测试
  - `shared/types/mastery.ts`——MasteryRecord, MasteryDimensions, MasteryEvent, ReviewAnswer
  - `web/src/views/DashboardView.tsx`——今日复习 + 掌握度进度条
  - `web/src/App.tsx`——swap DashboardView import from placeholders to real
  - `web/src/global.css`——dashboard 样式
  - `server/app/main.py`——mount mastery_router
  - `server/tests/test_smoke.py`——migration count 3→4
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest -q` | 36 passed | 36 passed ✓ |
  | `npm run build` | build pass | build pass ✓ |
  | `git push` | pushed | 2d5f5d2 ✓ |
- **结果与遗留**：
  - M3 完成，文档同步（TECH_DESIGN §4/§9/§10, CHANGELOG, data-model INDEX）待后续补充
  - 004_learning.sql 使用 DROP+CREATE 重建旧表（因 001_init.sql 有旧 schema 残留），不影响生产数据（M3 首次部署）

## 完成报告模板（复制使用）

```markdown
### <任务号> 完成报告（YYYY-MM-DD）
- 做了什么：
- 改动文件：
- 测试了什么：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | | | |
- 结果与遗留：
```

### T-M5 M5 复习闭环 完成（2026-08-27）

- **做了什么**：M5 全部交付——概念学习状态自动初始化、复习 API 优先级完善、学习时间线、数据模型冻结
- **改动文件**：
  - `docs/data-model/learning-model.md`（新增）——学习状态数据模型契约（truth hierarchy + event_uuid + source 枚举 + 时间计算规则 + SM-2 可替换声明）
  - `server/app/core/mastery.py`——新增 ensure_concept_learning_state()
  - `server/app/core/knowledge.py`——ensure_entity_by_title() 调用初始化
  - `server/app/routers/mastery.py`——review_today 优先级排序 + 错答提升 + review/history 端点
  - `server/migrations/004_learning.sql`——ON DELETE CASCADE 修复
  - `web/src/views/DashboardView.tsx`——学习时间线视图
  - `web/src/global.css`——timeline 样式
  - `docs/ai/CURRENT_STATE.md`——M5 路线确认 + Frozen Domains
  - `docs/ai/ACTIVE_TASK.md`——M5 子任务范围
  - `docs/data-model/INDEX.md`——learning-model 条目
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest -q` | 38 passed | 38 passed ✓ |
  | `npm run build` | build pass | build pass ✓ |
  | `git push` | pushed | c47d86f ✓ |
- **结果与遗留**：
  - M5 完成，Learning Loop 闭合（events → mastery → review_queue → 用户复习 → 新 events）
  - 下一阶段：M4 AI Tutor

### M3b-001 Universe Projection 完成（2026-08-27）

- **做了什么**：GET /api/v1/universe 端点，返回 concepts + links + mastery → {nodes, edges}
- **改动文件**：
  - `server/app/core/universe.py`（新增）——graph projection（concepts + links + mastery → nodes/edges）
  - `server/app/routers/universe.py`（新增）——GET /api/v1/universe
  - `server/app/main.py`——注册 universe_router
  - `server/tests/test_universe.py`（新增）——6 个测试
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest -q` | 132 passed | 132 passed ✓ |
  | `npx vite build` | build pass | build pass ✓ |
- **结果与遗留**：Universe API 完成，下一步前端渲染

### M3b-002 Universe Layout 完成（2026-08-27）

- **做了什么**：React Flow 渲染 Universe 图，mastery → radius(16-32px) + color(灰/橙/深)，domain filter
- **改动文件**：
  - `web/src/components/universe/KnowledgeUniverse.tsx`（新增）——React Flow 容器 + domain filter
  - `web/src/components/universe/ConceptNode.tsx`（新增）——节点渲染（mastery → radius + color）
  - `web/src/stores/ui.ts`——ViewKey 增加 "universe"
  - `web/src/App.tsx`——Universe tab 集成
  - `web/src/global.css`——universe 样式
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `npx tsc --noEmit` | no error | no error ✓ |
  | `npx vite build` | build pass | build pass ✓ |
- **结果与遗留**：Universe 前端骨架完成，下一步交互层

### M3b-003 Interaction + State Detail 完成（2026-08-27）

- **做了什么**：ConceptNode hover tooltip（mastery 四维）+ KnowledgeUniverse detail panel（click → 右侧 mastery 面板）+ Open Note action
- **改动文件**：
  - `web/src/components/universe/ConceptNode.tsx`——hover tooltip（mastery effective + 4 dimensions + status）
  - `web/src/components/universe/KnowledgeUniverse.tsx`——onNodeClick + detail panel（右侧 260px）
  - `web/src/global.css`——tooltip + detail panel + universe-body 样式
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `npx tsc --noEmit` | no error | no error ✓ |
  | `npx vite build` | build pass | build pass ✓ |
- **结果与遗留**：Universe 交互层完成，下一步 M3b-004 Navigation Layer（domain clustering）

### M3b-004 Navigation Layer 完成（2026-08-27）

- **做了什么**：Universe 导航层——domain filter 改为顶部 tab、weak area view（低掌握度概念筛选 + threshold slider）、focus mode（邻居展开 + depth 1/2/3 hop 控制 + neighbor list）
- **改动文件**：
  - `web/src/components/universe/KnowledgeUniverse.tsx`——view mode tabs (all/weak/focus)、domain tabs、weak threshold slider、focus depth control、neighbor list in detail panel
  - `web/src/global.css`——tabs、weak control、focus control、depth buttons、neighbor list 样式
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `npx tsc --noEmit` | no error | no error ✓ |
  | `npx vite build` | build pass | build pass ✓ |
- **结果与遗留**：M3b Knowledge Universe 全部完成（M3b-001~004），下一步 M2b MindMap

### M2b-001 MindMap Canvas 完成（2026-08-27）

- **做了什么**：MindMap Canvas CRUD + React Flow + ADR-019 isolation
- **改动文件**：
  - `server/migrations/006_mindmap.sql`——mind_maps + mind_map_nodes + mind_map_edges 三表
  - `server/app/core/mindmap.py`——CRUD（create/list/get/delete map, add/update/delete node, add/delete edge）
  - `server/app/routers/mindmap.py`——9 endpoints
  - `server/tests/api/test_mindmap.py`——18 tests（含 ADR-019 isolation test）
  - `web/src/components/mindmap/MindMapCanvas.tsx`——React Flow + sidebar
  - `web/src/components/mindmap/MapNode.tsx`——concept badge / temp node
  - `web/src/App.tsx`——MindMap tab 集成
  - `web/src/global.css`——mindmap 样式
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest -q` | 150 passed | 150 passed ✓ |
  | `npx vite build` | build pass | build pass ✓ |
- **结果与遗留**：M2b-001 完成，ADR-019 隔离验证通过，下一步 M2b-002 Concept Binding

### 项目审查记录（2026-08-27）

审查结论：

> 架构方向没有偏离，核心约束没有被破坏。达到「核心架构完成，进入扩展期」阶段。

关键发现：

1. **M0.5 命名混乱**：已修正为 M4-A Tutor Context Infrastructure（含 docs/ai/ + context builder）
2. **create_note 原子写入**：优先级从 Known Risk 提升为 P2（M7 Sync 前必须解决）
3. **M2b-002 前置**：建议增加 MindMap Boundary Audit（检查 ADR-019 铁律）
4. **M7 前置**：需要 ADR-020 Sync Conflict Resolution（Markdown/Event/SQLite 三套同步策略）

四层空间边界已确立：

```
Knowledge Layer → Learning Layer → Thinking Layer → AI Assistance
```

下一步：M2b-002 Concept Binding

### M2b-002 Concept Binding 完成（2026-08-27）

- **做了什么**：MindMap 节点绑定 Concept（引用，不改 mastery/event）+ ADR-019 Boundary Audit
- **改动文件**：
  - `server/app/core/mindmap.py`——bind_concept / unbind_concept / search_concepts
  - `server/app/routers/mindmap.py`——POST /bind + DELETE /bind + GET /concepts/search
  - `server/tests/api/test_mindmap.py`——TestConceptBinding (5) + TestMindMapBoundaryAudit (6)
  - `web/src/lib/api.ts`——searchConcepts / bindConcept / unbindConcept
  - `web/src/components/mindmap/MindMapCanvas.tsx`——Concept Binding Panel（选中节点 → 搜索 → 绑定/解绑）
  - `web/src/global.css`——binding-panel / binding-results / binding-current 样式
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest tests/api/test_mindmap.py` | 29 passed | 29 passed ✓ |
  | `pytest -q` | 161 passed | 161 passed ✓ |
  | `npx vite build` | build pass | build pass ✓ |
- **结果与遗留**：M2b-002 完成，ADR-019 五条铁律全部验证通过，下一步 M2b-003 Export/Import

### M2b-003 Export/Import 完成（2026-08-27）

- **做了什么**：MindMap Exchange Format v1 冻结 + 导入导出 API + 前端 UI
- **改动文件**：
  - `docs/architecture/ADR-021-mindmap-exchange-format.md`——格式冻结（version/type/map）
  - `server/app/core/mindmap.py`——export_map / import_map（ID 重映射 + concept_id 验证）
  - `server/app/routers/mindmap.py`——GET /export + POST /import
  - `server/tests/api/test_mindmap.py`——TestExportImport (6 tests)
  - `web/src/components/mindmap/MindMapCanvas.tsx`——Import/Export 按钮 + 下载/上传逻辑
  - `web/src/global.css`——mindmap-import-export 样式
  - `docs/ai/ADR_INDEX.md`——ADR-021 索引
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest tests/api/test_mindmap.py` | 35 passed | 35 passed ✓ |
  | `pytest -q` | 167 passed | 167 passed ✓ |
  | `npx vite build` | build pass | build pass ✓ |
- **结果与遗留**：M2b-003 完成，M2b MindMap 里程碑全部完成，下一步 ADR-020 Sync Conflict Resolution
