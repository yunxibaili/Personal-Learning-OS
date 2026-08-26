# Personal Learning OS · Open Learning OS

> **Open Learning OS** is an open-source, local-first AI learning environment that helps people collect knowledge, understand concepts, practice skills, and build long-term memory.
>
> 一个开源、本地优先的 AI 学习操作系统：帮助用户建立知识库、理解概念、练习技能，并形成长期记忆。

核心价值不是"记录信息"，而是**帮助用户学会信息**：
Markdown 知识库 × 类型化知识图谱 × 学习记忆（四维掌握度 / SM-2 复习 / 错误本）× 记忆感知 AI Tutor。

**不做的事**：对标或击败 Obsidian/Notion · 商业 SaaS · 云端绑定 · 用户锁死。
你的数据永远是开放的 Markdown + SQLite，随时可整库带走。

**为谁而做**：备考与自学者（高等数学/编程/考证）· 长期知识库构建者 · 开源贡献者。
架构对三者承诺：文档完善 · 一键运行 · 数据开放 · 可扩展（插件体系已预留设计）。

## 环境要求

- Python 3.12+
- Node 18+（本机开发验证于 24.x）

## 启动（开发模式）

```bash
# 后端 :8000（绑 127.0.0.1；可用 $env:PORT 覆盖，如与 UpMark 共存设 8100）
cd server
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端 :5173（另开终端）
cd web
npm install
npm run dev
```

浏览器访问 http://localhost:5173 。

## 当前进度

📋 任务看板与完成报告：[docs/tasks/TASKS.md](docs/tasks/TASKS.md) —— 当前焦点：**M0 脚手架**
每个里程碑的验收标准见 [docs/TECH_DESIGN.md](docs/TECH_DESIGN.md) §10。

## 目录

```
workspace/ 用户私有数据（vault 笔记 + 附件 + 数据库）——永不入库，路径可在设置中改
server/    FastAPI 后端（SQLite + 学习引擎 + AI）
web/       React 前端
docs/      技术设计唯一来源 + architecture/(principles+ADR) + dependencies/(policy+registry)
           + security/network-boundary + version-control/git-policy + tasks/TASKS
AGENTS.md  工程宪法（强制约束，AI 与人类共同遵守；写码前必读四文件见文首）
CHANGELOG.md 变更日志
```

## 文档

- 技术设计、数据模型、依赖取舍、里程碑：[docs/TECH_DESIGN.md](docs/TECH_DESIGN.md)
- 重大架构决策（ADR）：[docs/architecture/](docs/architecture/)
- 依赖注册表：[docs/dependencies/REGISTRY.md](docs/dependencies/REGISTRY.md)
