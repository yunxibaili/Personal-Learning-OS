# 架构原则（Engineering Principles）

> 本文是项目原则的**权威来源**（AGENTS.md 为操作摘要）。修改原则须经确认并同步 AGENTS.md。
> 关联：ADR-004 · `docs/dependencies/dependency-policy.md` · `AGENTS.md`

日期：2026-08-26 · 状态：Accepted

## 十大核心原则

| # | 原则 | 在本项目中的含义 |
|---|---|---|
| 1 | Local-first | 所有功能默认离线可用；用户数据只在本机；云能力是可选增强，永远可关闭 |
| 2 | Minimal Dependencies | 运行时依赖全集见 REGISTRY；新增走 Dependency Review |
| 3 | Open Source Reuse | 非核心能力优先复用成熟开源，不自研 |
| 4 | Standard Library First | Python/TS/Rust 各自标准库优先于一切第三方 |
| 5 | No Reinventing the Wheel | 见下方禁重复实现清单 |
| 6 | Modular Architecture | core/ 纯逻辑层可单测不依赖框架；router 薄；UI 组件保持简单 |
| 7 | Explicit Data Ownership | 源码 / 用户知识库 / 用户代码 / AI 生成内容四者物理分离 |
| 8 | Version Control First | Git 第一天启用，唯一版本真相 |
| 9 | Reproducible Development | lockfile + requirements.txt + README 两条命令可跑 |
| 10 | Small and Maintainable Codebase | 小文件、直白代码、拒绝抽象表演 |

目标不是堆叠技术，而是在最少复杂度下实现完整能力；禁止为了"看起来高级"增加技术栈。

## 能力复用优先级链

```
已有标准能力 → 已有项目代码 → 已装依赖 → 成熟开源项目 → 最后才是新依赖或自行实现
```

对应操作阶梯（Ponytail）：见 `AGENTS.md` §1。

## 禁止重新实现的成熟基础设施

Markdown parser · Git engine · SQL engine · Code editor · Syntax highlighter ·
LSP · AST parser · 数学符号引擎 · HTTP client · JSON/YAML parser ·
Graph layout engine · Auth 框架 —— 除非有经 ADR 确认的架构原因。

## 平衡式（防止机械执行）

- 少量简单代码（几十行、标准库可完成）**<** 一个复杂依赖
- 成熟复杂能力 **>** 自研大型轮子
- 一切按长期维护成本判断，不机械遵守 DRY，也不为了"零依赖"自造轮子

## 核心创新投入方向

开发精力只投给真正的差异化：Knowledge Graph · Learning Memory · AI Tutor ·
Visual Learning Engine · Personal Learning OS 整合。
