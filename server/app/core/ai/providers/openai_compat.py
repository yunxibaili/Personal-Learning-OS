"""OpenAI-compatible Provider（B1a + B2-B + 加固）：stdlib urllib 直连，零新依赖。

ADR-003 唯一协议：POST {base_url}/v1/chat/completions。
api_key 只存在于实例内部，绝不进入 context / export（守护测试在库）。
本地 Ollama 无 key：空 api_key 时不发送 Authorization 头。

B2-B：stream() 为真实 SSE 流式解析（``stream: true`` + 逐条 ``data:`` 帧），
增量拼装恒等于整段回答。

加固（2026-08-30，参考 OpenAI/OLlama 兼容惯例，全部 mock 可测、零真实 token）：
  - 重试退避：429 与 5xx / 连接超时 在连接建立阶段重试（MAX_RETRIES 次，指数退避）。
  - max_tokens：从 config 带入，约束单次补全长度（控制 token 成本）。
  - JSON 模式：extractor 调用（prompt.metadata.mode == "extractor"）自动附
    response_format={"type":"json_object"}，保证结构化输出（Ollama/OpenAI 均支持）。
  - 错误分类：401/403 → 认证失败；其余 HTTP → ProviderError；网络/超时 → ProviderTimeout。
"""
from __future__ import annotations

import json
import socket
import time
import urllib.error
import urllib.request
from collections.abc import Iterator

from ...tutor_types import TutorPrompt
from ..constants import MAX_COMPLETION_TOKENS as DEFAULT_MAX_TOKENS
from ..errors import ProviderError, ProviderTimeout

# 重试策略（指数退避，单位为秒；测试可 monkeypatch 为 0 避免睡眠）
MAX_RETRIES = 2
_RETRY_DELAYS = (0.5, 1.0)
# 瞬时错误码：429（限流）+ 5xx（服务端瞬时）——重试后仍失败才报错
_TRANSIENT_HTTP = frozenset({429, 500, 502, 503, 504})
_AUTH_HTTP = frozenset({401, 403})


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


def _is_extractor(prompt: TutorPrompt) -> bool:
    """是否 extractor 调用（prompt.metadata.mode == "extractor"）。"""
    metadata = prompt.get("metadata", {}) if isinstance(prompt, dict) else {}
    return metadata.get("mode") == "extractor"


class OpenAICompatProvider:
    """OpenAI-compatible HTTP Provider（stdlib urllib）。"""

    def __init__(self, base_url: str, api_key: str = "", model: str = "",
                 timeout: int = 60, max_tokens: int = DEFAULT_MAX_TOKENS) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self.model = model
        self._timeout = timeout
        self._max_tokens = max_tokens

    # ── 请求构造 ──────────────────────────────────────────────────
    def _payload(self, prompt: TutorPrompt, stream: bool) -> bytes:
        body: dict = {
            "model": self.model,
            "messages": _to_openai_messages(prompt),
            "stream": stream,
        }
        if self._max_tokens and self._max_tokens > 0:
            body["max_tokens"] = self._max_tokens
        if stream is False and _is_extractor(prompt):
            body["response_format"] = {"type": "json_object"}
        return json.dumps(body, ensure_ascii=False).encode("utf-8")

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    def _request(self, payload: bytes, stream: bool):
        """发送请求，遇瞬时错误退避重试；返回已建立的响应对象。

        stream=True 时：只在连接建立阶段重试；一旦成功，后续由调用方逐帧迭代。
        """
        req = urllib.request.Request(
            _endpoint(self._base_url), data=payload, headers=self._headers(),
            method="POST",
        )
        last_exc: Exception | None = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                return urllib.request.urlopen(req, timeout=self._timeout)
            except urllib.error.HTTPError as exc:
                if exc.code in _TRANSIENT_HTTP and attempt < MAX_RETRIES:
                    last_exc = exc
                    time.sleep(_RETRY_DELAYS[min(attempt, len(_RETRY_DELAYS) - 1)])
                    continue
                if exc.code in _AUTH_HTTP:
                    raise ProviderError("LLM 认证失败，请检查 base_url / API key") from exc
                raise ProviderError(f"LLM 服务返回错误（HTTP {exc.code}）") from exc
            except (urllib.error.URLError, socket.timeout, TimeoutError) as exc:
                if attempt < MAX_RETRIES:
                    last_exc = exc
                    time.sleep(_RETRY_DELAYS[min(attempt, len(_RETRY_DELAYS) - 1)])
                    continue
                raise ProviderTimeout(f"LLM 服务连接失败：{exc}") from exc
        raise ProviderError(f"LLM 请求重试后仍失败：{last_exc}")

    # ── 非流式 ────────────────────────────────────────────────────
    def complete(self, prompt: TutorPrompt) -> str:
        with self._request(self._payload(prompt, False), False) as resp:
            try:
                data = json.loads(resp.read().decode("utf-8"))
            except json.JSONDecodeError as exc:
                raise ProviderError("LLM 响应不是合法 JSON") from exc
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("LLM 响应缺少 choices[0].message.content") from exc

    # ── 流式 ──────────────────────────────────────────────────────
    def stream(self, prompt: TutorPrompt) -> Iterator[str]:
        """B2-B：真实 SSE 流式解析（``stream: true`` + 逐条 ``data:`` 帧）。

        逐行读取响应，解析 OpenAI-compatible ``data: {...}`` 帧，
        取 ``choices[0].delta.content``（空增量跳过），遇 ``data: [DONE]`` 收尾。
        """
        resp = self._request(self._payload(prompt, True), True)
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
