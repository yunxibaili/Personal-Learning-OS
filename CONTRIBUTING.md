# 为 Open Learning OS 做贡献

> 感谢关注！本项目是一个开源、本地优先的 AI 学习操作系统。
> 开始之前请先读 [AGENTS.md](AGENTS.md)（工程宪法）——它对所有贡献者（人类与 AI）一视同仁。

## 环境搭建

见 [README.md](README.md) 与 [docs/environment.md](docs/environment.md)：
Python 3.12 + Node 20+，两条命令分别启动后端(8000)与前端(5173)，无其他全局依赖。

## 开发流程（强制）

1. **认领/登记任务**：[docs/tasks/TASKS.md](docs/tasks/TASKS.md)——开始前写计划，完成后回填报告
   （必须含实际执行的测试命令与结果表）
2. **写码前**：输出 §12 八项清单（功能目标/架构位置/各层改动/API 设计/文件列表）并获确认
3. **自答设计三问**：用户真需要？现在必须做？三个月后新人能看懂？
4. **测试要求**：Core 逻辑必须有 pytest/vitest 覆盖；API 响应形状受契约测试锁定
5. **提交规范**：Conventional Commits，小而单一目的（见 docs/version-control/git-policy.md）

## 架构红线速览（全文见 AGENTS.md §2-§3）

- 分层不可越界：Frontend 只经 `/api/v1` 访问后端；图算法只在 Core
- 新增依赖走 Dependency Review + REGISTRY 登记；D3 渲染全家桶/LangChain/ORM 永久禁用
- Markdown 是正文唯一真相；TipTap JSON 不入库；用户数据永不锁死、永不上传云端
- 违规前先发 `[ARCHITECTURE WARNING]` 或 `[ENVIRONMENT CHANGE REQUEST]`

## 决策记录

任何影响架构的改动需要先写 ADR（docs/architecture/），
模板与既有决策（ADR-001~008）都在那里——先读再改。

## 提交 PR 前 checklist

- [ ] TASKS 报告已回填
- [ ] pytest / vitest 全绿
- [ ] `npm run build` 通过
- [ ] 相关文档（TECH_DESIGN/REGISTRY/INDEX/CHANGELOG）已同步
- [ ] 不含密钥、workspace 用户数据、构建产物
