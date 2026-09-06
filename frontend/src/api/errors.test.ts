// UX-005：错误呈现纯函数测试（node 环境，无 DOM / 无 React）。
//
// 安全边界：任何分支返回的用户文案都不得包含
//   · 内部 code（provider_error / provider_timeout / http_500 …）
//   · HTTP status
//   · backend diagnostic message 原文（中文诊断串 / 英文异常原文）
import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { presentError, presentErrorCode } from "./errors";

/** 一旦泄漏就会出现在 UI 上的内部字符串。 */
const FORBIDDEN = [
  "provider_error",
  "provider_timeout",
  "http_500",
  "Internal Server Error",
  "concept 999999 not found",
  "Tutor encountered an error. Please try again.",
  "conversations.conversations 非数组",
  "LLM 服务返回错误（HTTP 404）",
  "404",
  "502",
];

function expectSafe(text: string): void {
  for (const leak of FORBIDDEN) {
    expect(text, `泄漏内部字符串：${leak}`).not.toContain(leak);
  }
}

describe("presentError：精确 code 映射", () => {
  const cases: Array<[string, string]> = [
    ["provider_timeout", "连不上模型服务：请求超时或网络不可达，请稍后重试。"],
    ["provider_error", "模型服务返回错误，本次生成失败。请检查模型名称与 API key 是否正确。"],
    ["concept_not_found", "找不到对应的概念，请刷新后重试。"],
    ["note_not_found", "找不到对应的笔记，请刷新后重试。"],
    ["conversation_not_found", "找不到对应的会话，请刷新后重试。"],
    ["validation_error", "请求不合法，请检查输入。"],
    ["invalid_body", "请求不合法，请检查输入。"],
    ["contract_mismatch", "数据格式异常，请刷新重试。"],
  ];

  for (const [code, expected] of cases) {
    it(`${code} → 固定中文文案`, () => {
      expect(presentError(new ApiError(500, code, "任何内部原文"))).toBe(expected);
      expectSafe(expected);
    });
  }
});

describe("presentError：status 分档兜底", () => {
  it("未知 4xx → 请求/资源类安全文案", () => {
    const text = presentError(new ApiError(409, "duplicate_title", "已存在同名笔记：X"));
    expect(text).toBe("请求无法完成，请检查输入后重试。");
    expectSafe(text);
  });

  it("未知 5xx → 服务不可用文案", () => {
    const text = presentError(new ApiError(500, "http_500", "Internal Server Error"));
    expect(text).toBe("服务暂时不可用，请稍后重试。");
    expectSafe(text);
  });

  it("未知 code + 无可用 status（status=0）→ 安全兜底", () => {
    expect(presentErrorCode("some_unknown_code", 0)).toBe("操作失败，请稍后重试。");
  });
});

describe("presentError：非 ApiError 一律安全兜底", () => {
  it("普通 Error 不回显 message", () => {
    const text = presentError(new Error("boom: sk-real-key"));
    expect(text).toBe("操作失败，请稍后重试。");
    expect(text).not.toContain("sk-real-key");
  });

  it("undefined / null / 字符串 也不回显", () => {
    for (const e of [undefined, null, "raw text", 42]) {
      expect(presentError(e)).toBe("操作失败，请稍后重试。");
    }
  });
});

describe("安全边界：内部信息不得进入用户文案", () => {
  it("backend 中文诊断串不泄漏（provider_error 带 detail）", () => {
    const text = presentError(new ApiError(502, "provider_error", "LLM 服务返回错误（HTTP 404）"));
    expect(text).not.toContain("LLM 服务返回错误");
    expect(text).not.toContain("404");
  });

  it("英文异常原文不泄漏（未知 code）", () => {
    const text = presentError(new ApiError(500, "whatever", "concept 999999 not found"));
    expect(text).toBe("服务暂时不可用，请稍后重试。");
  });

  it("所有分支都不得出现 provider_error / provider_timeout 字样", () => {
    for (const e of [
      new ApiError(502, "provider_error", "x"),
      new ApiError(504, "provider_timeout", "x"),
      new ApiError(400, "invalid_body", "y"),
      new ApiError(0, "contract_mismatch", "z"),
      new ApiError(500, "http_500", "Internal Server Error"),
      new Error("boom"),
    ]) {
      const text = presentError(e);
      expect(text).not.toContain("provider_error");
      expect(text).not.toContain("provider_timeout");
    }
  });
});

// ── UX-005 消费者回归 + 源码门禁 ────────────────────────────────────

describe("features/** 错误呈现门禁", () => {
  const raw = import.meta.glob("../features/**/*.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const entries = Object.entries(raw);

  it("门禁取到视图源码（前置断言）", () => {
    expect(entries.length).toBeGreaterThanOrEqual(6);
  });

  it("不再出现 status / code / message 拼接与 errText", () => {
    for (const [name, src] of entries) {
      expect(src, name).not.toContain("${e.status}");
      expect(src, name).not.toContain("${e.code}");
      expect(src, name).not.toContain("${e.message}");
      expect(src, name).not.toContain("errText(");
    }
  });

  it("六个消费者统一经过 presentError", () => {
    const consumers = [
      "features/concepts/ConceptsView.tsx",
      "features/mastery/MasteryView.tsx",
      "features/notes/NotesView.tsx",
      "features/review/ReviewView.tsx",
      "features/tutor/TutorView.tsx",
      "features/tutor/ChatPanel.tsx",
    ];
    for (const name of consumers) {
      const hit = entries.find(([key]) => key.endsWith(name));
      expect(hit, `未找到 ${name}`).toBeDefined();
      expect(hit?.[1], name).toContain("presentError");
    }
  });
});

describe("settings.ts 分类层门禁", () => {
  const raw = import.meta.glob("./settings.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const src = Object.values(raw)[0] ?? "";

  it("源码可被读取（门禁前置）", () => {
    expect(src).toContain("classifyChatError");
  });

  it("不再拼接 backend detail", () => {
    expect(src).not.toContain("生成失败：");
    expect(src).toContain("presentErrorCode");
  });
});
