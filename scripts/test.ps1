# scripts/test.ps1 — 一键测试入口
# 用法: .\scripts\test.ps1           (全量 pytest)
#       .\scripts\test.ps1 -Smoke    (仅 M2 烟测)
#       .\scripts\test.ps1 -Watch    (watch 模式)

param(
    [switch]$Smoke,
    [switch]$Watch
)

$ErrorActionPreference = "Stop"
$serverDir = Join-Path $PSScriptRoot "..\server"

Push-Location $serverDir
try {
    if ($Smoke) {
        Write-Host "Running M2 smoke test..." -ForegroundColor Cyan
        & ".\.venv\Scripts\python.exe" -m pytest tests/api/test_m2_smoke.py -v
    } elseif ($Watch) {
        Write-Host "Starting pytest watch..." -ForegroundColor Cyan
        & ".\.venv\Scripts\python.exe" -m pytest --tb=short -q --watch
    } else {
        Write-Host "Running full pytest..." -ForegroundColor Cyan
        & ".\.venv\Scripts\python.exe" -m pytest -q
    }
} finally {
    Pop-Location
}
