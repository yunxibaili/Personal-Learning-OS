# ADR-011: 中文搜索——unicode61 起步，分词增强延后

日期：2026-08-26 · 状态：**Superseded by [ADR-027](ADR-027-chinese-fts-bigram.md)**
（2026-09-02：触发条件达成；本 ADR 首选改进路径 trigram 经选型评审证伪——
trigram 对 <3 字符查询静默 0 命中，2 字中文词必须永久 LIKE 回退。最终采用
应用侧 CJK bigram 预分词，见 ADR-027。）

## Context

FTS5 默认 unicode61 tokenizer 不切分连续汉字，中文短语检索在长句内命中不佳
（标题/tags 短字段基本可用）。候选修复各有成本：
trigram tokenizer（SQLite 内置，需重建 FTS 表）、jieba 外挂预分词列、ICU 扩展。

## Decision

- M2-C 直接以 unicode61 上线，不做任何分词增强
- 明确拒绝现阶段引入 jieba 及其他分词依赖（维护成本 > 收益）
- 记录改进路径，触发条件达成再执行：
  1. 首选：重建 notes_fts 为 `tokenize='trigram'`（内置能力，仅迁移成本）
  2. 备选：外挂分词写入 shadow 列（引入依赖，最后考虑）
- 触发条件：真实使用中中文搜索质量成为可感知问题（用户投诉或自查失败案例）

## Alternatives Considered

| 方案 | 结论 |
|---|---|
| 现在就上 trigram | 表刚建就要重建，且英文场景零收益；等真实反馈 |
| jieba 预分词列 | 引入 Python 分词依赖 + 双写复杂度，违反最小依赖 |
| ICU 扩展 | 编译/分发负担重 |

## Consequences

- v1 中文长句检索体验有限（已知、已记录、可接受）
- 搜索 UI 需同时提供标签/标题快捷过滤作为补偿（M2-C 范围内）
