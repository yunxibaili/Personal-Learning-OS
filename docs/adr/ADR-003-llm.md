# ADR-003: LLM 接入——OpenAI-compatible 裸 HTTP + settings 驱动

日期：2026-08-26 · 状态：Accepted

## Context
需要同时支持云端 API（DeepSeek/Qwen/OpenAI/…）与本地 Ollama，且厂商不可预知、
用户可随时切换；项目要求最小依赖。

## Decision
- 唯一协议：`POST {base_url}/v1/chat/completions`，SSE 流式
- 配置存 settings 表（base_url/api_key/model/fast_model），代码不感知厂商
- 用 Python 标准库 `urllib.request` 手写 SSE 解析（约 40 行），不用 SDK
- Ollama = base_url 指向 `http://127.0.0.1:11434/v1`，零代码差异

## Alternatives Considered
- openai SDK：只用一个端点，SDK 抽象与传递依赖不值
- 各厂商原生 SDK × N：厂商锁定，依赖爆炸
- LangChain：编排黑盒 + 版本地狱，管线手写 <200 行且完全可控

## Reason
一个协议覆盖全部主流/本地提供商；自维护面收敛为一小段 SSE 解析代码。

## Consequences
- SSE 协议变更风险自担（该协议事实上极稳定）
- 重试/超时逻辑需自行实现且保持最简（单次重试 + 明确报错）
- API key 存于 workspace 内 SQLite，永不回传明文、永不出本机
