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
import { isRecord } from "./validate";

export type ProviderState = "UNKNOWN" | "READY" | "NOT_CONFIGURED";

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
    return "READY";
  }
  return "NOT_CONFIGURED";
}

/** 加载并判定。查询失败不抛——降级为 UNKNOWN（UI 只提示，不阻断）。 */
export async function loadProviderState(): Promise<ProviderState> {
  try {
    return resolveProviderState(await getSettings());
  } catch {
    return "UNKNOWN";
  }
}
