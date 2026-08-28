# ADR-015: Multilingual Knowledge Support

**状态**：已批准（2026-08-27）
**决策者**：项目负责人
**关联**：ADR-001（存储分层）· ADR-008（知识图谱模型）· ADR-011（中文搜索）· ADR-014（AI Tutor）· M4-B

---

## 1. Problem

项目定位是 Learning OS，不是中文笔记软件。必然遇到：

- 英文论文、教材、代码文档
- 中英混合知识库
- AI Tutor 双语解释
- 多语言术语对照（Backpropagation = 反向传播 = 逆伝播）

需要冻结多语言原则，防止后续开发时做出语言绑定决策。

## 2. Decision

### 2.1 核心原则

```
Content language independent
UI language configurable
Tutor response language adaptive
```

### 2.2 Markdown 真相层（不变）

```
vault/
 ├── machine-learning.md        # 英文笔记
 ├── gradient-descent.md        # 英文笔记
 └── 深度学习.md                # 中文笔记
```

禁止：
- `title_cn` / `title_en` 字段
- 翻译映射表
- 语言后缀文件名

Markdown 是自由文本，用户用什么语言写就保持什么语言。

### 2.3 Concept 层语言元数据

不在 Note 层，在 Concept 层增加 `language` + `aliases`：

```sql
-- 未来 migration
ALTER TABLE concepts ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE concepts ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]';
```

示例：

```json
{
  "title": "Backpropagation",
  "language": "en",
  "aliases": ["反向传播", "BP"]
}
```

```json
{
  "title": "梯度下降",
  "language": "zh",
  "aliases": ["Gradient Descent", "GD"]
}
```

一个 Concept 可以有多种语言的别名，但 `title` 是主标识。

### 2.4 Search 策略（渐进式）

```
M1-M5:   FTS5 文本匹配（已有）
M4:      LLM context 语言自适应（当前）
M7+:     语义搜索（触发条件：概念数 >2000）
```

跨语言搜索路径：

```
用户搜索 "梯度下降"
  ↓
FTS5 原语言匹配（命中中文笔记）
  ↓
alias 匹配（命中 "Gradient Descent" concept）
  ↓
（未来）LLM 翻译查询 + embedding 语义匹配
```

M4 阶段不引入 embedding，LLM context Builder 可用 alias 做概念关联。

### 2.5 AI Tutor 输出语言策略

`build_prompt()` 未来增加 `language` 参数：

```python
TutorMode = Literal["explain", "hint", "review", "debug"]

# 未来
def build_prompt(
    context: TutorContext,
    query: str,
    mode: TutorMode = "explain",
    language: str = "auto",  # "auto" | "en" | "zh" | ...
) -> TutorPrompt:
```

规则：

- `language="auto"`：检测 query 语言，用同语言回答
- `language="en"`：强制英文回答
- `language="zh"`：强制中文回答
- 检测方法：简单字符范围判断（中文字符占比 > 30% → zh），不引入语言检测库

Prompt 中冻结：

```
The learner asked in {detected_language}.
Respond in the same language as the question.
```

### 2.6 Token 估算调整

中文 token 密度高于英文（同样语义，中文字符少但 token 多）。

```python
# constants.py 未来调整
DEFAULT_CHARS_PER_TOKEN = 4  # 英文

LANGUAGE_CHARS_PER_TOKEN = {
    "en": 4,
    "zh": 1.5,
    "ja": 1.5,
    "ko": 1.5,
}
```

M4 阶段暂不实现，保留扩展位。

### 2.7 Mistake / Review 语言无关

`learning_events` 和 `mistakes` 不分语言字段：

```json
{
  "event_type": "answer_wrong",
  "content": "Cannot explain overfitting",
  "language": "en"
}
```

或：

```json
{
  "event_type": "answer_wrong",
  "content": "无法解释梯度消失",
  "language": "zh"
}
```

`language` 字段是可选元数据，不是强制列。

## 3. Consequences

### 代码影响

- **M4-B**：metadata dict 保留扩展位，不改结构
- **M4-C**：LLM Provider 可在 response 中记录 `detected_language`
- **M7+**：搜索增强时可用 `aliases_json` 做跨语言匹配
- **M8**：移动端 UI 语言独立于内容语言

### 禁止

- 不引入翻译 API（用户自己写双语笔记）
- 不引入语言检测库（字符范围判断足够）
- 不在 Note 层绑定语言字段
- 不在 SQLite 层做全文索引的语言分割

### 对现有模块的影响

- `tutor_types.py` — 不改（metadata 已是 dict，可扩展）
- `ai/tutor.py` — 不改（language 参数未来加，当前 auto 模式已隐含）
- `ai/constants.py` — 不改（LANGUAGE_CHARS_PER_TOKEN 未来加）
- `knowledge.py` — 不改

## 4. Implementation Timeline

| 阶段 | 做什么 |
|---|---|
| **现在（M4-B）** | 冻结 ADR-015 + 本文档 |
| **M4-C** | Prompt metadata 增加 `detected_language` |
| **M7** | Concept `language` + `aliases_json` 迁移 |
| **M7** | Search 增加 alias 跨语言匹配 |
| **M8** | UI language 独立配置 |
| **M9+** | Semantic search 跨语言 embedding |

## 5. References

- Obsidian：Markdown 原生，不限制语言，搜索/索引层处理差异
- Logseq：Markdown/Org 原生，结构化知识 vs 语言绑定
- Trilium Notes：多语言 UI，知识内容独立
- Lumina Note：英文 canonical + 多语言界面
