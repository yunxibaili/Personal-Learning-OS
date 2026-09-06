// UX-005：错误呈现（presentation policy）——唯一收口点。
//
// 原则：**诊断信息与 presentation contract 分离**。
// internal error code / HTTP status / backend diagnostic message 即使有助诊断，
// 也不得直接成为用户可见文案 —— 一律在本模块转成安全中文。
//
// 本模块不碰（UX-005 硬边界）：
//   · client.ts / postStream() / SSE parser —— 两通道（HTTP JSON → ApiError、
//     SSE 帧 → stream error）已正确分离，问题是呈现层不是传输层
//   · UX-001 readiness 状态机语义（UNREACHABLE / FAILED 由 settings.ts 决定）
//   · UX-004/008 messages.status 生命周期文案
//
// 纯函数：无 DOM / 无 React / 无网络调用，可独立单测。
import { ApiError } from "./client";

/** 精确 code → 用户可见中文。只列当前真实可达的用户路径。 */
const CODE_MESSAGES: Record<string, string> = {
  provider_timeout: "连不上模型服务：请求超时或网络不可达，请稍后重试。",
  provider_error: "模型服务返回错误，本次生成失败。请检查模型名称与 API key 是否正确。",
  concept_not_found: "找不到对应的概念，请刷新后重试。",
  note_not_found: "找不到对应的笔记，请刷新后重试。",
  conversation_not_found: "找不到对应的会话，请刷新后重试。",
  validation_error: "请求不合法，请检查输入。",
  invalid_body: "请求不合法，请检查输入。",
  contract_mismatch: "数据格式异常，请刷新重试。",
};

/** 未知 4xx（含 404/409/422 等未在上表列出的 code）。 */
const CLIENT_ERROR = "请求无法完成，请检查输入后重试。";
/** 未知 5xx（含无统一 error 体的 http_500）。 */
const SERVER_ERROR = "服务暂时不可用，请稍后重试。";
/** 未知 code 且无可用 status 分档（含本地自造错误的 status=0）。 */
const FALLBACK = "操作失败，请稍后重试。";

/**
 * 按 (code, status) 给出用户文案。
 *
 * 优先级：精确 code 映射 → 5xx 分档 → 4xx 分档 → 安全兜底。
 * **任何分支都不会返回 code / status / backend message 原文。**
 */
export function presentErrorCode(code: string, status: number): string {
  const mapped = CODE_MESSAGES[code];
  if (mapped !== undefined) return mapped;
  if (status >= 500) return SERVER_ERROR;
  if (status >= 400) return CLIENT_ERROR;
  return FALLBACK;
}

/**
 * 错误对象 → 用户可见中文。非 ApiError（含未知异常）一律安全兜底，
 * 绝不 `String(e)` —— 那会把内部异常原文带上屏。
 */
export function presentError(e: unknown): string {
  return e instanceof ApiError ? presentErrorCode(e.code, e.status) : FALLBACK;
}
