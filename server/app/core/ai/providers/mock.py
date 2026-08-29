"""Mock LLM Provider（M4-C）：测试用，无网络依赖。

返回固定响应，用于验证完整链路：
  Context → Prompt → Provider → Response

B7.1：默认返回合法 JSON（extractor 需要），含 human_readable 字段供 Tutor 显示。

B2：stream() 确定性分块（字符切分，不用 sleep）——拼装结果恒等于 complete()，
供 /chat SSE 流式链路的可测性与稳定性（测试不等待、结果确定）。
"""
from __future__ import annotations

import json
from collections.abc import Iterator

from ...tutor_types import TutorPrompt

# Mock 分块步长（字符）：过小增加帧数、过大失去多帧意义；仅测试用，确定即可。
DEFAULT_CHUNK_SIZE = 12

# 默认 Tutor 回答（人类可读）
_DEFAULT_TUTOR_ANSWER = (
    "This is a mock tutor response. "
    "In production, this would be a real LLM answer about the concept."
)

# 默认 Extractor 输出（合法 JSON，含非空示例供 B3.2 链路验证）
_DEFAULT_EXTRACTOR_OUTPUT = json.dumps({
    "memories": [],
    "concept_suggestions": [
        {
            "title": "Mock Concept from Extractor",
            "summary": "This is an auto-extracted concept suggestion for testing the SuggestionList UI.",
        }
    ],
    "learning_events": [],
}, ensure_ascii=False)


class MockProvider:
    """测试用 LLM Provider，返回固定响应。"""

    def __init__(self, response: str | None = None) -> None:
        self._response = response or _DEFAULT_TUTOR_ANSWER
        self._call_count = 0
        self._last_prompt: TutorPrompt | None = None

    def complete(self, prompt: TutorPrompt) -> str:
        """返回固定响应。

        B7.1：检测 prompt 类型，extractor 返回合法 JSON，Tutor 返回人类可读文本。
        """
        self._call_count += 1
        self._last_prompt = prompt

        # 检测是否为 extractor 调用（prompt metadata.mode == "extractor"）
        metadata = prompt.get("metadata", {}) if isinstance(prompt, dict) else {}
        if metadata.get("mode") == "extractor":
            return _DEFAULT_EXTRACTOR_OUTPUT

        return self._response

    def stream(self, prompt: TutorPrompt, chunk_size: int = DEFAULT_CHUNK_SIZE) -> Iterator[str]:
        """流式返回固定响应的确定性分块。

        语义：``"".join(stream(prompt)) == complete(prompt)``。
        复用 complete() 的分派逻辑（extractor/Tutor 类型检测），仅把返回文本切成块；
        不使用 sleep/随机量，保证测试确定且无额外延迟。
        """
        text = self.complete(prompt)
        for i in range(0, max(len(text), 1), chunk_size):
            yield text[i:i + chunk_size]

    @property
    def call_count(self) -> int:
        return self._call_count

    @property
    def last_prompt(self) -> TutorPrompt | None:
        return self._last_prompt
