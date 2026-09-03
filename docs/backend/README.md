# Backend 技术档案 · Personal Learning OS

> 本目录是**纯后端**的权威技术档案。代码事实 > Git 历史 > 旧文档。
> 前端（`web/`、`ui/`、`shared/types`）已按 2026-09 纯后端化清理移除，本文不再描述任何前端运行时。

## 档案索引

| 文档 | 内容 |
|---|---|
| [README](README.md) | 本页：项目是什么、如何运行、目录结构 |
| [architecture](architecture.md) | 分层架构、请求数据流、模块地图 |
| [technology](technology.md) | 技术栈、真实依赖、工程约束 |
| [features](features.md) | 全部后端功能档案（背景/问题/作用/位置/状态） |
| [data-model](data-model.md) | 数据模型：22 张表 · migration · vault 事实源 · FTS |
| [api](api.md) | API 契约：93 端点 · 错误形状 · SSE 流式 |
| [testing](testing.md) | 测试体系：四条管道 · 1000+ 用例 · 如何运行 |
| [runtime](runtime.md) | 本地运行 · 环境变量 · 打包（PyInstaller sidecar） |
| [history](history.md) | 决策记录提炼（ADR 摘要 · 里程碑） |

## 项目是什么

Personal Learning OS（Open Learning OS）是一个**本地优先**的 AI 学习系统后端。
它把开放 Markdown 知识库（vault）当作唯一事实源，在 SQLite 之上建立：
知识图谱 · 学习记忆（四维掌握度 / SM-2 复习 / 错误本 / 记忆感知 AI Tutor）·
LAN 多端同步 · 代码执行可视化追踪。

核心价值不是"记录信息"，而是**帮助用户学会信息**。

**数据铁律**（ADR-001 / ADR-005）：
- `workspace/vault/**` 的 Markdown 是正文唯一事实源；
- SQLite（`workspace/db/learning-os.db`）只是**可重建的本地缓存**（元数据 / 索引 / 学习状态）；
- 任何跨设备可见状态必须以文件形式存在于 workspace（md / 旁车 json / eventlogs jsonl）；
- 用户数据永不锁死：随时可一键全量导出。

## 运行方式（见 [runtime](runtime.md)）

```bash
cd server
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# 或：python -m app.main          # 读取 PORT（默认 8000）
```

## 目录结构

```
learning-os/
├── server/               # 后端本体
│   ├── app/
│   │   ├── main.py       # FastAPI 工厂 + lifespan + 错误处理 + health
│   │   ├── db.py         # 唯一允许触碰 SQLite 的模块（connect/init_db/migrations）
│   │   ├── routers/      # 21 个 router（/api/v1/* 校验层）
│   │   └── core/         # 业务层（不 import FastAPI；AI/sync/tracer 子包）
│   ├── tests/            # 全部 pytest：unit/ api/ integration/ + 根级
│   ├── migrations/       # 纯 SQL migration（001_init ~ 010_fts_bigram）
│   ├── backend_main.py   # 打包态入口（PyInstaller onefile / Tauri sidecar）
│   ├── plos_backend.spec # PyInstaller 打包配置
│   ├── requirements.txt  # 运行依赖（fastapi/uvicorn/python-multipart）
│   └── requirements-dev.txt  # 测试依赖（pytest/httpx）
├── scripts/              # 后端运维/验证脚本（闭环 scenario / contract_audit / seed_demo）
├── docs/                 # 治理文档（本 backend/ 为权威档案）
├── workspace/            # 用户私有数据（gitignore，永不入库）
└── README.md
```

> `workspace/` 是用户数据根（默认路径，可用 `WORKSPACE_DIR` 覆盖），整体 `.gitignore`，
> 绝不入库。本档案不修改、不依赖 workspace 之外的任何数据。
