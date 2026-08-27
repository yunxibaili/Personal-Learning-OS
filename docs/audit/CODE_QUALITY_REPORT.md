# Code Quality Report

> 日期：2026-08-27 · 范围：server/ + web/src/

---

## 1. Python 代码质量

### 1.1 已修复

| 问题 | 文件 | 状态 |
|---|---|---|
| `import sqlite3` 直接在 router | settings.py | ✅ 已修复（提取到 db.py） |
| 死代码 `import os` | manifest.py | ✅ 已修复 |
| 自定义 `_glob_match` bug | scanner.py | ✅ 已修复 |
| Unused `import re` | attachments.py | ✅ 已修复 |
| Unused `Field` import | mindmap.py | ✅ 已修复 |
| Unused `JSONResponse` import | universe.py | ✅ 已修复 |
| Unused `timedelta` import | mastery.py | ✅ 已修复 |
| Unused `import os` | test_tutor_prohibition.py | ✅ 已修复 |

### 1.2 已知 Tech Debt（不在 stabilization 中修复）

| 问题 | 文件 | 严重度 | 说明 |
|---|---|---|---|
| Raw SQL in router | notes.py | Medium | 4 处 SQL 应提取到 core/knowledge.py |
| Raw SQL in router | mastery.py | High | 7 处 SQL 应提取到 core/mastery.py |
| Raw SQL in router | links.py | Low | 1 处 SQL 应提取到 core/ |
| Bare `except Exception` | settings.py | Low | 捕获通用异常，丢失 traceback |
| `pass` in except | knowledge.py:232 | Low | 静默跳过 JSON 解析错误 |

### 1.3 无问题

- `print()` 语句：0
- TODO/FIXME/HACK：0
- 硬编码密钥：0（测试夹具除外）
- Core 层违规（import FastAPI）：0
- Router 层 `import sqlite3`：0（已全部修复）

## 2. 前端代码质量

### 2.1 已修复

| 问题 | 文件 | 状态 |
|---|---|---|
| Emoji 违反 ADR-013 | KnowledgeRadar.tsx | ✅ 已修复（3 处） |
| `--bg-alt` 未定义 | global.css | ✅ 已修复 |

### 2.2 已知 Tech Debt

| 问题 | 文件 | 严重度 | 说明 |
|---|---|---|---|
| `.radar-content` 无 CSS | KnowledgeRadar.tsx:65 | Low | 包装 div 无样式 |
| `.muted` 作用域过窄 | global.css:192 | Medium | 只在 `.graph-toolbar` 下定义，5+ 处使用无样式 |
| 重复 mastery CSS | global.css + TutorPanel.css | Low | 4 个类重复定义，TutorPanel 覆盖全局 |
| `console.log` | 无 | — | 干净 |
| TODO/FIXME | 无 | — | 干净 |

## 3. 总结

| 类别 | 已修复 | Tech Debt | 总计 |
|---|---|---|---|
| Python | 8 | 5 | 13 |
| Frontend | 2 | 3 | 5 |
| **总计** | **10** | **8** | **18** |

stabilization 修复了 10 个问题，记录了 8 个 tech debt 项供后续里程碑处理。
