"""Token 限制与安全常量（M4-B）。

冻结常量：M4-C 接不同 Provider 时只改此处。
字符估算：英文 ≈4 chars/token，中文 ≈1.5 chars/token，取保守值 4。
"""
from __future__ import annotations

# ── Token 估算 ─────────────────────────────────────────────────────

CHARS_PER_TOKEN = 4

# 各段字符上限（≈ tokens）
SYSTEM_CHAR_LIMIT = 2000    # ≈ 500 tokens
CONTEXT_CHAR_LIMIT = 10000  # ≈ 2500 tokens
QUERY_CHAR_LIMIT = 2000     # ≈ 500 tokens

# ── 安全过滤 ──────────────────────────────────────────────────────

# 字段名黑名单（精确匹配，小写）
SENSITIVE_FIELD_NAMES = frozenset({
    "api_key", "apikey", "api-key",
    "password", "passwd", "pwd",
    "secret", "secret_key",
    "access_token", "refresh_token",
    "private_key", "ssh_key",
    "token",
})

# 内容模式黑名单（前缀匹配，用于值过滤）
SENSITIVE_CONTENT_PREFIXES = (
    "sk-",          # OpenAI API key
    "Bearer ",      # Auth header
    "ghp_",         # GitHub token
    "xoxb-",        # Slack token
)

# ── Context 版本 ──────────────────────────────────────────────────

CONTEXT_VERSION = "1"
