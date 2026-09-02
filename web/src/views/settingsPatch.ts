/**
 * 设置表单 → 提交载荷（P1-5-A 纯逻辑，零 React 依赖，便于单测）。
 *
 * 关键约束：GET /settings 对敏感键（llm.api_key 等）返回脱敏值 "******"。
 * 若把它原样 PUT 回去，用户的真密钥会被六个星号覆盖（不可逆）。
 * 规则：
 *   1. 脱敏值一律不下发（除非用户主动改写了该字段）
 *   2. 未变化的键不下发（避免无意义写入）
 *   3. 用户清空某键（""）→ 下发空串，即显式清除
 *   4. 从未配置过（服务端无该键）且表单也留空 → 不下发（不生成空条目）
 */

export const MASKED = "******";

/** SETTINGS 表单字段（TECH_DESIGN §6.1 / core/ai/config.py） */
export interface SettingsForm {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fastModel: string;
  maxTokens: string;
}

export const DEFAULT_FORM: SettingsForm = {
  provider: "mock",
  baseUrl: "",
  apiKey: "",
  model: "",
  fastModel: "",
  maxTokens: "",
};

/** 表单 → settings KV（后端键名） */
export function formToKV(form: SettingsForm): Record<string, string> {
  return {
    "llm.provider": form.provider,
    "llm.base_url": form.baseUrl.trim(),
    "llm.api_key": form.apiKey,
    "llm.model": form.model.trim(),
    "llm.fast_model": form.fastModel.trim(),
    "llm.max_tokens": form.maxTokens.trim(),
  };
}

/**
 * 构造提交载荷：只下发「相对已加载值确实变了」且「不是脱敏占位」的键。
 *
 * @param form  当前表单值（apiKey 为空串 = 用户没改）
 * @param loaded GET /settings 返回的原始值（含脱敏占位）
 */
export function buildSettingsPatch(
  form: SettingsForm,
  loaded: Record<string, string> = {},
): Record<string, string> {
  const kv = formToKV(form);
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(kv)) {
    if (value === MASKED) continue;              // 规则 1：绝不回写脱敏占位
    const prev = loaded[key];
    if (prev === value) continue;                // 规则 2：未变化不下发
    if (value === "" && prev === undefined) continue;  // 规则 4：无→空 不生成条目
    patch[key] = value;                          // 规则 3：清空 → 空串 = 显式清除
  }
  return patch;
}

/** max_tokens 校验：空 → 合法（用后端默认）；否则必须为正整数 */
export function validateMaxTokens(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (!/^\d+$/.test(v)) return "请输入正整数（留空则用后端默认）";
  const n = Number(v);
  if (n < 1 || n > 1_000_000) return "范围应在 1 – 1000000";
  return null;
}

/** openai_compat 需要 base_url；mock 不需要（给出提示而非阻断） */
export function validateForm(form: SettingsForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.provider === "openai_compat" && !form.baseUrl.trim()) {
    errors.baseUrl = "OpenAI 兼容模式必须填 base_url";
  }
  const mt = validateMaxTokens(form.maxTokens);
  if (mt) errors.maxTokens = mt;
  return errors;
}
