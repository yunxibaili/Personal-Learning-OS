// Settings 消费 + Provider 就绪判定（Phase 1-A §5）。
//
// 判定只能走 /settings，不能从 /chat 成败反推——因为 create_provider() 存在静默
// Mock fallback（server/app/core/ai/config.py）：provider 未配置时返回 MockProvider
// 而不抛错，/chat 依然返回 200（只是答案是 canned）。故"200"不含任何 provider 信息。
//
// 两条实测事实（勿再猜）：
//   · llm.base_url 不在脱敏名单（敏感名仅 api_key/token/password/secret 等，值前缀 sk- 等）
//     → GET /settings 返回真实值，可用于判定
//   · 从未配置过 llm.* 时，GET /settings 里可能根本没有 llm.provider 这个键
//     （后端 DEFAULT_PROVIDER="mock" 是读取期的缺省，不是落库值）→ 必须按 undefined 处理
import { api, ApiError } from "./client";
import { presentErrorCode } from "./errors";
import { isRecord } from "./validate";

// UX-001 / P2-PROVIDER-001：CONFIGURED 不等于 AVAILABLE。
// 它只表示「配置看起来完整」，尚未通过一次实际生成证明 provider 可用。
export type ProviderState = "UNKNOWN" | "CONFIGURED" | "NOT_CONFIGURED";

/** UX-001 就绪状态机（内部状态；仅存 React 内存，不持久化）。 */
export type ProviderReadiness =
  | ProviderState
  | "GENERATING"
  | "OK"
  | "UNREACHABLE"
  | "FAILED";

export async function getSettings(): Promise<Record<string, string>> {
  const res = await api.get("/api/v1/settings");
  const settings = (res as { settings?: unknown }).settings;
  if (!isRecord(settings)) {
    throw new ApiError(0, "contract_mismatch", "settings 响应缺 settings 对象");
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function resolveProviderState(settings: Record<string, string>): ProviderState {
  const provider = settings["llm.provider"];
  const baseUrl = settings["llm.base_url"];
  if (provider === "openai_compat" && typeof baseUrl === "string" && baseUrl.trim() !== "") {
    return "CONFIGURED";
  }
  return "NOT_CONFIGURED";
}

export interface ChatFailure {
  readiness: "UNREACHABLE" | "FAILED";
  /** 用户可见文案：绝不拼接内部 code（UX-001 硬边界）。 */
  message: string;
}

/**
 * /chat 错误码 → 就绪状态 + 中文文案。
 *
 * 硬边界：`provider_error` / `provider_timeout` 等内部 code **不得直接呈现给用户**，
 * backend diagnostic message 也不得拼进用户文案 —— 统一由 `presentErrorCode()`
 * 收口（UX-005）。细分原因（HTTP 401 认证 / 404 模型不存在 / 服务异常）属
 * Option B（后端 error contract 改动），已登记不实现。
 *
 * 状态语义（UX-001 冻结，不重开）：provider_timeout → UNREACHABLE；其余 → FAILED。
 */
export function classifyChatError(code: string): ChatFailure {
  return {
    readiness: code === "provider_timeout" ? "UNREACHABLE" : "FAILED",
    message: presentErrorCode(code, 0),
  };
}

/** 加载并判定。查询失败不抛——降级为 UNKNOWN（UI 只提示，不阻断）。 */
export async function loadProviderState(): Promise<ProviderState> {
  try {
    return resolveProviderState(await getSettings());
  } catch {
    return "UNKNOWN";
  }
}
