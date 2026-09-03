# 决策记录 · History

> 本页是**当前仍影响纯后端的事实**提炼，历史过程完整保留在 Git 与 `docs/archive/`。
> 原则：保存"决策"，不保存"过程垃圾"。

## 仍生效的关键决策（ADR 摘要）

| 决策 | 结论 | 现状 |
|---|---|---|
| ADR-001 存储 | Markdown vault 是正文唯一事实源；SQLite 是可重建缓存 | 生效 |
| ADR-002 mindmap | 导图结构唯一事实源为 `*.mindmap.json` 旁车；md 大纲段是派生视图 | 生效 |
| ADR-003 LLM | 仅 OpenAI-compatible HTTP 接口（含 Ollama），settings 驱动，代码不感知厂商 | 生效 |
| ADR-004 dependency | 依赖政策 + 注册表 | 生效 |
| ADR-005 多端同步 | 凡跨设备可见状态以文件存在于 workspace；db/settings/API key 不参与同步 | 生效 |
| ADR-008 图分层 | 图计算归 Core；UI 仅渲染 | 生效（前端渲染已移除） |
| ADR-009 Entity/Document | 概念/实体为知识对象，非文件关键词搜索 | 生效 |
| ADR-010 AI 上下文 | Router 禁直连 LLM；提示词组装经 Context Builder；RAG 只是给 Builder 加数据源 | 生效 |
| ADR-011 / 027 中文搜索 | FTS5 + CJK bigram 应用侧预分词；010_fts_bigram 全量 reindex | 生效（027 取代 011） |
| ADR-020 sync 真相 | 同步以文件为真相模型 | 生效 |

## 里程碑（后端事实面）

- **M0** 脚手架：FastAPI + migration runner + workspace 分离。
- **M1** 知识库核心：notes CRUD + 附件 + FTS5。
- **M2** 双链 · 图谱：wikilink + 反链 + 图谱读模型。
- **M2b** 思维导图：节点/边 CRUD + 概念绑定 + 导入导出 roundtrip。
- **M3** 学习图谱：四维掌握度 + SM-2 复习 + 复习会话。
- **M4** AI Tutor：上下文感知 Tutor + SSE 流式 + 对话持久化。
- **M6** 桌面分发（Tauri）：后端以 sidecar（PyInstaller onefile）被调用——**纯后端化后保留后端打包能力，UI 壳已移除**。
- **M7** LAN Sync：全链闭环 E2E。
- **M9** Visual Engine：tracer/API/步进组件后端就绪；渲染管线随前端移除（见 features §13 PARTIAL）。

## 近期里程碑（前端为主，已进入纯后端化）

P0~P8 阶段主要完成前端接线、FTS 选型、联调契约与 UI/UX 打磨（Bright UI Assembly）。
**2026-09 纯后端化**：移除 `web/` `ui/` `shared/types/`，收敛为纯后端可独立运行、测试、打包的项目。

## 前端移除说明

纯后端化清理（只读盘点后执行）删除：
`web/`（React/Vite/Tauri UI 工程）、`ui/`（设计稿/原型/可视化）、`shared/types/`（前后端共享 TS 契约目录）、
`_backup/` `_local/` `sandbox/`（本地 UI 归档/实验）。后端对 `shared/types` 无功能依赖（仅注释提及，已同步修正 `contract_audit.py`）。
`server/backend_main.py` 与 `server/plos_backend.spec` 为后端打包能力，保留。

> 完整决策与演进见 `docs/ai/`、`docs/adr/`、Git 历史。
