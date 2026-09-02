/** settingsPatch 单测（P1-5-A）：脱敏密钥不回写 + 增量提交 + 校验。 */
import { describe, expect, it } from "vitest";

import {
  buildSettingsPatch,
  DEFAULT_FORM,
  MASKED,
  formToKV,
  validateForm,
  validateMaxTokens,
  type SettingsForm,
} from "./settingsPatch";

const form = (over: Partial<SettingsForm> = {}): SettingsForm => ({
  ...DEFAULT_FORM,
  ...over,
});

describe("buildSettingsPatch", () => {
  it("脱敏 api_key 不被回写（防止星号覆盖真密钥）", () => {
    const patch = buildSettingsPatch(
      form({ apiKey: MASKED }),
      { "llm.api_key": MASKED, "llm.provider": "mock" },
    );
    expect(patch["llm.api_key"]).toBeUndefined();
  });

  it("用户改写 api_key 时才下发", () => {
    const patch = buildSettingsPatch(
      form({ apiKey: "sk-new" }),
      { "llm.api_key": MASKED },
    );
    expect(patch["llm.api_key"]).toBe("sk-new");
  });

  it("未变化的键不下发", () => {
    const patch = buildSettingsPatch(
      form({ provider: "openai_compat", model: "qwen3:14b" }),
      { "llm.provider": "openai_compat", "llm.model": "qwen3:14b" },
    );
    expect(patch).toEqual({});
  });

  it("新增/修改的键进入 patch，且 base_url 去空格", () => {
    const patch = buildSettingsPatch(
      form({ provider: "openai_compat", baseUrl: "  http://127.0.0.1:11434/v1  " }),
      { "llm.provider": "mock" },
    );
    expect(patch["llm.provider"]).toBe("openai_compat");
    expect(patch["llm.base_url"]).toBe("http://127.0.0.1:11434/v1");
  });

  it("清空某键 → 下发空串（显式清除）", () => {
    const patch = buildSettingsPatch(form({ fastModel: "" }), {
      "llm.fast_model": "old-model",
    });
    expect(patch["llm.fast_model"]).toBe("");
  });

  it("首次配置（loaded 为空）时全量下发，但不含空 api_key 之外的空值除外一律下发", () => {
    const patch = buildSettingsPatch(form({ provider: "mock" }), {});
    expect(patch["llm.provider"]).toBe("mock");
    // 空字段也与「无」相同 → 不下发，避免写一堆空值进 settings
    expect(patch["llm.base_url"]).toBeUndefined();
  });

  it("formToKV 键名与后端 core/ai/config.py 一致", () => {
    const kv = formToKV(form());
    expect(Object.keys(kv).sort()).toEqual([
      "llm.base_url",
      "llm.fast_model",
      "llm.max_tokens",
      "llm.model",
      "llm.provider",
      "llm.api_key",
    ].sort());
  });
});

describe("validateMaxTokens", () => {
  it("空值合法（用后端默认）", () => {
    expect(validateMaxTokens("")).toBeNull();
    expect(validateMaxTokens("   ")).toBeNull();
  });
  it("非数字 / 越界报错", () => {
    expect(validateMaxTokens("abc")).not.toBeNull();
    expect(validateMaxTokens("0")).not.toBeNull();
    expect(validateMaxTokens("-5")).not.toBeNull();
    expect(validateMaxTokens("2000000")).not.toBeNull();
  });
  it("正整数合法", () => {
    expect(validateMaxTokens("2048")).toBeNull();
  });
});

describe("validateForm", () => {
  it("openai_compat 缺 base_url 报错；mock 不要求", () => {
    expect(validateForm(form({ provider: "openai_compat" })).baseUrl).toBeTruthy();
    expect(validateForm(form({ provider: "mock" })).baseUrl).toBeUndefined();
  });
  it("max_tokens 非法时报错", () => {
    expect(validateForm(form({ maxTokens: "x" })).maxTokens).toBeTruthy();
    expect(validateForm(form({ maxTokens: "512" })).maxTokens).toBeUndefined();
  });
});
