# Language Contract（M4-B）

> 多语言知识支持的冻结契约。与 ADR-015 配套。

---

## 原则

```
Content language independent
UI language configurable
Tutor response language adaptive
```

## 当前阶段（M4-B）

- 不实现语言检测
- 不实现语言切换
- 不修改 Prompt 结构
- metadata 保留扩展位

## Prompt 增补（未来 M4-C+）

```json
{
  "metadata": {
    "context_version": "1",
    "mode": "explain",
    "truncated": false,
    "detected_language": "zh",
    "response_language": "zh"
  }
}
```

## Tutor 输出语言规则

```
language=auto
  → detect(query language)
  → respond same language

language=en
  → force English

language=zh
  → force Chinese
```

## 语言检测（简易方法）

```python
def detect_language(text: str) -> str:
    """字符范围判断，不引入语言检测库。"""
    cjk_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    if cjk_count / max(len(text), 1) > 0.3:
        return "zh"
    return "en"
```

## Token 估算（未来调整）

```python
LANGUAGE_CHARS_PER_TOKEN = {
    "en": 4,
    "zh": 1.5,
    "ja": 1.5,
    "ko": 1.5,
}
```

## Concept 语言元数据（未来 M7+）

```sql
ALTER TABLE concepts ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE concepts ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]';
```

## 禁止

- 翻译 API（用户自己写双语笔记）
- 语言检测库（字符范围判断足够）
- Note 层语言字段
- SQLite 全文索引语言分割
