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
| M2 | 双链·反链·FTS5·React Flow 图谱 | `[ ]` | — |
| M2b | Mind Map 编辑器（旁车 json + 生成大纲） | `[ ]` | — |
| M3 | Learning Graph（掌握度/状态机/SM-2/Dashboard） | `[ ]` | — |
| M3b | Knowledge Universe 视觉层（Galaxy/Explorer/Memory Map，ADR-007） | `[ ]` | — |
| M4 | AI Tutor（provider/流式/上下文管线/extractor/AI导图） | `[ ]` | — |
| M5 | 复习闭环（队列/测验/时间线） | `[ ]` | — |
| M6 | Tauri 桌面打包 | `[ ]` | — |
| M7 | LAN Sync v1（配对/manifest 对比/冲突双份，ADR-005） | `[ ]` | — |
| M8 | Mobile MVP Android（RN+混合内核，ADR-006） | `[ ]` | — |
| M9 | Visual Engine V1（trace/StepPlayer/三模板） | `[ ]` | — |
| M10 | AI 生成可视化 | `[ ]` | — |

## M0 任务拆解（当前）

- [x] server/：FastAPI 入口（绑 127.0.0.1）+ db.py + migrations/001_init.sql（TECH_DESIGN §4 DDL）+ routers 骨架 + GET/PUT /api/v1/settings
- [x] web/：Vite React TS + Zustand store 骨架 + global.css + 六视图占位路由切换 + api client
- [x] 联调：Vite proxy `/api/v1`→8000；两条启动命令验证通过
- [x] 测试就位：pytest 目录 + 冒烟用例（migration 可跑、/api/v1/settings 读写往返）；vitest 占位
- [x] 验收自查：对照 TECH_DESIGN §10 M0 标准逐条勾选，回填报告

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
