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

---

## 附录 §A（2026-08-30）：B1a 非流式偏离追认 + B2 流式恢复

本 ADR 正文第 10-12 行冻结「SSE 流式 + stdlib 手写解析约 40 行」，
但 **B1a 落地时 `providers/openai_compat.py` 为 `stream: False` 非流式**
（一整块 JSON 响应，无 SSE 解析）。此为对正文的偏离，此前无附录追认。

### 偏离事实
- B1a 仅实现 `complete()`（非流式），请求体 `stream: false`，无 `data:` 帧解析。
- 范围内所有 `docs/adr/` 无此偏离记录 —— 依 AGENTS §10「文档同步义务」补登。

### 追认与恢复（分两段）
1. **B1a**：非流式实现 **追认保留** 为该阶段 `complete()` 能力——`TutorService.ask()`
   一次性返回，满足 M4/Smoke/评估体系；不因偏离而返工。
2. **B2（2026-08-30）**：**恢复流式契约**——`LLMProvider` 协议新增 `stream()`，
   `/chat` 请求体增 `stream: bool`（默认 false，非流式向后兼容）；
   `stream=true` 返回 SSE。完成度：
   - `MockProvider.stream()`：确定性字符分块（不 sleep），拼装恒等于 `complete()`。
   - `OpenAICompatProvider.stream()`：**B2-B 已实现真实 SSE 解析**（`stream: true` +
     逐条 `data:` 帧解析，取 `choices[0].delta.content`，遇 `data: [DONE]` 收尾），
     stdlib 实现零新依赖，错误映射与 `complete()` 同源。
   - Router：`/chat` SSE `StreamingResponse`，`event: done` 携 `conversation_id`，
     `event: error` 携错误码；assistant 消息落库与 extractor 置于 `try/finally`（客户端断开不丢消息）。

### 契约
流式增量拼装恒等于整段回答：`"".join(provider.stream(p)) == provider.complete(p)`；
`"".join(TutorService.ask_stream(...)) == TutorService.ask(...)`。
SSE 帧类型见 `shared/types/tutor.ts` `TutorStreamFrame`。
