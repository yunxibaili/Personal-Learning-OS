# 技术栈 · Technology

## 运行时

| 项 | 版本 | 说明 |
|---|---|---|
| Python | 3.12 | venv 隔离于 `server/.venv`（不入库） |
| FastAPI | >=0.115,<1 | Web 框架 |
| Uvicorn | >=0.30,<1 | ASGI 服务器（绑定 127.0.0.1） |
| python-multipart | >=0.0.9,<1 | 附件/表单上传 |

开发/测试依赖（`requirements-dev.txt`）：pytest（>=8,<9）、httpx（>=0.27,<1）。

无 `pyproject.toml`，无 `package.json`——纯 Python 后端。

## 数据

- **SQLite**：只用 Python 标准库 `sqlite3` 直写 SQL；无 ORM / Query Builder（禁止清单）。
- **FTS5**：全文检索（`notes_fts` 虚拟表）。
- **CJK bigram**：中文应用侧预分词 `core/cjk_bigram.py`（ADR-027 方案 A），
  中文检索统一走 FTS 索引路径。
- **Markdown vault**：`workspace/vault/**` 是正文唯一事实源。
- **旁车 JSON**：`*.mindmap.json` 是思维导图结构唯一事实源（ADR-002 / ADR-019/021）。

## AI

- **仅走 OpenAI-compatible HTTP 接口**（含 Ollama），settings 配置驱动，代码不感知厂商
  （ADR-003 / ADR-010）。
- **禁止** LangChain / LlamaIndex 及一切 AI 编排框架（管线手写）。
- **禁止**向量数据库与 embedding 服务（实测性能瓶颈之前）。
- AI 调用边界：Router 禁止直连 LLM；提示词组装必须经 `core/ai` Context Builder；
  未来 RAG 只是给 Builder 增加数据源而非新管线（ADR-010）。

## 网络边界（安全红线）

- 只监听 `127.0.0.1`，禁止 `0.0.0.0`（ADR-003）。
- 出站白名单唯一例外：用户在设置中显式配置的 `base_url`
  （OpenAI-compatible `/v1/chat/completions`）。
- 零遥测：无统计/崩溃上报/检查更新外呼。
- `api_key` / token / secret 永不入 answer / snapshot / log / event。

## 工程约束摘要

- **依赖纪律**：引入前六连问；禁止清单（ORM / CSS 框架 / UI 库 / LangChain / 向量库 /
  "为几十行功能引入 npm 包"）。
- **能力复用阶梯**（Ponytail）：需要吗 → 已有？ → 标准库？ → 平台原生 → 已装依赖 →
  一行写完 → 才写最少实现。
- **禁止重新实现**：Markdown parser / Git engine / SQL engine / HTTP client /
  JSON parser / Graph layout engine / Auth 框架。
- 依赖只保留 `server/requirements*.txt`；CI 与打包均从该处安装。

## 相关治理文档

依赖政策与注册表：`docs/DEPENDENCIES.md`；网络边界：`docs/security/network-boundary.md`；
版本控制：`docs/version-control/git-policy.md`；工程宪法：`AGENTS.md`。
