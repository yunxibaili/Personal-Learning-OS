# ADR-026: Note Hierarchy Tree — 主笔记多级层级树

**状态**：Accepted（2026-09-01 项目所有者批准 v2；同日批准附三处修订 → v3。
修订来源：所有者转交的外部评审意见，三项全部采纳，见 §3.0）
**决策者**：项目所有者
**来源**：项目所有者 2026-09-01 需求——**「数学」只是学科示例，核心诉求是主笔记下面
挂最多五级、至少三层的子层级，像文件夹一样**；并要求调研业界还有哪些组织结构
（调研见 §2）。v1 原以「学科 domain」为主线，v2 依所有者澄清重构：
**层级树为主诉求，domain 降级为可选增强（P1）**。
**关联**：ADR-024（Note Hierarchy，本 ADR 直接放开其展示深度限制）· ADR-001（Markdown 真相）· ADR-018（Knowledge Universe / 星系两层不变）· ADR-023（Visualization Boundary）

---

## 3.0 v2 → v3 修订记录（2026-09-01 批准时一并裁定）

所有者转交评审意见，指出 v2 三个风险，全部采纳为修订：

| # | v2 风险 | v3 修订 |
|---|---|---|
| R1 | full forest 一次性传输：500+ 篇时 JSON 可达数 MB，前端截断渲染但传输/解析成本全付 | **API 加 `depth` 参数后端剪枝**（§3.1/§3.2），展开更深时按节点懒加载子树 |
| R2 | 5 层硬上限悖论：数据允许无限深，前端到 5 层截断，第 6 层笔记用户看不到会以为 bug | **取消产品层硬上限**：默认展开 3 层 + 懒加载自然支持任意深度；「…」入口改为再请求子树而非仅换视角 |
| R3 | 循环检测：手动改 frontmatter 搞出 A→B→C→A 会死循环 | **实测已有地基**：`hierarchy.py::_detect_cycles` 在 `resolve_hierarchy()` 内把环上节点判 invalid 不进树（REASON_CYCLE）。补守护测试固化（§6），无新代码风险 |

**批准时实测输入**（四个确认问题的项目实况）：
① 笔记量级 **20 篇**（百级以下，懒加载主要作为前瞻防护，非当下瓶颈）；
② 左侧列表为**三栏工作区常驻左栏**（UI 裁决，2026-08-30）——懒加载因此必要；
③ 拖拽改 parent **P1**（依赖稳定 note ID，ADR-024 §5）；
④ domain 现有数据使用率 **0**（从未实现）——按 §5 保留设计不占排期。

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
| 大纲式 outliner | Workflowy · Dynalist · Logseq | 无限嵌套的块级大纲 | ❌ 形态冲突：本项目是 TipTap 长文笔记，非块编辑器（大纲范式列为长期演进备选，见 §3.5） |
| 数据库多视图 | Notion | 同一内容按属性切多种视图 | ❌ 引入第二套数据模型，违反「无理由不加表/依赖」 |
| **多父层级** | Obsidian Breadcrumbs 插件 | 一条笔记同时挂多个父（多线索） | ❌ ADR-024 §2.5 已否决多父（与 links 语义重叠、双写不一致），维持否决 |
| PARA / Johnny.Decimal | 方法论 | 顶层分类框架 | 非存储结构，用户可在树上自行实践，产品不内置 |

**选型结论**：树（位置）、标签（分类）、双链（关联）回答三个不同问题，业界共识是
混合而非互斥。本项目只缺「位置」这一层——用单父 forest 补齐，其余不动。

## 3. Decision

> **树 = ADR-024 单父 forest 的展示层放开**：后端新增树投影端点
> `GET /notes/tree`（经唯一 `resolve_hierarchy()` 构建），**API 按参数剪枝 +
> 展开时懒加载**；前端默认展开 3 层（满足「至少 3 层」硬要求）并记忆展开状态；
> 数据层零变更。

### 3.1 深度契约（v3 修订）

| 层 | 规则 |
|---|---|
| 数据（ADR-024 不变） | 底层允许任意深度链，数据层**不限深** |
| API | `GET /notes/tree?depth=N`：**后端构建到第 N 层即剪枝**，不序列化更深节点。默认 `depth=3`；**安全上限 10**（工程边界防滥用，非产品边界） |
| 懒加载 | 展开被剪枝的子树时 `GET /notes/tree?root_id=<id>&depth=2` 再取该节点下子树——**无产品层硬上限**，第 6 层及以后与第 1 层体验一致 |
| 前端展示 | **默认展开 3 层全展开**（所有者硬要求 ≥3）；更深处节点显示「…」，点击即懒加载展开；**本地偏好记忆展开状态**（localStorage，重开不丢） |

### 3.2 树端点设计

- `GET /notes/tree?depth=&root_id=` → `NoteTreeResponse { trees: NoteTreeNode[] }`，
  `NoteTreeNode { note: NoteSummary, children: NoteTreeNode[] }`。
  `root_id` 缺省 = 全森林（顶层）；指定 = 该节点为根的子树（懒加载入口）。
- 构建**必须**经 `resolve_hierarchy()`（ADR-024 红线 2：禁止直读
  `links(relation='parent')` 自行拼树）。
- **循环防护**：`resolve_hierarchy()` 内建 `_detect_cycles`——parent 链成环
  （含自指）时环上节点全部判 invalid 不进树，原始值保留在 frontmatter
  （ADR-024 失败语义）；树端点与守护测试不得绕过该路径。
- 多棵树并存（forest）；**排序 = 同层 `created_at` 升序**（v3 修订：大纲式
  「从上到下自然生长」，符合层级心智；弃用 v2 的 `updated_at` 降序——改错别字
  不应导致整棵树同级重排）。手动排序依赖稳定 note ID，P1。
- orphan（parent 指向不存在笔记）不进树，同 ADR-024 失败语义。
- **Galaxy 维持两层**（星球+卫星，呈现层决策不变，ADR-018）——树与星系是两个视图，
  互不牵动。

### 3.3 前端交互（文件夹心智）

- 树根 = 无 parent 的笔记（主笔记）；层级缩进 + 折叠箭头（folder 展开心智）。
- 「＋」创建子笔记（P1-1 已实现，沿用到每一层）。
- 改父 = 改 frontmatter `parent`（PATCH 既有语义）；**拖拽移动 P1**（依赖稳定 note ID
  与标题级联更新，见 ADR-024 §5，不绑带）。
- 被剪枝的子树：节点显示「…」，**点击 → `root_id` 懒加载该子树**并就地展开；
  展开状态写入本地偏好，刷新/重开后恢复。
- 左栏树常驻三栏工作区（UI 裁决 2026-08-30）：懒加载保证初始只拉 3 层，
  常驻不构成传输/内存负担。

### 3.4 与标签/双链的分工（调研落点，写进设计以防腐蚀）

- 树回答「这条笔记在**哪里**」（位置，单父）；
- tags 回答「这条笔记**是什么**」（分类，多值横切）；
- wikilink/graph 回答「这条笔记**和谁有关**」（关联，网状）。
- 三者数据源独立（frontmatter `parent` / frontmatter `tags` / 正文 wikilink），
  任何视图不得用一类数据推导另一类（如：禁止用 tags 树状化、禁止用双链推断 parent——
  后者 ADR-024 已降级为 legacy fallback）。

### 3.5 长期演进备选（不占排期）

- **大纲模式**：同一套 `parent` 数据换交互范式（Workflowy 式无限缩进行），
  数据结构零改动，未来若做「大纲视图切换」无需新端点。
- **Breadcrumb 导航**：NoteEditor 顶部显示 `祖先 > … > 当前` 面包屑 +
  左栏只渲染当前上下文（父+兄弟+直接子）——若未来懒加载仍不够轻可切换，
  端点只需复用 `root_id`。

## 4. 明确否决的方案

| 否决项 | 理由 |
|---|---|
| 多父层级（Breadcrumbs 式） | ADR-024 §2.5 已否决：与 links 多态语义重叠、双写不一致；调研未发现推翻理由，维持 |
| vault 子目录 `<parent>/child.md` | ADR-024 §2.5 已否决：身份键 `path={title}.md` 波及 importer/watcher/附件/sync 全链 |
| 前端硬限深 3 层 | 所有者要求「至少 3 层以上」——3 是下限不是上限 |
| **前端截断、API 永远返回 full forest**（v2 原案） | v3 依批准修订推翻 v2 的「后端不截断」否决：500+ 篇时传输/解析成本全付。改为 **API `depth` 剪枝 + 懒加载**（§3.1）；数据层仍零变更，剪枝只是 API 层行为 |
| 5 层产品硬上限（v2 原案） | 第 6 层笔记在树中不可见会被当作 bug；改为默认 3 层 + 懒加载无上限（§3.3） |
| 同层按 `updated_at` 降序（v2 沿用旧约定） | 树导航需要稳定性——改一个错别字就同级重排，用户找不到刚才的笔记；v3 改 `created_at` 升序 |
| 大纲式块编辑器（outliner 化） | 与 TipTap 长文形态冲突，重写编辑器 blast radius 不可接受（大纲范式见 §3.5 备选） |

## 5. domain 学科字段：保留设计、P1 排期（语义边界已裁定）

v1 把「学科 domain」当主线；所有者澄清后确认**核心是层级树，学科只是举例**。
批准裁定（v3）：**保留设计、归 P1 排期、不砍**，并明确语义边界：

- **domain = 「知识领域」**：Galaxy 星球（planet）的维度属性，横切分类，
  一篇笔记一个领域值；
- **parent = 「层级位置」**：树导航的结构关系，决定笔记在森林里的位置。
- 二者正交：**domain ≠ parent，不得互相推导、不得合并字段**。若未来实测发现
  parent 能完全替代 domain（用户从不在 Galaxy 用领域维度），再依 ADR 流程合并删除。
- 届时按 v1 已写好的设计原样执行（frontmatter `domain` 事实源 + SQLite 缓存列 +
  `?domain=` 过滤——设计未废，只是降级排期），migration 重新编号。
  v1 设计存档：git 历史 `7f297f9`（ADR-026-note-domain.md v1 全文）。

## 6. 实施范围

| 层 | 改动 | 文件 |
|---|---|---|
| Router | `GET /notes/tree`（`depth` 默认 3 / 上限 10 校验、`root_id` 懒加载入口；经 resolve_hierarchy 构建森林 + created_at 升序排序） | `server/app/routers/notes.py` |
| Core | 森林构建辅助（若 hierarchy.py 需暴露多级 children 结构；剪枝在构建后、序列化前做） | `server/app/core/hierarchy.py` |
| Shared Types | `NoteTreeNode` / `NoteTreeResponse` | `shared/types/note.ts` |
| Frontend | `NoteTreeList`：默认展开 3 层 + 「…」懒加载展开 + 折叠箭头 + **展开状态本地偏好**（localStorage） | `web/src/views/NoteEditor.tsx` · `web/src/components/notes/` |
| Tests | 树端点（多级链 / forest / orphan·**cycle 不进树且走 `_detect_cycles` 路径** / depth 剪枝正确 / root_id 子树 / created_at 升序 / depth>10 校验失败）· 前端展开策略与偏好记忆纯函数测试 | pytest + vitest |

**验收**：pytest + vitest + tsc + vite build 全绿；**真实 vault 端到端验证 ≥3 层链
可在 UI 直接浏览**（纪律：只动 `parent` 字段或先备份，禁 PATCH content_md）。

## 7. 开放问题 → 裁决记录（2026-09-01 批准时全部落定）

| # | 问题 | 裁决 |
|---|---|---|
| Q1 | 默认展开深度 | **默认 3 层全展开 + 本地偏好记忆展开状态**；更深懒加载无上限 |
| Q2 | domain 字段去留 | **保留设计、P1 排期**；语义边界 domain（知识领域）≠ parent（层级位置），见 §5 |
| Q3 | 树排序 | **同层 `created_at` 升序**（弃 `updated_at` 降序）；手动排序待稳定 note ID，P1 |

## 8. Consequences

**正**：
- 零 migration / 零新表 / 零新依赖——纯投影 + 展示层改动，兑现成本最低。
- 「位置」层补齐后，树/标签/双链三种结构正交互补，与 Obsidian 等主流实践一致。
- ADR-024 数据层不动，红线全部继续有效。
- API 剪枝 + 懒加载：初始只传 3 层，笔记涨到千级也不复刻 full forest 性能陷阱；
  循环防护复用既有 `_detect_cycles`，无新增数据风险。

**负 / 代价**：
- ADR-024「第一版 UI 只展示一层」的裁决被本 ADR 显式取代（仅展示层，数据层不变）。
- 懒加载引入「展开即请求」的异步状态管理（loading/失败重试/展开状态持久化），
  前端复杂度高于 v2 一次性加载——以纯函数（展开策略/偏好读写）+ 单测消化。
- 拖拽移动、手动排序依赖稳定 note ID（ADR-024 P1 遗留），第一版只能用「＋子笔记」
  和改 parent 字段达成，交互上不如文件夹软件顺手——如实记录，不为顺手引入大改。
