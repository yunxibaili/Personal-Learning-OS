# frontend/

Open Learning OS 前端 —— Backend API Consumer（ADR-029）。

纯静态 SPA（React 19 + TypeScript + Vite），浏览器运行，经 HTTP 消费 `/api/v1/*`。
不依赖 Tauri / Electron / 任何 shell 专有 API（ADR-029 §2 H1–H3）。

## 启动

```bash
npm install
npm run dev        # http://127.0.0.1:5173；/api/v1 代理到 http://127.0.0.1:8000
```

后端另起（`server/`）：`python -m app.main`（PORT 可覆盖；代理目标用 `API_PORT` 环境变量对齐）。

## OpenAPI 契约类型生成（types-only）

```bash
npm run gen:api    # 默认 http://127.0.0.1:8000/openapi.json → src/api/schema.d.ts
```

- 后端端口不同时：`npx openapi-typescript http://127.0.0.1:<PORT>/openapi.json -o src/api/schema.d.ts`
- 产物为 path-keyed 类型（`paths`）。**不使用 operationId 作为调用契约**——
  operationId 由 FastAPI 从 Python 函数名生成，函数重命名不应影响前端
  （ADR-029 §5.2）。生成命令开发期手动执行，产物提交以便 review 契约漂移。

## API 调用

统一走 `src/api/client.ts`（ADR-029 §6 最小 wrapper）：

```ts
import { api, ApiError } from "./api/client";
const { mastery } = await api.get("/api/v1/mastery");
```

非 2xx 抛出 `ApiError { status, code, message }`（解包后端统一错误契约
`{"error":{code,message}}`）。

## 边界（ADR-029 §7.3）

- 禁止：SM-2 / mastery 计算 / 图谱算法 / 同步协议（L1、L3）
- 禁止：直连 SQLite / vault 文件系统 / AI provider（L3）
- 禁止：手写第二套 TS 类型契约、恢复 `shared/types/`（L2）
- 禁止：调用 shell 专有 API（Tauri IPC / Electron ipcRenderer）（H3）
