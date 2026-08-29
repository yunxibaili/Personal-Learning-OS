"""LLM Provider 配置与工厂（B1a）：settings 表驱动，代码不感知厂商。

settings 键（TECH_DESIGN §6.1）：
  llm.provider  = mock（默认）| openai_compat
  llm.base_url  = OpenAI-compatible 端点（如 http://127.0.0.1:11434）
  llm.api_key   = 密钥（只存在于 Provider 实例内，绝不进 context/export）
  llm.model     = 模型名
"""
from __future__ import annotations

from dataclasses import dataclass

from ...db import connect
from .constants import MAX_COMPLETION_TOKENS
from .providers.base import LLMProvider
from .providers.mock import MockProvider
from .providers.openai_compat import OpenAICompatProvider

DEFAULT_PROVIDER = "mock"
DEFAULT_MODEL = "deepseek-chat"


@dataclass(frozen=True)
class LLMConfig:
    provider: str = DEFAULT_PROVIDER
    base_url: str = ""
    api_key: str = ""
    model: str = DEFAULT_MODEL
    fast_model: str = ""  # extractor 等辅助调用用便宜模型；空 = 回退 model（ADR-003）
    max_tokens: int = MAX_COMPLETION_TOKENS  # 单次补全 token 预算（B1 加固）

    def __repr__(self) -> str:  # api_key 永不出现在任何字符串化输出
        tail = f"fast_model={self.fast_model!r}"
        return (f"LLMConfig(provider={self.provider!r}, base_url={self.base_url!r}, "
                f"model={self.model!r}, {tail}, api_key=***set***)"
                if self.api_key else
                f"LLMConfig(provider={self.provider!r}, base_url={self.base_url!r}, "
                f"model={self.model!r}, {tail}, api_key=)")


def load_llm_config(conn) -> LLMConfig:
    """从 settings 表读取 LLM 配置；未配置项取默认值。"""
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    kv = {r["key"]: r["value"] for r in rows}

    def _int(key: str, default: int) -> int:
        try:
            return int(kv.get(key, "") or default)
        except (TypeError, ValueError):
            return default

    return LLMConfig(
        provider=kv.get("llm.provider", DEFAULT_PROVIDER) or DEFAULT_PROVIDER,
        base_url=kv.get("llm.base_url", ""),
        api_key=kv.get("llm.api_key", ""),
        model=kv.get("llm.model", DEFAULT_MODEL) or DEFAULT_MODEL,
        fast_model=kv.get("llm.fast_model", ""),
        max_tokens=_int("llm.max_tokens", MAX_COMPLETION_TOKENS),
    )


def create_provider(config: LLMConfig) -> LLMProvider:
    """配置 → Provider 实例。未知 provider 回退 mock（不抛错，Tutor 永远可用）。"""
    if config.provider == "openai_compat" and config.base_url:
        return OpenAICompatProvider(
            base_url=config.base_url, api_key=config.api_key, model=config.model,
            max_tokens=config.max_tokens,
        )
    return MockProvider()


__all__ = ["LLMConfig", "load_llm_config", "create_provider"]
