# scripts/test.ps1 — 一键测试入口
# 用法: .\scripts\test.ps1           (全量 pytest)
#       .\scripts\test.ps1 -Smoke    (仅 M2 烟测)

param(
    [switch]$Smoke
)

$ErrorActionPreference = "Stop"
$serverDir = Join-Path $PSScriptRoot "..\server"

Push-Location $serverDir
try {
    if ($Smoke) {
        Write-Host "Running M2 smoke test..." -ForegroundColor Cyan
        & ".\.venv\Scripts\python.exe" -m pytest tests/api/test_m2_smoke.py -v
    } else {
        Write-Host "Running full pytest..." -ForegroundColor Cyan
        & ".\.venv\Scripts\python.exe" -m pytest -q
    }
} finally {
    Pop-Location
}
