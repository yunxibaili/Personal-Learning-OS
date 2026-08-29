"""LLM Provider Protocol（M4-C）。

所有 Provider 实现此接口。
返回纯文本，不直接写 DB。
"""
from __future__ import annotations

from collections.abc import Iterator
from typing import Protocol, runtime_checkable

from ...tutor_types import TutorPrompt


@runtime_checkable
class LLMProvider(Protocol):
    """LLM Provider 统一接口。"""

    def complete(self, prompt: TutorPrompt) -> str:
        """发送 prompt，返回完整响应文本。

        Args:
            prompt: 由 build_prompt() 产出的结构化 prompt

        Returns:
            str: LLM 响应文本

        Raises:
            ProviderTimeout: 超时
            ProviderError: 其他错误
        """
        ...

    def stream(self, prompt: TutorPrompt) -> Iterator[str]:
        """流式发送 prompt，逐块返回内容增量文本。

        每个 yield 一个非空字符串增量；对调用方约定的语义是：
        ``"".join(stream) == complete(prompt)``（增量拼装必须等于整段回答）。

        Args:
            prompt: 由 build_prompt() 产出的结构化 prompt

        Yields:
            str: 内容增量块

        Raises:
            ProviderTimeout: 超时
            ProviderError: 其他错误
        """
        ...
