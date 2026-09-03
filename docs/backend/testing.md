# 测试 · Testing

## 测试体系（三层 + 闭环）

| 层级 | 位置 | 工具 | 说明 |
|---|---|---|---|
| Unit | `server/tests/unit/` | 纯函数调用 | <1s，每次改 core 跑 |
| API | `server/tests/api/` | FastAPI TestClient | ~2s，每次改 router/core 跑 |
| Integration | `server/tests/integration/`（含 `sync/`） | TestClient + 临时 workspace | 跨模块闭环 |
| Smoke | `server/tests/test_smoke.py` `test_tutor_smoke.py` `api/test_m2_smoke.py` | TestClient 全流程 | 里程碑验收 |

当前基线：**1020 passed**（`python -m pytest tests/ -q`）。67 个 `test_*.py` 文件。

## fixture（`server/tests/conftest.py`）

- `tmp_workspace`：每用例独立临时 workspace（`monkeypatch.setenv("WORKSPACE_DIR", ...)`），绝不触碰真实用户数据。
- `client`：`TestClient(app)`（+ lifespan）。
- `core_conn`：core 层直连（已跑 migration 的连接，用完即关，避免 TestClient/fixture 锁冲突）。

## 关键考量

- 禁止手工启动 uvicorn 跑测试（TestClient 一条命令出结果）。
- 禁止 PowerShell `Invoke-RestMethod` 发 UTF-8 中文 JSON（GBK 乱码）——统一 pytest TestClient 或 Python httpx。
- SQLite 连接断言时打开、用完即关。

## 如何运行（从 `server/`）

```bash
.venv\Scripts\python.exe -m pytest -q             # 全量
.venv\Scripts\python.exe -m pytest tests/api -q   # 仅 API
.venv\Scripts\python.exe -m pytest tests/unit -q  # 仅 unit
```

一键入口（从仓库根）：`.\scripts\test.ps1`（全量）/ `-Smoke`（M2 烟测）。

## 闭环场景脚本（隔离 workspace，不碰真实数据）

- `scripts/scenario_a_closed_loop.py`：笔记→图谱→概念→掌握度→复习(SM-2)→Tutor 上下文→搜索→删除→图谱回射。
- `scripts/scenarios_bc_closed_loop.py`：B 思维导图闭环（create→nodes→edges→bind→export→import→roundtrip）；C 导出重建闭环（export→fresh workspace→reindex→对比）。
- `scripts/seed_demo.py`：Demo 数据种子（只增不改、幂等可重跑，走 API/TestClient）。
- `scripts/contract_audit.py`：OpenAPI 端点→测试引用 1:1 映射（只读，不触发 lifespan，恒返回 0）。
