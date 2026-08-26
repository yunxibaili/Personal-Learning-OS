# Personal Learning OS

Local-first 的 AI 个人学习操作系统：Markdown 知识库 × 知识图谱 × 学习记忆（掌握度/错误/遗忘）× 记忆感知 AI Tutor。

不是笔记软件，不是聊天工具——是一个知道"你学过什么、哪里薄弱、下一步学什么"的学习系统。

## 环境要求

- Python 3.12+
- Node 18+（本机开发验证于 24.x）

## 启动（开发模式）

```bash
# 后端 :8000
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
