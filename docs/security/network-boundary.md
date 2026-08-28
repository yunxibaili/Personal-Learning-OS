# 安全与网络边界（Security & Network Boundary）

> 强制约束。关联：`AGENTS.md` §3/§4.1 · ADR-003 · `docs/version-control/git-policy.md`
> 违反本文的行为必须先发 `[ARCHITECTURE WARNING]`（AGENTS §7）。

日期：2026-08-26 · 状态：Accepted

## 默认姿态

1. **零遥测**：无统计、无崩溃上报、无匿名分析、无"检查更新"外呼
2. **只绑回环**：FastAPI/Uvicorn 监听 `127.0.0.1`，禁止 `0.0.0.0`（防局域网暴露）
3. **无出站即无风险**：不写任何非白名单的网络请求代码路径

## 出站白名单（唯一例外）

| 用途 | 目标 | 启用条件 |
|---|---|---|
| LLM 对话/抽取 | 用户在设置中显式配置的 `base_url`（OpenAI-compatible `/v1/chat/completions`） | 设置页填写后才存在此代码路径 |
| Embedding（Phase 3 起） | 同上协议，另行显式启用 | 触发条件见 REGISTRY 规划表 |

白名单之外的一切出站请求（更新检查、字体/CDN 拉取、第三方统计等）一律不做。
前端构建产物必须完全本地化，不引用 CDN。

## 发送给云端 LLM 的上下文最小化

- 只发送：当前用户问题 + 检索到的相关概念/掌握度/错误摘要 + 明确授权的笔记片段
- **绝对排除**（无论用户如何配置，代码层硬过滤）：
  `.env` · API 密钥 · Token · SSH keys · Git credentials · 数据库文件 ·
  `workspace/db/` · 系统私人配置
- UI 义务：首次使用云端 LLM 前明示"哪些内容会被发送到哪里"；对话页提供
  「本次发送的上下文」透视（与 TECH_DESIGN §6.2 context_json 对应）
- AI 不获得整库访问权：只能拿到管线检索出的片段与用户显式授权的范围

## 外部 Git 仓库导入

- 默认 Read-only / Safe Import；保留原始 `.git`，不改历史、不改用户 Git 配置
- commit / push / pull / checkout / merge / rebase 仅在用户明确指令时执行
- 禁止默认上传用户代码到云端；同步/推送必须用户逐次发起

## 密钥与凭证

- LLM API key 仅存 `workspace/db/` 内 SQLite；API 响应永不再返回明文；不写日志
- `.env*` 一律 gitignore；生产形态下无服务器端密钥

## 未来扩展的边界预留

- Phase 5 代码执行沙箱：Docker 容器 `--network none`，CPU/内存/时长受限
- 多语言 trace（gdb/LLDB）：同样仅本地子进程

## 本地归档区（不入库）

`_local/`（仓库根，整体 gitignore）：旧代码快照、被替换的历史文档版本、
临时实验脚本、个人调试脚本——仅存本机，永不提交。
**正式回归测试（pytest/vitest 用例）不属于此类，必须随代码入库**（可复现开发原则）。
`sandbox/` 为一次性实验区，同样不入库且用完即删；有价值的结论沉淀为 ADR/TECH_DESIGN 条目。
（两区边界与环境删除测试见 `AGENTS.md §17` §三/§四/§五）
