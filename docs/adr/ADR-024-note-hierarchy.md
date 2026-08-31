# ADR-024: Note Hierarchy — 主/副笔记层级关系

**状态**：已批准（2026-09-01）
**决策者**：项目负责人
**评审**：GPT-5.5 Pro（2026-08-31，见存档 `Open Learning OS — 主副笔记层级决策征询（GPT）.md` §七）
**关联**：ADR-001（Storage / Markdown 真相）· ADR-008（Graph Model）· ADR-009（Entity-Document Boundary）· ADR-018（Knowledge Universe）· ADR-023（Visualization Boundary）

---

## 1. Problem

用户提出「主笔记 / 副笔记」需求，并要求左侧列表体现层级。核查后确认：

1. `workspace/vault/` 完全扁平，零子目录；笔记身份键是 `path = {title}.md`
   （`importer.py` 与 `routers/notes.py` 均按 title 生成 `rel_path`）。
2. **当前不存在任何主/副关系字段**。星系视图的「星球/卫星」是从 wikilink / `graph`
   边拓扑**推断**出来的假层级（`GalaxyCanvas.tsx::derivePlanets`）。
3. `core/knowledge.py::compose_file` **只回写 `tags`**，其余 frontmatter key
   在保存时被静默丢弃——这是本功能的地基缺陷。

需要裁决：关系存在哪、用什么格式、如何与既有推断逻辑共存。

## 2. Decision

> **主/副笔记采用 child-side 单父 `parent` 显式关系，事实源在 Markdown
> frontmatter。** 不持久化 `children`、不改扁平 vault / path 身份体系、
> 不以 SQLite `links` 作事实源；既有星系拓扑推断降级为 legacy fallback；
> `/graph`、`/universe` 统一以「显式优先」的关系解析结果为准。

### 2.1 存储格式

子笔记 frontmatter 顶层写：

```yaml
---
parent: "[[父笔记标题]]"
tags: 机器学习
---
```

- **只在 child 写 `parent`**；`children` 一律运行时反向派生，绝不持久化。
- 采用 wikilink 形式而非纯标题：语义明确（一眼看出是引用），且未来迁移稳定 ID
  时语法位置不变。
- **已知限制**：wikilink 仍是**标题寻址**，不能解决重命名断链。真解药是稳定 ID，
  见 §5（P1，独立 ADR）。

### 2.2 五条铁规则（不可协商）

| # | 规则 | 含义 |
|---|---|---|
| 1 | **事实源在 Markdown** | 关系必须可从 `*.md` 完整重建；SQLite 只是派生缓存 |
| 2 | **单向声明** | 只在 child 写 `parent`；不持久化 `children` |
| 3 | **严格单父（forest）** | 一个笔记最多一个 parent；vault 可含多棵树；**底层允许 `parent→parent→parent` 链**，第一版 UI 只展示一层 |
| 4 | **权威优先** | 显式 `parent` 是权威；wikilink 拓扑推断仅作 legacy fallback |
| 5 | **统一消费** | `/graph`、`/universe`、review 统一经 `resolve_hierarchy()`，禁止各视图自行推断 |

### 2.3 校验与失败语义

| 情形 | 处理 |
|---|---|
| `parent` 指向存在的笔记 | ✅ 正常建立关系 |
| `parent` 指向不存在的笔记 | ⚠️ **保留原值** + 标记 `invalid`（orphan 警告）。**绝不自动删除**——用户写错一次不该永久丢关系 |
| `parent` 自指（A→A） | ❌ 标记 `invalid`，不建立关系 |
| 形成环（A→B→A） | ❌ 检出 cycle，环上节点标记 `invalid`，不建立关系 |
| 删 parent 文件 | child **不被静默删除**，降级为 orphan（同第 2 行） |
| 改 parent | 旧关系立即消失（单父，无残留） |

### 2.4 与 `links` 表的关系

- **物理事实源 = Markdown frontmatter**。
- `links(relation='parent')` 仅作**派生索引**，供图查询/可视化消费；
  重建（reindex）时全量重算，**绝不作为第二事实源**。
- 冲突时（显式 parent 与 links 派生不一致）**永远以显式 `parent` 为准**。

### 2.5 明确否决的方案

| 否决项 | 理由 |
|---|---|
| SQLite `parent_id` 列 | 违反 ADR-001「Markdown = 唯一事实源」；reindex / import 后关系丢失（BUG-1 复现） |
| vault 子目录嵌套 `<parent>/child.md` | 为一个视觉隐喻改动身份键与整条 importer / watcher / 附件路径 / export-rebuild / sync 链，blast radius 过大 |
| `links` 作唯一存储 | 多态表可存 relation，但它是 DB；与铁规则 1 冲突 |
| 持久化 `children` | 反向声明必然产生双写不一致；children 应派生 |
| 多父 | 与既有 `links.relation` 语义重叠，造成双写 |

## 3. Frontmatter Round-Trip（地基，P0-1）

本 ADR 的**前置条件**，不是可选项。

现状 `compose_file(tags, body)` 只回写 `tags`，加任何新字段都会再踩一次雷。要求：

1. `parse_frontmatter ↕ compose_file` 必须保住**任意**既有 frontmatter key
   （不只 `tags` / `parent`），未知 key 不丢。
2. 「删 `parent`」必须**真正删除**该行，不能留空值。
3. 无 frontmatter key 时不写 `---` 块（保持现状，避免污染纯文本笔记）。
4. key 顺序稳定，避免无意义的 diff 噪音。

## 4. Implementation Order（P0 范围）

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0-1** | frontmatter round-trip（保任意 key + 真删除 + 稳定顺序） | 待施工 |
| **P0-2** | 显式 `parent` 读写 + 校验（orphan / 自指 / cycle） | 待施工 |
| **P0-3** | 统一 `resolve_hierarchy()`（explicit > inferred） | 待施工 |
| **P0-4** | `/graph`、`/universe` 统一消费 resolver | 待施工 |
| **P0-5** | round-trip / rebuild 守护测试——**升为 P0 验收标准** | 待施工 |

**不在 P0 范围**：左侧嵌套树 UI、稳定 note ID、星系视图改造（P0-4 只统一消费，不改视觉）。

### 4.1 守护测试表（P0-5 验收，12 项）

1. 无 parent 正常
2. parent 指向存在笔记 → 成功
3. parent 不存在 → 保留原值 + 标记 invalid
4. parent 自指 → 拒绝 / invalid
5. A→B→A → 检出 cycle
6. 两个 child 同 parent → 正常
7. 改 parent → 旧关系消失
8. 删 parent 文件 → child 不被静默删
9. compose 写回 → parent 不丢
10. export → rebuild → parent 不丢
11. legacy 无 parent → 仍走 fallback
12. **显式 parent 与 links 冲突 → 显式优先**（最关键，禁止结果摇摆）

## 5. Deferred（P1）

- **稳定 note ID**：独立 ADR。影响 rename / wikilink / graph / 引用 / sync /
  import-export，波及面足以单独成篇。**本 ADR 明确不绑带此项**，第一阶段维持
  `{title}.md` 身份不重构。
- 左侧嵌套树 UI（用户原始诉求「左边也要出现」）——地基完成后再做，见 §4。

## 6. Consequences

**正**：
- 关系跨 reindex / import / export / sync 不丢，兑现「Markdown 即真相」。
- 无新表、无新依赖、无 migration（`parent` 是文件内容，不是 schema）。
- 用户在任何编辑器打开 `.md` 都能看懂并手改关系。

**负 / 代价**：
- 标题寻址：主笔记改名需级联更新子笔记 frontmatter（P1 稳定 ID 解决）。
- 两套解析逻辑短期并存（显式 + legacy fallback），由单一 resolver 收敛，
  P0-4 后仅 resolver 内部可见。
- 校验失败态（orphan / cycle）需要 UI 呈现，第一版只暴露为数据标记，不阻断保存。
