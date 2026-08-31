# Testing Full — 全量测试文档（前端 → 后端闭环验收）

> 版本：v1.0 · 2026-08-31 · 基线 HEAD `cd21831`
> 定位：本文是**功能级全量测试文档**，覆盖「前端 UI → API → Core → vault/DB → 同步」的完整闭环。
> 测试体系制度（金字塔、Gate、矩阵维护规则）见 `TESTING.md`，本文不重复，只给出**逐功能执行清单**。
> 执行方式分两类：
> - **[自动]** 已有自动化测试，跑命令即可，本文列出「该存在的测试 → 对应文件」；
> - **[手动]** 需要人在真实运行环境里按脚本操作并核对结果的 E2E 用例。

---

## 目录

1. [测试环境准备](#1-测试环境准备)
2. [一键 Gate 命令](#2-一键-gate-命令)
3. [后端 API 全量测试矩阵](#3-后端-api-全量测试矩阵)
4. [前端功能测试](#4-前端功能测试)
5. [端到端闭环场景（核心）](#5-端到端闭环场景核心)
6. [同步闭环（双设备模拟）](#6-同步闭环双设备模拟)
7. [AI 边界与安全](#7-ai-边界与安全)
8. [性能与 a11y 契约验收](#8-性能与-a11y-契约验收)
9. [验收标准与报告模板](#9-验收标准与报告模板)

---

## 1. 测试环境准备

| 项 | 要求 | 检查命令 |
|---|---|---|
| Python | `server/.venv`，依赖 `server/requirements*.txt` | `pytest --version` |
| Node | 前端 `web/`，依赖含 TipTap 3.x、React | `node -v` |
| vault | 一个可写的 Markdown 目录（测试用独立目录，勿指向真实笔记库） | — |
| DB | SQLite，测试由 pytest fixture 隔离；手动测试前清库 | `server/migrations` 已应用 |
| LLM Provider | 闭环测试默认 **mock provider**（不依赖网络/密钥）；真实模型验证为可选项 | `server/app/core/ai/` |
| 启动后端 | `uvicorn app.main:app --port 8000`（工作目录 `server/`） | `GET /api/v1/health` → 200 |
| 启动前端 | `npm run dev`（工作目录 `web/`），Vite 代理 `/api` → 后端 | 打开首页无报错 |

**环境自检清单（手动测试前置）**
- [ ] `/api/v1/health` 返回 200
- [ ] 前端 dev 页面打开后 TopBar 显示「已同步」或「同步 ?」
- [ ] `#gallery`（dev-only 组件画廊）可打开：URL 加 `#gallery`

---

## 2. 一键 Gate 命令

```bash
# 后端全量（目标：0 failed；2026-08-31 实测 836 passed——含 BUG-1 修复
# 新增的 2 项 export→rebuild 守护测试）
cd server && .venv/Scripts/python -m pytest -q

# 前端类型 + 构建 + 单测
cd web && npm run build && npm test

# 一键（如根 scripts/ 有脚本则以 scripts/ 为准）
```

Gate 通过线：`pytest` 全绿 · `vitest` 全绿 · `tsc --noEmit` PASS · `vite build` PASS。任何一项红 → 不进入手动 E2E。

---

## 3. 后端 API 全量测试矩阵

> 共 20 个 router。每个端点给出：功能、必须覆盖的用例（N=正常 / B=边界 / E=错误）、自动化归属。
> 「归属」列出已存在的测试文件；若某用例无归属，标记 ⚠️ 为**补测缺口**。

### 3.1 notes — 笔记 CRUD（`server/app/routers/notes.py`，前缀 `/api/v1/notes`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `GET ""` | 笔记列表 | N 列表返回 title/id/updated_at；B 空库返回空数组 | `tests/test_notes.py` |
| `POST ""` | 新建笔记 | N 正常创建 201；E 空 title；B title 重复允许 | `tests/test_notes.py` |
| `POST /batch` | 批量操作 | N 批量创建；E 部分失败的回滚语义 | `tests/test_notes.py` |
| `POST /import` | 批量导入 Markdown | N 导入含 wikilink 的目录；B 非 md 文件跳过；E 空目录 | `tests/unit/test_importer` 相关 + `test_rebuild.py` |
| `GET /{id}` | 笔记详情 | N 返回 content_md；E 404 不存在 id | `tests/test_notes.py` |
| `PATCH /{id}` | 更新笔记 | N 更新 content_md 后 updated_at 变化；E 404 | `tests/test_notes.py` |
| `DELETE /{id}` | 删除笔记 | N 删除后列表消失、关联链接清理；E 404 | `tests/test_notes.py` |
| `GET /{id}/link-suggestions` | 链接建议 | N 返回建议；B 正文为空返回空 | `tests/api/test_autolink.py` |

### 3.2 attachments — 附件（`attachments.py`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `POST ""` | 上传 | N 图片上传返回 url；N PDF 上传；E 非 allowed 类型 4xx；B 超大文件 | `tests/test_attachments.py` |
| `GET /{name}` | 取回附件 | N 字节流一致；E 404 | `tests/test_attachments.py` |

### 3.3 concepts — 概念（`concepts.py`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `GET ""` | 概念列表 | N 全量；B 按 domain 过滤 | `tests/unit/test_concepts.py` |
| `GET /domains` | 域列表 | N 6 色域分配稳定 | `tests/unit/test_concepts.py` |
| `GET /{id}` | 概念详情 | N 含 mastery；E 404 | 同上 |
| `POST ""` | 建概念 | N 201；E 重名 | 同上 |
| `PATCH /{id}` | 改概念 | N 改名后链接跟随 | 同上 |
| `POST /extract` | 从笔记抽取概念 | N 抽出概念并建边；B 空笔记；E AI 失败降级 | `tests/unit/test_extractor.py`、`tests/api/test_concept_extractor.py`、`tests/integration/test_extractor_integration.py` |
| `DELETE /{id}` | 删概念 | N 级联清理边与掌握度 | `tests/unit/test_concepts.py` |

### 3.4 mastery / review — 掌握度与复习（`mastery.py`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `POST /events` | 学习事件 | N 201 入事件日志；E 非法类型 | `tests/unit/test_eventlog.py` |
| `GET /mastery` / `GET /mastery/{id}` | 掌握度 | N 初值 0；N 事件后上升 | `tests/api/test_mastery.py` |
| `GET /mastery/weak/list` | 薄弱列表 | N 按 mastery 升序；B 空库空列表 | 同上 |
| `GET /review/today` | 今日复习队列 | N SM-2 到期进入队列；B 无到期空队列 | `tests/unit/test_sm2.py`、`test_review_bridge.py` |
| `POST /review/{id}/answer` | 复习打分 | N 打分 1/3/5 后 interval/ease 变化正确；E 非法分数 4xx | `tests/unit/test_sm2.py` |
| `GET /review/history` / `GET /review/stats` | 历史/统计 | N 与答题记录一致 | `tests/unit/test_review_stats`（core） |
| 遗忘曲线衰减 | 后台衰减 | N 长期不复习 mastery 衰减但不为负 | `tests/unit/test_decay.py` |

### 3.5 study — 学习会话（`study.py`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `POST /study/sessions` | 建会话 | N 201 | `tests/api/test_study.py` |
| `GET /study/sessions/{id}/queue` | 会话队列 | N 队列概念集正确 | 同上 |
| `POST .../finish` | 结束会话 | N 结算事件落库；E 重复 finish | 同上 |
| `DELETE /study/sessions/{id}` | 删会话 | N 删除 | 同上 |

### 3.6 tutor / conversations / suggest — AI（`tutor.py` `conversations.py` `suggest.py`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `POST /chat`（stream=true SSE） | 流式对话 | N SSE 逐块输出 event:data；N 中止后落库已到部分；E 上游错误 event:error；E provider 未配置 | `tests/test_tutor_smoke.py`、`tests/unit/test_llm_provider.py`、`test_openai_provider.py` |
| `GET/POST /conversations*` | 会话管理 | N 建/查/删；E 删不存在 404 | `tests/unit/test_conversations.py` |
| `GET /tutor/context/{id}`、`POST /tutor/context` | 记忆感知上下文 | N 上下文含记忆与笔记；B 无记忆时降级 | `tests/test_tutor_context.py`、`tests/unit/test_tutor_notes.py`、`test_memories_context.py` |
| `POST /tutor/test` | 自测 | N 返回判定 | `tests/test_tutor_context.py` |
| `GET /knowledge/suggest` | 知识建议 | N 基于薄弱项建议 | `tests/api/test_suggest.py`、`test_suggest_memory.py` |
| AI 禁答边界 | AI 不替代思考 | N prompt 构造含禁令；N 禁止直接给答案的输出过滤 | `tests/unit/test_ai_boundary.py`、`test_prompt_builder.py`、`test_tutor_prohibition.py` |

### 3.7 memories — 记忆管理（`memories.py`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `GET ""` / `POST ""`（implicit） | 列表/建 | N CRUD 往返 | `tests/api/test_memories_api.py`、`tests/unit/test_memories.py` |
| `GET /{id}` `PATCH /{id}` `DELETE /{id}` | 详情/改/删 | N；E 404 | 同上 |
| `GET /maintenance` | 维护清单 | N 过期记忆被标出 | `tests/unit/test_memories_admin.py` |

### 3.8 mindmap — 思维导图（`mindmap.py`，前缀 `/api/v1/mindmaps`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `GET ""` / `POST ""` / `GET /{id}` / `DELETE /{id}` | 导图 CRUD | N 全往返；E 404 | `tests/api/test_mindmap.py` |
| `POST /{id}/nodes` `PATCH/DELETE .../nodes/{nid}` | 节点 CRUD | N；B 孤立节点允许 | 同上 |
| `POST/DELETE .../nodes/{nid}/bind` | 节点↔概念绑定 | N 绑定后掌握度联动；E 绑定不存在概念 | 同上 |
| `POST /{id}/edges` `DELETE .../edges/{eid}` | 边 CRUD | N；E 自环/重复边 | 同上 |
| `GET /{id}/outline` / `GET /{id}/export` / `POST /import` | 大纲/导出/导入 | N JSON 往返无损 | 同上 |
| `POST /suggest` | AI 生成导图 | N 从笔记生成节点/边；E 空笔记 | `tests/api/test_mindmap_suggest.py` |

### 3.9 mistakes — 错题本（`mistakes.py`）

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `GET /mistakes` / `GET /mistakes/stats` | 列表/统计 | N；B 空库 | `tests/api/test_mistakes.py` |
| `GET/PATCH/DELETE /mistakes/{id}` | 详情/改/删 | N；E 404 | 同上 |

### 3.10 search / home / graph / universe / export / settings / links

| 端点 | 功能 | 必测用例 | 归属 |
|---|---|---|---|
| `GET /search?q=` | 全文搜索 | N 命中标题与正文；B 中文分词；B 空词返回空 | `tests/api/test_m2_smoke.py` |
| `GET /home` | 聚合状态 | N 含 review_due / mastery 概览 | `tests/api/test_home.py` |
| `GET /graph` | 图谱拓扑 | N 节点含 note/concept 两类、边含关系类型；B 空库空图 | `tests/test_universe.py` |
| `GET /universe` | 星系数据 | N hub 判定（出度≥2）、卫星归属排他、孤立笔记独立星球 | `tests/test_universe.py` |
| `GET /export` | 全量导出 | N 导出 JSON 可再导入（roundtrip）；N 含全部实体 | `tests/unit/test_export.py` |
| `GET /settings` | 设置 | N 返回模型等配置（无密钥明文） | `tests/api/test_router_registration.py` |
| `GET /notes/{id}/backlinks` | 反向链接 | N 双向互链检出；B 无反链空数组 | `tests/api/test_autolink.py` |
| `GET /health` | 健康检查 | N 200 | `tests/test_smoke.py` |

### 3.11 sync — 同步（`sync.py`，见 §6 专章）

端点：`/status` `/resolve` `/manifest` `/plan` `/pair` `/peers` `/discover` `/files/{path}` `/receive`。
归属：`tests/api/test_sync_http.py` + `tests/unit/test_sync*.py`（8 个文件）+ `tests/integration/sync/`。

---

## 4. 前端功能测试

### 4.1 自动化（vitest，2026-08-31 实测 28 passed / 3 文件）

| 模块 | 文件 | 覆盖 |
|---|---|---|
| 布局引擎（纯函数） | `web/src/lib/graph/layout.test.ts` | 图谱/导图布局计算 |
| 星系星球推导 | `web/src/components/galaxy/derivePlanets.test.ts` | hub 判定、卫星归属排他、孤立笔记（13 项） |
| UI 状态 store | `web/src/stores/ui.test.ts` | activeView 切换、focusNoteId、tutorReturnView |

⚠️ 补测缺口（建议，非阻塞）：`lib/api.ts` 的错误分支（ApiError code 映射、401/409）目前无单测。

### 4.2 视图手动测试脚本（[手动]，每项按步骤执行并核对）

**V1 笔记工作区（默认主界面）**
1. 打开首页 → 默认进入笔记工作区，三栏可见（列表 / 编辑器 / 右栏 320）。
2. 点「＋ 新建」→ 列表出现新笔记，编辑器获得焦点。
3. 输入标题与正文（含 `[[另一篇]]`、`#标签`、公式 `$x^2$`、图片粘贴）→ 800ms 后元信息行显示「● 已保存」；刷新页面内容不丢。
4. 核对编辑器硬约束：正文列宽 **680px 居中**（DevTools 量测）；工具栏**只有「插图/PDF」**，无搜索/AI/雷达控件；保存态为元信息行极小字。
5. 点「插图/PDF」上传图片 → 编辑器内出现 `![alt](url)`；上传 PDF → 插入链接。
6. 删除笔记 → 列表移除、编辑器回到空态提示「← 选择或新建一篇笔记」。

**V2 右栏 ContextRail**
1. 五标签可切换：大纲 / 反链 / 关联 / 掌握度 / 雷达。
2. 大纲随正文标题实时更新；反链在有 `[[链接]]` 的笔记上非空。
3. 掌握度 tab 显示概念掌握度；雷达 tab 渲染四维雷达图。

**V3 TopBar**
1. 搜索框输入 → 250ms 防抖后出结果下拉；点击结果跨视图打开对应笔记；无结果显示「没有匹配的笔记」。
2. 复习徽章：有到期时亮起并显示数字，点击进入复习；无到期时不亮。
3. 同步指示：停止后端 → 显示「同步 ?」或冲突数；重启后恢复。
4. 浮层态（图谱/星系/复习等）左上出现「← 返回笔记」，点击回到工作区。

**V4 图谱（浮层）**
1. 进入图谱：Note=方形、Concept=圆形（形状即语义）；关系类型着色（依赖类深灰、其余浅灰）。
2. hover 节点橙色高亮（橙色仅用于交互态，不用于静态分类）。
3. 点击笔记节点 → 返回并打开该笔记（focusNoteId 跨视图）。
4. 拖拽画布/滚轮缩放流畅；Inspector 浮层显示选中节点信息。

**V5 星系（浮层）**
1. 进入星系：多星球系统——出度≥2 的笔记为星球，双向互链笔记为卫星，孤立笔记为独立小星球。
2. 卫星带墨色拖尾沿轨道公转；轨道前后分层遮挡正确（卫星绕到星球后面被挡住）。
3. 单卫星星球全屏 4s 轮换 / 右栏单颗静止两形态。
4. 鼠标拖动可转动地球相位；性能：DevTools Performance 面板确认单 rAF、约 30fps。
5. 卫星超过 16 个显示「…+N」聚合。

**V6 复习（浮层）**
1. 有到期概念时进入：居中专注卡，显示概念与 ProgressRing 进度。
2. 键盘 `1/2/3` 打分（映射 SM-2 1/3/5）、`Esc` 退出回笔记。
3. 打分后进度推进；答错概念进入薄弱列表（右栏掌握度可见）。
4. 全部答完出现结算态；再进 TopBar 徽章归零。

**V7 Tutor（右栏抽屉）**
1. 打开 Tutor → 右栏抽屉 + 遮罩；底层仍画来源视图，遮罩点击/关闭返回原视图（含从 Review 进入 → 回 Review）。
2. 提问 → SSE 流式逐块渲染；流式中有 Skeleton。
3. 点「停止」→ 已到部分保留、不算错误；后端落库该部分回答。
4. 断开 LLM provider → 显示错误条，不白屏。

**V8 思维导图（浮层）**
1. 创建导图、加节点/边、绑定概念；画布拖拽编辑正常。
2. 大纲视图与导出 JSON 与画布一致；导入 roundtrip 无损。
3. AI 生成导图（mock provider）产生节点与边。

**V9 搜索 / 导出 / 设置**
1. `/api/v1/export` 下载 JSON，内容含笔记/概念/掌握度/导图全量；再导入可还原。
2. 设置页无密钥明文暴露。

**V10 组件画廊（dev-only）**
- URL 加 `#gallery` 打开；基础组件五态（default/hover/active/disabled/loading）齐全；生产构建不含该入口（`npm run build` 后 grep 产物确认 tree-shake）。

---

## 5. 端到端闭环场景（核心）

> 每个场景是「前端操作 → API → 数据 → 回到前端呈现」的完整链路。**[手动]**，依次执行；
> 每步标注的核对点全部满足才算场景通过。后端可先用 mock provider。

**场景 A：一条笔记的一生（核心学习闭环）**
1. 新建笔记《光的干涉》，写入含 `[[双缝实验]]` 的正文 → 已保存。
2. 打开图谱 → 出现该笔记节点与指向双缝实验的边。
3. 对该笔记执行概念抽取（POST `/concepts/extract`）→ 概念「光的干涉」建立，初始 mastery=0。
4. 进入星系 → 若该笔记出度≥2 成为星球，卫星归属正确；孤立时为独立星球。
5. 发起学习事件 / 复习打分 → 右栏掌握度 tab 数值上升；TopBar 无到期时复习徽章不亮。
6. 数日后（可手工把 review 记录 due 改到昨天）→ TopBar 徽章亮起数字。
7. 完成复习打分 → 徽章清零；SM-2 interval/ease 变化可在 `/review/history` 核对。
8. 向 Tutor 提问「双缝实验为什么能证明波动性」→ 回答**不含最终答案式灌输**、引用了本库概念（记忆感知上下文），流式渲染正常。
9. 删除该笔记 → 图谱节点、概念关联、卫星归属同步消失，星系重新推导正确。

**场景 B：导图闭环**
1. 从场景 A 笔记生成导图 → 节点/边出现。
2. 给节点绑定概念 → 该节点颜色反映掌握度通道。
3. 导出 JSON → 删除导图 → 导入 → 画布一致。

**场景 C：全量导出 → 重建 → 还原**
1. `/export` 导出快照 → 记录文件（zip 含 vault + attachments + mind_maps +
   metadata/eventlogs + **concepts.json 概念/掌握度快照** + 脱敏 settings）。
2. 清空 vault+DB，用 `notes/import` + 导出件重建（import 会自动暂存
   concepts.json，随后 `admin/reindex` 恢复概念/掌握度并回放事件日志）。
3. 核对：笔记数、链接、概念、掌握度、复习记录与快照一致（reindex 正确性）。
   **自动化守护**：`tests/unit/test_export.py::TestExportRebuildClosedLoop`
   （闭环一致性 + 二次 reindex 幂等）；脚本 `scripts/scenarios_bc_closed_loop.py`
   场景 C 全步可复跑（2026-08-31 修复后 15/15）。

**场景 D：离线与本地优先**
1. 停掉后端 → 前端各视图错误态友好（错误条/空态），不白屏不崩溃。
2. 恢复后端 → 同步指示回到「已同步」，数据可继续写入。

---

## 6. 同步闭环（双设备模拟）

> 自动化主体：`tests/integration/sync/test_sync_closed_loop.py`（闭环）、`test_sync_simulation.py`（模拟）、`test_e2e_demo.py`；HTTP 层 `tests/api/test_sync_http.py`；单元 8 个 `test_sync*.py`。

**[自动] 必须全绿**
- 配对：pair → peers 列表 → 删除设备。
- 发现：discover 找到同库 peer。
- 计划与接收：manifest diff → plan 产生 op 列表 → receive 应用 → 双端 manifest 一致。
- 冲突：同文件双端改 → status 报冲突 → resolve（保留任一/合并）→ 冲突清零。
- 恢复：中断传输后重跑 plan 可续传（test_sync_recovery）。
- 边界：路径穿越（`/files/../`）被拒、越权文件不可读（boundary audit）。

**[手动] 双实例演练（起两个后端指向两个 vault 目录）**
1. 设备 A 改笔记并保存 → A manifest 更新；B 执行 plan/receive → B 前端打开同一笔记内容一致。
2. 双端同时改同一笔记 → B 端同步指示出现冲突计数 → 在 SyncStatusPanel 解决 → 双端一致。
3. 全程 Frontend TopBar 同步态正确反映以上每一步。

---

## 7. AI 边界与安全

**[自动]**（全部必须常绿，任何放宽即为 P0 回归）
- `test_ai_boundary.py` / `test_prompt_builder.py` / `test_tutor_prohibition.py`：AI 不给替代思考的答案、prompt 含禁令、输出过滤。
- `test_secret_guards.py`：密钥不落库、不进导出、不进日志、settings 不回显明文。
- `test_llm_provider.py` / `test_openai_provider.py`：provider 抽象、超时、错误降级。

**[手动]**
1. settings 页面与 `/export` 结果中 grep 无 api_key 明文。
2. Tutor 回答抽查 3 次：不直接给作业式答案、不炫技（产品原则 3）。

---

## 8. 性能与 a11y 契约验收

> 契约来源 `ui/UI_DESIGN.md` §9–10（冻结）。**[手动]**，用 Chrome DevTools Performance/Lighthouse。

| 项 | 通过线 | 验证方法 |
|---|---|---|
| 画布帧率 | 单 rAF、约 30fps 节流 | Performance 录制星系/图谱 10s，无逐帧 DOM 重建、无 box-shadow 动画 |
| dpr | Hero/全屏 ≤1.5，卡片 =1 | canvas 尺寸检查 |
| 静止休眠 | 离屏/隐藏 tab 暂停 rAF | 切 tab 后 Performance 无绘制活动 |
| LCP / CLS | LCP ≤2.5s（基线 468ms）、CLS ≤0.1（基线 0.0003） | Lighthouse |
| 对比度 | 正文 ≥4.5:1；品牌色作文字用 `--brand-text` | DevTools 吸管 + 计算器 |
| 键盘可达 | 全部交互可 Tab 到达，focus ring 2px brand | 纯键盘走查 V1–V8 |
| 触摸目标 | ≥44px | DevTools 尺寸检查 |
| reduced-motion | 系统开启后动效全停 | 系统「减弱动态效果」开启后走查 |
| lang | `lang="zh-CN"` | html 元素检查 |

---

## 9. 验收标准与报告模板

**全量验收通过 = 以下全部满足：**
1. §2 一键 Gate 四项全绿（pytest / vitest / tsc / build）。
2. §3 矩阵中每个端点的 N 类用例有自动化归属且通过；⚠️ 缺口项已立项补测。
3. §4.2 V1–V10 手动脚本逐条通过（记录偏离项）。
4. §5 场景 A–D 全部通过（场景 A 为发布阻断项）。
5. §6 同步闭环：自动全绿 + 双实例演练通过。
6. §7 安全项零放宽。
7. §8 契约逐项达标或记录豁免理由。

**报告模板（结果回填 `docs/audit/` 新建报告或 Gate Report）**

```
# Full-Loop Test Report — YYYY-MM-DD · HEAD <hash>
Gate: pytest __/__ · vitest __/__ · tsc PASS/FAIL · build PASS/FAIL
API 矩阵: __ 端点全绿 · 缺口: [列出 ⚠️ 项]
手动 E2E: V1-V10 __ 通过 / __ 偏离（附证据截图/录屏编号）
闭环场景: A[ ] B[ ] C[ ] D[ ]
同步演练: [通过/失败 + 说明]
安全: [零放宽 / 例外清单]
性能 a11y: [达标项 / 豁免项]
结论: PASS / PASS-with-notes / FAIL（阻断项列出）
```

---

### 附：已知偏差（测试时按现状核对，勿误报）

- 复习打分键盘为 **1/2/3 三档**（映射 SM-2 1/3/5），UI_DESIGN「1–4」待裁决统一。
- 编辑器工具栏当前仅「插图/PDF」一项；文字格式依赖 Markdown 语法与快捷键。
- `views/placeholders.tsx` 中 4 个占位视图已无引用（MindMap/Tutor/Review/MemoryDashboard 真实实现均已存在），属待清理死代码，不参与测试。
- MiSans 字体子集未引入，当前回落 Inter/系统字体。
