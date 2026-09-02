# Dependencies — 依赖登记与审查

> 依赖登记册与引入审查流程。合并自原 `docs/DEPENDENCIES.md` 下的两份文档。
**后端优先阶段**：新增前端依赖在后端 backlog 清零前一律不予受理。

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

| 包 | 版本策略 | 用途 | License | 为何标准库不够 | 维护状态 |
|---|---|---|---|---|---|
| fastapi | 锁定于 requirements.txt | Web 框架 + 校验 | MIT | stdlib http.server 无路由/校验/异步，手写即自研轮子 | 活跃 |
| uvicorn | 同上 | ASGI server | BSD-3 | stdlib 无 ASGI 支持 | 活跃 |
| react / react-dom | 锁定于 package.json | UI | MIT | 浏览器无声明式组件模型 | 活跃 |
| zustand | 同上 | 全局状态 | MIT | React context 高频更新性能不足；已否决 redux/mobx 等 | 活跃 |
| katex | 同上 | LaTeX 渲染 | MIT | 平台无数学排版能力；MathJax 更慢已否决 | 活跃 |
| @xyflow/react | **v12.11.5**（2026-08-26 M2-E 安装） | 图谱画布 + 思维导图编辑器（**仅渲染，不含图计算/布局**，ADR-008） | MIT | 图布局/拖拽/缩放自研=大轮子；Cytoscape API 陈旧、D3 渲染模块禁令 | 活跃 |
| @tiptap/react · @tiptap/starter-kit | 同上 | 笔记编辑器内核（~~@tiptap/pm~~ 已于 v0.1.0-rc.1 移除） | MIT | textarea 无法支撑双链交互/代码块按钮；裸 ProseMirror 太底层 | 活跃 |
| @aarkue/tiptap-math-extension | 同上 | `$...$` 行内/块级 LaTeX | MIT | TipTap 官方 math 扩展为付费 Pro | 社区维护 |
| tiptap-markdown | **0.9.x · TipTap v3 线**（2026-08-26 实装） | TipTap JSON ↔ Markdown 双向转换（仅编辑器适配层） | MIT | PM 序列化自研=重复造轮子；TipTap v3 官方 MD 扩展与 v2 生态兼容性未证实。ECR 已获批准（2026-08-26），Status: Approved for M1 Knowledge Editor | 社区维护 |
| python-multipart | 锁定 requirements.txt | multipart/form-data 解析（附件上传 UploadFile 必需件） | Apache-2.0 | FastAPI 文件上传的官方配套；无替代即无法实现已批 M1 计划第 4 条 | 活跃 |
| @tiptap/extension-image | v3 线（M1，ECR 获批 2026-08-26） | 图片节点：`![alt](src)` markdown 往返与内嵌渲染 | MIT | StarterKit 无图片节点；无 schema 节点时 md 图片语法会在编辑往返中丢失 | 活跃 |
| dagre | **^0.8.5**（2026-08-28 P8-002 安装） | Graph V2 层级布局引擎（dagre 拓扑排序 + 坐标分配，ADR-023 Graph 边界） | MIT | TS 标准库无图布局能力；d3-force 做力导向不做层级（ADR-007 仅批准 d3-force 单模块）；React Flow 无内置布局器；手写拓扑排序+坐标分配属重复造轮子 | 稳定（功能完整，低活跃维护） |

> tiptap-markdown 边界（批准附带）：**禁止作为任何存储格式**——数据真相永远是 `vault/` 的 .md 文件；
> 数据库只保存 metadata/index/relations/learning state，不保存 TipTap JSON（除非未来 ADR 单独批准）。

### 已移除依赖（审计存档）

| 包 | 原用途 | 移除版本/commit | 原因 |
|---|---|---|---|
| d3-force 3.0.0 | 力导向布局（P8-001B Universe V2，ADR-007 唯一例外） | v0.1.0-rc.1（`dd4f40c` 删代码、`13fa1bc` 卸依赖） | P8-001B 实现整体废弃，Universe 改自研 Canvas Galaxy；ADR-007 已标 Superseded |
| cobe ^0.6.5 | 点阵地球 WebGL（P8-001C Knowledge Planet） | v0.1.0-rc.1（同上） | P8-001C 实现废弃；点阵地球视觉定稿改入 ui 库（`ui/dot-earth.html`） |
| @tiptap/pm | TipTap 传递修正 | v0.1.0-rc.1（`13fa1bc`） | 未使用 |
| marked | ——（**从未安装**，登记有误） | 2026-09-02 审计更正 | Markdown 序列化由 tiptap-markdown 的传递依赖 markdown-it 承担 |

### 依赖审计记录

**2026-09-02 · P8 收尾审计（AGENTS §17 §五.1）**
- web：package.json 10 个 dependencies 全部有真实 import（逐包 grep 计数）；devDeps 全部为
  工具链本体；`npm ls --package-lock-only` 与 lockfile 一致 → **零未使用、零缺失声明**。
- server：requirements.txt 3 项均有据（fastapi 39 处 import · uvicorn 启动入口
  `main.py:126` · python-multipart 为附件上传 UploadFile 必需件）；dev（pytest/httpx）
  37 个测试文件使用 → **零未使用**。starlette/pydantic 为直接 import 的 fastapi
  传递依赖（声明策略：随 fastapi 传递，不单独声明，风险低）。
- 本轮（M9 + T-NOTE-TREE）**零新增依赖**；REGISTRY 无登记义务变更。
- 结论：依赖集合 = 最小合理集，通过。

### 开发依赖

vite · typescript · vitest · pytest · @vitejs/plugin-react · @types/*
（仅构建期，不进入运行时 footprint）

构建期工具（不进运行时 footprint，随各自工具环境安装）：
pyinstaller 6.22.2（server/.venv；P0-2b 桌面 sidecar 打包，2026-09-03）

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

