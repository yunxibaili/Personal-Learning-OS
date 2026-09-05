# ADR-028 · 文档变更抽象层（Document Revisions）

- 状态：**已接受并封口**（2026-09-04 接受；**2026-09-05 所有者裁定封口**）

  > **封口含义**：ADR-028 后端核心实现完成且冻结，禁止「顺手收尾」式扩权。
  > 剩余四项均为**新任务**，须在各自任务上下文中另立：① Git revision source adapter
  > ② 前端 revision/history/diff UI ③ frontmatter-only 变化是否触发快照（**已登记的
  > 语义边界，非 bug，不得重开**）④ 孤儿快照长期垃圾回收策略。
  > **不得因存在 ② 而解释为前端解冻**：前端消费须 Owner 显式宣布
  > Frontend Consumer 解冻后才成立（见 `PROJECT_STATE.md` §0）。
- 关联：`ADR-001`（Markdown 唯一事实源）· `ADR-005`（多端同步）· `ADR-020`（同步真相模型）
- 冲突登记：`AGENTS.md §4` 字面禁令，**本 ADR 即其豁免依据**

---

## 1. 背景与问题

Knowledge Workspace 需要展示笔记的变更历史与差异对比（Revision / Changes / Diff）。
项目此前**完全没有**文档级版本能力：

| 已有 | 实质 | 能否充当 revision |
|---|---|---|
| `notes.content_hash` | `sha256(body)`，仅用于增量索引判断 | ❌ 不保存历史 |
| `core/sync/diff.py::diff_manifests` | Manifest 级 hash 比对（upload/download/conflict/skip） | ❌ 文件级，非文本 diff |
| `core/vault_watcher.py::snapshot` | `{path: (mtime, size)}` 状态快照 | ❌ 不含内容 |
| `learning_events` / `eventlogs/*.jsonl` | 学习事件日志 | ❌ 语义不同（学习行为，非文档） |

## 2. 决策

建立**与 Git 解耦的文档变更抽象层**。当前实现两个 revision source：

```
current    直接读 workspace/vault/ 下的 Markdown（唯一事实源，ADR-001）
snapshot   读 workspace/metadata/revisions/ 下的历史快照文件
```

`git` source 是后续独立任务，**本 ADR 不为其预留抽象层**（见 §6）。

### 2.1 明确排除（不实现）

不调用 git CLI · 不实现 branch / commit / stash / merge / rebase / cherry-pick。
本层不是 Git 客户端，也不替代 Git。

---

## 3. 存储布局

```
workspace/metadata/revisions/<vault 相对路径>/<YYYYmmddTHHMMSSZ>-<hash8>.md
```

例：`workspace/metadata/revisions/Adam优化器.md/20260904T083000Z-a1b2c3d4.md`

### 3.1 为什么落文件系统而非 SQLite（**零新增 migration**）

`AGENTS.md §3` 多端可见性铁律 + ADR-005：SQLite 在任何设备上都只是**可重建的本地缓存**，
db 永不参与同步。两处白名单只收 workspace/ 下的文件：

- `EXPORT_DIRS`（`core/export.py`）
- `SYNC_PATTERNS`（`core/sync/manifest.py`）

快照若落表 → 既不进导出包、也不参与多端同步 → 直接违反「用户数据永不锁死」红线
（`AGENTS.md §3`）。**故禁止为快照新增 SQLite 表。**

### 3.2 为什么目录不在 `vault/` 下

`reindex.py` 用 `vault_root.rglob("*.md")` 递归扫描且**无隐藏目录豁免**。
快照放在 vault/ 下会被当成正式笔记吞进索引，并触发 `vault_watcher` 的 reindex 风暴。

### 3.3 为什么目录键用路径而非 `note_id`

`note_id` 是 SQLite 自增主键，db 不同步（ADR-005），**跨设备不保证一致**。
故目录键 = vault 相对路径（含 `.md`），镜像 vault 目录结构，天然支持
`importer` 产生的嵌套路径（`imported/sub/note.md`）。
以完整路径（而非去扩展名）作目录键，排除 `a/b.md` 与 `a/b/c.md` 的歧义。

重命名由 `rename_revision_dir()` 迁移；路径越界（含 `..`、绝对路径、反斜杠）一律拒绝。

### 3.4 快照文件即合法 Markdown

```
compose_file({**笔记原 frontmatter, **rev_* 元数据}, body)
```

- `rev_` 前缀命名空间避免与用户 frontmatter key 冲突；
- 剥离 `rev_*` 后即可 `compose_file(note_meta, body)` 无损还原原笔记文件；
- 快照可被任何外部编辑器直接打开，符合「vault 永远是开放 Markdown」精神。

元数据键：`rev_id` · `rev_origin`（auto/manual）· `rev_hash` · `rev_prev_hash` ·
`rev_created_at` · `rev_note_path`。

> **术语区分**：`source` = revision source（`current`/`snapshot`，抽象层轴）；
> `origin` = 快照触发方式（`auto`/`manual`），与 `concepts.origin` 用词一致。

---

## 4. 快照策略

| 项 | 决策 |
|---|---|
| 触发 | **写前去抖自动** + **手动打点**（`POST /notes/{id}/revisions`） |
| 去抖 | 内容哈希去重（与最新一份相同则跳过）**且** 距上次快照 ≥ 300s |
| 时机 | 在 `atomic_write_file` **之前**调用，快照的是**即将被覆盖的旧内容** |
| 上限 | 每篇保留最近 50 份，超出按时间序淘汰最旧 |
| 重命名 | 迁移快照目录；目标已存在则不覆盖（防御性兜底） |
| 删除 | **保留**快照以支持误删恢复；人工清理走 `DELETE /notes/{id}/revisions` |
| 恢复 | 既有笔记 `POST /notes/{id}/revisions/{rev_id}/restore`；已删笔记走
  `GET /admin/revisions/orphans` + `POST /admin/revisions/restore` 重建 |
| 导出 | **进** `EXPORT_DIRS`（用户数据，必须可全量导出） |
| 同步 | **不进** `SYNC_PATTERNS`（历史是本地便利能力，不是跨设备事实） |

> `rev_note_path` 记录**快照创建时**的路径，不随重命名回改 ——
> 修订记录应当记录历史，而非当前状态。

> `origin` 取值：`auto`（写前去抖）· `manual`（显式打点）· `restore`（恢复前对
> 被覆盖状态的留存——恢复本身可逆的前提）。

**已知边界（有意为之，非缺陷）**：去重键是**正文哈希**——仅 frontmatter 变化
（tags/parent）不产生新快照；相应地，恢复在"仅 frontmatter 差异"时也不留
pre-write 快照（差异仅 tags/parent，且是用户显式选择丢弃的状态）。
正文仍是唯一去重与排序对象，与 `notes.content_hash` 语义一致。

### 4.1 失败不阻断

vault 是唯一事实源（ADR-001），快照是派生便利能力。
**快照写入/迁移失败绝不阻断笔记保存**，只记日志。

---

## 5. API

前缀 `/api/v1/notes`（与 `routers/notes.py` 同前缀）。

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/notes/{note_id}/revisions` | 版本列表，首位 `current`，其余快照时间倒序 |
| `POST` | `/notes/{note_id}/revisions` | 手动打点；内容未变返回 `created: false` |
| `GET` | `/notes/{note_id}/revisions/{rev_id}` | 读指定版本内容（`current` 为保留字） |
| `GET` | `/notes/{note_id}/changes` | 当前 vs 最新快照的变更概览 |
| `POST` | `/notes/{note_id}/diff` | 任意两版本结构化 diff |
| `DELETE` | `/notes/{note_id}/revisions` | 清理该笔记全部快照 |
| `POST` | `/notes/{note_id}/revisions/{rev_id}/restore` | 恢复到指定快照（恢复前留 `origin=restore` 快照，可逆） |

前缀 `/api/v1/admin`（管理面）：

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/admin/revisions/orphans` | 孤儿快照列举（笔记已删、快照仍在） |
| `POST` | `/admin/revisions/restore` | 从孤儿快照重建笔记（走常规创建写路径） |

字段一律 `snake_case`；错误统一 `{"error":{"code","message"}}`。

**diff 响应**同时给两种形态：

- `hunks`：`{op, old_start, old_end, new_start, new_end}`，0-based 左闭右开，
  **只含非 equal 段**，供前端块级高亮；
- `unified`：unified diff 文本，供人读与导出。

> ⚠️ `SequenceMatcher(..., autojunk=False)` 是**必需**的：默认启发式会把出现频次
> >1% 的行判为 junk 并排除，对文本 diff 产生错误结果（实测：300 行 5 种取值的文本
> 只改 1 行，autojunk=True 报 changed=150，False 报 changed=1）。

---

## 6. 被否决的方案

| 方案 | 否决理由 |
|---|---|
| SQLite 新表存快照 | 不进导出/同步，违反 `AGENTS §3` 与 ADR-005（§3.1） |
| 快照放 `vault/.revisions/` | 被 `rglob("*.md")` 吞成笔记 + reindex 风暴（§3.2） |
| 用 `note_id` 做目录键 | db 不同步，跨设备错位（§3.3） |
| 复用 `eventlogs/*.jsonl` | 语义不同（学习事件 vs 文档正文）；正文进 JSON 转义后不可直读，违背「Markdown 是唯一事实源」精神 |
| 每次 PATCH 全量快照 | autosave 场景下存储爆炸 |
| 现在就建 git adapter 抽象层 | 违反 `AGENTS §6`「没有真实复杂度就不制造 Adapter/Provider 层」；只有一个真实分支点时 `if/elif` 足够，等 git 真正接入再提取 |
| 调用 git CLI 实现 | 任务明令禁止；且 vault 用户数据整体 gitignore，Git 本就不覆盖 |

---

## 7. 与 `AGENTS.md §4` 的关系（冲突登记）

`AGENTS.md §4` 原文：

> Git 是 Source Code / Architecture / Configuration Template / Documentation 的**唯一版本真相**
> 禁止自造 commit / diff / patch / branch / history 系统

**冲突判定：术语层面成立，方向层面不成立。**

1. §4 的 Git 真相域有明确枚举 —— `Source Code / Architecture / Configuration
   Template / Documentation`，**不含用户笔记数据**；
2. `AGENTS.md §18 §2`「用户数据永不入库」：`workspace/` 整体 `.gitignore`；
3. 推论：**vault 中的用户笔记根本不在 Git 覆盖范围内**。Git 对它们不是"真相"，
   而是完全不覆盖。

故本层不是「自造 Git 替代品」，而是给 Git 覆盖不到的用户数据层补一个变更记录层。
按 `AGENTS.md` 序言第 ②–⑤ 条，已在 `AGENTS.md §4` 补作用域澄清，并经所有者确认。

**持续约束**：本层永久禁止引入 branch / commit / merge / rebase 等 Git 概念与术语。

---

## 8. 后续任务（不在本 ADR 范围）

- ~~已删除笔记的孤儿快照回收~~ **已完成**（`GET /admin/revisions/orphans` +
  `POST /admin/revisions/restore`）
- ~~从快照恢复笔记的端点~~ **已完成**（既有笔记 restore + 孤儿重建两条路径）
- Git revision source 适配器（独立任务，届时再提取 source 分派）
