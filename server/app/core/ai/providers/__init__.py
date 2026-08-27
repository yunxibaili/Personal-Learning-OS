"""LLM Provider 抽象层（M4-C）。"""
from .base import LLMProvider
from .mock import MockProvider

__all__ = ["LLMProvider", "MockProvider"]
