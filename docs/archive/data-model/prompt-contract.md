# Prompt Contract（M4-B）

> AI Prompt 结构的冻结契约。M4-C 接 LLM Provider 时以此为准。

---

## Input

```python
from app.core.tutor_types import TutorContext, TutorMode

context: TutorContext   # 由 build_tutor_context() 产出
query: str             # 用户问题
mode: TutorMode        # "explain" | "hint" | "review" | "debug"
```

## Output

```python
from app.core.tutor_types import TutorPrompt

prompt: TutorPrompt
```

结构：

```json
{
  "system": "You are Learning OS Tutor...",
  "messages": [
    {"role": "user", "content": "Learner context:\n\n...\n\nQuestion:\n..."}
  ],
  "metadata": {
    "context_version": "1",
    "mode": "explain",
    "truncated": false
  }
}
```

## TutorMode

| Mode | 用途 | 行为 |
|---|---|---|
| explain | 解释概念 | 清晰讲解，引用掌握度调整深度 |
| hint | 提示 | 不直接给答案，用问题引导 |
| review | 复习 | 基于掌握度提问测试回忆 |
| debug | 代码分析 | M4-B fallback to explain |

## Token 限制

| 段 | 字符上限 | ≈ Tokens |
|---|---|---|
| system | 2000 | 500 |
| context | 10000 | 2500 |
| query | 2000 | 500 |
| **total** | **14000** | **3500** |

字符估算：`CHARS_PER_TOKEN = 4`

## 安全过滤（双重防御）

### Layer 1: Context Builder（tutor_context.py）

负责：不输出危险数据（db_path, api_key, filesystem, migration）

### Layer 2: Prompt Builder（ai/tutor.py）

负责：即使收到异常 context，也不送入模型

过滤规则：

- **字段名黑名单**：api_key, password, secret, token 等 → 删除整个字段
- **内容前缀黑名单**：sk-, Bearer , ghp_, xoxb- → 替换为 `[REDACTED]`

注意：正常知识内容（如 "token bucket algorithm"）不被误删。

## 禁止行为

Prompt Builder 不得：

- 查询 SQLite
- 读取文件
- 调用网络
- 修改 event / mastery
- 引入新依赖

## 与 M4-A 的关系

```
M4-A: build_tutor_context(conn, concept_id) → TutorContext
                                    ↓
M4-B: build_prompt(context, query, mode) → TutorPrompt
                                    ↓
M4-C: LLM Provider(prompt) → Response
```

## 与 shared/types/tutor.ts 的关系

- `tutor_types.py` 是 Python Core 内部 contract
- `shared/types/tutor.ts` 是 API response contract
- 两者概念对齐，不强耦合
- M4-B 无 API 变更，不修改 tutor.ts

## Language Handling

Prompt builder MUST NOT assume Chinese content.

Supported:
- English
- Chinese
- Mixed language

Default:
Response language follows user query language.

Future (M4-C+):
metadata 可扩展 `detected_language` / `response_language` 字段。
详见 `docs/data-model/language-contract.md` + `docs/architecture/ADR-015-multilingual.md`。
