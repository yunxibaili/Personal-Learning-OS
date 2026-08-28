# ADR-012: Context-Aware Knowledge Assistance Architecture

**状态**：已批准（2026-08-26）
**决策者**：项目负责人
**关联**：M3.5-A Knowledge Radar MVP · M3.5-B Full Omniscience · ADR-008（图谱模型）· ADR-009（Entity vs Document）

---

## 1. Problem

用户写作时，系统无法主动关联已有知识。搜索是被动的——用户必须知道要搜什么。

核心矛盾：
- Obsidian 模式：用户主动找知识（搜索/浏览图谱/翻反链）
- 目标模式：知识主动找用户（上下文感知 + 实时建议）

这不是"自动补全文字"（Copilot），而是"知识注入学习"——系统在用户写作时，主动提示相关笔记、概念关系、学习状态。

## 2. Decision

引入 **Omniscience Mode（全知领域）** 作为编辑器上下文感知层。

分两阶段：
- **M3.5-A** Knowledge Radar MVP：纯本地检索（FTS + Graph），无 AI，无学习记忆
- **M3.5-B** Full Omniscience：接入 concept_mastery + SM-2 + mistakes + AI Tutor

## 3. Architecture

```
TipTap Editor
     ↓
Context Collector（段落/选文提取，不触发 API）
     ↓
Knowledge Trigger Engine（debounce 500ms，提取查询词）
     ↓
Knowledge Sources:
  ├─ FTS5（笔记全文匹配，M3.5-A）
  ├─ Graph（邻居概念 + 反链，M3.5-A）
  ├─ Learning Memory（mastery + review + mistakes，M3.5-B）
  └─ AI（LLM 增强，M4+）
     ↓
Knowledge Radar UI（Ctrl+Shift+K 唤起，右侧面板）
```

### 3.1 核心模块

**Context Collector**：
- 从 TipTap Editor 提取当前段落文本或选中文本
- 不触发网络请求，纯前端计算
- 提取策略：选中文本优先 → 当前段落 → 光标前 50 字符

**Knowledge Trigger Engine**：
- 新增 `server/app/core/knowledge.py` → `suggest_for_context()`
- 接收查询词，返回匹配结果 + 图谱邻居 + 学习状态（占位）
- 纯 SQL 查询，无 LLM 调用，响应 <200ms

**Knowledge Radar UI**：
- `web/src/components/KnowledgeRadar.tsx`
- 默认隐藏，`Ctrl+Shift+K` 或顶部 `⚡` 按钮切换
- 渲染三区域：匹配笔记/概念 · 相关概念 · 学习状态（占位）

### 3.2 API 设计

```
GET /api/v1/knowledge/suggest?q=&note_id=&limit=
```

响应：
```json
{
  "matches": [
    {"type": "note", "id": 3, "title": "冒泡排序", "snippet": "...", "score": 0.95}
  ],
  "related": [
    {"title": "快速排序", "relation": "sibling"}
  ],
  "memory": {
    "mastery": null,
    "review_due": null,
    "last_mistake": null
  }
}
```

M3.5-A 阶段 `memory` 全部返回 null。

## 4. Principles

### 4.1 本地知识优先

```
Vault > SQLite > Graph > AI
```

数据来源优先级：已有笔记内容 → FTS 索引 → 图谱关系 → 学习记忆 → AI 增强。
任何一层返回足够结果即停止，不向上层请求。

### 4.2 禁止实时 LLM 作为第一层

错误模式：
```
输入一个词 → 调用 AI → 生成回答
```

正确模式：
```
输入 → 本地匹配 → 需要时 AI 增强
```

LLM 只在 M4+ 阶段作为可选增强，不作为默认行为。

### 4.3 不改变 Markdown 真相

知识雷达只是辅助视图。任何建议必须经用户确认才能写入笔记。
禁止自动插入内容到编辑器。

### 4.4 不叫"自动补全"

产品术语：Knowledge Suggestion（知识建议）。
禁止使用"Auto Complete"——目标是帮助学习，不是代替写作。

## 5. Scope Boundary（边界）

### Phase A（M3.5-A）允许

- ✅ 本地 FTS 搜索匹配
- ✅ 图谱邻居概念推荐
- ✅ 反链关系展示
- ✅ 点击跳转到相关笔记/概念

### Phase A 禁止

- ❌ 自动修改用户笔记内容
- ❌ 自动替用户学习（强制展示学习建议）
- ❌ 强制插入内容到编辑器
- ❌ 调用外部 LLM API

### Phase B（M3.5-B）新增

- ✅ 掌握度显示（concept_mastery）
- ✅ 复习建议（review_due）
- ✅ 错误历史提示（mistakes）
- ✅ AI Tutor 增强（M4+）

## 6. Evolution Path

| 阶段 | 里程碑 | 能力 |
|---|---|---|
| Phase A | M3.5-A Knowledge Radar MVP | FTS + Graph + 基础 Radar |
| Phase B | M3.5-B Full Omniscience | + mastery + review + mistakes |
| Phase C | M4+ AI Tutor Integration | + LLM 增强 + 自动生成 |

## 7. Rejected Alternatives

| 方案 | 拒绝原因 |
|---|---|
| Copilot 式文字补全 | 目标不同：学习辅助 ≠ 写作辅助 |
| 默认常驻右侧面板 | 干扰"思考模式"，降低沉浸感 |
| 硬编码快捷键 | 用户环境不同，应可配置 |
| `[[` 触发器（Obsidian 风格） | 属于 Mind Map 编辑器范畴（M2b），不在本 ADR 范围 |
| 向量搜索/语义匹配 | 引入 embedding 依赖，违反 minimal dependencies；当前 FTS + 图谱已够用 |

---

## 附录：交互设计

### 冻结状态（M3.5-A 评审批准后）

- Radar 结果上限冻结：`MAX_SUGGEST_MATCHES = 5` · `MAX_RELATED_CONCEPTS = 5`
- 不再扩展 Radar 功能，作为 M3 的消费者
- ADR-013（Context Extractor）/ ADR-014（suggest cache）为候选，见触发条件

### 快捷键

| 平台 | 默认值 | 可配置 |
|---|---|---|
| Windows/Linux | `Ctrl+Shift+K` | ✅ Settings → shortcuts.knowledge_radar |
| macOS | `Cmd+Shift+K` | ✅ |

### UI 状态

- **关闭**：顶部 `○` 按钮，面板隐藏
- **开启**：顶部 `⚡` 按钮，右侧面板展开
- 状态不持久化——每次打开笔记默认关闭

### 面板布局

```
┌─────────────────────┐
│ ⚡ 知识雷达           │
├─────────────────────┤
│ 📘 匹配笔记          │
│   冒泡排序 (0.95)    │
│   排序算法 (0.82)    │
├─────────────────────┤
│ 🔗 相关概念          │
│   快速排序           │
│   插入排序           │
├─────────────────────┤
│ 🧠 学习状态          │
│   暂无数据（M3.5-B） │
└─────────────────────┘
```
