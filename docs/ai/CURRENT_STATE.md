# Current State

> AI 启动时必读第二份。每次 git commit 后同步更新。
> 上次更新：2026-08-27 · Last commit：76caddb · Branch：main · Clean：yes

---

## 当前里程碑

M5 ✅ → M4-Preflight ✅ → M4-A ✅ → M4-B ✅ → Gate 1 ✅ → M4-C ✅ → Smoke ✅ → M4-D ✅ → M4.5 ✅ → M4-E ✅ → M3b-001 ✅ → M3b-002 ✅ → M3b-003 ✅ → M3b-004 ✅ → M2b-001 ✅ → M2b-002 ✅ → M2b-003 ✅ → ADR-020 ✅ → P2 Atomic Write ✅ → M7-001 Sync Engine Core ✅ → M7-001 Stabilization ✅ → M7-Nightly Audit ✅ → M7-001.5 Sync Simulation ✅ → ADR-022 ✅ → M7-002 LAN Discovery ✅ → **M7-003 Sync Transport ✅**

## Last Completed

M7-003 Sync Transport 完成。
三个新模块：messages.py（4种传输消息类型）· transfer.py（白名单路径匹配 + 原子写入 + 哈希验证）·
transport.py（SyncTransport 协调器：execute_plan + serve_file + receive_incoming）。
31 个新测试 · 总计 327 passed · vite build PASS。

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

## Next Up

- **M7-005 Conflict UI**（冲突双份展示与解决）
- M7-006 End-to-end LAN Demo
- 挂起：Data Model Terminology Cleanup（event_id/event_uuid 术语统一，独立 micro-task）
- 前置阅读：docs/sync/sync-model.md §Apply 层/§边界与恢复 · sync-transport.md · ADR-020

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
pytest -q          → 373 passed
npx vitest run     → 2 passed
npx vite build     → pass
.\scripts\test.ps1 → 全量
```

## 本次会话改动（M7-004.5 Sync Boundary & Recovery Audit）

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
- docs/data-model/INDEX.md：补登 ADR-020 Sync Truth Model 数据模型行
- AGENTS.md §10 文档地图：新增 docs/sync/ 条目
- docs/diagrams/sync-flow.html：新增同步管线图（Discovery→Transport→Apply→Workspace），旧图未动
- docs/tasks/TASKS.md：总览表同步已完成状态 + 新增 M7 子任务区
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
- docs/testing/M7-STABILITY-REPORT.md
- CHANGELOG.md：新增 M7 stabilization 条目
