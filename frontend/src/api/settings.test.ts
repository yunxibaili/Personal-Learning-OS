// Settings / Provider 判定测试（node 环境）。
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSettings, loadProviderState, resolveProviderState } from "./settings";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveProviderState", () => {
  it("openai_compat + 非空 base_url → READY", () => {
    expect(
      resolveProviderState({ "llm.provider": "openai_compat", "llm.base_url": "http://127.0.0.1:11434/v1" }),
    ).toBe("READY");
  });

  it("未配置时 llm.provider 键可能根本不存在 → NOT_CONFIGURED", () => {
    expect(resolveProviderState({})).toBe("NOT_CONFIGURED");
  });

  it("provider 为 mock → NOT_CONFIGURED", () => {
    expect(resolveProviderState({ "llm.provider": "mock", "llm.base_url": "http://x" })).toBe(
      "NOT_CONFIGURED",
    );
  });

  it("provider 正确但 base_url 为空 → NOT_CONFIGURED", () => {
    expect(resolveProviderState({ "llm.provider": "openai_compat", "llm.base_url": "" })).toBe(
      "NOT_CONFIGURED",
    );
  });

  it("base_url 只有空白字符 → NOT_CONFIGURED", () => {
    expect(resolveProviderState({ "llm.provider": "openai_compat", "llm.base_url": "   " })).toBe(
      "NOT_CONFIGURED",
    );
  });
});

describe("getSettings", () => {
  it("解包 settings 对象，非字符串值被剔除", async () => {
    mockFetch(200, { settings: { "llm.provider": "openai_compat", "llm.max_tokens": 2048 } });
    expect(await getSettings()).toEqual({ "llm.provider": "openai_compat" });
  });

  it("缺 settings 时抛 contract_mismatch", async () => {
    mockFetch(200, {});
    await expect(getSettings()).rejects.toMatchObject({ code: "contract_mismatch" });
  });
});

describe("loadProviderState", () => {
  it("读取成功即判定", async () => {
    mockFetch(200, { settings: { "llm.provider": "openai_compat", "llm.base_url": "http://x" } });
    expect(await loadProviderState()).toBe("READY");
  });

  it("读取失败降级为 UNKNOWN（不抛，UI 只提示）", async () => {
    mockFetch(500, { error: { code: "db_error", message: "boom" } });
    expect(await loadProviderState()).toBe("UNKNOWN");
  });
});
