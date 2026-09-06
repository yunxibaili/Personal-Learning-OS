// Settings / Provider 判定测试（node 环境）。
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyChatError,
  getSettings,
  loadProviderState,
  resolveProviderState,
} from "./settings";

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
  it("openai_compat + 非空 base_url → CONFIGURED（≠ AVAILABLE）", () => {
    expect(
      resolveProviderState({ "llm.provider": "openai_compat", "llm.base_url": "http://127.0.0.1:11434/v1" }),
    ).toBe("CONFIGURED");
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
    expect(await loadProviderState()).toBe("CONFIGURED");
  });

  it("读取失败降级为 UNKNOWN（不抛，UI 只提示）", async () => {
    mockFetch(500, { error: { code: "db_error", message: "boom" } });
    expect(await loadProviderState()).toBe("UNKNOWN");
  });
});

describe("classifyChatError", () => {
  it("provider_timeout → UNREACHABLE + 中文文案", () => {
    const f = classifyChatError("provider_timeout");
    expect(f.readiness).toBe("UNREACHABLE");
    expect(f.message).toContain("连不上模型服务");
  });

  it("provider_error → FAILED + 中文文案", () => {
    const f = classifyChatError("provider_error");
    expect(f.readiness).toBe("FAILED");
    expect(f.message).toContain("模型服务返回错误");
  });

  it("未知 code → FAILED，且不再拼接 backend message（UX-005）", () => {
    const f = classifyChatError("contract_mismatch");
    expect(f.readiness).toBe("FAILED");
    expect(f.message).toBe("数据格式异常，请刷新重试。");
    expect(f.message).not.toContain("conversations.conversations 非数组");
  });

  it("未知 code → 安全中文兜底（无内部信息）", () => {
    expect(classifyChatError("").message).toBe("操作失败，请稍后重试。");
  });

  // 硬边界：内部 code 绝不出现给用户
  it("任何分支的文案都不得包含 provider_error / provider_timeout 原文", () => {
    for (const code of ["provider_timeout", "provider_error", ""] as const) {
      const f = classifyChatError(code);
      expect(f.message).not.toContain("provider_error");
      expect(f.message).not.toContain("provider_timeout");
    }
  });
});

// UX-001 契约：provider 就绪状态只存 React 内存，不进 sessionStorage / localStorage
describe("持久化边界", () => {
  const raw = import.meta.glob("./settings.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const src = Object.values(raw)[0] ?? "";

  it("源码可被读取（门禁前置）", () => {
    expect(src).toContain("resolveProviderState");
  });

  it("settings.ts 不引入任何 Web Storage", () => {
    expect(src).not.toContain("sessionStorage");
    expect(src).not.toContain("localStorage");
  });
});
