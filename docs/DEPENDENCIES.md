# Dependencies — 依赖登记与审查

> 依赖登记册与引入审查流程。合并自原 `docs/DEPENDENCIES.md` 下的两份文档。
**纯后端阶段（v0.1.0-rc.3 起）**：仓库已不含任何前端载体（`web/` `ui/` `shared/types/` 已移除），
不存在 `package.json` 与 npm 依赖树；新增前端依赖一律不予受理。

---

## 目录

1. [依赖政策（Dependency Policy）](#1-依赖政策-dependency-policy)
2. [依赖注册表（Dependency Registry）](#2-依赖注册表-dependency-registry)

---

## 1. 依赖政策（Dependency Policy）

> 流程权威来源。登记数据见 `docs/DEPENDENCIES.md`；
> 原则背景见 `docs/adr/principles.md` 与 ADR-004；纪律摘要见 `AGENTS.md` §2。

日期：2026-08-26 · 状态：Accepted

### 引入流程

```
产生需求
  ↓ Dependency Review 六连问（依次检查，任一成立即止）
① Python/TS/Rust 标准库能做？
② 已有依赖能做？
③ 项目内已有类似实现能做？
④ 有成熟活跃开源可直接复用？
⑤ 组合已有能力能解决？
⑥ 确需新包 → 值得长期维护成本吗？
  ↓ 全部通过
按模板登记 docs/DEPENDENCIES.md（答不全不准合入）
  ↓
实现 + 在同一批变更中更新相关文档（AGENTS §10 同步义务）
  ↓
里程碑结束时参与依赖审计
```

### 登记模板（13 字段）

Dependency / Version / Purpose / Why needed / Alternatives considered /
Why standard library is insufficient / Why existing dependencies are insufficient /
Why an established open-source implementation is insufficient /
Maintenance status / License / Approximate dependency footprint / Security considerations

### 红线

- **一进一出**：加一个新的运行时依赖时，评估能否同时删除旧的
- **同域唯一方案**：同一能力域只允许一个库；新旧重叠必须先提替换提案，禁止并存
- **禁提前安装**：规划中依赖（Monaco/SymPy/Jupyter/Tree-sitter/Docker/sqlite-vec 等，
  清单见 REGISTRY）在其触发条件达成前不得出现在 package.json / requirements.txt
- 禁止为几十行的功能引入 npm 包、为工具函数引库、为追流行引库

### 依赖审计（每里程碑结束）

检查并处置：未使用 · 功能重复 · 间接依赖意外引入 · 过时 · 高风险(CVE/停维) ·
可被标准库替代 · 可删除。
结果记入 REGISTRY「审计记录」表 + CHANGELOG 条目。

### 目标

**最小的合理依赖集合**——不为数字牺牲可靠性，不为省事堆砌依赖。

---

## 2. 依赖注册表（Dependency Registry）

> 政策流程详见 `docs/DEPENDENCIES.md` · `AGENTS.md` §2 · ADR-004。
> **任何新增第三方依赖必须先通过六连问审查，再按下方模板登记于本文件，答不全不准合入。**
> 已否决备选清单：`docs/TECH_DESIGN.md` §3.2（禁止回潮）。

### 登记模板

```
Dependency:
Version:
Purpose:
Why needed:
Alternatives considered:
Why standard library is insufficient:
Why existing dependencies are insufficient:
Why an established open-source implementation is insufficient:
Maintenance status:
License:
Approximate dependency footprint:
Security considerations:
```

### 运行时依赖（当前全集）

> 自 v0.1.0-rc.3 纯后端化后，运行时依赖 = `server/requirements.txt` 的 3 项，
> **无前端 / npm 依赖**。以下证据为 2026-09-05 实测：AST 精确统计 `import` / `from` 的顶层包名，
> 扫描 `server/` 下 155 个 `.py` 文件。

| 包 | 版本策略 | 用途 | License | 为何标准库不够 | 维护状态 |
|---|---|---|---|---|---|
| fastapi | 锁定于 `server/requirements.txt` | Web 框架 + 校验 + OpenAPI | MIT | stdlib `http.server` 无路由/校验/异步，手写即自研轮子 | 活跃 |
| uvicorn | 同上 | ASGI server | BSD-3 | stdlib 无 ASGI 支持 | 活跃 |
| python-multipart | 同上 | `multipart/form-data` 解析（`app/routers/attachments.py:24` `file: UploadFile = File(...)` 必需件） | Apache-2.0 | FastAPI 文件上传的官方配套；无替代则附件上传无法实现 | 活跃 |

**实测证据（2026-09-05）**
- `fastapi` 53 个文件直接 import；`uvicorn` 2 个（`app/main.py`、`backend_main.py`）
- `python-multipart` **零直接 import**：由 FastAPI 在解析 `UploadFile` / `Form` 时内部调用，
  属**传递必需**，不可移除（移除后附件上传端点即 500）

### 已移除依赖（审计存档）

| 包 | 原用途 | 移除版本/commit | 原因 |
|---|---|---|---|
| **react / react-dom · zustand · katex · @xyflow/react · dagre · @tiptap/react · @tiptap/starter-kit · @tiptap/extension-image · @aarkue/tiptap-math-extension · tiptap-markdown** | 前端 UI、编辑器、图谱渲染、思维导图 | **v0.1.0-rc.3**（`3fe8d13` 纯后端化） | `web/` 整体移除，前端载体不再存在；依赖随之退役 |
| d3-force 3.0.0 | 力导向布局（P8-001B Universe V2，ADR-007 唯一例外） | v0.1.0-rc.1（`dd4f40c` 删代码、`13fa1bc` 卸依赖） | P8-001B 实现整体废弃，Universe 改自研 Canvas Galaxy；ADR-007 已标 Superseded |
| cobe ^0.6.5 | 点阵地球 WebGL（P8-001C Knowledge Planet） | v0.1.0-rc.1（同上） | P8-001C 实现废弃；点阵地球视觉定稿改入 ui 库（`ui/dot-earth.html`，该库亦已于 rc.3 移除） |
| @tiptap/pm | TipTap 传递修正 | v0.1.0-rc.1（`13fa1bc`） | 未使用 |
| marked | ——（**从未安装**，登记有误） | 2026-09-02 审计更正 | Markdown 序列化由 tiptap-markdown 的传递依赖 markdown-it 承担（该能力已随 rc.3 一并退役） |

### 依赖审计记录

**2026-09-05 · 纯后端化后审计（v0.1.0-rc.3 · AGENTS §17 §五.1）**
- 前提变更：`web/` `ui/` `shared/types/` 已于 `3fe8d13` 移除，仓库**无 `package.json`、无 npm 依赖树**，
  「逐包 grep web 依赖」这一审计动作已失去对象。
- server 运行时：requirements.txt 3 项 —— `fastapi` 53 文件直接 import、
  `uvicorn` 2 文件（`app/main.py` / `backend_main.py`）、`python-multipart` 零直接 import
  但为 `UploadFile` 传递必需 → **零未使用、零缺失声明**。
- server 开发期：`requirements-dev.txt` 2 项 —— `pytest` 37 文件直接 import；
  `httpx` 零直接 import 但为 `fastapi.testclient.TestClient` 传递必需
  （33 个测试文件使用 TestClient）→ **零未使用**。
- 零新增依赖；REGISTRY 无登记义务变更。
- 结论：依赖集合 = **runtime 3 + dev 2**，最小合理集，通过。
- ⚠️ 观察项（P2，不阻塞）：`starlette.testclient` 在导入时发出
  `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead`。
  当前 `httpx 0.28.1` + `starlette 1.6.0` 功能正常（1099 passed），仅告警。
  迁移 `httpx2` 属独立任务，触发条件：starlette 移除 httpx 兼容层。

**2026-09-02 · P8 收尾审计（历史记录，当时仍含前端）**
- ~~web：package.json 10 个 dependencies 全部有真实 import~~ —— **该结论已随 v0.1.0-rc.3
  纯后端化整体失效**（`web/` 已移除），保留仅为历史可追溯，不得作为当前状态引用。
- server：requirements.txt 3 项均有据（fastapi 39 处 import · uvicorn 启动入口
  `main.py:126` · python-multipart 为附件上传 UploadFile 必需件）；dev（pytest/httpx）
  37 个测试文件使用 → 结论仍然成立。starlette/pydantic 为直接 import 的 fastapi
  传递依赖（声明策略：随 fastapi 传递，不单独声明，风险低）。
- 本轮（M9 + T-NOTE-TREE）**零新增依赖**；REGISTRY 无登记义务变更。
- 结论：依赖集合 = 最小合理集，通过。

### 开发依赖

`server/requirements-dev.txt`（仅开发/测试期，不进入运行时 footprint）：
`pytest` · `httpx`（后者为 `fastapi.testclient.TestClient` 的传递必需件，零直接 import）

构建期工具（不进运行时 footprint，随各自工具环境安装）：
pyinstaller 6.22.2（`server/.venv`；后端 sidecar 打包，2026-09-03）

> 纯后端化前的前端工具链（`vite` / `typescript` / `vitest` / `@vitejs/plugin-react` / `@types/*`）
> 已于 v0.1.0-rc.3 随 `web/` 一并移除，不再属于本仓库的开发依赖。

### 规划中依赖（触发条件达成前禁止安装）

| 包 | 用途 | 触发条件 |
|---|---|---|
| react-native · expo · expo-sqlite 等 RN 系 | 移动客户端（ADR-006） | M8 启动 |
| Monaco | 代码编辑 | Phase 5 IDE |
| SymPy / Jupyter | 数学计算 | Phase 5 IDE |
| Tree-sitter / LSP 系 | 代码分析 | Phase 5 IDE |
| Docker | 执行沙箱 | Phase 5 IDE |
| sqlite-vec + 云端 embedding API | 向量检索 | 概念数 >2000 或匹配质量不足 |
| （UpMark 联动如需 HTTP 工具库） | 桥接客户端 | 解挂 integration-upmark.md 时评审；默认标准库 urllib 即可 |

### 审计记录

| 里程碑 | 日期 | 动作 |
|---|---|---|
| （首次审计于 M1 结束时填写） | | |

