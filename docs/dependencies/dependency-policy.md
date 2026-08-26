# 依赖政策（Dependency Policy）

> 流程权威来源。登记数据见 `docs/dependencies/REGISTRY.md`；
> 原则背景见 `docs/architecture/principles.md` 与 ADR-004；纪律摘要见 `AGENTS.md` §2。

日期：2026-08-26 · 状态：Accepted

## 引入流程

```
产生需求
  ↓ Dependency Review 六连问（依次检查，任一成立即止）
① Python/TS/Rust 标准库能做？
② 已有依赖能做？
③ 项目内已有类似实现能做？
④ 有成熟活跃开源可直接复用？
⑤ 组合已有能力能解决？
⑥ 确需新包 → 值得长期维护成本吗？
  ↓ 全部通过
按模板登记 docs/dependencies/REGISTRY.md（答不全不准合入）
  ↓
实现 + 在同一批变更中更新相关文档（AGENTS §10 同步义务）
  ↓
里程碑结束时参与依赖审计
```

## 登记模板（13 字段）

Dependency / Version / Purpose / Why needed / Alternatives considered /
Why standard library is insufficient / Why existing dependencies are insufficient /
Why an established open-source implementation is insufficient /
Maintenance status / License / Approximate dependency footprint / Security considerations

## 红线

- **一进一出**：加一个新的运行时依赖时，评估能否同时删除旧的
- **同域唯一方案**：同一能力域只允许一个库；新旧重叠必须先提替换提案，禁止并存
- **禁提前安装**：规划中依赖（Monaco/SymPy/Jupyter/Tree-sitter/Docker/sqlite-vec 等，
  清单见 REGISTRY）在其触发条件达成前不得出现在 package.json / requirements.txt
- 禁止为几十行的功能引入 npm 包、为工具函数引库、为追流行引库

## 依赖审计（每里程碑结束）

检查并处置：未使用 · 功能重复 · 间接依赖意外引入 · 过时 · 高风险(CVE/停维) ·
可被标准库替代 · 可删除。
结果记入 REGISTRY「审计记录」表 + CHANGELOG 条目。

## 目标

**最小的合理依赖集合**——不为数字牺牲可靠性，不为省事堆砌依赖。
