# Test Plan — Open Learning OS

> 全局测试策略。Gate 制度 + 测试金字塔 + 执行规范。
> 配合 `TEST_MATRIX.md`（模块→测试映射）使用。

---

## 1. 测试金字塔

```
Release（安装 + 迁移 + 导出）  ← Gate 3
  ↓
Regression（全量回归）        ← Gate 0/1/2
  ↓
Smoke（E2E 关键路径）         ← 每次 commit
  ↓
API（接口契约）               ← 每次改 router/core
  ↓
Unit（纯函数）                ← 每次改 core
```

## 2. Gate 制度

| Gate | 时机 | 范围 | 阻断 |
|---|---|---|---|
| Gate 0 | M4 开工前 | 全量回归 + 依赖审计 | BLOCK |
| Gate 1 | M4 完成后 | 全量 + AI Context 边界 | BLOCK |
| Gate 2 | M3b 开始前 | 全量 + 性能基线 | BLOCK |
| Gate 3 | 公开发布 | 全量 + 安装 + 迁移 + 导出 | BLOCK |

Gate 未通过 = 禁止进入下一阶段。

## 3. 执行命令

```bash
# 后端全量
cd server && .\.venv\Scripts\python.exe -m pytest -q

# 后端单模块
cd server && .\.venv\Scripts\python.exe -m pytest tests/api/test_mastery.py -v

# 前端构建
cd web && npm run build

# 前端测试
cd web && npm run test

# 一键全量
.\scripts\test.ps1
```

## 4. 测试文件位置

```
server/tests/
├── conftest.py               # fixtures（tmp_workspace + client）
├── test_smoke.py             # M0 基础健康
├── test_notes.py             # M1 notes CRUD + FTS
├── test_attachments.py       # M1 附件
├── test_recovery.py          # 数据恢复（Gate 0 新增）
├── api/
│   ├── test_m2_smoke.py      # M2 全链路 E2E
│   ├── test_mastery.py       # M3 Learning Graph
│   └── test_suggest.py       # M3.5-A Knowledge Radar

web/src/
├── stores/ui.test.ts         # Zustand store
```

## 5. 新增测试规则

- 新功能必须有对应测试
- 测试用例使用 `tmp_workspace` fixture，绝不触碰真实数据
- SQLite 连接断言时打开、用完即关
- 禁止手工启动 uvicorn 跑测试
- 禁止 PowerShell `Invoke-RestMethod`（GBK 乱码）

## 6. Gate 报告格式

每次 Gate 执行后记录到对应 `GATE-*.md` 文件：

```markdown
## Gate X Report — YYYY-MM-DD

| 检查项 | 预期 | 实际 | 状态 |
|---|---|---|---|
| pytest | passed | 38 passed | ✅ |
| build | pass | pass | ✅ |
| ... | ... | ... | ... |

结论：PASS / FAIL
```
