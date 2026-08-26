# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **ADR-008 知识图谱数据模型冻结**（M1.5）：Node=类型化 Entity（note/concept，预留
  code_symbol 等）；三张旧关系表统一为多态 `links` 表（migration 002，发布前破坏性整理）；
  `[[wiki链接]]` 三级解析规则与附件路径政策；图谱分层铁律入宪法；
  M2 拆分为 M2-A~E 五个子里程碑
- **M1 知识库核心**：notes CRUD（vault/.md 为真相 + sha256 增量索引 + frontmatter tags）·
  附件上传/回读（20MB 白名单）· FTS5 检索端点 · Core 层 knowledge.py 首次入驻 ·
  shared/types 契约目录 + pytest 形状锁定 · TipTap(v3)+KaTeX 数学渲染编辑器 · pytest 18 绿 ·
  图片内嵌渲染（@tiptap/extension-image，ECR 获批后接入）
- **M0 双端脚手架**：FastAPI（app 包 + migrations runner + settings/health API + 统一错误契约
  `{error:{code,message}}` + lifespan 启动迁移）· Vite React TS（Zustand + 六视图占位 +
  api client）· pytest 6 绿 / vitest 2 绿 / build 通过 · workspace 目录自动创建
- 必读文档体系：docs/architecture/principles.md · docs/dependencies/dependency-policy.md ·
  docs/security/network-boundary.md · docs/version-control/git-policy.md（自 POLICY.md 更名）
- 任务列表与完成报告制度 docs/tasks/TASKS.md（含里程碑总览、M0 拆解、报告模板）
- 本地归档区约定 `_local/`（旧代码/旧文档/临时脚本仅存本机，gitignore）
- 工程宪法 AGENTS.md（能力复用优先级链、依赖纪律、架构红线、数据所有权分离、
  版本控制规则、架构检查十问、[ARCHITECTURE WARNING] 协议）
- 技术设计基线 docs/TECH_DESIGN.md（架构 / SQLite DDL / 掌握度引擎 /
  AI Tutor 管线 / Mind Map 系统 / Visual Engine 预设计 / API / 里程碑 M0–M8）
- ADR-001 存储分层 · ADR-002 思维导图存储 · ADR-003 LLM 接入 · ADR-004 依赖管理
- docs/dependencies/REGISTRY.md 依赖注册表
- docs/version-control/git-policy.md 版本控制策略
- docs/data-model/INDEX.md 数据模型变更索引

### Changed
- 产品定位升级为 Local-first 多端：桌面(Tauri) + 移动(RN, Android 先行) + LAN 同步；
  浏览器降级为开发视图，App-first 数据规约自第一天生效
- 里程碑重排：M7 LAN Sync v1 · M8 Mobile MVP · M9 Visual Engine · M10 AI 可视化
- FastAPI 端口支持 `PORT` 环境变量覆盖（默认 8000，与 UpMark 共存时 8100）

### Added (Architecture Records)
- ADR-005 局域网同步模型：文件为同步唯一真相（md+旁车json+附件+eventlogs jsonl）、
  manifest/sha256 三态对比、冲突保留双份、配对 token 认证、SQLite/settings 永不同步
- ADR-006 移动端技术栈：React Native(Expo)+混合内核——SM-2/掌握度数学移植 TS(~200 行)，
  pytest↔vitest 同夹具一致性测试为合并门禁；AI 走桌面(LAN)或直连云的降级阶梯
- docs/architecture/integration-upmark.md：UpMark 联动计划（错题登记→掌握度→双向出题，
  仅经其 REST 契约桥接）——**挂起中，未排期**
- ADR-007：d3-force 单模块作为 D3 禁令唯一例外（Knowledge Universe 力导向布局）
- docs/architecture/separation.md 分层架构规范（四层职责/接口先行五步/共享类型契约/
  AI 与同步模块隔离）；AGENTS §12 写码前输出协议（8 项清单）
- docs/environment.md 环境治理：版本基线/目录归属六分类/sandbox 即弃实验区/
  里程碑收尾四件事（+环境删除测试+删除优先检查）/ [ENVIRONMENT CHANGE REQUEST] 协议

### Changed
- API 全面版本化：`/api` → `/api/v1`（M0 起生效）
- TECH_DESIGN §8 重构为「可视化系统」：§8.1 Knowledge Universe 视觉层（新里程碑 M3b：
  Galaxy/Explorer/Memory Map 三模式+四维视觉编码）· §8.2 执行轨迹动画（M9-M10）
- DDL：concepts 表补 `origin` 列（manual|ai_suggested）
- 依赖 +1：d3-force（运行时合计 13）；Framer Motion 进否决表
