"""打包态后端入口（P0-2b，方案 i：Tauri sidecar）。

PyInstaller onefile 冻结后的进程入口：程序化启动 uvicorn + FastAPI app。

workspace 解析顺序（app.db.workspace_root 只认 env，本入口负责在导入 app 前定好）：
  1. env WORKSPACE_DIR 显式指定优先；
  2. 自 exe 所在目录向上最多 4 级寻找 `workspace/db` 存在的目录
     （开发树：target/release → 上 4 级 = repo 根 → repo/workspace，真数据）；
  3. 兜底 exe 同级 `workspace/`（随 exe 便携；正式安装版 userData 迁移另行任务）。

端口：env PORT（Rust 壳未传时默认 8100，避让 dev 手动 uvicorn 的 8000）。
host：恒 127.0.0.1（network-boundary 红线，永不 0.0.0.0）。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def resolve_workspace() -> Path:
    env = os.environ.get("WORKSPACE_DIR")
    if env:
        return Path(env)
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
    else:
        exe_dir = Path(__file__).resolve().parent
    for base in [exe_dir, *exe_dir.parents][:5]:
        if (base / "workspace" / "db").is_dir():
            return base / "workspace"
    return exe_dir / "workspace"


def main() -> None:
    os.environ.setdefault("WORKSPACE_DIR", str(resolve_workspace()))
    import uvicorn

    from app.main import app

    port = int(os.environ.get("PORT", "8100"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
