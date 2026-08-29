"""Tutor Service（M4-C）：业务层，串联 Context → Prompt → Provider → Response。

职责：
  - 调用 build_prompt() 组装 prompt
  - 调用 Provider.complete() 获取响应
  - 统一错误处理

禁止：
  - 直接访问数据库
  - 直接调用 LLM HTTP 接口
  - 修改 mastery / events
"""
from __future__ import annotations

from collections.abc import Iterator

from ..tutor_types import TutorContext, TutorMode, TutorPrompt
from .tutor import build_prompt
from .errors import ProviderError, ProviderTimeout, TutorError
from .providers.base import LLMProvider


class TutorService:
    """AI Tutor 业务层。"""

    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider

    def ask(
        self,
        context: TutorContext,
        query: str,
        mode: TutorMode = "explain",
    ) -> str:
        """Context + Query → Tutor Response。

        纯函数链：build_prompt() → provider.complete() → str
        不访问 DB，不修改状态。

        Raises:
            TutorError: Provider 超时或错误（用户友好消息）
        """
        prompt = build_prompt(context, query, mode)
        try:
            return self._provider.complete(prompt)
        except TutorError:
            raise
        except TimeoutError:
            raise ProviderTimeout()
        except Exception as exc:
            raise ProviderError() from exc

    def ask_stream(
        self,
        context: TutorContext,
        query: str,
        mode: TutorMode = "explain",
    ) -> Iterator[str]:
        """Context + Query → 流式增量块（B2）。

        纯生成器链：build_prompt() → provider.stream() → 逐块 str。
        调用方约定：``"".join(ask_stream(...)) == ask(...)``（增量拼装恒等于整段回答）。

        不访问 DB，不修改状态；错误传播与 ask() 一致（TutorError 透传）。

        Raises:
            TutorError: Provider 超时或错误（用户友好消息）
        """
        prompt = build_prompt(context, query, mode)
        try:
            yield from self._provider.stream(prompt)
        except TutorError:
            raise
        except TimeoutError:
            raise ProviderTimeout()
        except Exception as exc:
            raise ProviderError() from exc

    def build_prompt_only(
        self,
        context: TutorContext,
        query: str,
        mode: TutorMode = "explain",
    ) -> TutorPrompt:
        """只构建 prompt，不调用 Provider（测试 / 调试用）。"""
        return build_prompt(context, query, mode)
