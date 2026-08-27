# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **M4-B Prompt Assembly**：build_prompt() 纯函数 Prompt 编排层 ·
  TutorContext TypedDict（NotRequired 支持不完整上下文）· TutorMode Literal 类型 ·
  四模式 system prompt（explain/hint/review/debug fallback）·
  双重安全过滤（字段名黑名单 + 内容前缀替换）·
  字符级 token 截断（constants.py 冻结常量）·
  16 个纯函数单元测试 · prompt-contract.md 契约文档

### Added
- **ADR-015 Multilingual Knowledge Support**：多语言知识支持原则冻结 ·
  Content language independent · Concept 层 language+aliases ·
  Tutor 输出语言自适应 · Token 估算多语言扩展位 · language-contract.md

### Added
- **Gate 1 AI Boundary Audit**：M4-C 前置安全审计 · 25 个边界测试 ·
  Context Isolation · Prompt Purity · LLM Write Boundary · Provider Isolation ·
  Multilingual Boundary · Edge Cases · 6/6 PASS · M4-C 施工红线冻结

### Added
- **M4-C LLM Provider**：ProviderProtocol 统一接口 · MockProvider 测试用 ·
  TutorService 业务层（Context→Prompt→Provider→Response）·
  Provider 错误类型（Timeout/Error/Unavailable）· 14 个单元测试

### Added
- **M4-D Tutor Panel**：Context-aware Tutor 面板 · TutorPanel.tsx ·
  Concept Context + Mastery Bar + Mistakes + Related ·
  三动作模式（Explain/Hint/Review）· Structured Answer 渲染 ·
  连接 /tutor/test endpoint · npm run build 通过

### Added
- **M4-C Smoke Test**：POST /api/v1/tutor/test 全链路验证端点 ·
  Context→Prompt→MockProvider→Response 闭环测试 · 5 个集成测试

### Added
- **ADR-016 Tutor UI Design**：Tutor 界面设计宪法冻结 ·
  Knowledge Assistant Panel（非聊天机器人）· 禁止清单（avatar/bubble/typing/魔法按钮）·
  三动作模式（Explain/Hint/Review）· 结构化输出格式

### Added
- **M4-Preflight Hardening (H1-H6)**：FTS5 输入清洗（双引号包裹）·
  create_note 校验前移 · learning_events.detail 列（quality only）·
  SM-2 时间参数化（UTC）· 9 新测试 · Dashboard 去 emoji

### Added
- **ADR-014 AI Tutor Architecture**：AI Tutor 架构冻结 · 读写边界铁律 ·
  Context Builder 唯一组装点 · Provider 策略（复用 ADR-003）·
  M4 四阶段拆分（Context API → Prompt → LLM → UI）·
  docs/data-model/tutor-context.md 上下文可见性契约

### Added
- **ADR-013 Frontend Design System**：Minimal Scientific Workspace 设计宪法 ·
  白橙主题冻结 · 三栏布局设计冻结 · 图标/组件/动画约束 ·
  AGENTS §16 AI 前端生成规则 · docs/design/UI_REFERENCE.md 视觉参考边界

### Added
- **M5 Review Loop**：ensure_concept_learning_state() 概念触达自动初始化 ·
  review_today 优先级排序（wrong→low mastery→early due）· 错答提升优先级 ·
  GET /review/history 学习时间线端点 · Dashboard 时间线视图 ·
  004_learning.sql ON DELETE CASCADE 修复 · learning-model.md 数据模型契约冻结

### Added
- **M0.5 AI Context Infrastructure**：AI 开发流程外部长期记忆层——
  `docs/ai/PROJECT_MEMORY.md`（永久记忆 <200行）· `CURRENT_STATE.md`（实时状态快照）·
  `ACTIVE_TASK.md`（工作记忆/子任务范围）· `SESSION_PROTOCOL.md`（AI 启动协议）·
  `ADR_INDEX.md`（12 个 ADR 索引，按需展开）· AGENTS §15 AI Context Loading Rules

## [0.2.0] - 2026-08-26

### Added
- **M3 Learning Graph**：四维掌握度引擎（knowledge/practice/recall/transfer, 权重 0.35/0.30/0.20/0.15）·
  SM-2 独立复习调度器（可替换为 FSRS/Leitner）· 6 API 端点（mastery CRUD + review/today + weak-list）·
  Dashboard 仪表盘（今日复习 + 掌握度进度条）· migration 004（concept_mastery/learning_events/review_queue）
- **M3.5-A Knowledge Radar MVP（全知领域 Phase A）**：GET /knowledge/suggest 上下文匹配端点 ·
  KnowledgeRadar.tsx 组件（debounce 500ms，Ctrl+Shift+K 唤起）· ADR-012 编辑器上下文感知架构
  （Scope Boundary + Evolution Path + Rejected Alternatives）· 零新依赖零新表

### Changed
- **项目里程碑**：M0 ✅ → M1 ✅ → M2 ✅ → M3 ✅ → M3.5-A ✅

### Added
- **M2 双链·反链·图谱**：[[wikilink]] 解析 + concept 桩自动创建/升级 + 统一 links 表索引
  + 反链 API（GET /notes/{id}/backlinks）+ 级联删除 + 图谱读模型（递归 CTE，depth 1~3）
  + React Flow 基础图谱（@xyflow/react 12，只读/单击跳转/双击局部展开/领域过滤）
  + NoteEditor 反链面板 + 全文搜索框（FTS5+LIKE fallback）+ 跨视图聚焦
  + 桩生命周期（migration 003：concepts.status unconfirmed→active）
  + 附件路径守卫（禁止盘符/file://）+ rebuild 幂等
- **测试基础设施**：tests/api/ 三层体系（unit/api/smoke）· scripts/test.ps1 一键入口 ·
  AGENTS §13 测试规范 + §14 Windows 红线（禁止 Invoke-RestMethod UTF-8）
- **M3.5-A Knowledge Radar MVP（全知领域 Phase A）**：GET /knowledge/suggest 上下文匹配端点 ·
  KnowledgeRadar.tsx 组件（debounce 500ms，Ctrl+Shift+K 唤起）· ADR-012 编辑器上下文感知架构
- **架构评审落地**：ADR-009 Entity/Document 边界 · ADR-010 AI Context Architecture
  （Router 禁直连 LLM，RAG 仅作 Builder 数据源）· ADR-011 中文搜索延后
  （unicode61 起步，拒现阶段 jieba）· PRODUCT_PRINCIPLES.md 五条产品原则 ·
  LICENSE Apache-2.0 · 六个月禁令清单显式化
- **项目重定位：Open Learning OS（开源 AI 学习型知识操作系统）**：双语北极星定位/
  三类用户画像/不做清单；CONTRIBUTING.md；根目录 PROJECT_BRIEF.md 决策资料包；
  宪法新增「用户数据永不锁死」「AI 调用边界」「Entity vs Document」红线与设计三问
- **ADR-008 知识图谱数据模型冻结**（M1.5）：Node=类型化 Entity（note/concept，预留
  code_symbol 等）；`[[wiki链接]]` 三级解析规则与附件路径政策；图谱分层铁律入宪法；
  M2 拆分为 M2-A~E 五个子里程碑
- **M1 知识库核心**：notes CRUD（vault/.md 为真相 + sha256 增量索引 + frontmatter tags）·
  附件上传/回读（20MB 白名单）· FTS5 检索端点 · Core 层 knowledge.py 首次入驻 ·
  shared/types 契约目录 + pytest 形状锁定 · TipTap(v3)+KaTeX 数学渲染编辑器 ·
  图片内嵌渲染（@tiptap/extension-image，ECR 获批后接入）· pytest 18 绿
- **M0 双端脚手架**：FastAPI（app 包 + migrations runner + settings/health API + 统一错误契约
  `{error:{code,message}}` + lifespan 启动迁移）· Vite React TS（Zustand + 六视图占位 +
  api client）· workspace 目录自动创建
- 必读文档体系：docs/architecture/principles.md · docs/dependencies/dependency-policy.md ·
  docs/security/network-boundary.md · docs/version-control/git-policy.md（自 POLICY.md 更名）
- 任务列表与完成报告制度 docs/tasks/TASKS.md（里程碑总览/报告模板/挂起区）
- 本地归档区 `_local/` 与实验沙盒 `sandbox/` 约定（仅存本机，gitignore）
- 工程宪法 AGENTS.md（能力复用优先级链、依赖纪律、架构红线、数据所有权分离、
  版本控制规则、架构检查十问、[ARCHITECTURE WARNING] 与 [ENVIRONMENT CHANGE REQUEST] 协议）
- 技术设计基线 docs/TECH_DESIGN.md（架构 / SQLite DDL / 掌握度引擎 /
  AI Tutor 管线 / Mind Map 系统 / 可视化系统 / API / 里程碑）
- ADR-001 存储分层 · ADR-002 思维导图存储 · ADR-003 LLM 接入 · ADR-004 依赖管理 ·
  ADR-005 局域网同步模型（文件真相/manifest 对比/冲突双份/token 配对）·
  ADR-006 移动端技术栈（RN + 混合内核 + 双端一致性门禁）·
  ADR-007 d3-force 单模块例外 · integration-upmark.md 联动计划（挂起）
- docs/dependencies/REGISTRY.md · dependency-policy.md · docs/version-control/git-policy.md ·
  docs/data-model/INDEX.md · docs/environment.md 环境治理 · separation.md 分层架构规范

### Changed
- **项目重定位**为 Open Learning OS：桌面(Tauri)+移动(RN Android 先行)+LAN 同步多端形态；
  浏览器降级为开发视图，App-first 数据规约自第一天生效
- **数据模型统一**：三张旧关系表并入多态 links 表（migration 002，ADR-008）；DDL 补 concepts.origin
- **可视化系统定稿**：§8.1 Knowledge Universe=学习反馈可视化奖励层（掌握三色编码/
  features/universe 模块/universe-layout 设备缓存/动效治理）· §8.2 Learning Trace Engine（M9-M10）
- 里程碑重排：M2 拆分 A~E · M7 LAN Sync · M8 Mobile MVP · M9-M10 可视化
- FastAPI 端口支持 `PORT` 环境变量覆盖（默认 8000，与 UpMark 共存时 8100）
- API 全面版本化：`/api` → `/api/v1`
- 依赖：运行时合计 Python 4（fastapi/uvicorn/python-multipart）+ Web 13；
  Framer Motion 进否决表；d3-force 批准（M3b 安装）
