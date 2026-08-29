"""Token 限制与安全常量（M4-B）。

冻结常量：M4-C 接不同 Provider 时只改此处。
字符估算：英文 ≈4 chars/token，中文 ≈1.5 chars/token，取保守值 4。
"""
from __future__ import annotations

import re

# ── Token 估算 ─────────────────────────────────────────────────────

CHARS_PER_TOKEN = 4

# 各段字符上限（≈ tokens）
SYSTEM_CHAR_LIMIT = 2000    # ≈ 500 tokens
CONTEXT_CHAR_LIMIT = 10000  # ≈ 2500 tokens
QUERY_CHAR_LIMIT = 2000     # ≈ 500 tokens
MEMORIES_CHAR_BUDGET = 2000  # ≈ 500 tokens（B8-R2 方案 C：memories 段独立预算）

# 单次补全 token 预算（控制 LLM 成本；config `llm.max_tokens` 可覆盖）
MAX_COMPLETION_TOKENS = 2048

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

# 子串规则（拦 llm_api_key 等组合命名）
SENSITIVE_SETTING_TOKEN = "api_key"


def is_sensitive_setting(key: str, value: str) -> bool:
    """settings 条目是否敏感——**全项目唯二消费点的共同判定**。

    三规则并集（P1：互补单一规则的盲区）：
      1. 键名含 SENSITIVE_SETTING_TOKEN 子串（拦 llm.api_key）
      2. 键名按 . _ - 切段后任一段命中 SENSITIVE_FIELD_NAMES（拦 llm.token / db.password）
      3. 值以 SENSITIVE_CONTENT_PREFIXES 开头（拦存在任意键名下的 sk- 值）

    消费点语义不同，判定必须同源（2026-08-29 修：此前 routers/settings 只用规则 1，
    导致 llm.password / llm.token / 值为 sk- 的任意键在 GET /settings 明文返回）：
      - core/export：命中 → 整体排除（导出包不该有不完整凭据占位）
      - routers/settings：命中 → 掩码为 ******（保留键，前端需知道配置项存在）
    """
    k = key.lower()
    if SENSITIVE_SETTING_TOKEN in k:
        return True
    if any(seg in SENSITIVE_FIELD_NAMES for seg in re.split(r"[._-]", k)):
        return True
    return any(value.startswith(prefix) for prefix in SENSITIVE_CONTENT_PREFIXES)

# ── Context 版本 ──────────────────────────────────────────────────

CONTEXT_VERSION = "1"
