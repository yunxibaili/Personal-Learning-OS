"""OpenAI-compatible Provider（B1a）：stdlib urllib 直连，零新依赖。

ADR-003 唯一协议：POST {base_url}/v1/chat/completions（非流式 complete）。
api_key 只存在于实例内部，绝不进入 context / export（守护测试在库）。
本地 Ollama 无 key：空 api_key 时不发送 Authorization 头。

B2-B：stream() 为真实 SSE 流式解析（``stream: true`` + 逐条 ``data:`` 帧），
stdlib 实现零新依赖；增量拼装恒等于整段回答。
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
        """B2-B：真实 SSE 流式解析（``stream: true`` + 逐条 ``data:`` 帧）。

        stdlib 实现，无新依赖（ADR-003）。逐行读取响应，解析 OpenAI-compatible
        ``data: {...}`` 帧，取 ``choices[0].delta.content``（空增量跳过），
        遇 ``data: [DONE]`` 收尾。与 complete() 一致：增量拼装恒等于整段回答。

        错误映射与 complete() 同源：HTTP 错误 → ProviderError；网络/超时 → ProviderTimeout。
        """
        payload = json.dumps({
            "model": self.model,
            "messages": _to_openai_messages(prompt),
            "stream": True,
        }).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        req = urllib.request.Request(
            _endpoint(self._base_url), data=payload, headers=headers,
            method="POST",
        )
        try:
            resp = urllib.request.urlopen(req, timeout=self._timeout)
        except urllib.error.HTTPError as exc:
            raise ProviderError(f"LLM 服务返回错误（HTTP {exc.code}）") from exc
        except (urllib.error.URLError, socket.timeout, TimeoutError) as exc:
            raise ProviderTimeout(f"LLM 服务连接失败：{exc}") from exc

        with resp:
            try:
                for raw_line in resp:
                    line = raw_line.decode("utf-8").strip()
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[len("data:"):].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        frame = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue  # 跳过损坏帧，不中断流
                    try:
                        delta = frame["choices"][0]["delta"]
                    except (KeyError, IndexError, TypeError):
                        continue
                    content = delta.get("content")
                    if content:
                        yield content
            except (urllib.error.URLError, socket.timeout, TimeoutError) as exc:
                raise ProviderTimeout(f"LLM 流式中断：{exc}") from exc
