# Export Manifest（T-EXPORT 预检，M7-006.5）

> 目的：开源发布 / GitHub Release / 项目迁移时，发布包的文件范围基线。
> 依据：AGENTS §3「用户数据永不锁死」+ TECH_DESIGN §10 T-EXPORT 行
> （触发条件：首次对外公开发布前必须）。本文件是预检产出，导出脚本本身未实现。

## 1. 必须进入发布包

| 路径 | 内容 | 说明 |
|---|---|---|
| `server/app/` | FastAPI + core | 源码（不含 `__pycache__`） |
| `server/migrations/` | DDL 001–004 | 幂等可重放 |
| `server/tests/` | pytest 全量 | 可复现性原则：测试必须随代码入库（AGENTS §3.1） |
| `server/requirements*.txt` | 依赖清单 | 运行 3 项 / 开发 2 项，全部有版本上限 |
| `web/src/` + `shared/` | 前端源码与 API 契约 | 契约层两侧共用 |
| `web/package.json` `vite.config.*` `tsconfig*` | 构建定义 | 不含 lock 时应附安装说明 |
| `docs/` | 全部文档 | 含 ADR/sync/testing/design——架构即文档 |
| `scripts/test.ps1` | 一键测试 | |
| 根文档 | README · AGENTS · CHANGELOG · CONTRIBUTING · LICENSE · PRODUCT_PRINCIPLES · PROJECT_BRIEF | |
| `.gitignore` `.gitattributes`(如有) | 版控配置 | |

## 2. 必须排除

| 路径/模式 | 原因 |
|---|---|
| `workspace/` 整目录 | 用户私有数据（.gitignore 已覆盖）：vault/db/attachments/metadata |
| `_local/` `sandbox/` | 本机归档与一次性实验（AGENTS §3.1/docs/environment.md） |
| `server/.venv/` `.cache/` `.pytest_cache/` | 环境与缓存产物 |
| `node_modules/` `web/dist/` | 依赖与构建产物（发布含 dist 与否届时按分发方式决定） |
| `.env` `.env.*` 及一切密钥 | 安全红线（network-boundary.md）；API key 仅存用户本机 settings 表，从不出现在任何导出中 |
| `coverage/` `*.log` `src-tauri/target/` | 测试/日志/打包产物 |

## 3. 用户数据随行导出（T-EXPORT 正式实现时）

完整迁移包 = 发布代码包 **之外** 单独打包：

```
vault/**(md + *.mindmap.json) + attachments/**
+ metadata/eventlogs/*.jsonl      ← 学习状态真相（ADR-020 Layer 1）
```

明确**不随行**（各设备本地重建或本地私有，ADR-005/020）：
db/learning-os.db · metadata/devices.json · settings（含 API key）· manifests。

恢复 = 新机解压 workspace + 启动应用（migration 自动建库、扫描自动重建 Layer 2）。
该恢复路径已由 M7-004~006 的机制隐式保证，正式验证归 DATA_RECOVERY_TEST。

## 4. 当前缺口（发布前必办）

- [ ] 导出脚本 `scripts/export.ps1` 或后端端点尚未实现（backlog T-EXPORT）
- [ ] web/package-lock.json 入库与否需在首次 Release 前定案并写入 CONTRIBUTING
- [ ] LICENSE 文件存在；README 需补「数据在哪/如何备份」一节时引用本 manifest
