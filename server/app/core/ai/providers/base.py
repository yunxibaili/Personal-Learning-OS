"""LLM Provider Protocol（M4-C）。

所有 Provider 实现此接口。
返回纯文本，不直接写 DB。
"""
from __future__ import annotations

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
