"""Mock LLM Provider（M4-C）：测试用，无网络依赖。

返回固定响应，用于验证完整链路：
  Context → Prompt → Provider → Response
"""
from __future__ import annotations

from ...tutor_types import TutorPrompt


class MockProvider:
    """测试用 LLM Provider，返回固定响应。"""

    def __init__(self, response: str | None = None) -> None:
        self._response = response or "Mock tutor response: I don't have enough context to answer."
        self._call_count = 0
        self._last_prompt: TutorPrompt | None = None

    def complete(self, prompt: TutorPrompt) -> str:
        """返回固定响应。"""
        self._call_count += 1
        self._last_prompt = prompt
        return self._response

    @property
    def call_count(self) -> int:
        return self._call_count

    @property
    def last_prompt(self) -> TutorPrompt | None:
        return self._last_prompt
