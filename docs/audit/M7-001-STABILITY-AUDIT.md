# M7-001 Stabilization Audit

> 日期：2026-08-27 · 审计范围：M7-001 Sync Engine Core + 全系统边界检查

---

## 1. Sync Engine Code Quality

### 1.1 已修复：_glob_match bug（scanner.py）

**问题**：自定义 `_glob_match` 函数使用 `pat_parts.index(pp)` 查找 `**`，但 `index()` 返回第一个 `**` 的位置，而非当前段的位置。导致嵌套目录文件（如 `vault/sub/ml.md`）无法匹配 `vault/**/*.md`。

**修复**：移除自定义 `_glob_match`，替换为 `_path_matches` 函数：将 pattern 按 `/` 拆分为段列表（保留 `**` 作为独立段），递归匹配。

**影响**：scanner.py 嵌套目录文件现在正确匹配。

### 1.2 已修复：死代码（manifest.py）

**问题**：`import os` 未被使用。

**修复**：移除。

### 1.3 测试覆盖

新增 `TestPathMatches`（8 个用例）覆盖：
- vault 直接文件 / 嵌套文件 / 深层嵌套
- eventlog / mindmap 匹配
- 错误扩展名 / 错误目录 / 无前缀不匹配

## 2. API 边界审计

### 2.1 已修复：settings.py 边界违规

**问题**：`routers/settings.py` 直接 `import sqlite3` 并执行原始 SQL，违反分层架构（§12：Backend 禁止触碰 SQLite）。

**修复**：
- `db.py` 新增 `get_all_settings()` 和 `put_settings()` 数据访问函数
- `settings.py` 移除 `import sqlite3`，改为调用 db.py 函数
- 异常处理改为捕获通用 `Exception`

### 2.2 其他 Router 状态

| Router | 数据访问方式 | 状态 |
|---|---|---|
| notes.py | core/knowledge.py | ✅ |
| graph.py | core/graph.py | ✅ |
| review.py | core/review.py | ✅ |
| mastery.py | core/mastery.py | ✅ |
| dashboard.py | core/dashboard.py | ✅ |
| knowledge_radar.py | core/knowledge_radar.py | ✅ |
| tutor.py | core/ai/tutor.py | ✅ |
| mindmap.py | core/mindmap.py | ✅ |
| universe.py | core/universe.py | ✅ |
| **settings.py** | **db.py（已修复）** | ✅ |

所有 Router 现在均通过 Core 或 db.py 访问数据。

## 3. 数据模型审计

### 3.1 表完整性

Migration 001-006 创建的表：
- `notes`, `concepts`, `links`, `concept_mastery` — 知识层
- `learning_events`, `review_queue`, `mistakes`, `memories` — 学习层
- `mind_maps`, `mind_map_nodes`, `mind_map_edges` — 思维导图层
- `conversations`, `messages` — AI 对话层
- `settings`, `schema_migrations` — 系统层

test_smoke.py expected 集合已更新（添加 review_queue）。

### 3.2 外键约束

`PRAGMA foreign_keys = ON` 在 `db.py:connect()` 中启用。006_mindmap.sql 包含正确的 FK 定义。

## 4. 同步测试覆盖（42 tests）

| 类别 | 测试数 | 覆盖内容 |
|---|---|---|
| TestManifest | 8 | FileEntry/Manifest 序列化、SHA-256 |
| TestPathMatches | 8 | ** 通配符匹配、前缀、嵌套、边界 |
| TestScanner | 10 | 扫描、黑名单、隐藏文件、嵌套目录、哈希正确性 |
| TestDiff | 16 | upload/download/skip/conflict、LWW、to_dict、多文件场景 |
| **总计** | **42** | |

## 5. 遗留项

- settings.py 异常处理现在捕获通用 `Exception`（替代 `sqlite3.Error`），可考虑定义 `SettingsError` 异常类
- scanner.py `_is_blacklisted` 仍使用 `fnmatch`（合理，黑名单无 `**` 模式）
- manifest.py `file_sha256` 可考虑大文件分块优化（当前 8KB 块已合理）
