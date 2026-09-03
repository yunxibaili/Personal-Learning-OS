# -*- mode: python ; coding: utf-8 -*-
"""P0-2b：桌面版 Python 后端 sidecar 打包配置（PyInstaller onefile）。

构建（server 目录内）：
  .venv/Scripts/python.exe -m PyInstaller plos_backend.spec --noconfirm
产物：
  dist/plos-backend.exe
  （历史说明：P0-2b 曾拷贝为 web/src-tauri/binaries/plos-backend-x86_64-pc-windows-gnu.exe
    作为 Tauri externalBin sidecar；纯后端化后 UI 壳已移除，exe 即为独立后端产物。）
说明：
  - 仅构建期工具（pyinstaller 装在 server/.venv，不进 requirements.txt）；
  - migrations 以 datas 打进 _MEIPASS/server/migrations，
    与 app/db.py 的 frozen 分支（MIGRATIONS_DIR）配套。
"""
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = collect_submodules("uvicorn") + [
    "anyio._backends._asyncio",
]

a = Analysis(
    ["backend_main.py"],
    pathex=["."],
    binaries=[],
    datas=[("migrations", "server/migrations")],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="plos-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
