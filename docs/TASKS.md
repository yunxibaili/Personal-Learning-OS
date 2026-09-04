# 任务列表与执行报告（Task Tracker）

> **制度（强制）**：
> 1. 任何开发任务开始前在此登记「计划」；完成后必须回填「完成报告」——
>    含做了什么、改动文件、**测试了什么（逐条列出实际执行的测试命令与预期/实际结果）**、遗留问题。
> 2. 未回填报告的任务视为未完成，不得开始依赖它的下一项任务。
> 3. 里程碑收尾**四件事**：依赖审计（REGISTRY 审计表）· 环境删除测试 + 删除优先检查
>    （AGENTS.md §17 §五）· CHANGELOG 条目 · Git tag。
>
> **单一真相源原则（2026-09-02 所有者裁定）**：项目进度的唯一权威 = `docs/PROJECT_STATE.md`
> （§10 闭环完成度 / §10.3 当前任务与路线 / §12 技术债）。本文件职责 = **任务定义 + 执行队列 +
> 完成报告存档**；本文件的状态列若与 PROJECT_STATE 或实际代码冲突，以二者为准并回改本文件。
> 本文件已完成部分的过时表述（如已被取代的架构）在 2026-09-02 收口中标注，历史原文进 git。
>
> 状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成（附报告锚点）

## 执行队列（2026-09-02 所有者裁定「先收口，后开发」重排）

> 历史队列（1–8 项，后端 backlog 清零 → 前端阶段 → T-NOTE-HIER）全部完成，
> 完整历史见本文档下半部完成报告区与 `git log`。

```text
[0]–[8] ✅ 全部完成（收口 / 技术债分级 / M9-007·008 / M9 关闭 /
        T-NOTE-TREE T1–T3 / P8 收尾 tag v0.1.0-rc.2，详见 PROJECT_STATE §10.3）

── 2026-09-02 所有者第二次裁定：先 P1 技术债收敛，M8 不启动 ──

[9]  [x] P1-1 MindMap API 边界治理（2026-09-02 完成，报告见下文）
     6 处裸 fetch → lib/api.ts（ApiError 归一化）+ 拖拽坐标
     drag-end flush + 1s trailing debounce 兜底（PositionSaveQueue）。
     范围裁定：不修 N1 sidecar、不新增 shared/types/mindmap.ts（契约治理候选，
     现有 lib/api.ts 类型可安全承载）、不动 GET /mindmaps wrapper。

[9b] [x] P1-MINDMAP-TRUTH（2026-09-02 完成，报告见下文）
     恢复 MindMap sidecar producer：*.mindmap.json（ADR-002/019 声明的事实源）
     此前全库零生产者，MindMap 数据只在 SQLite → 不同步、多端必丢。
     落地：core/mindmap.py 增删改后整体重写 sidecar + rebuild_mindmaps()
     从文件重建 SQLite 三表 + /sync/receive 落盘后触发重建。
     **M8 前置条件已满足。**

[10] [x] P1-5 Backend/UI 能力裁定（2026-09-02 四组弹窗完成，裁定结果见 PROJECT_STATE §12）
[10a] [x] P1-5-A 设置 UI：LLM Provider 配置页（GET/PUT /settings；2026-09-02 完成）
[10b] [ ] P1-5-B 错题本 UI：列表/标记已解决/删除/统计（/mistakes/*）
[10c] [ ] P1-5-C 会话历史最小 UI：Tutor 抽屉内列表+删除（/conversations）
[11] [ ] P1-3 MockProvider 演示路径
[12] [ ] P1-4 中文 FTS
[13] [ ] P1-2 国际化（18 处硬编码英文）
[14] [ ] M8 Mobile 可行性 / 架构决策（前置：[9][9b][10] 完成）
[15] [ ] M8 Android MVP
[16] [x] ADR-028 Backend: Document Changes / Revision / Diff 基础能力（2026-09-04 完成，报告见下文）
     与 Git 解耦的文档版本层：快照（合法 Markdown 存 metadata/revisions/）+
     changes/diff/restore + 孤儿快照回收。零 migration 零 Git 依赖。
     Git source 适配器与前端消费均在任务书划界外（另立任务）。
```

<details>
<summary>历史执行队列（2026-08-29 → 2026-09-01，全部完成，存档）</summary>

```text
1. ✅ 审核收口四项（SYNC 矛盾统一 · ADR-020 附录化 · 残留清零 · 基线）
2. ✅ T-EXPORT 导出脚本（B11 完成：GET /api/v1/export · 493 passed）
3. ✅ M7-007 Vault Conflict Preservation（代码+文档均已闭环）
4. ✅ 9.1 AI 闭环（B1-B10 全部 ✅）
5. ✅ pairing + manifest（M7-008 Sync HTTP 层闭合）
6. ✅ event_id/event_uuid 术语统一（migration 009 + 代码+文档同步）
── §9 后端 backlog 已全部清零 ──
── 前端阶段（2026-08-30 项目所有者宣布进入）──
7. ✅ /home 聚合端点（D1）+ P8-003 Home 最小接线
   （后注：HomeView 已按「方案 B」删除，GET /home 端点保留，见 §Home 处置）
· FE-001（UI 视觉打磨，2026-08-31 解冻：Round1-3 已推 907ff74/888ecd2/3182465，已收尾）
8. [x] T-NOTE-HIER 主/副笔记层级（ADR-024）——P0+P1 完成（2026-09-01）
── 项目所有者 2026-09-01 裁定：M9 优先于 T-NOTE-HIER P1 ──
9. [~] M9 Visual Engine V1 → M9-002~006 已完成，余 007/008（见新队列 [2]-[4]）
10. [ ] T-NOTE-TREE T1-T3（ADR-026 v3 Accepted）→ 移入新队列 [5]-[7]
```

</details>

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
| M2b | Mind Map 编辑器（旁车 json + 生成大纲） | `[x]` 完成（M2b-001~003 + B18 大纲反解析 ✅，2026-08-31 核实回填） | [T-M2b](#m2b-003-mindmap-编辑器完成2026-08-27) |
| M3 | Learning Graph（掌握度/状态机/SM-2/Dashboard） | `[x]` 完成 | [T-M3](#t-m3-m3-learning-graph-完成2026-08-26) |
| M3b | Knowledge Universe 视觉层（Galaxy/Explorer/Memory Map，ADR-007） | `[x]` 完成（M3b-001~004） | 见 CURRENT_STATE |
| M3.5-A | Knowledge Radar MVP（全知领域 Phase A：FTS+Graph+Radar 面板，ADR-012） | `[x]` 完成 | [T-M3.5A](#t-m35a-m35-a-knowledge-radar-mvp-完成2026-08-26) |
| M3.5-B | Full Omniscience（全知领域 Phase B：+mastery+review+mistakes，前置 M3/M5） | `[x]` 完成（2026-08-31） | 见下方 M3.5-B 拆解 |
| M4 | AI Tutor（provider/流式/上下文管线/extractor/AI导图） | `[x]` 完成（M4-A~E + Gate 1，ADR-014/015/016） | 见 CURRENT_STATE |
| M5 | 复习闭环（队列/测验/时间线） | `[x]` 完成 | [T-M5](#t-m5-m5-复习闭环完成2026-08-27) |
| M6 | Tauri 桌面打包 | `[x]` 完成（2026-09-01，GNU 工具链，MSI 65MB + NSIS 102MB） | [T-M6](#t-m6-m6-tauri-桌面打包完成2026-09-01) |
| M7 | LAN Sync v1（配对/manifest 对比/冲突双份，ADR-005） | `[x]` 完成（M7-001~008 全链路闭环，2026-08-31 核实回填） | 见下方 M7 拆解 |
| M8 | Mobile MVP Android（RN+混合内核，ADR-006） | `[ ]` | — |
| M9 | Visual Engine V1（预置示例 trace/VisualEngine/三 Renderer） | `[~]` 进行中（ADR-025 IDE 步进范式；**M9-002~006 已完成 2026-09-01**，余 M9-007 接入 / M9-008 验收） | [M9 拆解](#m9-visual-engine-任务拆解) |
| M10 | AI 生成可视化 | `[ ]` | — |

## M7 LAN Sync 任务拆解（当前）

> 详细设计：docs/SYNC.md · sync-transport.md · ADR-020（真值模型）

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
  完成报告：见 CURRENT_STATE「本次会话改动」与 docs/SYNC.md §Apply 层
- [x] M7-004.5 Sync Boundary & Recovery Audit ✅（19 tests · 发现并修复 Apply 未
  fail-closed 漏洞 · pytest 354→373）完成报告：见 CURRENT_STATE 与
  docs/SYNC.md §边界与恢复
- [x] M7-005 Conflict UI ✅（SyncStatusPanel @ Dashboard · GET /sync/status +
  POST /sync/resolve（方案 a：仅 mindmap 冲突源）· pytest 373→390）
  完成报告：见 CURRENT_STATE 与 shared/types/sync.ts 契约
- [x] M7-006 End-to-end LAN Demo ✅（Phase 1 runner · Phase 2 四场景 ·
  Phase 3.0 serve/receive 端点补齐 + Rule 1 收缰 · Phase 3.1 真实两进程字节级一致 ·
  Phase 3.2 宕机重试恢复 · pytest 390→397）完成报告：见 CURRENT_STATE
- [x] M7-006.5 Sync Release Audit ✅（AST 边界终审 PASS · Truth Model/Recovery 证据归档 · T-EXPORT 预检）产出 docs/SYNC.md · docs/release/EXPORT_MANIFEST.md · docs/release/RELEASE_AUDIT_M7.md
- [x] **M7-007 Vault Conflict Preservation** ✅（2026-08-29 已实现，
  2026-08-30 复核确认）：`apply.py`  vault 分支冲突时把本地版写入
  `path + ".conflict"`（`.conflict` 不在 `vault/**/*.md` 白名单内，天然隔离同步）。
  此前本行未勾选属文档滞后——代码侧早已闭环。
- [x] **M7-008 Sync HTTP 层（manifest exchange + pairing）** ✅（2026-08-30）：
  补齐两台设备在 API 层面协商「谁有什么」的能力，闭合
  **Discover → Pair → Manifest → Diff → Transport → Apply → Reindex** 全链路。
  详见下方 M7-008 任务区。

## M7-008 Sync HTTP 层：Manifest Exchange + Pairing（2026-08-30 ✅）

> 缺口来源：core 侧 scan/diff/transport/apply 早已齐备，但 **HTTP 层没有出口**——
> 两台设备无法在 API 层面完成「谁有什么」的协商，端到端只能靠脚本直调 core。
> 本任务把同步链路最后一段接线补上，不改任何冻结协议结构。

**Core 层**（新建 `core/sync/pairing.py`）
- `PeerDevice`（device_id/name/host/port/paired_at）· `add_peer`（幂等，同 id 更新不追加）·
  `list_peers`（稳定序）· `get_peer` · `remove_peer`
- 存于 `metadata/paired_devices.json`——**Layer 3 本地缓存，永不同步**
  （已登记进 `manifest.SYNC_BLACKLIST`，并有测试端到端证明其不会进 manifest）
- 健壮性：原子写入（tmp → replace）· 损坏文件先备份 `.corrupt-<ts>` 再重建 ·
  脏条目跳过不拖垮整簿 · `MAX_PEERS=64` 上限
- fail-closed 校验：device_id 形态 · host（IPv4 或 RFC1123 主机名）· port 1-65535 ·
  **bool 显式挡掉**；非法入参不落盘

**HTTP 层**（`routers/sync.py` 新增 6 端点）
- `GET /sync/manifest` — 本地 Layer 1 清单（只读扫描）
- `POST /sync/plan` — 收对端清单 → 返回 SyncPlan，**纯计算不落盘**
  （写入仍唯一经 `/sync/receive` + SyncApply，Rule 1 未被绕过）
- `GET /sync/discover` — UDP 广播发现（默认 1.5s、`max_retries=1`、超时上限 5s，
  避免一次发现拖住同步链路；网卡不可广播时降级为空列表而非 500）
- `POST /sync/pair` · `GET /sync/peers` · `DELETE /sync/peers/{id}`

**实测修正（测试先行抓出的真实缺陷）**
1. host 校验过松：`999.999.999.999` 被主机名正则（标签允许数字）判为合法——
   配对成功但永远连不上。收紧为「纯数字点分串一律按 IPv4 严检」。
2. `files=[]` 让 `Manifest.from_dict` 抛 `AttributeError`，逃逸成 **500**；
   网络边界补 `AttributeError` 捕获 → 统一 400 `bad_manifest`。
3. 参数校验在本项目被 `main.py` 全局处理器映射为 **400 `invalid_body`**（非 422）。

**验证**：
- `tests/unit/test_sync_pairing.py`（core 层 **45** 项）
- `tests/api/test_sync_http.py`（HTTP **30** 项）
- `tests/integration/sync/test_sync_closed_loop.py`（端到端闭环 **7** 项）
- `tests/api/test_mastery.py` +3（mastery detail 缺 title 回归）
- 全量 **pytest 815 passed**（基线 730 → +85），零失败。

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
   属测试脏数据 → P8-004 已清除（2026-08-28）。

## P8 任务链规划（2026-08-27 用户裁定：先内容结构，后视觉语言）

```
P8-001A Concept Foundation      ✅ 已完成（origin 唯一来源 + /concepts CRUD，2026-08-27）
        ↓
P8-001B Universe V2 Layout      ✅ 已完成（d3-force + Planet + Inspector，2026-08-27）
                                ⚠️ 【2026-09-02 收口标注】后于 2026-08-31 随架构演进
                                整包删除（dd4f40c，11 文件 2283 行）；d3-force 依赖已移除；
                                替代物 = Galaxy 多星球系统（自研 Canvas）。勿据本行恢复代码。
        ↓
P8-001C Knowledge Planet        ✅ 已完成（Cobe 地球 + 轨道卫星 + 性能契约，2026-08-28）
                                ⚠️ 【2026-09-02 收口标注】同上已删除（dd4f40c + 依赖移除
                                13fa1bc）；点阵地球视觉定稿改入 ui 库（ui/dot-earth.html）。
                                勿据本行恢复代码。
        ↓
P8-004 Demo Cleanup             ✅ 已完成（清除 TestConcept/MasteryTest 探针残留，2026-08-28）
        ↓
P8-002 Graph V2                 ✅ 已完成（dagre 层级布局 + 双视觉 + Layer Toggle，2026-08-28）
        ↓
P8-003A Review Session MVP      ✅ 已完成（SM-2 学习闭环接入 UI，2026-08-28）
        ↓
P8-003C Vault Reindex           ✅ 已完成（Markdown→SQLite 索引恢复，2026-08-28）
        ↓
P8-003B Mastery Decay           ✅ 已完成（Ebbinghaus 时间衰减，2026-08-28）
        ↓
P8-003D Eventlog Producer      ✅（ADR-020 闭合：update_mastery → JSONL）
        ↓
P8-003D Tutor Knowledge Base    ✅（甲路线笔记引用 + 乙路线 auto_notes FTS 检索，见 PROJECT_STATE §9.1）
        ↓
P8-003E Tutor Review Bridge     ✅（context 注入 mastery/mistakes/review/memories；chat 回合后 extractor → update_mastery，2026-08-30 验证）
        ↓
Home / UI Polish
```

### P8-003 Home + /home 聚合端点（D1）（2026-08-30 ✅ 端点；视图已按方案 B 删除）

> 【2026-09-02 收口标注】本任务标题的 ✅ 指 **`GET /home` 聚合端点**（保留至今，
> TopBar 复习徽章 + 右栏掌握度消费）；而 `HomeView.tsx` 视图已于裁决 A 删除
> （见本文「Home 处置」节：方案 B）。两处 ✅ 语义不同，非矛盾。

前端阶段首个任务（项目所有者 2026-08-30 宣布进入前端阶段）。§0 边界遵守：
最小接线（调用得通、结果可见），零视觉打磨（FE-001 仍冻结）。

**设计决策**：
- D1 聚合范围（v1 最小集）：recent_notes(5) + weak_concepts(5) + review_due 计数
  ——对应 TECH_DESIGN §10 backlog「GET /api/v1/home」行
- D2 零新表零 migration，纯读现有表
- D3 weak_concepts 复用 `get_weak_concepts`（effective>0 才算薄弱）
- D4 Home 为默认视图（首 tab），DashboardView 保留不动（Sync 面板/星球/时间线仍在此）

**新增/修改**：
- `server/app/core/home.py`（聚合读模型，纯 core）· `server/app/routers/home.py` · main.py 注册
- `shared/types/home.ts`（契约）· `web/src/views/HomeView.tsx`
- `web/src/stores/ui.ts`（ViewKey+"home"，默认视图 home）· `ui.test.ts` · `App.tsx`（首 tab 接线）

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `pytest tests/api/test_home.py -q` | 4 passed | 4 passed |
| `pytest -q` | 全绿 | 826 passed |
| `npx tsc --noEmit` | PASS | PASS |
| `npx vitest run` | 23 passed | 23 passed |
| `npx vite build` | PASS | PASS |
| 真实服务冒烟 `GET /home` | 三段聚合数据 | PASS（notes/weak/review_due=1） |

**遗留**：HomeView 跳转（openNote/openTutorForConcept）与视觉呈现属下一轮（FE-001 解冻后）；
B10 文档状态与 §9 闭环记录见 PROJECT_STATE §9.1。

### P8-001C Knowledge Planet（用户直接需求，2026-08-27 首版落地 ✅）

首页知识星球：Cobe 点阵地球（MiMo 风格）+ 4 条错倾轨道卫星。
- 卫星 = 笔记：新建笔记即增卫星；尺寸随总数 6→13px 封顶；>16 篇聚合展示总数
- 遮挡：数学 z-position（z<0 且在地球投影圆内 → opacity:0，sandbox 验证方案）
- 交互：hover 放大+名称 · click 底部指示器 · 拖动旋转（pointer capture）
- **性能契约**（修复 sandbox 版 CPU 90%）：
  dpr=1（不乘 1.5）· 280px canvas（非 560）· 地球与卫星共用一个 30fps 节流 rAF ·
  IntersectionObserver + visibilitychange 不可见即暂停 · prefers-reduced-motion 静态帧 ·
  canvas/scene `contain: layout paint size`
- 依赖：cobe ^0.6.5 入 REGISTRY（MIT · 5KB，性能边界随登记）
- 位置：web/src/components/planet/KnowledgePlanet.tsx，挂 Dashboard；
  sandbox/cobe-test*.html 为实验留档（按 environment.md 用完即删原则待清理）

### P8-004 Demo Cleanup（2026-08-28 ✅）

清除 workspace/db 早期探针残留，恢复 demo 数据纯净。

**删除目标**（精确 IN，无模糊匹配）：
- `TestConcept`（id=1, origin=manual）+ `MasteryTest`（id=2, origin=manual）
- 关联：links 4行 · concept_mastery 1行 · learning_events 0 · review_queue 0 · mistakes 0

**执行**：
1. 备份 `learning-os.db` → `learning-os.db.backup-before-p8-004`
2. SQL 精确删除：links → concept_mastery → concepts（按外键依赖顺序）
3. 验证：残留检查 = 0 · 清理后 concepts=17 · links=5

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `pytest --tb=short -q` | 426 passed | 426 passed |
| `npx vitest run` | 16 passed | 16 passed |
| `npx vite build` | PASS | PASS |

**结论**：真实 DB 删除不影响测试隔离（tests 全用 tmp_workspace）。
**辅助脚本**：`scripts/_cleanup_check.py` / `_cleanup_delete.py`（一次性，待清理）

### P8-002 Graph V2（2026-08-28 ✅）

关系探索视图升级：从网格布局升级为 dagre 层级布局 + 双视觉节点。

**设计决策**（已裁定）：
- D1 Mixed 默认（Concept 主视觉更大，Note 辅助更轻）
- D2 Note = 方形卡片（document card）
- D3 Edge 文字默认隐藏 hover 显示
- D4 复用 Floating Inspector
- D5 dagre 层级布局
- D6 不改后端

**新增文件**：
- `web/src/lib/graph/layout.ts`：dagre 布局引擎（纯函数，7项测试）
- `web/src/lib/graph/layout.test.ts`：空输入/单节点/层级/同层/确定性/混合
- `web/src/components/graph/GraphConceptNode.tsx`：圆形概念节点
- `web/src/components/graph/GraphNoteNode.tsx`：方形笔记节点
- `web/src/components/graph/GraphEdge.tsx`：9种 relation 视觉层次
- `web/src/components/graph/index.ts`：导出

**重写文件**：
- `web/src/views/GraphView.tsx`：dagre + Layer Toggle + MiniMap + Inspector + hover

**CSS**：global.css +80行（gnode concept/note/tooltip/gedge/layer-toggle/inspector）

**依赖**：dagre ^0.8.5 + @types/dagre（REGISTRY 登记）

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `npx tsc --noEmit` | PASS | PASS |
| `npx vitest run` | 23 passed | 23 passed |
| `npx vite build` | PASS | PASS |
| `pytest --tb=short -q` | 426 passed | 426 passed |

### P8-003A Review Session MVP（2026-08-28 ✅）

SM-2 复习流程接入真实 UI。不新增后端、不改数据模型、不加新依赖。

**设计决策**（已裁定）：
- D1 不建 review_sessions 表（MVP 不需要 session 追踪）
- D2 评分按钮：😵 忘记了(1) / 🤔 有点模糊(3) / ✨ 记得很清楚(5)
- D3 概念标题直接显示（不是 Quiz，是记忆强度反馈）
- D4 必须有 feedback 页（mastery 变化 + 下次复习日期）
- D5 Dashboard 保留快速入口，Review 页面提供完整流程
- D6 不改后端 / 不改 migration / 不加 API / 不加 store

**新增文件**：
- `web/src/views/ReviewSessionView.tsx`：完整复习流程（idle→loading→ready→answering→feedback→done）

**修改文件**：
- `web/src/App.tsx`：ReviewQueueView → ReviewSessionView
- `web/src/global.css`：+120行复习状态样式
- `shared/types/mastery.ts`：ReviewItem 增加 effective 字段（对齐后端实际返回）

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `npx tsc --noEmit` | PASS | PASS |
| `npx vitest run` | 23 passed | 23 passed |
| `npx vite build` | PASS | PASS |
| `pytest --tb=short -q` | 426 passed | 426 passed |

### P8-003C Vault Reindex（2026-08-28 ✅）

Markdown → SQLite 索引恢复机制。修复 Sync 写入后 FTS5/links/concepts 不更新的架构缺口。

**设计决策**（已裁定）：
- D1 独立模块 core/reindex.py（不放入 knowledge.py，职责分离）
- D2 Sync 后自动 reindex（Post-sync hook，但 SyncApply 冻结不变）
- D3 全量扫描 MVP，接口预留 changed_paths 增量模式
- D4 删除检测默认关闭（prune_missing=False），Admin 模式可开启
- D5 Post-sync hook 加注释标识，不膨胀 router

**新增文件**：
- `server/app/core/reindex.py`：reindex_vault 纯函数（~100行）
- `server/tests/unit/test_reindex.py`：13 项测试

**修改文件**：
- `server/app/routers/notes.py`：新增 admin_router + POST /api/v1/admin/reindex
- `server/app/routers/sync.py`：receive 后触发 reindex_vault
- `server/app/main.py`：注册 admin_router

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `npx tsc --noEmit` | PASS | PASS |
| `npx vitest run` | 23 passed | 23 passed |
| `npx vite build` | PASS | PASS |
| `pytest --tb=short -q` | 439 passed | 439 passed |

### P8-003B Mastery Decay（2026-08-28 ✅）

掌握度时间衰减：effective 不再是静态快照，而是当前时间函数。

**设计决策**（已裁定）：
- D1 last_seen 数据源：learning_events MAX(created_at)（不是 next_review）
- D2 DB 保留 effective 作为 baseline，API 新增 effective_now
- D3 Ebbinghaus 衰减函数，tau=14 天半衰期
- D4 review_today Python 侧排序（SQL 无法调用动态函数）
- D5 Tutor context 使用衰减后掌握度
- D6 Universe 视觉暂不改动（需要 Mastery vs Freshness 设计）

**新增文件**：
- `server/tests/unit/test_decay.py`：14 项测试（衰减函数 + get_effective_now + 时间真实性）

**修改文件**：
- `server/app/core/mastery.py`：+decay_effective +get_effective_now +_get_last_seen
- `server/app/routers/mastery.py`：review_today 重排 + _format_mastery +effective_now
- `server/app/core/tutor_context.py`：_get_mastery 使用 get_effective_now
- `shared/types/mastery.ts`：MasteryDetail + ReviewItem 增加 effective_now

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `npx tsc --noEmit` | PASS | PASS |
| `npx vitest run` | 23 passed | 23 passed |
| `npx vite build` | PASS | PASS |
| `pytest --tb=short -q` | 453 passed | 453 passed |

### P8-003D Eventlog Producer（2026-08-28 ✅）

ADR-020 闭合：update_mastery() 同事务追加 JSONL 写入，跨端同步真相源不再断链。

**设计决策**（已裁定）：
- D1 eventlog JSON 格式：event_id + concept_id + event_type + dimension + weight + source + detail + device_id + created_at
- D2 device_id 生成：环境变量 > 持久化文件 > hostname-uuid
- D3 同事务上下文：SQLite INSERT 后立即文件追加，OSError 不阻断
- D4 按月归档：metadata/eventlogs/<yyyy-mm>.jsonl
- D5 不加 migration（event_uuid 列后续再加）

**新增文件**：
- `server/tests/unit/test_eventlog.py`：8 项测试（device_id 3 + write_eventlog 2 + 集成 3）

**修改文件**：
- `server/app/core/mastery.py`：+_get_device_id +_write_eventlog +update_mastery 调用

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `npx tsc --noEmit` | PASS | PASS |
| `npx vitest run` | 23 passed | 23 passed |
| `npx vite build` | PASS | PASS |
| `pytest --tb=short -q` | 461 passed | 461 passed |

### 排序铁律（用户原话归纳）

1. 让 Universe 有东西看 → 2. 让节点关系有意义 → 3. 让首页像产品 →
4. 最后统一视觉语言。顺序反过来就是"漂亮的空壳"。

### P8-FE-001 Visual Language Polish（✅ 2026-08-30 解冻）

> **2026-08-30 项目所有者显式宣布「解冻前端任务」**，见 `PROJECT_STATE.md` §0。
> 配色与 Universe 方向按同日裁决更新（原「纸张感四色」方案**不采用**）。

Allowed：CSS · 组件结构调整 · 动画/间距/字体层级 · 颜色系统 · 空状态 · 页面转场
Forbidden：改数据库 / Core / API / 同步逻辑

**2026-08-30 裁决后的方向**（取代原表格）：

| 元素 | 方向 |
|---|---|
| 背景 / 表面 | `--bg-soft #F5F5F5` + `--surface #FFFFFF`——**沿用 `ui/tokens.css` v1** |
| 品牌色 | `--brand #FF6B35` 唯一暖色；概念状态**不引入四色**，由形状（Note 方 / Concept 圆）与 mastery 环承载 |
| 双链 | `--hl #FBF1CF` 底 + `--ink #35618F` 字，hover 加深底色、**不加下划线** |
| 字号 | 阅读正文 17px / 1.75；UI 文字 13–14px |
| Universe | 改为**星系**：主笔记=星球（点阵地球，`home-hero.html` 移植）· 副笔记=卫星；视觉守白空间线稿 |

⚠️ 原「ADR-013 配色过审」要求作废：本裁决沿用既有 `ui/tokens.css` v1，不引入新配色，
故无需 ADR 附录。

---

## 前端阶段任务（Phase 0–4 · 2026-08-30 解冻后重排）

> 范围：仅前端（`web/`），不动后端。组件分配与布局详见 `ui/UI_DESIGN.md`。
> 排序沿用既有铁律「先内容结构，后视觉语言」——故先令牌、后组件、再布局、最后动效。

### Phase 0 — 令牌归一 + 全局基线 ✅（2026-08-30）

- [x] 镜像 `ui/tokens.css` → `web/src/styles/tokens.css`（逐值复制；main.tsx 先于 global.css 导入）
- [x] 清除 `global.css` 裸值 54 处 → 令牌（#ff8a00→--brand · #888/#8a8a8a→--text-2 ·
      #b3564d/rgba(179,86,77,*)→--err/--err-soft · #e08c85→--err · rgba(91,157,217,.1)→--ink-soft ·
      color:#fff→--text-inv 等）
- [x] 旧令牌别名块（--bg-primary/--text-secondary/--brand-hover 等 → 新令牌，保留一版本后删）
- [x] 字体栈：body 已接 `var(--font)`（MiSans 本地安装即生效）；woff2 子集**已放弃**（裁定 C：MiSans 协议禁止子集化，维持现状降级苹方/雅黑）
- [x] 全局基线：`*:focus-visible` 品牌焦点环 · `prefers-reduced-motion` 全局动效归零块
      （`html lang="zh-CN"` 既有即满足）
- [x] 验收：`tsc --noEmit` PASS · `vitest` 23 passed · `vite build` PASS ·
      浏览器实检 笔记/仪表盘/ Tutor 三视图无视觉崩溃（新品牌橙 #FF6B35 全局生效）

**遗留**：① planet 暗色三值（#3a3f52/#23262e/#a8aab5）保留——P8-001C 视觉，Phase 3 星系重做时处置；
② rgba(0,0,0,*) 阴影未映射 --shadow-*（值不一一对应，避免视觉漂移，Phase 4 动效收口时统一）；
③ MiSans woff2 子集（见上）。

### Phase 1 — 基础组件层（`web/src/components/ui/`）✅ 完成（2026-08-30）

- [x] P1：Button · Input · Tag · Badge · Skeleton · Toast · Progress ✅（2026-08-30，
      见下方报告）
- [x] P2：Select · Modal · Tooltip · SegmentedControl · Tabs · Switch ✅（2026-08-30：
      Modal Esc/遮罩关闭实检通过 · Switch 切换实检通过 · 全令牌驱动，
      与 P1 同批提交）
- [x] P3：Textarea · Checkbox · Avatar ✅（2026-08-30：Checkbox 勾选/禁用态实检通过，
      Avatar 首字回退三尺寸实检通过，与 P2 同批验证）
- [x] 每个组件内置五态：variant / size / disabled / loading / error（相关态全覆盖）
- [x] 触摸目标 ≥44×44（md/lg），间距 ≥8px
- [x] dev-only gallery（`#gallery` + `import.meta.env.DEV` 双重门控）作为活文档

#### P1 组件完成报告（2026-08-30 ✅）

**新增**：`web/src/components/ui/`（primitives.tsx · Toast.tsx · index.ts）·
`web/src/dev/ComponentGallery.tsx` · `src/vite-env.d.ts`（补 vite/client 类型）·
global.css「P1 基础组件」区（约 170 行，全令牌驱动零裸值）。

**要点**：Toast 为 Provider+useToast 模式（App 根部挂载；未包裹时 useToast 返回空实现不崩溃）·
Progress 色调随值自动（≥0.7 ok / ≥0.4 brand / 其余 err，与 Dashboard barColor 一致）·
Tag 可移除 · Skeleton 三形态且 reduced-motion 下静止（依赖 Phase 0 归零块）。

**测试**：
| 命令 | 预期 | 实际 |
|---|---|---|
| `npx tsc --noEmit` | PASS | PASS |
| `npx vitest run` | 23 passed | 23 passed |
| `npx vite build` | PASS | PASS |
| `#gallery` 浏览器实检 | 组件五态可见无崩溃 | PASS（截图逐区核对） |
| Toast 交互实检 | 点击后弹出 | PASS（role=status 可见） |

**UI_DESIGN.md §7 对齐审查（2026-08-30，实检后修正）**：
Toast 右上角/4s ✓ · Input/Select/Textarea focus 橙描边+外发光 ✓ · Avatar 32/40/56 ✓ ·
Modal 遮罩 30% ✓ · 主按钮 hover 抬升+`--shadow-glow` ✓ · Skeleton 1.2s ✓。

**刻意偏差与延后**（对照 UI_DESIGN §7）：
- Select 用原生 `<select>` 而非自绘——键盘/无障碍基线优先，自绘下拉留 Phase 4 评估
- Segmented「滑块移动 250ms」与 Tabs「下划线从左展开」暂为切换态直切——动效属 Phase 4 收口
- Toast 时长 4s（spec）但堆叠上限未做（低频场景，Phase 4 一并处理）

### Phase 2 — AppShell 笔记优先三栏 ✅（2026-08-30）

- [x] `shell/AppShell.tsx`：移除 7 个平级 tab（App.tsx 重写，tabbar 删除）
- [x] 三栏栅格：列表 240 + 编辑器（NoteEditor 内聚）/ 上下文 320（右栏自取数据，经
      `ui.activeNoteId` 与编辑器解耦）
- [x] 响应式塌缩（container query）：≤1080 收右栏 → ≤780 收左栏列表 → ≤560 隐藏同步态
- [x] TopBar：品牌点 · 全局搜索（防抖 + 结果下拉 + 点击跳转）· 复习徽章（`/home`
      review_due，有才亮，实检「复习 1」点亮）· 同步状态（`/sync/status` 冲突数）
- [x] 右栏标签：大纲（Markdown 标题实时解析）/ 反链（backlinks API + 计数徽章）/
      关联（图谱/星系/导图/Tutor 入口）/ 掌握度（薄弱概念 + Progress）
- [x] 删除 `views/DashboardView.tsx`（裁决 A；SyncStatusPanel 随之退场，冲突数由 TopBar 呈现）
- [x] `stores/ui.ts`：ViewKey 删 `dashboard`；新增 `activeNoteId`；
      graph/universe/mindmap/tutor/review 为浮层态（顶栏「← 返回笔记」）

**实检**（vite proxy + 真实后端）：三栏 ✓ · 大纲随笔记实时解析 ✓ · 关联→图谱浮层 +
返回 ✓ · 复习徽章点亮 ✓ · 1000px 视口右栏按塌缩链隐藏 ✓

**测试**：`tsc` PASS · `vitest` 23 passed · `vite build` PASS

**遗留（Phase 3）**：~~编辑器工具栏仍含 全文搜索/知识雷达~~ 等三项已全部销账（2026-08-31
审计实检）：搜索→TopBar、雷达→右栏「雷达」标签、行宽 680 居中、保存态小字下沉元信息行。

### Phase 3 — 视图重做

| 顺序 | 视图 | 说明 |
|---|---|---|
| 1 | NoteEditor | ✅ 三栏重构；搜索/雷达移出工具栏（搜索→TopBar、雷达→右栏）；行宽 680；保存态下沉元信息行（2026-08-31 审计实检） |
| 2 | Review | ✅ 专注卡居中（640/留白96）+ 键盘 1/2/3 评分（键位角标）· Esc 退出（2026-08-30 实检） |
| 3 | Graph | ✅ 令牌已在 Phase 0 归一（裸值仅剩 var fallback）；工具栏触摸目标 ≥44px + checkbox accent（2026-08-30） |
| 4 | Tutor | ✅ 右栏抽屉（560px + 遮罩 + 返回笔记）；✅ **B2 SSE 流式已接**（2026-08-31）：`apiPostStream` 解析 `data:`/`event:done`/`event:error` 帧 → 增量渲染 + Stop 中止（AbortController，保留已到部分）；结束后全文定格（单状态源 streamText）；headless 实检：mock 8 帧流式→96 字全文保留→Ask 恢复 |
| 5 | 星系 | ✅ **多星球系统**（2026-08-31）：层级 = 从 wikilink 拓扑推断（方案 A）；出度≥2 为星球、与 hub 双向互链为卫星、互链排他归给严格更大者、被收编的 hub 降级；双形态（全屏巡览 4s·可暂停·可点选 / 右栏单颗静止·dpr=1）；公转 72s/圈；卫星上限 16 + 「…+N」；橙色只用于 mastery 弧与选中态；13 项语义单测全过；实检渲染：4 颗星球、Transformer 1 卫星（与真实图数据预演完全一致） |

### Phase 4 — 动效基元 + a11y + 性能收口 ✅ 完成（2026-08-31）

- [x] 动效基元：`FadeInUp` · `CountUp` · `Skeleton` · `Toast` · `ProgressRing` · `WaveLink`
      （来源 `ui/motion-primitives.html`）——Phase 1 已落地于 `components/motion/index.tsx`
      + `ui/primitives.tsx` + `ui/Toast.tsx`，本次核对与资产一致、CSS 类齐备
- [x] a11y：对比度 0 处不达标（4 视图实测）· 焦点可见（`*:focus-visible`）
      · 键盘可达（skip-link）· 语义 landmark（`header/main/aside` + 各视图 `h1`）
- [x] 性能：30fps 节流 · dpr≤1.5（dpr=3 屏实测钳到 1.50）· 离屏与隐藏暂停（实测静止）
      · **LCP 468ms ✅** · **CLS 0.0003 ✅**（修复前 0.0454）
- [x] 清理 `App.tsx` 的 `#preview` / `#planet` 原型入口（连带 import 一并移除）

**a11y 修色（按改色铁律四步走：tokens → UI_DESIGN → global.css → build）**

| 令牌 | 变更 | 白底比值 |
|---|---|---|
| `--text-3` | `#A3A3A3` → **`#737373`** | 2.52:1 → **4.74:1** |
| `--brand-text`（新增） | `#C2410C`，供品牌色作文字/白字底用 | **5.18:1** |
| `--brand` | 值不变，`#FF6B35`，**降级为仅图形/填充/描边** | 2.84:1（图形按 1.4.11 判 3:1，纯装饰可用；禁承载文本） |

配套：`--brand` 当小字用的 11 处（激活 tab、eyebrow、chip.brand、主按钮底色、
徽章、图谱 layer toggle …）改 `--brand-text`。
**修正文档笔误**：`ui/UI_DESIGN.md` §2.2 旧写品牌橙「3.6:1」，实测 **2.84:1**——已改写为实测表格。

**CLS 修复**：右栏 `GalaxyMini` 数据未到时 `return null`，到位后插入 272px
canvas → 把右栏下推 317px（CLS 0.0454）。改为始终渲染 + `.ctx-galaxy`
固定高度 `calc(272px + 44px)` + hint 单行省略 → CLS **0.0003**。

#### Phase 3 ⑤ 顺带修掉的旧账

- 契约 bug：`shared/types/graph.ts` 的 `refId` 字段全项目唯一 camelCase 违约
  （Python 契约权威产出 `ref_id`，pytest 已锁定）。导致 `GraphView` 与星系
  拿到 undefined——2026-08-31 全量改 `ref_id`（6 文件 22 处）。

### 前端阶段不做（待独立立项）

- **本地知识库 + RAG**：属后端 AI 层。建议先用已落地的 **FTS5 + CJK bigram**（B9）跑通关键词检索，
  embedding 等概念数 >2000 再补（依 `PROJECT_BRIEF` §6.2 触发条件）
- **联网搜索**：降级为「知识库找不到时的兜底」，非常规路径。模型设置页 UI 可随 Phase 3 做，
  但开关背后的能力待后端阶段

---

### ⚠️ 待决冲突：P8-003 Home vs 裁决 A（需项目所有者裁定）

> 【2026-09-02 收口标注】**本冲突已裁决**：所有者裁定 = 方案 B（见上方「当前处置」）——
> `HomeView.tsx` 及 home 视图接线已删除，默认视图回归 `notes`，`GET /home` 端点保留。
> 以下为裁定前快照，仅作决策依据存档。

**现状**（2026-08-30 已实现，未提交）：

| 文件 | 改动 |
|---|---|
| `web/src/views/HomeView.tsx` | 新建 65 行，三个 `dash-section` 区块（今日待复习 / 最近笔记 / 掌握度薄弱） |
| `web/src/stores/ui.ts` | `ViewKey` 加 `"home"`；默认视图 `notes` → `home`；`openNote` 改为跳 `home` |
| `web/src/App.tsx` | 新增 `case "home"`；`TABS` 首位加「首页」（现共 **8 个 tab**） |
| `server/app/core/home.py` + `routers/home.py` + `shared/types/home.ts` | 新增 `/api/v1/home` 聚合端点（D1） |

**冲突点**：Home 是按 **2026-08-27 路线决议**（「Dashboard 升级为 Learning OS Home」）实现的；
而 **2026-08-30 裁决 A** 改为「笔记优先 · 取消平级 tab · 打开即笔记工作区 · 删除仪表盘」。
两者互斥——一个要「首页作默认入口」，一个要「笔记工作区作默认入口」。

**三个选项**：

| 选项 | 含义 | 代价 |
|---|---|---|
| A. 保留 Home，修订裁决 | 首页作默认入口；裁决 A 的「笔记优先」降级 | 与 `ui/README.md`、`ui/UI_DESIGN.md` §8 的冲突持续存在 |
| B. 按裁决 A 改造 Home | Home 降为笔记工作区的一部分（复习徽章 + 右栏），不占独立 tab | P8-003 的前端部分需改造 |
| C. 保留但降为次级入口 | 默认视图改回 `notes`；Home 保留为 tab 但不默认 | 折中，但仍有 8 个 tab，违反「取消平级 tab」 |

**当前处置**：✅ **已裁定 = 方案 B**（2026-08-30 项目所有者选定）——按裁决 A 改造：
Home 取消独立 tab、不作默认视图；其三段聚合数据（待复习/最近笔记/薄弱概念）并入
笔记工作区的 TopBar 复习徽章与右栏（Phase 2/3 落地）。**已执行**：`HomeView.tsx` 删除、
`ui.ts`/`App.tsx`/`ui.test.ts` 的 home 接线回退（默认视图回归 notes，tab 恢复 7 个）；
`/api/v1/home` 端点 + `shared/types/home.ts` 契约**保留**（Phase 2 右栏复用）。
Phase 2 解除暂缓。

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
   → **2026-08-31 裁定**：ADR-022 的 UI 载体由 Dashboard 迁移至
   TopBar / Workspace-level mode switch（附录 A，语义不变）。
   实施单独立项 `P8-Mode-001`（附录 A §实施边界，触发 = 所有者显式发起），
   本候选仅保留条目不排期。
2. ~~Dashboard 升级为 Learning OS Home（Today / Review / Weak Areas / Recent / Universe 预览）~~
   **已作废（2026-08-30 裁决 A）**——取消平级 tab、删除仪表盘，打开应用即笔记工作区。
   Home 的聚合数据（待复习/最近笔记/薄弱概念）已改由 TopBar 复习徽章与右栏承载；
   `/api/v1/home` 端点保留作右栏数据源（方案 B）。见上方「待决冲突：P8-003 Home vs 裁决 A」。
3. Tutor 三入口闭环（Note→Explain · Review 错答→Hint · Universe 弱项→Tutor）
   → **当前任务（P8-006）**。2026-08-31 调研结论：纯 Frontend 即可闭环
   （后端 `/chat` 已支持 concept_id/note_ids/mode 含 hint；`/tutor/context`、
   `/mastery/weak/list` 均已存在）。方案：`tutorSeed`（一次性预填包，
   预填 ≠ 自动发送）+ `tutorReturnView`（从 Review 进入后返回 Review 而非 Notes）。
   入口现状：① 右栏「关联」AI Tutor 按钮不带笔记上下文（半成品）；
   ② Review feedback 阶段无 Tutor 入口（缺失，仅 quality≤2 显示）；
   ③ Graph 概念「问 Tutor」已通（P8-003D），右栏掌握度弱项行缺入口。

### P8 收尾阶段（2026-08-31 政策切换）

> Phase 0–4 收口后进入收尾阶段。政策：**解除前后端修改范围限制，
> 端到端闭环 + 契约一致性为最高优先级**——详见 `PROJECT_STATE.md` §0.1 与
> `AGENTS.md` §12「端到端闭环协议」。跨层修改仍需真实原因，禁止借任务扩权。

| 序 | 任务 | 状态 |
|---|---|---|
| P8-006 | **Tutor 三入口闭环**（tutorSeed + tutorReturnView；入口①笔记②错答 hint③弱项） | **✅ 完成（2026-08-31）** |
| P8-007 | Tutor 三入口 E2E 验证（三路径各 ≥1 条自动化测试） | ✅ store 6 项单测 + headless 三路径实测（见完成报告） |
| 挂起 | P8-Mode-001 Knowledge/Learning Mode（ADR-022 附录 A，等所有者发起） | 挂起区 |

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

## M3.5-A 任务拆解（Knowledge Radar MVP · 2026-08-31 核实回填）

> 注：里程碑表早已标 `[x]`，但此清单未勾——2026-08-31 逐项核实后回填真实状态。

- [x] ADR-012 落盘（Context-Aware Knowledge Assistance Architecture）
- [x] Core: `suggest_for_context()` 函数（FTS匹配 + concept LIKE + graph邻居 + memory占位）
- [x] Router: `GET /api/v1/knowledge/suggest` 路由 + 参数校验
- [x] Types: `shared/types/suggest.ts` 契约类型
- [x] Frontend: `KnowledgeRadar.tsx` 组件（debounce + 三区域渲染 + 点击跳转）
- [x] Frontend: NoteEditor 集成（~~showRadar状态 + Ctrl+Shift+K + 段落提取~~）
      **已关闭（2026-08-31 裁定）**——雷达挂右栏「雷达」标签可用，查询词 = 笔记标题
      （大纲首项兜底）；「编辑器内选中触发」属增强，维持挂起区待用户显式发起（见下）。
- [x] Frontend: CSS 样式
- [x] Tests: `test_suggest.py`（空库/匹配/邻居/参数校验，7 项）
- [x] Docs: TECH_DESIGN §9/§10 + TASKS + CHANGELOG + REGISTRY + data-model INDEX
- [x] 验收：pytest全绿 + vitest通过 + build成功

## M3.5-B 任务拆解（Full Omniscience · ✅ 2026-08-31 完成）

- [x] Core: `_resolve_concept_for_memory()`——查询词定位唯一 concept
      （matches 命中 concept 优先 → 精确标题 → LIKE 唯一命中；多候选不猜，返回 None）
- [x] Core: `_memory_for_concept()`——mastery(`concept_mastery.effective`) +
      review_due(`review_queue` status=pending) + last_mistake(`mistakes.description` 最近一条)
- [x] Core: `suggest_for_context()` memory 三字段接真实数据（原占位全 null）
- [x] Tests: `test_suggest_memory.py` 6 项（真实数据/事件反映/到期/无concept全null/错题/latest-wins）
- [x] Frontend: `KnowledgeRadar` 学习状态区真实渲染
      （掌握度=橙条+百分比 · 复习=到期日/「今日到期」强调 · 错题=单行省略+title 悬浮；
      全 null 时整区不渲染，不占版面）
- [x] Frontend: 雷达查询词升级 = 笔记标题优先（原大纲首项在无标题笔记下恒为空）
- [x] 验收：pytest 13（7+6）+ vitest 22 + build 全绿；
      实检：真实库造数据后 API 返回 `{mastery:0.04, review_due:pending, last_mistake}`，
      无头浏览器截图确认三行渲染正确、「今日到期」橙色强调生效

> **已知边界**：M3 之前建库的旧 concept 无学习状态行（惰性初始化只在新 concept
> 触达时发生），这些 concept 的 memory 返回全 null——**是正确行为**，不是 bug。
> 旧数据回填如需要属独立小任务（遍历 concepts 调 `ensure_concept_learning_state`）。

## M9 Visual Engine 任务拆解

> **ADR-025 v3（2026-09-01 按二轮终审修正；v2 六项偏离已全部获确认）· 登记 HEAD `3db327a`**
>
> 契约、安全模型、范围边界以 `docs/adr/ADR-025-visual-engine-v1.md` 为**唯一来源**。
> 本节只维护**进度**与**任务清单**；守护测试清单见 ADR-025 §8，不在此重复（避免双份维护漂移）。
>
> **V1 定位**：受控的 Python 教学示例执行可视化器，**不是通用代码可视化器**。
> 只执行 `core/tracer/examples/` 清单内的 6 个示例；**用户任意代码不执行**。
> 复杂数据结构（力扣 / 链表 / 树 / DP / 图）归 M9.5 ALGOGEN / VTA。

### 交付物核查（2026-09-01 实查；开工时全 ❌，随任务推进回填）

| 交付物 | 应有位置 | 实际 |
|---|---|---|
| tracer 包 | `server/app/core/tracer/{__init__,runner,snapshot,limits}.py` | ✅ M9-003 |
| 示例库 | `server/app/core/tracer/examples/`（+ `manifest.py`） | ✅ 6 示例 + manifest（M9-003） |
| 路由 | `server/app/routers/trace.py` | ✅ M9-004（+ 只读 examples 端点） |
| 契约 | `shared/types/trace.ts` | ✅ M9-002 |
| 前端 | **`ui/visual-engine/`**（6 tsx + 3 纯逻辑模块 + CSS）。**仅 ui 库，未合并 `web/`**；旧稿归档 `ui/archive/visual-engine-tsx-2026-09-01/` | ✅ M9-005/006 |
| 数据表 | migration 010+ | 止于 `009_event_id_rename.sql`（V1 不建表） |
| API | `POST /api/v1/trace/run` | ✅ M9-004 |

**已就位**：`core/mastery.py:134/194/391` 已支持 `visualize → practice +0.05 × weight`——
掌握度侧零改动，M9 只补事件生产者。
**门槛已解除**：`TECH_DESIGN` §10「后端 backlog 清零前 M9 不启动」——本文件第 26 行已标清零，M6 已完成。

### 子任务（8 项）

| # | 任务 | 产出 | 前置 | 状态 |
|---|---|---|---|---|
| **M9-001** | ADR-025 v3 批准 + 文档同步（TECH_DESIGN §8 / AGENTS §10 / ADR_INDEX / 本节） | 4 处文档 | — | `[x]` 已批准（v3 含二轮终审 5 项修正；2026-09-02 收口统一——M9 已实际推进至 006 且所有者裁定继续 007，批准事实成立） |
| **M9-002** | `shared/types/trace.ts`（`TraceRun` / `TraceEvent` / `TraceValue`）+ 契约测试 | 契约与守护测试 | M9-001 | `[x]` 2026-09-01（含 runner 真实输出往返校验 6 项） |
| **M9-003** | tracer PoC **四步**（见下） | `runner` / `snapshot` / `limits` | M9-002 | `[x]` 2026-09-01（PoC 四步全绿；独立审核修复：tempfile 对齐 §5.5、per-event stdout 对齐 §4.2、删 `_exec_in_process` 死代码、§5.4 六项 builtins 全移除、序列化集中 snapshot.py） |
| **M9-004** | `POST /api/v1/trace/run` + API 测试（含 `mode:"vta"` → 400） | 路由 | M9-003 | `[x]` 2026-09-01（15 项测试：400/404/422/429 映射、同步 def 守护、信号量 429/归还、非 completed → 200 桩锁定；`code` 字段 422 需 handler 内手工校验——全局 RequestValidationError handler 会把 422 转 400） |
| **M9-005** | `CodePane` + `DebugToolbar` + `stepping` 状态模型（**入 ui 组件库**；2026-09-01 裁定否决播放器，改 IDE 步进，见 ADR-025 §3.2） | IDE 步进壳，无 Renderer | M9-002 | `[x]` 2026-09-01（纯逻辑 68 项测试全绿；组件**仅入 ui 库不合并 `web/`**，接入视图归 M9-007） |
| **M9-006** | `FrameStackView` / `ArrayView` / `GeneralView` | 三 Renderer（`derive.ts` 纯函数驱动） | M9-005 | `[x]` 2026-09-01（真实 trace 夹具测试全绿；样式以 `ui/visual-engine.html` 定稿，组件 CSS 为其等值转写） |
| **M9-007** | 示例清单 6 条 + Concept 页入口 + `visualize` 事件 **+ 把 `ui/visual-engine/` 回灌到 `web/src/components/ui/` 并在 `index.ts` 解冻导出** | 端到端闭环 | M9-004 + M9-006 | `[x]` 2026-09-02（见 [T-M9-007/008](#t-m9-007008-visual-engine-接入与验收完成2026-09-02)） |
| **M9-008** | M9 全量验收（11 条） | 验收报告 | M9-007 | `[x]` 2026-09-02（见 [T-M9-007/008](#t-m9-007008-visual-engine-接入与验收完成2026-09-02)） |

#### M9-003 PoC 四步（不得跳步）

| 步 | 用例 | 验证点 |
|---|---|---|
| **PoC-1** | `factorial` | `call` / `line` / 递归 frames / `return` |
| **PoC-2** | `quicksort` | 数组变更、行高亮、ArrayView 数据完整性 |
| **PoC-3** | `while True: pass` | watchdog 生效、`process.kill()`、`status == "timeout"`、无僵尸进程 |
| **PoC-4** | 大量 `print` | tempfile 输出、`output_limit`、不阻塞 |

目标**不是「做通用 tracer」**，而是证明：settrace + 递归 frame + 安全快照 +
`process.kill` + stdout tempfile + TraceRun 序列化，六件事全部成立。**四步全绿才进 M9-004。**

### 排位

当前活跃任务为 **T-NOTE-HIER**（ADR-024），其 P1（稳定 note ID · 左侧嵌套树 UI）未完成；
M8 Mobile 同为 `[ ]`。**M9 尚未进执行队列**——需项目所有者在 T-NOTE-HIER P1 与 M9 之间排序。

### 待拍板项（阻塞 M9-001 批准）

**A. 对终审意见的六处偏离**（详见 ADR-025 §11）——**已裁决：二轮终审（2026-09-01）逐条确认全部成立，无需推翻**。下表保留为裁定记录：

| # | 偏离 | 关键度 | 裁决 |
|---|---|---|---|
| 1 | 请求体**不开放 `code` 字段**（终审 §17 给了 `{code}`，与 §2「不执行用户任意代码」冲突） | 🔴 高 | ✅ 确认（「禁止字段」，收到即 422） |
| 2 | `status` 枚举补为 5 值（终审 §11 的 `output_limit` 未在 §6 枚举内） | 🟢 低 | ✅ 确认 |
| 3 | 取消 `TraceEvent.heap` 字段，值内联在 `locals` | 🟡 中 | ✅ 确认（🟢/🟡） |
| 4 | V1 **不建** `trace_cache` 表（终审自述「可选」；原则即刻生效） | 🟡 中 | ✅ 确认（TraceRun 只存在于 HTTP response + 前端内存） |
| 5 | tempfile 结论采纳，**理由修正**（不是 PIPE 死锁，是内存无界） | 🟢 低 | ✅ 确认 |
| 6 | **不建** `TraceProvider` 抽象基类，改由契约约束兑现 Provider 中立 | 🟡 中 | ✅ 确认（第二个真实实现出现时再评估抽象边界） |

**A2. 二轮终审 5 项冻结前修正**（P0×3 + P1×2，均已落入 ADR-025 v3，见其 §11.2）：

| # | 修正 | 落点（ADR-025 v3） |
|---|---|---|
| 1 | `example_id` 取代 `code`；`code` = 禁止字段 → 422 | §4.5 |
| 2 | Trusted Example Registry：枚举键非路径（防穿透）、title→example 唯一、>1 匹配禁止猜测 | §3.3 |
| 3 | `MAX_CONCURRENT_TRACES = 1`，超出 → 429 `trace_busy` | §5.7 + 守护测试 16 |
| 4 | cleanup 生命周期（Timer / 句柄 / 回收 / tempfile，`finally` 全覆盖） | §5.7 + 守护测试 18 |
| 5 | 清除 heap / `$ref` / Event.metadata.template / {code} 残留；统一「TraceRun 运行时派生数据，V1 不持久化」措辞；验收分三层 | §2.3 · §4 · §6.2 · §8 |

**B. 其他**

| # | 事项 | 建议 |
|---|---|---|
| 1 | **信任模型**：接受「执行随代码发布的受信任示例」？无 Docker 隔离（Phase 5 才有） | 接受；风险已写入 ADR §10 |
| 2 | **打包态（`sys.frozen`）子进程解释器** | M6 未打包后端（无 sidecar / 无 PyInstaller spec），V1 不处理；**后端一旦打包须回补** |
| 3 | **Markdown VisualizationSpec 载体** | HTML 注释**已排除**（`TiptapEditor.tsx:27` 配 `html:false`，注释载入即丢、保存即删）。V1 不引入声明，Concept 页按 title 匹配；载体标为 M9.5 待定 |

## 挂起区（有明确触发条件，未排期）

| 计划 | 触发条件 | 文档 |
|---|---|---|
| UpMark 联动 U1 错题登记流入 → U2 双向出题 → U3 题库导入 | 用户显式发起；前置 M3/M4(/M5) 完成 | docs/adr/integration-upmark.md |
| Radar 编辑器内触发（选中正文 → Ctrl+Shift+K → 段落提取为查询词） | 用户显式要求；M3.5-A 原计划的增强项，雷达现已挂右栏可用 | ADR-012 §5 Phase A |
| **P8-Mode-001** Knowledge/Learning Mode 实现（workspace_mode + TopBar Mode UI + Reminder） | 项目所有者显式立项；语义与载体已由 ADR-022 附录 A 冻结 | docs/adr/ADR-022-product-mode-boundary.md Appendix A |
| 修 `REGISTRY.md` 引用漂移（`AGENTS.md:213` / `:532` / `ADR_INDEX.md` 快速查阅） | 项目所有者发起；**登记来源** ADR-025 §7 第 3 项 | 该文件已并入 `docs/DEPENDENCIES.md`，仓库根无此文件 |

## 完成报告

### P8-006 Tutor 三入口闭环 完成（2026-08-31）
- **做了什么**：store 新增 `tutorSeed`（一次性预填包：conceptId/noteIds/mode/query，
  消费即清除；**预填 ≠ 自动发送**，守 ADR-022「你问，我答」）与 `tutorReturnView`
  （进入 Tutor 前的视图快照）+ `openTutor(seed)` 统一入口（`openTutorForConcept`
  改薄包装，P8-003D 调用方零改动）+ `closeTutor()`（回来源视图）。
  三入口：① 右栏「关联」AI Tutor 携带当前笔记（`noteIds=[activeNote]` + explain，
  按钮标注「引用「标题」」）；② Review feedback **仅 quality≤2** 显示「向 Tutor 求提示」
  （seed 带 concept_id + hint）；③ 右栏掌握度弱项行「问 Tutor」（seed 带 concept_id）。
  App.tsx tutor 态底层按 tutorReturnView 渲染——从 Review 进入后遮罩关闭**真回 Review**
  （修真实状态流缺陷：原先一律 setActiveView("notes")）。
  TutorPanel 挂载时消费 seed：预选 mode / 预填 concept / 直接设置笔记引用
  （context 随之带 note_ids 重载）/ query 置输入框——**不自动提交**。
- **改动文件**：`web/src/stores/ui.ts`（+tutorSeed/tutorReturnView/openTutor/closeTutor/
  consumeTutorSeed）· `web/src/stores/ui.test.ts`（+6 项语义单测）·
  `web/src/components/tutor/TutorPanel.tsx`（消费 seed；TutorNoteRef.excerpt 改可选——
  该字段从未被渲染，纯类型冗余）· `web/src/components/shell/ContextRail.tsx`（入口①③）·
  `web/src/views/ReviewSessionView.tsx`（入口②）· `web/src/App.tsx`（underlying 视图 +
  closeTutor）· `web/src/global.css`（+2 按钮：文字式/描边/`--brand-text` 5.18:1/250ms，合规 ADR-013）
- **端到端验证**（headless Chrome 实测真实数据流，截图核对）：
  - 路径① 打开 Transformer → 关联 → AI Tutor：抽屉开、**Explain 预选、
    笔记引用 chip「Transformer」出现、输入框为空**（预填≠自动提问）→ 用户输入提交成功
  - 路径② 复习「学习率」按 1（答错）→ feedback 出现「向 Tutor 求提示（学习率）」
    → 点击后抽屉 **Hint 预选 + Concept「学习率」** → 关闭遮罩 → **回到 Review**
    （非 notes——tutorReturnView 生效）
  - 路径③ 右栏掌握度弱项「梯度下降」→ 问 Tutor → 抽屉开、Concept=梯度下降、
    context 面板完整（四维掌握度 + 最近错题「复习答错（quality=1）」）
- **测试**：

  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `npx vitest run` | 全绿（22→28） | 28 passed ✓ |
  | `npx tsc --noEmit` | PASS | PASS ✓ |
  | `npx vite build --outDir dist_verify5` | PASS | PASS ✓ |
  | `pytest tests/api/`（回归，零后端改动确认） | 全绿 | passed（见 CI 记录）✓ |

- **架构自检**：ADR 违反=否（tutorSeed 语义经 ADR-022 校验）· API 一致=是（零后端改动，
  纯消费既有契约）· Shared Types 同步=是（无变化）· DB 变化=否 · 新依赖=否 ·
  跨层修改=否（审计后确认纯前端足够；excerpt 可选化为既有类型冗余修正，非契约变更）

### P8-007 Tutor SSE 流式前端接线 + UI 审计销账 完成（2026-08-31）
- **做了什么**：① `lib/api.ts` 新增 `apiPostStream<TFrame>`（唯一后端访问入口内的 SSE 通道：
  POST + `text/event-stream`，按空行分帧解析 `data:`/`event:done`/`event:error`，
  帧形状对齐 `shared/types/tutor.ts TutorStreamFrame`；HTTP 层错误仍走统一 ApiError，
  AbortController 中止原样上抛）；② `TutorPanel.handleSubmit` 切 `stream=true` 流式：
  增量渲染 `streamText`、`event:done` → conversation_id 续链 + extractor 刷新、
  Stop 按钮（loading 态切换）经 AbortController 中止、**中止保留已到部分**；
  ③ 修复接线过程中的双状态源缺陷：初版「streamText 定稿后置 null + answer 存空串」
  导致流结束后答案区渲染空白、中止即丢全部已到文字——改为**单状态源**
  （streamText 非 null 即答案：流式中增量/结束后定格/中止保留），headless 实检确认修复；
  ④ UI 审计销账：删除死代码 `views/placeholders.tsx`（4 占位视图零引用，52 行）；
  ⑤ 文档回填：TASKS Phase 3 NoteEditor/Tutor 销账、B2-A 遗留①销账、
  M3.5 NoteEditor 集成项关闭、PROJECT_STATE §10/§2.4 状态更新、UI_DESIGN 评分键位校正。
- **改动文件**：`web/src/lib/api.ts`（+apiPostStream）·
  `web/src/components/tutor/TutorPanel.tsx`（流式 + 单状态源修复）·
  `web/src/views/placeholders.tsx`（删除）· `docs/TASKS.md` · `docs/PROJECT_STATE.md` ·
  `ui/UI_DESIGN.md`（评分键位 1–4→1/2/3 实况校正）
- **端到端验证**（真实后端 + vite proxy + headless Chrome，`--no-proxy-server` 排除环境代理）：
  - 契约帧验证：curl 直连 + 穿 proxy 双通，`data:{"text":...}` 帧与 TutorStreamFrame 一致
    （qwen3-14b 实测逐块下发；qwen3 思考型首帧前上游缓冲 ~88s 属 B10 已知行为，非缺陷）
  - UI 流式实检（MockProvider 确定性 8 帧）：完整路径（选笔记→关联→AI Tutor→提问）→
    **流结束后 answer 区 96 字全文保留**（修复前恒为 0）、无错误条、Ask 按钮恢复
  - 停止语义：后端 `try/finally` 保证中止时增量落库（B2-A 已锁），前端保留已到部分
- **测试**：

  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `npx tsc --noEmit` | PASS | PASS ✓ |
  | `npx vitest run` | 全绿（28） | 28 passed ✓ |
  | `pytest tests/unit/test_conversations.py tests/unit/test_llm_provider.py tests/unit/test_openai_provider.py -q` | 全绿 | 77 passed ✓ |
  | headless E2E（流式→定稿→Ask 恢复） | PASS | PASS ✓（`final.len=96, err=null`） |

- **架构自检**：ADR 违反=否（逐字显示非打字机动画，无气泡，ADR-016 §3 允许 streaming）·
  API 一致=是（消费既有 B2 契约，零后端改动）· Shared Types 同步=是（TutorStreamFrame
  原样消费）· DB 变化=否 · 新依赖=否 · 跨层修改=否（纯 Frontend 接线，AGENTS §12 场景 E）

### T-B2A B2-A 流式输出（SSE）后端骨架 完成（2026-08-30）
- **做了什么**：`LLMProvider` 协议增 `stream()`（`"".join(stream)==complete` 契约）；
  `MockProvider.stream()` 确定性字符分块（不 sleep）；`OpenAICompatProvider.stream()` 非流式回退
  （真 SSE 解析留 B2-B）；`TutorService.ask_stream()`（生成器，无 DB/无直连网络）；
  `POST /api/v1/chat` 请求体增 `stream: bool`（默认 false，向后兼容），`stream=true` 返回
  `text/event-stream`；SSE 帧契约 `data:{text}` ×N → `event:done{conversation_id}` /
  `event:error{code,message}`；assistant 落库 + B3 extractor 置于 `try/finally`（客户端断开不丢消息）。
  非流式路径共用 `_apply_turn_extractor`。
- **改动文件**：`server/app/core/ai/providers/{base,mock,openai_compat}.py` ·
  `server/app/core/ai/service.py` · `server/app/routers/conversations.py` ·
  `shared/types/tutor.ts` · `docs/adr/ADR-003-llm.md`（附录 §A）· 测试 3 文件
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest tests/unit/test_conversations.py tests/unit/test_llm_provider.py tests/unit/test_openai_provider.py -q` | 56 passed | 56 passed ✓ |
  | `pytest -q` | 全绿（627→651） | 651 passed ✓（56.04s） |
  | `npx tsc --noEmit` | PASS | PASS ✓ |
  | `npx vitest run` | 23 passed | 23 passed ✓ |
  | `npx vite build --outDir dist-verify` | PASS | PASS ✓ |
- **结果与遗留**：B2-A 完成，AI 闭环流式骨架就位。遗留：① ~~前端零接线~~ **已销账**
  （2026-08-31：TutorPanel 切 `apiPostStream` 流式，headless 实检通过，见 P8-007 报告）；
  ② `openai_compat` 真 SSE 解析（B2-B，✅ 已随 T-BBC 完成）；③ 路由 `response_model=None`
  规避 `dict|StreamingResponse` 契约冲突（同 T-M0 已知项）。
- 下一项：**B2-B OpenAICompatProvider 真 SSE 解析**（已完成）。

### T-BBC 后端闭环批（B12/B2-B/B13/B17/B18/B21/B22/B24）完成（2026-08-30）
- **做了什么**：逐项闭合 backend backlog——错题本 API、真实 SSE、复习统计、增量 reindex、
  大纲反解析、三项技术债。全部带守护测试，逐项 commit 到 main。
- **改动文件**：`server/app/core/{mistakes,review_stats,timeutil,reindex,mindmap,sync/device,ai/providers/openai_compat}.py` ·
  `server/app/routers/{mistakes,mastery,notes,mindmap}.py` · `shared/types/mastery.ts` ·
  `server/tests/{api/{test_mistakes,test_mastery,test_mindmap}.py, unit/{test_openai_provider,test_reindex,test_discovery}.py}` ·
  `docs/PROJECT_STATE.md` · `docs/ai/{CURRENT_STATE,ACTIVE_TASK}.md`
- **测试了什么**：
  | 命令 | 预期 | 实际 |
  |---|---|---|
  | `pytest -q` | 全绿 | **681 passed**（651→681，+30） |
  | `npx tsc --noEmit` | PASS | PASS |
  | `npx vitest run` | 23 passed | 23 passed |
  | `npx vite build --outDir dist-verify` | PASS | PASS |
- **结果与遗留**：B12/B2-B/B13/B17/B18/B21/B22/B24 闭环。遗留：B14/B15/B16/B19/B20/B23/B25/B26 未做；
  B1b（真实凭据冒烟）/B9（中文 FTS）/B10（Ollama 实测）需外部依赖。B4/B5/B6（AI 自动链路）为下一优先。

### T-DOC-001 多端架构修订 + UpMark 联动挂起（2026-08-26）
- **做了什么**：产品定位升级为 Local-first 多端（Tauri 桌面 + RN Android + LAN Sync）；
  新增 ADR-005/006 与 integration-upmark.md；TECH_DESIGN §1/§2/§4.2/§5.4/§9/§10 更新；
  里程碑重排 M7=同步、M8=移动、M9/M10=可视化；AGENTS 冻结表/红线/优先级同步；
  REGISTRY 规划依赖补 RN 系；TASKS 重排并建挂起区
- **改动文件**：docs/adr/(ADR-005·006·integration-upmark) · TECH_DESIGN · AGENTS ·
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
- **做了什么**：新增 AGENTS.md §17（版本基线/目录归属法/sandbox 规则/收尾四件事/
  [ENVIRONMENT CHANGE REQUEST] 协议/环境变量表）；.gitignore 补 sandbox/ 与 server/.cache/；
  AGENTS §7.1 ECR 协议、§11 收尾扩为四件事；network-boundary 同步两区边界说明
- **改动文件**：AGENTS.md §17(新) · .gitignore · AGENTS · network-boundary · 本文件 · CHANGELOG
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
  - `docs/DATA_MODEL.md`（新增）——学习状态数据模型契约（truth hierarchy + event_uuid + source 枚举 + 时间计算规则 + SM-2 可替换声明）
  - `server/app/core/mastery.py`——新增 ensure_concept_learning_state()
  - `server/app/core/knowledge.py`——ensure_entity_by_title() 调用初始化
  - `server/app/routers/mastery.py`——review_today 优先级排序 + 错答提升 + review/history 端点
  - `server/migrations/004_learning.sql`——ON DELETE CASCADE 修复
  - `web/src/views/DashboardView.tsx`——学习时间线视图
  - `web/src/global.css`——timeline 样式
  - `docs/ai/CURRENT_STATE.md`——M5 路线确认 + Frozen Domains
  - `docs/ai/ACTIVE_TASK.md`——M5 子任务范围
  - `docs/DATA_MODEL.md`——learning-model 条目
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
  - `docs/adr/ADR-021-mindmap-exchange-format.md`——格式冻结（version/type/map）
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

---

## T-NOTE-HIER 主/副笔记层级（ADR-024 · 2026-09-01 登记）

### 背景与裁决来源

用户提出「主笔记 / 副笔记」需求并明确「左边也要出现」。核查确认当前**无任何主/副
关系字段**，星系的星球/卫星是从 wikilink 拓扑**推断**的假层级。经 GPT-5.5 Pro
评审（存档 `Open Learning OS — 主副笔记层级决策征询（GPT）.md` §七）后裁决，
落地为 **ADR-024**。

**核心裁决**：child-side 单父 `parent`，事实源在 Markdown frontmatter。
格式 `parent: "[[父笔记标题]]"`。零新表零 migration。

### 五条铁规则（ADR-024 §2.2）

1. 事实源在 Markdown，不在 SQLite
2. 只在 child 写 `parent`，不持久化 `children`
3. 严格单父（forest）；底层允许多级链，第一版 UI 只展示一层
4. 显式 parent 为权威，wikilink 推断降为 legacy fallback
5. `/graph`、`/universe`、review 统一经 `resolve_hierarchy()`，禁止各自推断

### 执行计划（P0 最小闭环）

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0-1 | frontmatter round-trip：`parse_frontmatter ↕ compose_file` 保任意 key、真删除、稳定顺序 | `[x]` 完成（`compose_file(meta, body)` + `read_note_meta`） |
| P0-2 | 显式 `parent` 读写 + 校验（orphan / 自指 / cycle） | `[x]` 完成（`parse_parent`/`set_meta_parent` + `NotePatch.parent`） |
| P0-3 | 统一 `resolve_hierarchy()`（explicit > inferred） | `[x]` 完成（`server/app/core/hierarchy.py`） |
| P0-4 | `/graph`、`/universe` 统一消费 resolver | `[x]` 完成（`_merge_parent_edges` + reindex 物化 + web `derivePlanets` 显式优先） |
| P0-5 | round-trip / rebuild 守护测试 12 项（**P0 验收标准**） | `[x]` 完成（`tests/unit/test_hierarchy.py` 12 项 + `derivePlanets.test.ts` 2 项） |

**不在 P0**：左侧嵌套树 UI · 稳定 note ID（独立 ADR）· 星系视觉改造。

#### P0 完成报告（2026-09-01 · commit `08dff52`）

落地要点：

- **P0-1 修掉地基缺陷**：`compose_file` 原只回写 `tags`，其余 frontmatter key
  保存时静默丢弃（每加一个字段就会再踩一次）。改为 `compose_file(meta, body)`：
  保任意 key · 真删除（调用方 `pop`）· 稳定顺序 · 无 key 不写 `---` 块。
- **P0-2 红线 4**：自指与 orphan **不以 4xx 阻断保存**——保留用户原值，由 resolver
  标记 `invalid` 并拒绝建立关系。原实现缺 `NotePatch.parent` 字段（崩点）一并修掉。
- **P0-3**：`hierarchy.py` 新增 `resolve_hierarchy()`（唯一 resolver）·
  `sync_note_parent`（单篇镜像）· `materialize_parent_links`（reindex 全量物化）。
  wikilink 推断仅对**完全没声明过** parent 的旧笔记生效，避免结果摇摆。
- **顺带修掉真 bug**：`_detect_cycles` 首版对任何成环**无限循环**（缺「当前路径
  回头」检测），由 P0-5 守护测试逼出。

**验证**：pytest **848 passed**（全量，含新增 12 项）· tsc PASS · vitest **30 passed**
· vite build PASS · CI 双绿。真实 vault 端到端实测：显式 `Adam优化器→机器学习`
压过正文 `[[梯度下降]]` 推断；orphan 保留值且不建关系；改正文 parent 存活；
`parent=""` 真删除。

**同期修复（非本任务，独立 commit `b4c0a9f`）**：`tests/unit/test_eventlog.py`
硬编码读 `2026-08.jsonl`，跨月进入 2026-09 后 6 项静默失败。已改为默认取
`now_iso()[:7]`（复用 B21 单一时间源）。经 `git stash` 回干净 HEAD 复跑确认
为**测试过时**，非本次回归。

#### P1-1 完成报告（2026-09-01 · 已提交：`469d667` web P1 / `eb049ee` server P1 / `6da2b3f` 报告）

落地要点：

- **契约 TS**：`NoteSummary.parent_id: number | null`（ADR-024 红线 2/5）+
  `NoteCreateBody.parent?: string | null`（创建时一步指定父笔记）
- **后端 4 端点**：`_parent_map(conn)` → `resolve_hierarchy()`；list/get/patch/create
  全部返回 `parent_id`；`NoteCreate.parent` → `_create_note_vault` 写 frontmatter +
  `sync_note_parent` 镜像派生边
- **前端层级树**：`buildNoteTree`（纯函数，orphan 兜底 + 深度防御 + `updated_at` 降序）→
  `NoteTreeList` 递归渲染（缩进 + branch/leaf + 「＋」创建副笔记按钮）→
  `createNote(parent)` 一步到位
- **CSS**：`.note-tree__*` 树样式（缩进 + 活跃态 + 按钮）

**验证**：pytest **853 passed**（+5 notes 测试）· vitest **36 passed**（+6 buildNoteTree）
· tsc PASS · vite build PASS。

#### Vault Rebuild Test（2026-09-01 · GPT 评审建议 · 已提交 `611852b`）

新增 `tests/unit/test_vault_rebuild.py`（12 项）：

| 测试 | 断言 |
|---|---|
| notes + links 重建 | 笔记元数据 + wikilink 边一致 |
| parent hierarchy 重建 | parent_of + parent_edges 一致 |
| tags 重建 | tags_json 一致 |
| orphan parent 重建 | invalid 标记一致 |
| self-parent 重建 | invalid 标记一致 |
| cycle 重建 | 环上节点 invalid 一致 |
| 多级嵌套重建 | A→B→C 链一致 |
| wikilink + parent 混合 | 两种边都一致 |
| 空 vault 重建 | 空状态一致 |
| 幂等性 | 连续两次 reindex 结果一致 |
| 文件修改后重建 | 反映最新状态 |
| 表重建 | 所有表重新创建 |

**验证**：12/12 passed。核心架构不变量「Markdown = 唯一事实源」被自动验证。

### P1 遗留（未开工）

| 项 | 内容 | 前置 |
|---|---|---|
| P1-1 | **左侧嵌套树 UI**（用户原始诉求「左边也要出现」）：`/notes` 契约补 `parent_id` → `NoteList` 渲染层级树（折叠/展开 + 新建副笔记入口） | `[x]` 完成（2026-09-01 · `buildNoteTree` + `NoteTreeList` + CSS + `NoteCreate.parent`） |
| P1-2 | **稳定 note ID**（独立 ADR）：当前 `parent` 按标题寻址，主笔记改名需级联更新子笔记 frontmatter | `[ ]` 独立 ADR，不与本功能绑带（GPT 评审明确） |

### 失败语义（ADR-024 §2.3，不得偏离）

| 情形 | 处理 |
|---|---|
| parent 不存在 | 保留原值 + 标记 `invalid`，**绝不自动删除** |
| parent 自指 | 标记 `invalid`，不建立关系 |
| 成环 A→B→A | 检出 cycle，环上节点标记 `invalid` |
| 删 parent 文件 | child 不被静默删，降级 orphan |

### 验收

- `pytest` 全绿（含新增 12 项守护测试 + 5 项 notes 测试 + 12 项 Vault Rebuild 测试）
- `npx tsc --noEmit` · `npx vitest run`（36 passed）· `npx vite build` 全绿
- export → rebuild → query：parent 关系不丢
- 与 links 派生冲突时，显式 parent 恒优先

---

## T-M6 M6 Tauri 桌面打包 完成（2026-09-01）

### 做了什么

- 安装 Rust 工具链到 D 盘（`D:\RustToolchain\rustup` + `D:\RustToolchain\cargo`）
- 安装 Tauri CLI 2.11.4（GNU 工具链，避免 MSVC 依赖）
- 创建 `web/src-tauri/` 项目结构（Cargo.toml、tauri.conf.json、src/main.rs、src/lib.rs、icons）
- 生成应用图标（32x32、128x128、256x256、ICO、ICNS）
- 构建 Windows 安装包：MSI 65MB + NSIS 102MB

### 改动文件

| 文件 | 变化 |
|---|---|
| `web/src-tauri/Cargo.toml` | 新增（Rust 依赖配置） |
| `web/src-tauri/tauri.conf.json` | 新增（Tauri 配置） |
| `web/src-tauri/build.rs` | 新增（构建脚本） |
| `web/src-tauri/src/main.rs` | 新增（入口） |
| `web/src-tauri/src/lib.rs` | 新增（应用逻辑） |
| `web/src-tauri/icons/` | 新增（6 个图标文件） |
| `web/package.json` | 新增 `"tauri": "tauri"` 脚本 |

### 测试了什么

| 测试 | 预期 | 实际 |
|---|---|---|
| `cargo tauri build` | 构建成功，生成 MSI/NSIS | ✅ 通过 |
| `rustc --version` | 1.98.0 | ✅ 通过 |
| `cargo tauri --version` | 2.11.4 | ✅ 通过 |

### 遗留问题

- 服务器端 .venv 被删除时锁定（node 进程占用），需重启后重建
- 应用图标为简单橙色圆形（占位符），后续可替换为正式设计
- 仅验证构建产物，未测试实际安装运行（需用户双击 MSI/NSIS 测试）

### 验收

- Rust 工具链安装在 D 盘，PATH 持久化
- Tauri CLI 安装成功
- `src-tauri/` 结构完整
- `cargo tauri build` 生成 MSI + NSIS 安装包

## T-NOTE-TREE 主笔记多级层级树（ADR-026 v3 Accepted · 2026-09-01 批准）

> v1 原名 T-NOTE-DOMAIN（以学科 domain 为主线）→ v2 依所有者澄清重构（层级树为主，
> domain 降级 P1）→ **v3 = 所有者 2026-09-01 批准 v2，同日采纳外部评审三处修订**：
> ① API 加 `depth` 参数后端剪枝（弃 full forest 一次性传输）；② 取消 5 层产品硬上限，
> 改默认 3 层 + 懒加载；③ 排序改 `created_at` 升序 + domain 语义边界明确。
> v1/v2 存档：git `7f297f9`（v1）/ 本节历史（v2，git 历史）。
> **批准时实测输入**：vault 20 篇（百级以下）· 左栏树常驻三栏工作区 · 拖拽 P1 ·
> domain 使用率 0。环检测实测已有（`hierarchy.py::_detect_cycles`），补守护测试固化。

### 核心设计（详见 ADR-026 v3 §3）

- **深度契约**：数据层不限深（ADR-024 不变）· API `GET /notes/tree?depth=N`
  **后端剪枝**（默认 3，安全上限 10）· 展开被剪枝子树时
  `?root_id=<id>&depth=2` 懒加载——**无产品层硬上限**。
- **树端点**：必须经唯一 `resolve_hierarchy()` 构建（ADR-024 红线 2，禁止直读
  links 拼树）；forest 多树并存；orphan/cycle 不进树（环防护走既有
  `_detect_cycles`，原始值保留在 frontmatter）。
- **排序**：同层 `created_at` 升序（大纲式自然生长；弃 `updated_at` 降序——
  改错别字不应导致整棵树同级重排）。
- **前端**：默认展开 3 层全展开（所有者硬要求 ≥3）· 「…」懒加载展开 ·
  折叠箭头 · **展开状态 localStorage 本地偏好**。
- **domain 语义边界（P1）**：domain = 知识领域（Galaxy planet 维度），
  parent = 层级位置（树导航）；二者正交，不得互相推导、不得合并字段。
- **Galaxy 维持两层，零改动零新交互**（2026-09-01 最终裁定）：卫星 = 直接子笔记
  （depth-1），第 3 层及以下不上图不计数（「卫星计数提示」已提议并否决）；
  树/标签/双链数据源独立，禁止互相推导。

### 裁决记录（2026-09-01 批准时落定，ADR-026 v3 §7）

| # | 问题 | 裁决 |
|---|---|---|
| Q1 | 默认展开深度 | 默认 3 层全展开 + 展开状态本地偏好；更深懒加载无上限 |
| Q2 | domain 去留 | 保留设计、P1 排期；语义边界 domain≠parent（ADR-026 §5） |
| Q3 | 树排序 | 同层 `created_at` 升序；手动排序待稳定 note ID，P1 |

### 执行计划

| 阶段 | 内容 | 状态 |
|---|---|---|
| T0 | ADR-026 v3 批准 + Q1–Q3 裁决 | `[x]`（2026-09-01） |
| T1 | 契约 `NoteTreeNode`/`NoteTreeResponse`（shared/types/note.ts）+ `GET /notes/tree`（depth 校验/剪枝 + root_id 懒加载 + created_at 升序，经 resolve_hierarchy） | `[ ]` |

**T1 实现要点（2026-09-01 已对照代码逐条核实，动工前必读）**：

1. **路由顺序**：`GET /notes/tree` 是静态单段路径，必须注册在
   `@router.get("/{note_id}")` **之前**（否则 `tree` 被当作 note_id 解析 → 422）。
   既有先例：`/batch`、`/import` 都排在 `/{note_id}` 前（`notes.py`）。
2. **排序字段现成**：`notes.created_at` 列已存在（`migrations/001_init.sql`，
   `datetime('now')` 默认值）——created_at 升序零 migration；同值按 id 兜底。
3. **契约含 `truncated`**：`NoteTreeNode` 需第四字段 `truncated: boolean`
   （depth 截断处=true），前端靠它渲染「…」懒加载入口（ADR-026 v3 §3.2）。
4. **参数校验手工做**：`depth` 越界（<1 或 >10）在 handler 内手工返回
   422 `invalid_depth`——全局 RequestValidationError handler 会把 422 转 400
   （与 `trace.py` 同模式），pydantic 自动校验靠不住。
5. **orphan/cycle 零新代码**：`resolve_hierarchy()` 已把环上节点弹出 `parent_of`
   并记入 `invalid`，树构建只消费其 `roots`/`children` 输出即可，禁再自行过滤。
| T2 | 前端 `NoteTreeList`：默认展开 3 层 · 「…」懒加载展开 · 折叠箭头 · 展开状态本地偏好 | `[ ]` |
| T3 | 守护测试（多级链 / forest / orphan·cycle 不进树且走 `_detect_cycles` / depth 剪枝 / root_id 子树 / created_at 升序 / depth>10 校验 / 前端展开策略与偏好纯函数）+ Gate 全绿 + 真实 vault ≥3 层端到端验证 | `[ ]` |

**验收纪律**：pytest + vitest + tsc + vite build 全绿；真实 vault 验证只动 `parent`
字段或先备份（禁 PATCH content_md）。domain 实现为 P1 另起 T-NOTE-TREE-P1，
按 v1 设计（git `7f297f9`）执行，migration 重新编号。


## T-M9-007/008 Visual Engine 接入与验收完成（2026-09-02）

### 做了什么

- **回灌**：`ui/visual-engine/` 16 个代码文件（6 组件 + types + stepping/derive/highlight
  3 纯逻辑 + 3 测试文件 + index + css）**逐字节复制**至 `web/src/components/ui/visual-engine/`
  （cmp 校验一致）；`ui/visual-engine/index.ts` 注释同步更新为「已解冻」。
- **解冻导出**：`web/src/components/ui/index.ts` 导出 VisualEngine 组件集与类型。
- **业务壳**：新增 `web/src/components/visual-engine/VisualizeOverlay.tsx`——
  取源码（GET /trace/examples/{id}）+ 执行（POST /trace/run）+ 渲染 ui 库 VisualEngine +
  visualize 事件（POST /events，模块级 openKey 去重 StrictMode 双实例；
  取数模块级 inflight 去重防撞 §5.7 并发护栏 429）。
- **入口**：`GraphView` Floating Inspector——按 `concepts.title` 匹配示例清单
  （GET /trace/examples，挂载取一次），**无匹配概念不渲染按钮**（守护 14），
  匹配则「可视化 · {title}」；点击打开图谱内全屏覆盖层（图谱状态保留，不新增 ViewKey）。
- **场景 A 契约补齐**：`describe_example` 补 `file` 字段（UI 显示用，CodePane 标题）+
  `shared/types/trace.ts` `ExampleEntry.file` + 精确形状断言同步。
- **契约收紧（场景 C）**：`shared TraceValue` 移除 `Record<string, unknown>` 分支——
  该分支违反 ADR-025 §4.3 类型封闭与守护 2；对齐 ui 库 types.ts 的封闭联合。
- **CSS**：覆盖层壳（`.visualize-overlay/.visualize-panel`）入 global.css（令牌驱动）；
  组件样式 `visual-engine.css` 由 main.tsx 引入。
- **门禁**：wiring.test.ts +4（导出存在 / 副本一致锚点 / 业务壳真实消费 / 守护 14 条件渲染）。

### 改动文件

server：`core/tracer/__init__.py`（+1 字段）· `tests/api/test_trace_api.py`（形状断言 + 守护 15 两条）
shared：`types/trace.ts`（file 字段 + TraceValue 收紧）
web：`components/ui/visual-engine/`（16 文件新增）· `components/ui/index.ts` ·
`components/visual-engine/VisualizeOverlay.tsx`（新增）· `views/GraphView.tsx` ·
`main.tsx` · `global.css` · `components/ui/wiring.test.ts`（+4）
ui 库：`visual-engine/index.ts`（注释同步解冻）

### 测试了什么

| 命令 | 预期 | 实际 |
|---|---|---|
| `pytest -q`（server） | 全绿 | **967 passed**（2m07s，含新增守护 15 两条） |
| `npx vitest run`（web） | 全绿 | **155 passed / 9 files**（87 + 回灌 68） |
| `tsc --noEmit` | 0 错误 | PASS |
| `vite build --outDir dist-m9check` | PASS | PASS（4.14s） |
| 无头自检 `web/sandbox/m9-check.cjs`（真后端） | 全绿 | **17/17 · 0 控制台错误** |

### 验收对照（ADR-025 §8 十一条）

| # | 标准 | 证据 |
|---|---|---|
| 1 | factorial 递归 frames | test_tracer_poc PoC-1 ✅ |
| 2 | quicksort 数组状态 | PoC-2 ✅ + 无头自检 rect=7 |
| 3 | 步进语义（Over/Into/Out/Continue/Restart/Back） | 无头自检：6 按钮 + 步号前进 ✅ |
| 4 | 当前行高亮 | 无头自检 `.ve-line--active`=1 ✅ |
| 5 | 无限循环可靠终止 | test_tracer_poc PoC-3 ✅ |
| 6 | 大量 stdout 不阻塞 | test_tracer_poc PoC-4 + 守护 7 ✅ |
| 7 | TraceRun 前后端契约 | test_trace_contract 26 项 ✅ |
| 8 | Concept 页打开动画 | 无头自检：Inspector 按钮 → overlay → VisualEngine ✅ |
| 9 | Markdown 只存声明 | V1 零声明零改动，vault 无新内容 ✅ |
| 10 | 删 SQLite 可从 Markdown 重建 | TraceRun 运行时派生不持久化（§6.2），无表；test_vault_rebuild ✅ |
| 11 | visualize 事件进入 Learning Memory | 无头自检 practice 增量 0.05 + pytest 守护 15 ✅ |

守护测试 18 项：1-13/16-18 此前已锁（test_trace_api + test_tracer_poc）；
**14**（无匹配不渲染按钮）= 无头自检双向 + wiring 门禁；**15**（visualize → practice +0.05×weight）= 新增 pytest 两条。

### 遗留

- 无。M9 关闭；M9.5（ALGOGEN/VTA）按 ADR-025 §9 Deferred。
- 入口当前仅图谱 Inspector（Concept 详情的唯一呈现处）；右栏掌握度等其他入口
  等真实需求，未做（符合 V1 范围锁定）。
- StrictMode 双挂载的两次坑（取数 429 / 事件双记）已在业务壳以模块级去重解决；
  线上生产构建无 StrictMode 双跑，但 dev 是日常环境，必须防。

## T-NOTE-TREE 多级层级树完成（2026-09-02）

### 做了什么（T1 后端 + T2 前端 + T3 验收）

- **T1 后端**：`GET /api/v1/notes/tree?depth=&root_id=`（`notes.py`，注册在 `/{note_id}`
  **之前**——路由顺序陷阱）；`depth` 默认 3 / 安全上限 10，越界**手工 422**
  （全局 RequestValidationError handler 会把 422 转 400，不能用 Query 校验）；
  `root_id` 懒加载子树入口；`truncated` 标剪枝处；同层 `created_at` 升序（v3 修订）。
- **Core**：`hierarchy.py::build_note_forest`（纯结构构建，输入强制来自
  `resolve_hierarchy()`——红线 2；cycle/orphan 零新代码走既有 `_detect_cycles` 路径）。
- **契约**：`shared/types/note.ts` +`NoteTreeNode`（note/children/**truncated**）+
  `NoteTreeResponse`。
- **T2 前端**：NoteEditor 数据源切换 `/notes/tree?depth=3`；`treeView.ts` 纯函数
  （mergeSubtree 懒加载合并 + 折叠偏好 localStorage 读写）；NoteTreeList 折叠箭头
  （aria-expanded）+「…更多子层级」入口；加载骨架（CLS 铁律定高）。
  **buildNoteTree 本地建树退役删除**（含 6 项测试）——单一树数据路径，杜绝第二套 hierarchy。
- **T3**：守护测试 pytest 10 项（多级链/forest/orphan/cycle/depth 剪枝/root_id/
  created_at 升序/越界 422/路由顺序）+ vitest 8 项（mergeSubtree/偏好 roundtrip）；
  真实 vault 4 层临时链 E2E（见下）。

### 改动文件

server：`core/hierarchy.py`（+build_note_forest）· `routers/notes.py`（+/tree）·
`tests/api/test_note_tree.py`（新增 10 项）
shared：`types/note.ts`（+2 接口）
web：`components/notes/treeView.ts`+`treeView.test.ts`（新增）·
`components/notes/buildNoteTree.ts`+`.test.ts`（**删除**）· `views/NoteEditor.tsx` · `global.css`

### 测试了什么

| 命令 | 预期 | 实际 |
|---|---|---|
| `pytest -q` | 全绿 | **977 passed**（+10 树守护） |
| `npx vitest run` | 全绿 | **161 passed / 9 files**（-6 buildNoteTree +8 treeView +4 wiringM9 已计入前次） |
| `tsc --noEmit` | 0 | PASS |
| `vite build --outDir dist-treecheck` | PASS | PASS（4.45s） |
| 无头 E2E `web/sandbox/tree-check.cjs`（真实 vault） | 全绿 | **16/16 · 0 控制台错误** |

### E2E 覆盖（真实 vault，4 层临时链 A→B→C→D，测后物理删除）

默认 3 层全展开（A/B/C 可见、D 被后端剪枝）· 第 3 层出现「…」入口 ·
点击懒加载 D 出现且入口消失 · 折叠箭头（aria-expanded）· 折叠偏好跨刷新保持 ·
再次展开恢复。

### 语义解释（供所有者复核）

ADR-026 §3.2「orphan/cycle 不进树」落地为：**不作为任何节点的 child 悬挂**
（resolver 已判 invalid、`children` 中不出现），**以根身份保持可见**（parent_id=null）——
与 `resolve_hierarchy()` 的 roots 语义（明文含 invalid）及 ADR-024 P1-1 前端
「orphan 按根渲染避免丢笔记」一致；完全隐藏会违反「用户不丢笔记」产品原则。
守护测试按此断言（`test_orphan_visible_as_root_never_hanging` /
`test_cycle_nodes_never_hanging_visible_as_roots`）。

### 遗留

- 手动排序 / 拖拽改父依赖稳定 note ID（ADR-024 P1-2），未做（ADR-026 §3.3 既定）。
- domain 维度 P1 排期（ADR-026 §5，语义边界 domain≠parent）。

## P1-1 MindMap API 边界治理完成（2026-09-02）

### 做了什么

所有者裁定批准实现（评审结论 Q7/Q9 已纳入范围控制）：

- **6 处裸 `fetch` → `lib/api.ts`**（`MindMapCanvas.tsx` 创建 Map / 添加节点 /
  连线 / 导出 / 导入 / 拖拽存坐标）：全部获得 `ApiError` 归一化
  （network_error / http_xxx 统一错误体解析），删除手写
  `throw new Error("create failed")` 等不一致错误路径。
- **F3 拖拽坐标保存重做**：原实现每个 `dragging` change 都裸发 PATCH、无防抖、
  `resp.ok` 不检查、失败静默。新实现 = `PositionSaveQueue`
  （`drag-end flush + 1s trailing debounce 兜底`，评审裁定原文）：
  拖动中只入队（同节点去重保留最新值），drop 立即 flush；
  兜底 debounce 防止 drag-end 信号丢失；组件卸载 `dispose()` 对尾批做最后尝试；
  flush 失败经 `onError` → `setError` 显式上报（此前完全静默）。
- **失败处理补齐**（评审 F2/F4）：添加节点 / 连线此前不检查响应成功与否，
  失败用户不可见；现统一走 `apiPost` 抛 `ApiError` 被 catch 上报。
- **范围红线（评审裁定，未越界）**：❌ MindMap sidecar producer（→ P1-MINDMAP-TRUTH
  单独立项）· ❌ Sync 修复 · ❌ 新增 `shared/types/mindmap.ts`
  （记录为 P1-1 后续契约治理候选，现有 `lib/api.ts` 本地类型可安全承载）·
  ❌ `GET /mindmaps` response wrapper · ❌ 18 处英文（P1-2）·
  ❌ `searchingConcept` 清理（P2-6）· MindMap SQLite 行为零改动。

### 改动文件

- `web/src/components/mindmap/MindMapCanvas.tsx`（6 处 fetch 替换 + 队列接线）
- `web/src/components/mindmap/PositionSaveQueue.ts`（新增，纯逻辑零 React 依赖）
- `web/src/components/mindmap/PositionSaveQueue.test.ts`（新增，11 项）

### 测试了什么

| 命令 | 预期 | 实际 |
|---|---|---|
| `vitest run src/components/mindmap/PositionSaveQueue.test.ts` | 全绿 | **11 passed**（trailing debounce / drag-end flush / 同节点去重 / 多节点合并 / 计时重置 / 失败回调 / dispose / 插入序） |
| `npx vitest run` | 全绿 | **172 passed / 10 files** |
| `tsc -b --force` | 0 error | PASS |
| `vite build` | PASS | PASS（3.22s，Tiptap chunk 警告为既有 P2-5） |
| `pytest -q`（后端零改动回归确认） | 全绿 | **977 passed**（124.6s，与 T-NOTE-TREE 基线一致） |

### 语义说明（供所有者复核）

- `typeof ch.dragging === "boolean"` 门控：仅真实拖拽 change 入队
  （`dragging===true` 拖动中 / `===false` drag-end），程序化 position change
  不触发保存——与原实现 `ch.dragging` truthy 判断语义兼容且更严格。
- 原 `dragging:false`（drop 终帧）坐标在旧实现中**不会保存**（truthy 判断跳过），
  新实现 drop 帧入队并立即 flush——修复了一个潜在丢点。
- 队列 flush 闭包经 `activeMapIdRef` 读当前 map：切换 Map 时挂起的尾批
  仍会存到**正确**的 map（以 flush 时刻的 ref 为准），队列实例不随渲染重建。

## P1-MINDMAP-TRUTH MindMap sidecar producer 完成（2026-09-02）

### 做了什么（所有者裁定单独立项，P0/P1 架构修复 · M8 前置）

恢复 ADR-002「结构真相 = *.mindmap.json 旁车」——此前实现只在 SQLite
（实现事实源 ≠ 架构规定事实源，评审 Q7），M7 Sync 对 `mind_maps/**/*.mindmap.json`
的 scan/apply 管线早已就绪却无任何生产者。SQLite 三表降级为**可重建缓存**
（与 notes/vault 同一教义，ADR-001/005）：

- **Producer**（`core/mindmap.py`）：create/delete map、add/update/delete node、
  add/delete edge、bind/unbind concept、import——每个成功 mutation 提交后
  **整体重写**该 map 的 sidecar（幂等）；`delete_map` 删文件；sidecar 缺失时
  下一次 mutation 自愈重建；写失败 `logger.warning` 不阻断 API。
- **Sidecar 契约**：`workspace/mind_maps/<map_id>.mindmap.json`，
  schema = `{version, type:"mindmap_state", map, nodes, edges}` **状态快照**
  （含 id 全列）。文件名用 id：改名不产生文件 churn、跨设备稳定。
  **刻意不用 ADR-021 交换格式**（交换格式重分配 id，无法承担「从文件重建」）。
  **与 ADR-002 字面偏离登记**：ADR-002 写的是 `<笔记名>.mindmap.json`（按笔记树模型），
  M2b 实际是独立 Map（ADR-019 三表）→ 以 `<map_id>` 命名，待所有者复核是否补 ADR 修订。
- **Rebuild**：`rebuild_mindmaps(conn, workspace, prune_missing=True)`——
  逐文件整体替换（id 保留，纯 INTEGER PRIMARY KEY 无需修 sequence）；
  concept_id 本地不存在 → NULL（FK 硬约束，与 import_map 语义一致；
  跨设备 concept id 对齐属稳定 ID 债务 ADR-024 P1-2）；
  坏 JSON / 重复 id 跳过计数；prune 无 sidecar 的 DB 行；幂等可反复执行。
- **接线**：`db.py` WORKSPACE_SUBDIRS += `mind_maps`；
  `/sync/receive`（sync.py）落盘后 reindex_vault 旁边调 rebuild_mindmaps
  ——「另一设备 Apply → 重新建立 SQLite cache」闭环闭合。

### 改动文件

- `server/app/core/mindmap.py`（producer + rebuild + 各 mutation 钩子）
- `server/app/db.py`（+mind_maps 子目录）
- `server/app/routers/sync.py`（receive 后重建 cache）
- `server/tests/api/test_mindmap_sidecar.py`（新增 17 项）

### 测试了什么

| 命令 | 预期 | 实际 |
|---|---|---|
| `pytest server/tests/api/test_mindmap_sidecar.py` | 全绿 | **17 passed**（producer 7 / Sync 发现 1 / rebuild 6 / 跨设备闭环 1 / 防御 2） |
| mindmap/sync/rebuild/m2_smoke 既有面 | 无回归 | **80 passed** |
| `pytest server/tests`（全量） | 全绿 | **994 passed**（122.1s，977 基线 + 17 新增） |

### 验收链核对（所有者裁定原文 → 实测）

```text
创建/修改/删除 MindMap → *.mindmap.json 正确变化   ✅ producer 7 项
SQLite 可从文件重建                                ✅ rebuild 6 项（含 id 保留 / 幂等 / prune）
Sync 能发现 sidecar                                ✅ scan_workspace 白名单命中（test_scan_workspace_includes_sidecar）
另一设备 Apply → 重新建立 SQLite cache             ✅ test_sidecar_rebuilds_on_fresh_device
                                                     （Apply 落盘本体由 M7 既有测试覆盖）
```

### 遗留 / 待所有者复核

- ADR-002 命名偏离（`<笔记名>` → `<map_id>`）：见上，是否补 ADR 修订待裁决
- 跨设备 concept_id 对齐：rebuild 时本地不存在 → NULL，稳定 note/concept ID
  属 ADR-024 P1-2 既定债务，本任务不解决
- M8 前置条件（[9b]）已满足；下一步 = [10] P1-5 Backend/UI 能力裁定（待所有者逐项裁决）

## P1-5-A 设置 UI 完成（2026-09-02）

### 做了什么（P1-5 裁定 A 组：/settings 接 UI；P1-4 MockProvider 演示的硬前置）

新增浮层视图「设置」——LLM Provider 配置页。没有它，用户无法把默认 MockProvider
切成真实 LLM，Tutor 只能永远演示。

- `views/SettingsView.tsx`（新增）：Provider 下拉（mock / openai_compat）·
  Base URL · API Key（password，已保存时占位「不修改请留空」）· 模型名 ·
  辅助模型 · token 预算；保存走 `PUT /settings`，成功/失败经 Toast 反馈
- `views/settingsPatch.ts`（新增，纯逻辑零 React 依赖）+ 12 项单测：
  **脱敏值 `******` 绝不回写**（否则真密钥被六个星号覆盖，不可逆）·
  未变化的键不下发 · 空串 = 显式清除 · 「服务端无该键 + 表单留空」不生成空条目
- 接线：`ViewKey += "settings"` · App lazy 路由 · TopBar「设置」入口 ·
  `lib/api.ts` 新增 `getSettings`/`saveSettings`/`apiPut` · global.css 纯色样式
  （无 gradient / 无 backdrop-filter，`contain: layout paint`）
- 组件层接线副产品：`Select` / `Input` / `Badge` / `Button` / `Skeleton` /
  `useToast` 首次进入业务（此前整层 0 接线，见 empty-states.html 审计结论）

### 改动文件

`web/src/views/SettingsView.tsx`（新）· `web/src/views/settingsPatch.ts`（新）+`.test.ts`（新）·
`web/src/lib/api.ts` · `web/src/stores/ui.ts` · `web/src/App.tsx` ·
`web/src/components/shell/TopBar.tsx` · `web/src/global.css`

### 测试了什么

| 命令 | 预期 | 实际 |
|---|---|---|
| `vitest run`（新增 settingsPatch 12 项） | 全绿 | **184 passed / 11 files**（172 基线 + 12） |
| `tsc -b --force` | 0 error | PASS |
| `vite build` | PASS | PASS（3.15s，Tiptap chunk 警告既有） |
| 真实后端契约验证（临时 workspace 跑 app） | 四项假设成立 | **脱敏** `api_key→******` · **增量 PUT 不覆盖真密钥** · **空串清除** · **provider 切换工厂生效**（mock → MockProvider） |
| `pytest server/tests`（后端零改动回归） | 全绿 | **994 passed**（124.5s，与 P1-MINDMAP-TRUTH 后基线一致） |

### 边界（P1-5 裁定执行）

只做 LLM Provider 配置。**未做**：同步管理（D 组，延 M8）· 全量导出/导入
（G 组，backend-only）· 学习数据回看与 study 会话（E/F 组，backend-only）。

### 遗留

- `/tutor/test` 端点按 H 组裁定 backend-only，故设置页**没有「测试连接」按钮**；
  若后续希望「填完立刻验证」，需重新裁定（该端点已实现，接一个按钮成本很低）

## T-P1-4 MockProvider 演示路径验证完成（2026-09-02）

### 做了什么

P1-5-A 设置 UI（LLM Provider 配置页）落地后，本任务完成「配置 → 真实问答」的
端到端闭环验证（无代码改动，纯验证 + 配置切换）：

1. 探测本机 Ollama 在线，`qwen3-14b-uncensored-16k`（B10 同款）已拉取
2. `PUT /api/v1/settings`：`llm.provider` mock → `openai_compat`
   （base_url/model 已预填 `127.0.0.1:11434/v1` + qwen3，Ollama 无需 key）
3. `POST /tutor/test`（concept_id=7）→ HTTP 200，**provider=OpenAICompatProvider**，
   真实中文回答（非 Mock 占位）
4. `POST /chat`（非流式）→ conversation 落库，真实回答，且**回答内容体现
   memories 注入**（引用 B3 extractor 此前抽取的用户记忆）
5. `POST /chat stream=true` → **SSE 逐 token 流式**（`data:{"text":...}`）正常

### 配置处置

保留 `openai_compat` + 本地 Ollama qwen3（开箱即真实；设置页可随时切回 Mock）。
验证产生的 2 轮对话为自然使用痕迹，保留在 workspace（用户数据不删）。

### Gate

| 项 | 结果 |
|---|---|
| 全链路 Smoke（/tutor/test） | 200 · 真实回答 · provider 正确 |
| /chat 非流式 | 200 · conversation 落库 · memories 注入生效 |
| /chat SSE 流式 | 逐 token 输出正常 |
| pytest / vitest / tsc / build | 994 / 186·12 / 0 / PASS（本日实测） |

### 遗留

- 无代码改动；P1-4 关闭。

## T-P1-MINDMAP-TRUTH-HISTORY 定性完成（2026-09-02 · 架构确认，零代码）

### 所有者之问

现有 SQLite-only MindMap 数据，在什么时候、以什么机制、由谁生成 `*.mindmap.json`？

### 答案：不存在存量——回填动作退化为 no-op，P1-MINDMAP-TRUTH 正式关闭

| 核查项 | 实证 |
|---|---|
| 前向 producer | ✅ `core/mindmap.py` 全部 11 个 mutation 触发 `write_sidecar`（create/import/add_node/position/label/bind/unbind/delete_node/add_edge/delete_edge/delete_map），整体重写 + 原子替换（tmp.replace），失败仅告警不阻断 |
| 反向 rebuild | ✅ `rebuild_mindmaps`（幂等，prune_missing mirror 语义），唯一调用点 `sync.py:200`（Sync Apply 后一致性钩子） |
| **存量数据** | **`mind_maps` 表 maps=0 / nodes=0 / edges=0（真实库实测）**——用户从未在真实库创建导图，M2b 开发数据全在测试库 |
| 回填机制 | **不需要**——无 SQLite-only 存量，「历史回填」退化为空集；a68bc3d 的原语（write_sidecar 单 map 幂等）已覆盖未来任何单库迁移需求 |

### 结论

按所有者裁定框架落标记：**历史数据回填 = 运维/首次迁移动作，不属于运行时 producer；
本库为首次使用且无存量 → 该动作无操作。P1-MINDMAP-TRUTH 正式关闭。**

### 一条长期注意点（登记，不行动）

`rebuild_mindmaps` 默认 `prune_missing=True`：未来若出现「rc.2 之前创建且从未再编辑」
的 map（无 sidecar），Sync Apply 会按 mirror 语义删除它。当前为零；producer 已生效，
所有新 map 自动带 sidecar，窗口不会重新打开。

## T-P1-2 i18n 用户可见英文中文化完成（2026-09-02）

### 做了什么

5 个组件的用户可见硬编码英文全部中文化，共 **46 处**（收口时估计 18 处为抽查值，
执行时以「用户可见英文清零」为准逐文件盘点）：

| 组件 | 处数 | 明细 |
|---|---|---|
| MindMapCanvas | 13 | 导图 / 新导图标题… / 创建 / 导入 / 导出 / 添加节点… / 添加 / 概念绑定 / 绑定说明 / 搜索概念… / 已绑定： / 解绑 / 选择或新建一个导图 |
| TutorPanel | 22 | AI 导师 / 概念 / 掌握度（掌握·练习·回忆·迁移四维）/ 历史错题 / 关联 / 引用笔记 / 关闭 / 移除 aria / 搜索要引用的笔记 / 操作 / 停止 / 提问 / MODE_LABELS ×3 / MODE_DESCRIPTIONS ×3 |
| MemoryList | 11 | 记忆 / 加载中… / 事实·偏好·目标·错误模式 / 内容不能为空 / 保存中… / 保存 / 取消 / 编辑 / 删除 |
| SuggestionList | 5 | AI 建议 / 加载中… / 来自 AI / 采纳 / 忽略 |
| MapNode | 2 | 概念引用 / 临时节点（tooltip） |

### 红线遵守

无 i18n 框架 · 零新依赖 · 零 API/数据模型/ADR 变更 · 零组件重构 ·
技术标识（mode 枚举 key / CSS 类名 / status 值 / 模板名）全部不动。

### 测试了什么

| 项 | 结果 |
|---|---|
| 残留英文扫描（五文件 JSX 文本/placeholder/aria 正则） | **零命中** |
| `tsc --noEmit` | 0 错误 |
| `npx vitest run` | **186 passed / 12 files**（文案无测试断言依赖，全绿） |
| `vite build --outDir dist-i18ncheck` | PASS（4.31s） |
| git staging | exact-path（5 文件逐一列名，未用 -A） |

## T-P0-2b Tauri sidecar 接线与桌面链路闭环 完成（2026-09-03，P0-2 方案 i）

> 背景见 workspace 根《P0-2 Tauri Desktop 验证记录》：壳可启动但 sidecar 从未接线 +
> 生产 API base 相对路径断链。所有者授权方案 i 后接线。**桌面版自此双击可用。**

### 做了什么

- `server/backend_main.py`（新增）：打包态后端入口。workspace 解析 = env >
  自 exe 上溯 4 级找 `workspace/db`（开发树命中 repo/workspace，真数据）>
  exe 同级 `workspace/` 兜底；端口 env PORT 默认 **8100**（避让 dev 8000）；
  host 恒 127.0.0.1（红线）。
- `server/plos_backend.spec`（新增）：PyInstaller onefile；hiddenimports=
  collect_submodules("uvicorn")+anyio asyncio backend；datas 打
  `server/migrations → _MEIPASS/server/migrations`。产物 15.5MB。
- `server/app/db.py`：加 frozen 分支（打包态 `MIGRATIONS_DIR = _MEIPASS/server/migrations`），
  非 frozen 路径零改动。
- `server/app/main.py`：CORSMiddleware（allow：`http(s)://tauri.localhost`、
  `http://localhost:5173`）——桌面 WebView 跨源访问 sidecar 的真实前提。
- `web/src/lib/api.ts`：`import.meta.env.MODE === "desktop"` 时 BASE 切 `http://127.0.0.1:8100`（`--mode desktop` 即开关；dev/web 相对路径不变）。
  注：`.env.desktop` 方案已否决——仓库红线 `.env*` 不入库，改用 MODE 判定进代码。
- `web/src-tauri/tauri.conf.json`：`bundle.externalBin=["binaries/plos-backend"]`；
  beforeBuildCommand → `npm run build -- --mode desktop`。
- `web/src-tauri/src/lib.rs`：setup 内 `shell().sidecar("plos-backend").spawn()`，
  `RunEvent::Exit` 时 kill（防孤儿后端）。Rust 层只做 spawn/kill，端口与 workspace
  解析全在 Python 侧（薄壳原则）。
- `.gitignore`：`web/src-tauri/binaries/`、`server/build/`（构建产物不入库）。

### 测试了什么

| 测试 | 结果 |
|---|---|
| 冻结态 sidecar 单跑（dist/plos-backend.exe） | ✅ 8100 health `db:true` · notes=20（workspace 上溯命中真库）· CORS 预检 200 + `allow-origin: http://tauri.localhost` |
| `cargo tauri build --no-bundle` | ✅ desktop 模式 tsc+vite build → Rust release 1m47s |
| 端到端：双击 plos.exe | ✅ 壳自动拉起 sidecar（onefile 引导+Python 子进程）· 8100 health/notes 全通 · dist 内确认烘焙 `127.0.0.1:8100` |
| 退出回收 | ✅ 关壳后 plos/plos-backend 进程零残留、8100 释放 |
| 回归 | ✅ pytest 50 passed（smoke/notes/cjk_bigram）· vitest 186 passed（tsc 已由 beforeBuildCommand 覆盖） |

### 追加修复（P0-3 实测发现，2026-09-03）

- **孤儿 sidecar**：优雅关闭窗口后 onefile 引导进程被回收，真正的 Python 服务作为孙进程残留数秒——若占住 8100/SQLite，下次启动 sidecar 绑定失败。`lib.rs` 退出改为**进程树终止**（系统 `taskkill /PID /T /F` + CREATE_NO_WINDOW，零新依赖）；复测优雅关闭后进程树零残留、8100 立即释放。

### 已知边界 / 教训

- 本地命令行环境下 vite 清空 `dist` 会被批量删除守护拦截 → 构建前先手动清 dist
  （脚本化构建后续可用 `--emptyOutDir false`）。
- onefile 启动自解压有 ~1-2s 延迟（用户可感知的窗口空白期）；不可接受时改 onedir + resources。
- 正式安装版（MSI）数据目录仍指向解析出的 workspace；迁移 userData 归 P2 发布基线任务。
- PyInstaller 为**构建期工具**（server/.venv，6.22.2），不进 requirements.txt（DEPENDENCIES dev 依赖节登记）。

## [16] ADR-028 Backend: Document Changes / Revision / Diff 基础能力 完成（2026-09-04）

> 任务书：与 Git 解耦的文档变更/版本/diff 后端能力，仅 `current` + `snapshot` 两源
> （Git 适配器明确另立任务）。先考察后实现，两轮交付 + 一轮恢复能力补全。

### 做了什么

- **代码考察先行**（任务书 §2）：确认版本能力为零（`sync/diff.py` 是 manifest 级、
  `vault_watcher.snapshot` 仅状态快照）；migration 路线架构性不成立（SQLite 不在
  EXPORT_DIRS/SYNC_PATTERNS，DB 不随同步迁移）；快照不能放 `vault/` 下
  （`reindex.py` rglob 会吞成笔记）且目录键必须用 vault 相对路径（note_id 不随 DB 同步）。
- **`core/revisions.py`**（新增 ~480 行）：快照目录安全校验（拒绝逃逸/反斜杠/绝对路径）、
  `create_snapshot` / `maybe_snapshot`（正文 hash 去重 + 300s 去抖 + 每笔记上限 50 张先裁旧）、
  `list_snapshots` / `latest_snapshot` / `read_snapshot` / `read_current` / `resolve_revision`、
  `rename_revision_dir`（迁移）/ `prune_revisions` / `purge_revisions`、
  `list_orphan_paths`（第二轮）、`diff_texts`（difflib `autojunk=False` 强制）。
  快照文件本身是合法 Markdown（`compose_file` 注入 `rev_*` 元数据），时间戳精确到微秒。
- **`routers/revisions.py`**（新增）：`/api/v1/notes/{id}/revisions`（GET 列表首位 current 虚拟项 /
  POST 手动打点 / GET 单版读 / DELETE 清理 / POST restore 恢复）+ `/changes` + `/diff`；
  admin：`GET /revisions/orphans` + `POST /revisions/restore`（从孤儿快照重建笔记）。
- **`routers/notes.py`**：PATCH 写前去抖快照 + 重命名迁移、DELETE 保留快照（均失败仅记日志不阻塞保存）；
  `_create_note_vault` 扩展 meta/rel_path 参数供恢复路径复用常规写路径。
- **`core/export.py`**：EXPORT_DIRS 增加 `metadata/revisions`（所有者裁定：导出含、同步不含）。
- **`db.py`**：WORKSPACE_SUBDIRS 增加 `metadata/revisions`。
- **AGENTS §4 澄清**：Git 事实域=应用侧资产；workspace/ 用户数据在 Git 覆盖之外；
  文档版本层永久禁用 Git 概念术语。
- **ADR-028**（新增）+ 文档同步（api.md 102 route/82 path · data-model.md 快照节 ·
  ADR_INDEX · architecture.md 模块图 · PROJECT_STATE §7 计数与行项）。
- 已知边界：正文 hash 去重意味着**仅 frontmatter 变化不产生快照**（ADR-028 §4 登记）。

### 改动文件

`server/app/core/revisions.py`（新）· `server/app/routers/revisions.py`（新）·
`server/app/routers/notes.py` · `server/app/core/export.py` · `server/app/db.py` ·
`server/app/main.py` · `server/tests/unit/test_revisions.py`（新 ~48 用例）·
`server/tests/api/test_revisions.py`（新 ~32 用例）· `docs/adr/ADR-028-document-revisions.md`（新）·
`AGENTS.md` §4 · docs 五处登记 · `.workbuddy/artifacts/` 考察与交付报告

### 测试了什么

| 项 | 结果 |
|---|---|
| `pytest tests -q`（第一轮 / 第二轮 / 恢复轮） | 1019 → 1085 → **1099 passed** |
| `python scripts/contract_audit.py` | 全部新端点契约审计 `Y` |
| 端到端冒烟（隔离 workspace，未触碰真实 vault） | 快照→列表→diff→restore→删笔记→孤儿回收重建 全链路通 |
| 关键防回归 | autojunk 反证（True→150 行误判 / False→1）；同秒快照微秒序；422 上限；sync 边界负向守卫 |

### 遗留问题

- Git source 适配器（任务书明确另立任务，禁 git CLI 依赖）。
- 仅 frontmatter 变化不产生快照（去重边界，ADR-028 §4）。
- 前端消费（版本面板/diff 视图）未排期。
