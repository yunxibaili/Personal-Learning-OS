# 依赖注册表（Dependency Registry）

> 政策流程详见 `docs/dependencies/dependency-policy.md` · `AGENTS.md` §2 · ADR-004。
> **任何新增第三方依赖必须先通过六连问审查，再按下方模板登记于本文件，答不全不准合入。**
> 已否决备选清单：`docs/TECH_DESIGN.md` §3.2（禁止回潮）。

## 登记模板

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

## 运行时依赖（当前全集）

| 包 | 版本策略 | 用途 | License | 为何标准库不够 | 维护状态 |
|---|---|---|---|---|---|
| fastapi | 锁定于 requirements.txt | Web 框架 + 校验 | MIT | stdlib http.server 无路由/校验/异步，手写即自研轮子 | 活跃 |
| uvicorn | 同上 | ASGI server | BSD-3 | stdlib 无 ASGI 支持 | 活跃 |
| react / react-dom | 锁定于 package.json | UI | MIT | 浏览器无声明式组件模型 | 活跃 |
| zustand | 同上 | 全局状态 | MIT | React context 高频更新性能不足；已否决 redux/mobx 等 | 活跃 |
| katex | 同上 | LaTeX 渲染 | MIT | 平台无数学排版能力；MathJax 更慢已否决 | 活跃 |
| marked | 同上 | Chat 消息 md→html | MIT | 手写 Markdown parser 属禁令清单 | 活跃 |
| @xyflow/react | **v12.11.5**（2026-08-26 M2-E 安装） | 图谱画布 + 思维导图编辑器（**仅渲染，不含图计算/布局**，ADR-008） | MIT | 图布局/拖拽/缩放自研=大轮子；Cytoscape API 陈旧、D3 渲染模块禁令 | 活跃 |
| @tiptap/react · @tiptap/pm · @tiptap/starter-kit | 同上 | 笔记编辑器内核 | MIT | textarea 无法支撑双链交互/代码块按钮；裸 ProseMirror 太底层 | 活跃 |
| @aarkue/tiptap-math-extension | 同上 | `$...$` 行内/块级 LaTeX | MIT | TipTap 官方 math 扩展为付费 Pro | 社区维护 |
| d3-force | **3.0.0**（2026-08-27 P8-001B 安装） | 力导向布局物理计算（Knowledge Universe，§8.1） | ISC | JS 无内置物理模拟；React Flow 无布局器；手写版调参成本高（六连问全文见 ADR-007） | 活跃（已安装） |
| tiptap-markdown | **0.9.x · TipTap v3 线**（2026-08-26 实装） | TipTap JSON ↔ Markdown 双向转换（仅编辑器适配层） | MIT | PM 序列化自研=重复造轮子；TipTap v3 官方 MD 扩展与 v2 生态兼容性未证实。ECR 已获批准（2026-08-26），Status: Approved for M1 Knowledge Editor | 社区维护 |
| python-multipart | 锁定 requirements.txt | multipart/form-data 解析（附件上传 UploadFile 必需件） | Apache-2.0 | FastAPI 文件上传的官方配套；无替代即无法实现已批 M1 计划第 4 条 | 活跃 |
| @tiptap/extension-image | v3 线（M1，ECR 获批 2026-08-26） | 图片节点：`![alt](src)` markdown 往返与内嵌渲染 | MIT | StarterKit 无图片节点；无 schema 节点时 md 图片语法会在编辑往返中丢失 | 活跃 |
| cobe | **^0.6.5**（2026-08-27 P8-001C 安装） | Knowledge Planet 点阵地球 WebGL 渲染（首页可视化） | MIT | 纯 CSS/SVG 散点球需手动维护数百坐标点且效果差；three-globe 依赖链重（30x+ 体积）。cobe 5KB 单文件即达 MiMo 风格点阵效果。**性能边界**：dpr=1 + 30fps 节流 + IntersectionObserver/visibilitychange 暂停，CPU 需保持 <10%（sandbox/cobe-test-math.html 已验证遮挡数学） | 活跃 |

> tiptap-markdown 边界（批准附带）：**禁止作为任何存储格式**——数据真相永远是 `vault/` 的 .md 文件；
> 数据库只保存 metadata/index/relations/learning state，不保存 TipTap JSON（除非未来 ADR 单独批准）。

## 开发依赖

vite · typescript · vitest · pytest · @vitejs/plugin-react · @types/*
（仅构建期，不进入运行时 footprint）

## 规划中依赖（触发条件达成前禁止安装）

| 包 | 用途 | 触发条件 |
|---|---|---|
| react-native · expo · expo-sqlite 等 RN 系 | 移动客户端（ADR-006） | M8 启动 |
| Monaco | 代码编辑 | Phase 5 IDE |
| SymPy / Jupyter | 数学计算 | Phase 5 IDE |
| Tree-sitter / LSP 系 | 代码分析 | Phase 5 IDE |
| Docker | 执行沙箱 | Phase 5 IDE |
| sqlite-vec + 云端 embedding API | 向量检索 | 概念数 >2000 或匹配质量不足 |
| （UpMark 联动如需 HTTP 工具库） | 桥接客户端 | 解挂 integration-upmark.md 时评审；默认标准库 urllib 即可 |

## 审计记录

| 里程碑 | 日期 | 动作 |
|---|---|---|
| （首次审计于 M1 结束时填写） | | |
