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
| @xyflow/react | 同上 | 图谱画布 + 思维导图编辑器 | MIT | 图布局/拖拽/缩放自研=大轮子；Cytoscape API 陈旧、D3 禁令 | 活跃 |
| @tiptap/react · @tiptap/pm · @tiptap/starter-kit | 同上 | 笔记编辑器内核 | MIT | textarea 无法支撑双链交互/代码块按钮；裸 ProseMirror 太底层 | 活跃 |
| @aarkue/tiptap-math-extension | 同上 | `$...$` 行内/块级 LaTeX | MIT | TipTap 官方 math 扩展为付费 Pro | 社区维护 |

## 开发依赖

vite · typescript · vitest · pytest · @vitejs/plugin-react · @types/*
（仅构建期，不进入运行时 footprint）

## 规划中依赖（Phase 5 前禁止安装）

Monaco（代码编辑）· SymPy / Jupyter（数学）· Tree-sitter / LSP（代码分析）·
Docker（执行沙箱）· sqlite-vec + 云端 embedding API（触发条件：概念数 >2000 或匹配质量不足）

## 审计记录

| 里程碑 | 日期 | 动作 |
|---|---|---|
| （首次审计于 M1 结束时填写） | | |
