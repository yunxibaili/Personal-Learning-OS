# 开发环境记录与环境治理（Environment Governance）

> **强制约束**。原则：Minimal · Reproducible · Clean Workspace · Disposable Experiment。
> 目标：新机器可重装 · 一条命令启动 · 依赖来源可追溯 · 删临时文件不影响项目 · 零不可追踪污染。
> 关联：`AGENTS.md` §11（里程碑收尾）/ §7（WARNING 协议）· `docs/version-control/git-policy.md`

日期：2026-08-26 · 状态：Accepted

## 一、版本基线（本机实测）

| 工具 | 版本 | 说明 |
|---|---|---|
| Python | 3.12.10 | venv 隔离于 `server/.venv`（不入库） |
| Node.js | 24.18.1（npm 11.16） | 依赖锁 `web/package-lock.json` 必须提交 |
| Rust | **未安装** | M6 前不需要；届时 rustup 安装并更新此行 |

## 二、安装与启动（唯一权威来源 = README.md）

```
后端：cd server && python -m venv .venv && pip install -r requirements.txt
      uvicorn app.main:app --reload --port 8000        # 或 python -m app.main（读 PORT）
前端：cd web && npm install && npm run dev             # http://127.0.0.1:5173
```

禁止出现"你电脑装了 xxx 就能跑"——一切以项目内配置文件定义为准。

## 三、目录归属法

任何文件创建前必须能归入且仅归入一类：
Source Code / Configuration / Documentation / Test / Build Artifact / Runtime Data。

| 路径 | 归属 | 入库？ |
|---|---|---|
| `web/src/` 等 | Source | ✅ |
| `migrations/` · `requirements*.txt` · `package.json` · 各 md | Config/Doc/Test | ✅ |
| `web/dist/` | Build Artifact | ❌ gitignore |
| `server/.cache/` | Backend 缓存产物 | ❌ gitignore |
| `server/.venv/` · `node_modules/` | 环境本体 | ❌ gitignore |
| `workspace/` | Runtime Data（用户私有） | ❌ gitignore |
| `_local/` | 本地归档：旧代码快照/被替换文档 | ❌ gitignore，**长期保留** |
| `sandbox/` | 一次性实验 | ❌ gitignore，**用完即删** |

禁止出现 `temp/ test2/ backup/ old/ new/ demo-final/ *-copy/` 这类目录；
禁止把生成物混进源码目录。

## 四、sandbox 实验规则

- 实验代码一律进 `sandbox/<实验名>/`（如 `sandbox/force_layout_try/`）
- 不进入正式模块、不被正式代码 import、不加正式依赖声明
- 实验结束**必须删除**；有价值的结论沉淀为 ADR 或 TECH_DESIGN 条目，代码本身丢弃
- 与 `_local/` 的区别：`_local/`=有保留价值的归档；`sandbox/=`即弃草稿

## 五、里程碑收尾检查（并入 AGENTS §11，共四件事）

1. **依赖审计** → REGISTRY 审计记录
2. **环境删除测试**：删掉 `.venv/ node_modules/ dist/ .cache/ 临时文件` 后，
   仅凭源码+配置按 README 能否完整重建运行？（实测通过才算过）
3. **删除优先检查**：未使用依赖 / 未使用文件 / 空目录 / 废弃代码 / 重复实现 —— 优先删除而非保留
4. CHANGELOG 条目 + Git tag（版本策略见 git-policy.md）

## 六、禁止清单

- 项目目录外随意安装工具；保存下载缓存/AI 缓存/日志垃圾/测试数据入库
- 未经批准引入：Docker（部署前）/ Kubernetes / 复杂 CI / Monorepo 工具 / Nx / Turborepo / Bazel——简单脚本够就不加工具

## 七、[ENVIRONMENT CHANGE REQUEST] 协议

AI 禁止自行：安装依赖 · 修改系统环境 · 创建成批辅助文件 · 引入开发工具 · 保留无用代码。
认为需要时，先输出并等待确认：

```
[ENVIRONMENT CHANGE REQUEST]
新增内容：
目的：
替代方案：
删除风险：
长期维护成本：
```

## 八、环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `PORT` | 8000 | FastAPI 监听端口（仅 `python -m app.main` 方式读取）；与 UpMark 共存设 8100 |
| `API_PORT` | 8000 | Vite dev proxy 目标端口 |
| `WORKSPACE_DIR` | `<repo>/workspace` | 用户数据根，可指向任意本地目录 |
