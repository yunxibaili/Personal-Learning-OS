# ADR-026: Note Domain — 学科（Subject/Domain）维度 + 五级层级树

**状态**：Proposed（2026-09-01 登记，待项目所有者批准 + 3 项开放问题拍板）
**决策者**：待定（批准权在项目所有者）
**来源**：项目所有者 2026-09-01 提出的「Subject (Domain) + 5-Level Hierarchy」计划
**关联**：ADR-001（Storage / Markdown 真相）· ADR-024（Note Hierarchy，本 ADR 的层级语义地基）· ADR-008（Graph Model）· ADR-013（Frontend Design System）

---

## 1. Problem

用户需要按**学科**（数学 / 物理 / 编程 / …）组织笔记，并在左侧列表看到**最多五级**的
层级树。现状核查：

1. **笔记没有 domain 字段**。`concepts` 表有 `domain`（`GET /concepts?domain=` 过滤、
   `GET /concepts/domains` 聚合均已实现），但 notes 表与 frontmatter 均无对应概念。
2. **层级地基已完成**（ADR-024 P0+P1，2026-09-01）：显式 `parent` frontmatter、
   统一 `resolve_hierarchy()`、前端 `buildNoteTree` + `NoteTreeList`（单层缩进树）。
   但：无学科过滤、无后端树端点、展示深度未定、`/graph` 中笔记节点 domain 硬编码
   `None`（`core/knowledge.py::local_graph`）。
3. frontmatter round-trip 地基（ADR-024 P0-1）已修好——新增任意 frontmatter key
   不会再被保存时静默丢弃。

需要裁决：domain 存在哪、词表从哪来、树端点怎么建、与 concepts.domain 什么关系。

## 2. Decision（Proposed）

> **笔记学科 = frontmatter 顶层 `domain` 字符串（事实源）+ SQLite `notes.domain`
> 缓存列（migration 010）**——完全镜像 `tags` 的既有双存储模式
> （frontmatter 为真相、`tags_json` 为缓存）。层级树经唯一 resolver
> `resolve_hierarchy()` 构建后端投影端点 `GET /notes/tree`。

### 2.1 存储格式

笔记 frontmatter 顶层写：

```yaml
---
parent: "[[机器学习]]"
domain: 数学
tags: 神经网络
---
```

- 纯字符串，**不是** wikilink（domain 是分类标签，不是实体引用）。
- 空/缺失 = 未分类，不是错误；不强制填写。
- **SQLite `notes` 表加一列** `domain TEXT NOT NULL DEFAULT ''` 作为缓存
  （migration `010_notes_domain.sql`），仅用于快速过滤与聚合——
  删 SQLite 后 reindex 必须能仅凭 frontmatter 完整恢复（同 ADR-024 铁规则 1）。
- 写路径三处同步：create note（`NoteCreate.domain` → 写 frontmatter + 缓存）、
  patch note（`NotePatch.domain` → 同上；`""` 真删）、reindex（从 frontmatter
  提取缓存）。

### 2.2 与 concepts.domain 的关系

- **两套独立字段，不自动 join**。`notes.domain` 是用户对笔记的学科归类；
  `concepts.domain` 是概念实体的领域属性。笔记可以不挂任何概念但仍有学科。
- 词表风格保持一致（自由文本 + 端点聚合去重），为将来跨表统一词表留口，
  但本 ADR 不做统一（明确否决：借 domain 之名做 notes↔concepts 强关联推导）。

### 2.3 API 设计（均待批准后实现）

| 端点 | 语义 | 契约 |
|---|---|---|
| `GET /notes?domain=X` | 平铺列表按学科过滤 | `NoteSummary` 增加 `domain: string` |
| `GET /notes/domains` | 全库学科聚合去重（含计数） | `NoteDomainListResponse` |
| `GET /notes/tree?domain=X` | 后端预建层级树；domain 过滤**树根**（子节点随父保留） | `NoteTreeNode { note: NoteSummary, children: NoteTreeNode[] }` |
| `POST /notes` / `PATCH /notes/{id}` | domain 读写（`""` 真删，None 不改——同 parent 语义约定） | `NoteCreateBody` / `NotePatchBody`（TS 侧补 PATCH body 契约类型，当前缺失） |

**层级树铁规则（继承 ADR-024，不另立）**：

1. `/notes/tree` 的树结构**必须**经 `resolve_hierarchy()` 构建，禁止直读
   `links(relation='parent')` 自行拼树（ADR-024 §2.6 红线 2）。
2. 无效关系（orphan / 自指 / cycle）不进树，但**原始 frontmatter 值保留**，
   节点以根形态出现在平铺列表中（同 ADR-024 失败语义）。
3. **后端不限深度**——底层允许任意 `parent→parent→…` 链（ADR-024 铁规则 3 的
   forest），五级是**前端展示上限**，不是数据上限。
4. **Galaxy 维持两层**（主笔记=星球、副笔记=卫星）——这是呈现层决策
   （ADR-018 / 2026-08-30 裁决 A），本 ADR 不改。
5. `/graph` 笔记节点 `domain` 改读缓存列（替换 `knowledge.py:502` 硬编码 `None`）。

### 2.4 数据流

```text
创建主笔记 → 选学科 → frontmatter 写 domain + SQLite 缓存
创建副笔记 → parent 指定父笔记；domain 默认预填父值（前端行为，可覆盖）→ 同上
GET /notes/tree?domain=X
  → resolve_hierarchy() 取权威 parent_of
  → build forest（parent_of 多级链自然成树）
  → 按 domain 过滤树根（子树随父保留）
  → 返回 NoteTreeNode[]
```

### 2.5 明确否决的方案

| 否决项 | 理由 |
|---|---|
| domain 只存 SQLite 不写 frontmatter | 违反 ADR-001「Markdown = 唯一事实源」；reindex / import / sync 后学科丢失（BUG-1 同型） |
| 新表 `note_domains` / 复用 links | 一个标量字段不需要新表（AGENTS「无理由不加表」）；links 是关系表不是属性表（ADR-008） |
| 由 note↔concept 关联**推导**学科 | 间接且不可靠（大量笔记未挂概念）；语义混淆 notes 归类与 concepts 属性 |
| vault 子目录按学科分文件夹 | 与 ADR-024 §2.5 否决子目录同理：身份键 `path={title}.md` 波及 importer/watcher/附件/sync 全链 |
| 后端强制 domain 词表校验 | 与 concepts.domain 自由文本不一致；分类词表应由使用习惯涌现而非硬编码 |
| 后端限深五级 | 数据模型不该揣测展示需求；resolve_hierarchy 已天然支持任意深度 |

## 3. 实施范围（批准后）

| 层 | 改动 | 文件 |
|---|---|---|
| Migration | `010_notes_domain.sql`（`ALTER TABLE notes ADD COLUMN domain TEXT NOT NULL DEFAULT ''`） | `server/migrations/`（1 新文件） |
| Core | `parse_domain(meta)` / `set_meta_domain(meta, domain)`；reindex 提取；`local_graph` 读缓存列 | `server/app/core/knowledge.py` |
| Router | `NoteCreate/NotePatch.domain`；`_summary()` 加 `domain`；`GET /notes` domain 过滤；`GET /notes/domains`；`GET /notes/tree`（经 resolve_hierarchy） | `server/app/routers/notes.py` |
| Shared Types | `NoteSummary.domain` · `NoteCreateBody.domain` · **新增 `NotePatchBody`** · `NoteTreeNode` / `NoteTreeResponse` / `NoteDomainListResponse` | `shared/types/note.ts` |
| Frontend | 创建笔记学科下拉（预填父值）· 列表学科 badge · `GraphNoteNode` tooltip · 树/领域过滤接入 `NoteTreeList` | `web/src/views/NoteEditor.tsx` · `web/src/components/graph/GraphNoteNode.tsx` 等 |
| Tests | 契约往返 · domain 过滤 · tree 构建（含 orphan/cycle 不进树）· round-trip 守护 | pytest + vitest |

**验收**：pytest + vitest + tsc + vite build 全绿（P8 收尾政策）；
完成后同步 `DATA_MODEL.md`（DDL）与 `PROJECT_STATE.md` §6.3 migration 历史。

## 4. 待项目所有者拍板的 3 个开放问题

| # | 问题 | 计划内建议（未裁定） |
|---|---|---|
| Q1 | 学科词表：预定义列表（数学/物理/编程/…）还是完全自由文本？ | 自由文本 + `GET /notes/domains` 聚合（与 concepts.domain 一致）；后续可加「常用建议」 |
| Q2 | 子笔记是否自动继承父笔记 domain？ | 创建时前端**预填**父值、可覆盖；后端不做强制继承（保持数据中立） |
| Q3 | 树默认展开几级？ | 默认展开到 2 级，更深折叠；展示上限 5 级 |

> Q2 注意：若裁定「后端强制继承」，则 domain 写入发生在后端 create 路径，
> 与「数据中立」建议不同——实现前必须拍板，避免两层各写一半。

## 5. Consequences

**正**：
- 学科成为跨 reindex / import / export / sync 存活的一等元数据（frontmatter 真相）。
- 用户在任何编辑器可直接改 `domain:`，与 parent 同一套心智。
- 复用 tags 的成熟双存储模式，无新表、无新依赖，仅一个 additive migration。

**负 / 代价**：
- additive migration 010（本 ADR 是首个给 notes 表加列的层级/元数据类 ADR；
  ADR-024 的 parent 是零 migration 方案，domain 因需要 SQLite 侧快速过滤聚合而不同）。
- domain 与 concepts.domain 双轨并存，短期无统一词表约束——可能出现同义词
  （「数学」vs「高等数学」），聚合端点按原值去重不做归一化。
- 树端点与前端 `buildNoteTree` 短期并存（后者继续服务现视图）；`/notes/tree`
  落地时 `NoteTreeList` 切换数据源，`buildNoteTree` 若零引用则按废弃纪律删除。
