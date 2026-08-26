# ADR-007: 力导向布局采用 d3-force 单模块（D3 禁令的唯一例外）

日期：2026-08-26 · 状态：Accepted（M3b 实施）

## Context

Knowledge Universe 视觉层（TECH_DESIGN §8.1）需要力导向布局。D3.js 在本项目永久禁令清单中；
但该禁令的本意是阻止引入 D3 渲染/选择集全家桶来替代自研可视化，而非禁止一切同名包。

## Decision

- 引入 `d3-force` **单模块包**用于力导向物理计算（斥力/弹簧/向心）
- **边界**：仅限布局计算。d3-selection / d3-svg / d3-zoom 等任何渲染类模块仍然禁止，
  渲染一律走 React Flow + SVG/CSS
- 同步修订 AGENTS §2.2 禁令措辞：「D3.js」→「D3 全家桶（渲染模块）；唯一例外 d3-force（ADR-007）」

## Dependency Review 六问

1. 标准库？—— 无（JS 无内置物理模拟）
2. 已有依赖？—— React Flow 不含力导向布局器
3. 项目内已有实现？—— 仅手写 tidy-tree（树形），无力导向
4. 成熟开源？—— d3-force 即是：独立发布、~30KB、零传递依赖、ISC 协议、持续维护十余年
5. 组合可行？—— 否，力模拟必须有人写
6. 值得长期成本？—— 值得：收敛行为经过大规模实战调校，手写版需反复调参且质量难保证

登记字段详见 `docs/dependencies/REGISTRY.md` 运行时表 d3-force 行。

## Alternatives Considered

| 备选 | 否决理由 |
|---|---|
| 手写力导向 ~150 行 | 可行但收敛/抖动调参耗时且效果难保证；属于"为省一个干净小依赖而造中型轮子"，违反平衡式 |
| d3 全家桶 | 渲染职责与 React Flow 重叠，正是禁令要防的情形 |
| Framer Motion | 是动画库非布局器，且 CSS transition+rAF 已覆盖本层动效需求（进 §3.2 否决表） |

## Reason

最小例外换取最大确定性：布局质量直接决定 Galaxy 模式的可用性。

## Consequences

- 运行时依赖数 +1（合计 13）；未来若替换必须先提替换提案（AGENTS §2.3）
- 若出现第二个 d3 模块需求，视为红线事件，须重新开 ADR 评审
