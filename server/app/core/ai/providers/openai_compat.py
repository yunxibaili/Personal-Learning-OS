"""OpenAI-compatible Provider（B1a）：stdlib urllib 直连，零新依赖。

ADR-003 唯一协议：POST {base_url}/v1/chat/completions（非流式 complete）。
api_key 只存在于实例内部，绝不进入 context / export（守护测试在库）。
本地 Ollama 无 key：空 api_key 时不发送 Authorization 头。

B2-A：stream() 目前为**非流式回退**（一次性 yield complete() 结果），
真实 SSE 解析（``stream: true`` + 逐条 ``data:`` 帧解析）留待 B2-B 落此——接口形状已定，
以免 Router 契约后续返工。
"""
from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from collections.abc import Iterator

from ...tutor_types import TutorPrompt
from ..errors import ProviderError, ProviderTimeout


def _endpoint(base_url: str) -> str:
    """{base_url}/v1/chat/completions；容忍 base_url 已带 /v1。"""
    base = base_url.rstrip("/")
    if base.endswith("/v1"):
        base = base[: -len("/v1")]
    return f"{base}/v1/chat/completions"


def _to_openai_messages(prompt: TutorPrompt) -> list[dict[str, str]]:
    """TutorPrompt → OpenAI messages 数组（system + 已有 messages）。"""
    messages: list[dict[str, str]] = []
    if prompt.get("system"):
        messages.append({"role": "system", "content": prompt["system"]})
    messages.extend(prompt.get("messages", []))
    return messages


class OpenAICompatProvider:
    """OpenAI-compatible HTTP Provider（stdlib urllib，非流式）。"""

    def __init__(self, base_url: str, api_key: str = "", model: str = "",
                 timeout: int = 60) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self.model = model
        self._timeout = timeout

    def complete(self, prompt: TutorPrompt) -> str:
        payload = json.dumps({
            "model": self.model,
            "messages": _to_openai_messages(prompt),
            "stream": False,
        }).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        req = urllib.request.Request(
            _endpoint(self._base_url), data=payload, headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise ProviderError(f"LLM 服务返回错误（HTTP {exc.code}）") from exc
        except (urllib.error.URLError, socket.timeout, TimeoutError) as exc:
            raise ProviderTimeout(f"LLM 服务连接失败：{exc}") from exc
        except json.JSONDecodeError as exc:
            raise ProviderError("LLM 响应不是合法 JSON") from exc

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("LLM 响应缺少 choices[0].message.content") from exc

    def stream(self, prompt: TutorPrompt) -> Iterator[str]:
        """B2-A 非流式回退：一次性 yield 整段回答（接口形状已定）。

        语义仍满足 ``"".join(stream(prompt)) == complete(prompt)``。
        真实 SSE 增量解析（``stream: true``）留待 B2-B 覆盖此方法。
        """
        yield self.complete(prompt)
