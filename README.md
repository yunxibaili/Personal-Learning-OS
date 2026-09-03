# Personal Learning OS · Open Learning OS（纯后端）

> **Open Learning OS** is a local-first AI learning system **backend**. It turns
> an open Markdown knowledge base (vault) into a typed knowledge graph with
> learning memory (4-dimension mastery / SM-2 reviews / mistake log / memory-aware
> AI tutor) and LAN multi-device sync.
>
> 一个开源、本地优先的 AI 学习系统后端：把开放 Markdown 知识库转化为类型化知识图谱，
> 内置学习记忆（四维掌握度 / SM-2 复习 / 错误本 / 记忆感知 AI Tutor）与 LAN 多端同步。
>
> *Your knowledge is not a pile of notes. It is a universe that grows with you.*

核心价值不是"记录信息"，而是**帮助用户学会信息**。
正文事实源永远是开放 Markdown + SQLite 缓存，可在需要时一键全量导出、整库带走。

**2026-09 纯后端化**：前端（`web/` React/Vite/Tauri、`ui/` 设计原型、`shared/types/` 共享 TS 契约）、
本地 UI 归档与实验目录已移除。本仓库现为**可独立运行、测试、打包的纯后端项目**。

**项目说明、架构、功能、依赖、测试、打包的权威档案见 [docs/backend/](docs/backend/README.md)。**

## 环境要求

- Python 3.12+

## 启动 / 运行（开发模式）

```bash
cd server
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# 或：python -m app.main          # 读取 $env:PORT，默认 8000
```

- 只绑定 `127.0.0.1`。
- 端口默认 8000；`$env:PORT=8100` 可覆盖（与 UpMark 共存）。
- 用户数据目录默认 `workspace/`，可用 `$env:WORKSPACE_DIR` 覆盖。

## 数据模型

以 `workspace/` 为用户数据根（整体 `.gitignore`，永不入库）：

```
workspace/
├── vault/            # Markdown 正文 + *.mindmap.json（事实源）
├── attachments/      # 附件
├── metadata/         # 元数据
├── mind_maps/        # 导图导出
└── db/               # SQLite：learning-os.db（可重建缓存）
```

- 正文唯一事实源：`workspace/vault/**/*.md`（ADR-001/005）。
- SQLite（`workspace/db/learning-os.db`）只是可重建的本地缓存。
- 全库 22 张表 + FTS5（CJK bigram，ADR-027）。详见 [data-model](docs/backend/data-model.md)。

## 测试

```bash
cd server
.venv\Scripts\python.exe -m pytest -q               # 全量（基线 1020 通过）
.venv\Scripts\python.exe -m pytest tests/api -q     # 仅 API
.venv\Scripts\python.exe -m pytest tests/unit -q    # 仅 unit
```

一键入口（仓库根）：`.\scripts\test.ps1`（全量/`-Smoke`/`-Watch`）。
关闭闭环与契约：`scripts/scenario_a_closed_loop.py` · `scripts/scenarios_bc_closed_loop.py` · `scripts/contract_audit.py`。

## 打包（PyInstaller sidecar）

```bash
cd server
.venv\Scripts\python.exe -m PyInstaller plos_backend.spec --noconfirm
# 产物：dist/plos-backend.exe
```

详见 [runtime](docs/backend/runtime.md)。

## 目录结构

```
learning-os/
├── server/            # 后端本体（app/main.py · db.py · routers/ · core/）
│   ├── app/           # FastAPI + 业务 core + 数据访问
│   ├── tests/         # 全部 pytest（unit/ api/ integration/）
│   ├── migrations/    # 纯 SQL migration（001~010）
│   ├── backend_main.py  # 打包态入口
│   └── plos_backend.spec # PyInstaller 配置
├── scripts/           # 后端运维/验证脚本
├── docs/              # 治理文档（docs/backend/ 为权威档案）
├── workspace/         # 用户私有数据（gitignore，永不入库）
└── README.md
```

## 文档

- 权威后端档案：**[docs/backend/](docs/backend/README.md)**（架构 · 技术栈 · 功能 · 数据模型 · API · 测试 · 运行态 · 历史）
- 工程宪法：`AGENTS.md`（强制工程约束）
- 重大架构决策（ADR）：`docs/adr/` · 状态唯一来源：`docs/PROJECT_STATE.md`
- 依赖政策：`docs/DEPENDENCIES.md` · 网络边界：`docs/security/network-boundary.md` · Git 策略：`docs/version-control/git-policy.md`
