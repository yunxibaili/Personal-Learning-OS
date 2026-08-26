# 版本控制策略（Version Control Policy）

> 强制约束来源：`AGENTS.md` §4。Git 是本项目唯一的版本控制真相；
> 禁止自造 commit / diff / patch / branch / history 系统。

## 1. 基本规则
- 项目**第一天**启用 Git（已于 2026-08-26 初始化）
- 主干 `main`；个人项目允许 main 直接小步提交，较大功能开 `feature/<name>` 短分支
- Commit 必须小、清晰、可回滚、单一目的；禁止 "feat: everything" 式巨型混合提交
- Conventional 风格前缀：

| 前缀 | 用途 |
|---|---|
| feat: | 新功能 |
| fix: | 缺陷修复 |
| refactor: | 重构（不改行为） |
| docs: | 文档 |
| chore: | 构建/工具/杂项 |
| test: | 测试 |

## 2. 用户数据永不入库
- `workspace/` 整体 `.gitignore`（知识库、附件、SQLite、AI 生成内容）
- `.env*` 及一切密钥凭证禁止提交
- 导入的外部 Git repository 保留原始 `.git`，默认只读；
  commit/push/pull/checkout/merge/rebase 仅在用户明确要求时执行，
 且绝不自动 push

## 3. 版本发布（Semver）
- 格式 `MAJOR.MINOR.PATCH`；MVP 开发期固定 `0.x.y`
- 每个稳定里程碑：
  - annotated tag：`git tag -a v0.Y.0 -m "..."`
  - CHANGELOG.md 新增条目（Keep a Changelog 格式）
  - 对应里程碑验收标准全部满足才允许打 tag
- 预期映射（按实际完成度执行）：M1→v0.1.0 · M2/M2b→v0.2.x · M3→v0.3.0 ·
  M4→v0.4.0 · M5→v0.5.0 · M6（桌面安装包）→v0.6.0 · 1.0.0 待产品稳定后评估

## 4. 可复现开发
- Python：requirements.txt 固定版本区间 + venv
- Node：package-lock.json 必须提交
- 启动命令以 README.md 为准，保持两条命令可用
