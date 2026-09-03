# 运行态 · Runtime & Packaging

## 本地开发运行（从 `server/`）

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# 或：python -m app.main            # 读取 PORT，默认 8000
```

只绑 `127.0.0.1`（network-boundary 红线）。与 UpMark 共存时 `PORT=8100`。

## 环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `PORT` | 8000 | FastAPI 监听端口（仅 `python -m app.main` 方式读取） |
| `WORKSPACE_DIR` | `<repo>/workspace` | 用户数据根，可指向任意本地目录 |
| `API_PORT` | 8000 | （历史 Vite dev proxy 目标端口——纯后端化后已无前端消费，保留仅兼容） |

## 打包（PyInstaller sidecar，保留）

后端打包/部署能力独立保留，与 Tauri sidecar 关系不构成"前端依赖"。

- 入口：`server/backend_main.py` —— 程序化启动 uvicorn + FastAPI app。
  workspace 解析顺序：① env `WORKSPACE_DIR` ② 自 exe 向上最多 4 级找 `workspace/db`
  ③ exe 同级 `workspace/`。端口默认 8100（避让 dev 手动 uvicorn 的 8000）。
- 配置：`server/plos_backend.spec`（PyInstaller onefile）。
  构建（`server/` 目录内）：
  ```bash
  .venv/Scripts/python.exe -m PyInstaller plos_backend.spec --noconfirm
  ```
  产物：`dist/plos-backend.exe`；migrations 以 datas 打进 `_MEIPASS/server/migrations`，
  与 `app/db.py` 的 frozen 分支（`MIGRATIONS_DIR`）配套。
- 说明：pyinstaller 仅构建期工具（装在 `server/.venv`，不进 `requirements.txt`）。

## 数据与 workspace

- 数据库：`workspace/db/learning-os.db`（SQLite，migration 自动建表）。
- vault：`workspace/vault/**/*.md`（正文事实源）。
- 测试/CI 一律用临时 workspace，绝不触碰真实数据。

## 一键测试

`.\scripts\test.ps1`（全量）/ `-Smoke` / `-Watch`（见 [testing](testing.md)）。

## 相关治理文档

网络边界 `docs/security/network-boundary.md` · 版本控制 `docs/version-control/git-policy.md` ·
工程宪法 `AGENTS.md`。
