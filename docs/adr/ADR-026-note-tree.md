# ADR-026: Note Hierarchy Tree — 主笔记五级层级树

**状态**：Proposed（2026-09-01 登记 v2，待项目所有者批准 + Q1–Q3 拍板）
**决策者**：待定（批准权在项目所有者）
**来源**：项目所有者 2026-09-01 需求——**「数学」只是学科示例，核心诉求是主笔记下面
挂最多五级、至少三层的子层级，像文件夹一样**；并要求调研业界还有哪些组织结构
（调研见 §2）。v1 原以「学科 domain」为主线，v2 依所有者澄清重构：
**层级树为主诉求，domain 降级为可选增强（P1）**。
**关联**：ADR-024（Note Hierarchy，本 ADR 直接放开其展示深度限制）· ADR-001（Markdown 真相）· ADR-018（Knowledge Universe / 星系两层不变）· ADR-023（Visualization Boundary）

---

## 1. Problem

用户要在左侧列表看到：主笔记为根、像文件夹一样逐层展开的子笔记树，
**至少 3 层、最多 5 层**。现状核查：

1. **数据层已就绪**：ADR-024 P0 已实现 child-side 单父 `parent`（frontmatter 事实源）
   + 统一 `resolve_hierarchy()`，底层**天然支持任意深度** `parent→parent→…` 链
   （铁规则 3 明文「底层允许 parent→parent→parent 链」）。
2. **缺口在展示与投影**：ADR-024 当时裁决「第一版 UI 只展示一层」——本 ADR 放开该限制；
   后端无树投影端点，前端 `NoteTreeList` 只按平铺列表 + `buildNoteTree` 渲染且未做
   深度展开策略。
3. 不需要任何新字段、新表、migration——**零 schema 变更**（domain 降级后，v1 设计里
   的 migration 010 一并取消，见 §5）。

## 2. 业界组织结构调研（2026-09-01 网络调研，结论落选型）

| 结构 | 代表产品 | 形态 | 与本项目关系 |
|---|---|---|---|
| **文件夹式树**（Librarian） | OneNote · Evernote · 文件系统 | 单父层级，笔记有唯一「位置」 | ★ 用户要的就是它——由 ADR-024 单父链 + 本 ADR 树投影实现 |
| 标签/元数据（Gardener） | Bear · Joplin | 多维横切分类，无层级 | 已有（frontmatter tags）；做横切过滤，不替代树 |
| 双链网络（Weaver / Zettelkasten） | Obsidian · Roam · Logseq | 网状关联，结构涌现 | 已有（wikilink + graph + 星系）；做「关联」，与树正交 |
| 大纲式 outliner | Workflowy · Dynalist · Logseq | 无限嵌套的块级大纲 | ❌ 形态冲突：本项目是 TipTap 长文笔记，非块编辑器 |
| 数据库多视图 | Notion | 同一内容按属性切多种视图 | ❌ 引入第二套数据模型，违反「无理由不加表/依赖」 |
| **多父层级** | Obsidian Breadcrumbs 插件 | 一条笔记同时挂多个父（多线索） | ❌ ADR-024 §2.5 已否决多父（与 links 语义重叠、双写不一致），维持否决 |
| PARA / Johnny.Decimal | 方法论 | 顶层分类框架 | 非存储结构，用户可在树上自行实践，产品不内置 |

**选型结论**：树（位置）、标签（分类）、双链（关联）回答三个不同问题，业界共识是
混合而非互斥。本项目只缺「位置」这一层——用单父 forest 补齐，其余不动。

## 3. Decision（Proposed）

> **树 = ADR-024 单父 forest 的展示层放开**：后端新增树投影端点
> `GET /notes/tree`（经唯一 `resolve_hierarchy()` 构建），前端层级树
> **默认展开 3 层、可展开至 5 层**；数据层零变更。

### 3.1 深度契约

| 层 | 规则 |
|---|---|
| 数据（ADR-024 不变） | 底层允许任意深度链，后端**不限深** |
| API | `GET /notes/tree` 返回完整森林，不做深度截断 |
| 前端展示 | **至少 3 层可直接浏览（所有者硬要求），上限 5 层**；第 5 层以下折叠为「…」入口（可点进该笔记改变视角继续浏览，见 §3.3） |

### 3.2 树端点设计

- `GET /notes/tree` → `NoteTreeResponse { trees: NoteTreeNode[] }`，
  `NoteTreeNode { note: NoteSummary, children: NoteTreeNode[] }`。
- 构建**必须**经 `resolve_hierarchy()`（ADR-024 红线 2：禁止直读
  `links(relation='parent')` 自行拼树）。
- 多棵树并存（forest）；排序沿用 `buildNoteTree` 既有约定（同层 `updated_at` 降序）。
- 无效关系（orphan / 自指 / cycle）不进树，原始值保留在 frontmatter（ADR-024 失败语义）。
- **Galaxy 维持两层**（星球+卫星，呈现层决策不变，ADR-018）——树与星系是两个视图，
  互不牵动。

### 3.3 前端交互（文件夹心智）

- 树根 = 无 parent 的笔记（主笔记）；层级缩进 + 折叠箭头（folder 展开心智）。
- 「＋」创建子笔记（P1-1 已实现，沿用到每一层）。
- 改父 = 改 frontmatter `parent`（PATCH 既有语义）；**拖拽移动 P1**（依赖稳定 note ID
  与标题级联更新，见 ADR-024 §5，不绑带）。
- 超过 5 层的子树：节点显示「…」占位，点击后以该笔记为根重新聚焦浏览
  （「进入文件夹」心智），不在一棵无限长树里硬渲染。

### 3.4 与标签/双链的分工（调研落点，写进设计以防腐蚀）

- 树回答「这条笔记在**哪里**」（位置，单父）；
- tags 回答「这条笔记**是什么**」（分类，多值横切）；
- wikilink/graph 回答「这条笔记**和谁有关**」（关联，网状）。
- 三者数据源独立（frontmatter `parent` / frontmatter `tags` / 正文 wikilink），
  任何视图不得用一类数据推导另一类（如：禁止用 tags 树状化、禁止用双链推断 parent——
  后者 ADR-024 已降级为 legacy fallback）。

## 4. 明确否决的方案

| 否决项 | 理由 |
|---|---|
| 多父层级（Breadcrumbs 式） | ADR-024 §2.5 已否决：与 links 多态语义重叠、双写不一致；调研未发现推翻理由，维持 |
| vault 子目录 `<parent>/child.md` | ADR-024 §2.5 已否决：身份键 `path={title}.md` 波及 importer/watcher/附件/sync 全链 |
| 前端硬限深 3 层 | 所有者要求「至少 3 层以上」——3 是下限不是上限；截断到 3 会砍掉 4–5 层合法数据 |
| 后端截断树深度 | 数据模型不揣测展示需求；截断应由前端按 3.1 深度契约做 |
| 大纲式块编辑器（outliner 化） | 与 TipTap 长文形态冲突，重写编辑器 blast radius 不可接受 |

## 5. domain 学科字段：降级为 P1 可选增强（待拍板保留与否）

v1 把「学科 domain」当主线；所有者澄清后确认**核心是层级树，学科只是举例**。
处置：

- **P0（本 ADR 主线）不含 domain**——零 migration、零新字段、零新表。
  v1 设计中的 `010_notes_domain.sql` 取消。
- 若所有者后续仍要学科维度，按 v1 已写好的设计原样执行（frontmatter `domain`
  事实源 + SQLite 缓存列 + `?domain=` 过滤——设计未废，只是降级排期），
  归入 **P1，待显式拍板**；届时 migration 重新编号。
  v1 设计存档：git 历史 `7f297f9`（ADR-026-note-domain.md v1 全文）。

## 6. 实施范围（批准后）

| 层 | 改动 | 文件 |
|---|---|---|
| Router | `GET /notes/tree`（经 resolve_hierarchy 构建森林） | `server/app/routers/notes.py` |
| Core | 森林构建辅助（若 hierarchy.py 需暴露多级 children 结构） | `server/app/core/hierarchy.py` |
| Shared Types | `NoteTreeNode` / `NoteTreeResponse` | `shared/types/note.ts` |
| Frontend | `NoteTreeList` 深度放开（默认展开 3 层、上限 5 层 + 「…」聚焦入口 + 折叠箭头） | `web/src/views/NoteEditor.tsx` · `web/src/components/notes/` |
| Tests | 树端点（多级链 / forest / orphan·cycle 不进树 / 深度不截断）· 前端展开策略纯函数测试 | pytest + vitest |

**验收**：pytest + vitest + tsc + vite build 全绿；**真实 vault 端到端验证 ≥3 层链
可在 UI 直接浏览**（纪律：只动 `parent` 字段或先备份，禁 PATCH content_md）。

## 7. 待项目所有者拍板的 3 个开放问题（v2）

| # | 问题 | 计划内建议（未裁定） |
|---|---|---|
| Q1 | 默认展开深度：3 层直接全展开，还是展开 3 层 + 4/5 层手动点开？ | 默认展开 3 层（满足「至少 3 层」硬要求），4/5 层点击展开 |
| Q2 | domain 学科字段：随树一并保留为 P1，还是彻底砍掉？ | 保留设计、P1 排期，不占 P0 |
| Q3 | 树排序：同层按 `updated_at` 降序（现约定）还是手动排序？ | 沿用 `updated_at` 降序；手动排序依赖稳定 note ID，P1 |

## 8. Consequences

**正**：
- 零 migration / 零新表 / 零新依赖——纯投影 + 展示层改动，兑现成本最低。
- 「位置」层补齐后，树/标签/双链三种结构正交互补，与 Obsidian 等主流实践一致。
- ADR-024 数据层不动，红线全部继续有效。

**负 / 代价**：
- ADR-024「第一版 UI 只展示一层」的裁决被本 ADR 显式取代（仅展示层，数据层不变）。
- 深链树的宽 + 深组合可能出现超长列表——以折叠 + 聚焦入口缓解，V1 不做虚拟滚动。
- 拖拽移动、手动排序依赖稳定 note ID（ADR-024 P1 遗留），第一版只能用「＋子笔记」
  和改 parent 字段达成，交互上不如文件夹软件顺手——如实记录，不为顺手引入大改。
