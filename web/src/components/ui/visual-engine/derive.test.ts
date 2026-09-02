/**
 * ui/visual-engine/derive.test.ts
 *
 * 派生数据单测（覆盖 §4.3 全部值类型 + 关键函数）。
 */
import { describe, it, expect } from "vitest";
import {
  formatValue,
  computeHitCounts,
  inlineValuesForLine,
  changedKeys,
  pickNumericArray,
  changedIndices,
  normalizeHeights,
  isArrayView,
  isFrameView,
} from "./derive";
import type { TraceEvent, TraceValue } from "./types";

function ev(line: number, locals: Record<string, TraceValue>, depth = 1): TraceEvent {
  return {
    step: 0,
    line,
    frames: Array.from({ length: depth }, () => ({ func: "main", line, locals })),
    stdout: "",
    metadata: {},
  };
}

describe("formatValue · Python 语义", () => {
  it("null → None", () => {
    expect(formatValue(null)).toBe("None");
  });
  it("boolean", () => {
    expect(formatValue(true)).toBe("True");
    expect(formatValue(false)).toBe("False");
  });
  it("整数原样", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue(-7)).toBe("-7");
  });
  it("浮点去尾零", () => {
    expect(formatValue(0.5)).toBe("0.5");
    expect(formatValue(0.1234)).toBe("0.1234");
  });
  it("字符串加单引号", () => {
    expect(formatValue("hi")).toBe("'hi'");
  });
  it("数组递归", () => {
    expect(formatValue([1, 2, 3])).toBe("[1, 2, 3]");
    expect(formatValue([[1, 2], [3]])).toBe("[[1, 2], [3]]");
  });
  it("未知对象 → <ClassName object>", () => {
    expect(formatValue({ type: "object", class: "Node" })).toBe("<Node object>");
  });
  it("深度受限对象 → <ClassName …>", () => {
    expect(formatValue({ type: "depth_limit", class: "ListNode" })).toBe("<ListNode …>");
  });
  it("截断容器", () => {
    expect(formatValue({ type: "truncated", n: 1000 })).toBe("[… 1000 items]");
  });
  it("超过 maxLen 截断加 …（字符串算上外侧单引号）", () => {
    // 50 个 a → text 加引号后 52 字符，maxLen 默认 40 → 截断为 39 + …
    expect(formatValue("a".repeat(50))).toBe("'" + "a".repeat(38) + "…");
  });
  it("绝不调用 repr——未知类型走 object 分支", () => {
    // 模拟一个用户自定义 repr() 但协议禁止调用
    const weird = { type: "object", class: "X" } as const;
    expect(formatValue(weird)).toBe("<X object>");
  });
});

describe("computeHitCounts", () => {
  it("每行命中数 + max", () => {
    const e = [ev(1, {}), ev(2, {}), ev(2, {}), ev(3, {})];
    const h = computeHitCounts(e);
    expect(h.counts).toEqual({ 1: 1, 2: 2, 3: 1 });
    expect(h.max).toBe(2);
  });
  it("空轨迹 max = 1", () => {
    const h = computeHitCounts([]);
    expect(h.max).toBe(1);
    expect(h.counts).toEqual({});
  });
});

describe("inlineValuesForLine · VS Code 行尾 inline", () => {
  it("取首个与 locals 同名的标识符", () => {
    const e = ev(1, { x: 1, y: "z" });
    expect(inlineValuesForLine("y = x + 1", e)).toEqual([
      { name: "y", text: "'z'" },
      { name: "x", text: "1" }
    ]);
  });
  it("跳过关键字（def/if 等）", () => {
    const e = ev(1, { x: 1 });
    // "def x()" → 标识符有 "def" 与 "x"；def 跳过，x 在 locals 中保留
    expect(inlineValuesForLine("def x():", e)).toEqual([
      { name: "x", text: "1" }
    ]);
  });
  it("全关键字行 → []", () => {
    const e = ev(1, { x: 1 });
    expect(inlineValuesForLine("if True:", e)).toEqual([]);
  });
  it("locals 没有的标识符忽略", () => {
    const e = ev(1, { x: 1 });
    expect(inlineValuesForLine("y = 1", e)).toEqual([]);
  });
  it("行内重复名只取第一个", () => {
    const e = ev(1, { x: 1 });
    const r = inlineValuesForLine("x = x + 1", e);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("x");
  });
  it("undefined ev → []", () => {
    expect(inlineValuesForLine("x = 1", undefined)).toEqual([]);
  });
});

describe("changedKeys", () => {
  it("首步视全部键为变化", () => {
    expect(changedKeys(undefined, ev(1, { a: 1, b: 2 }))).toEqual({ a: true, b: true });
  });
  it("仅变化键", () => {
    const p = ev(1, { a: 1, b: 2 });
    const n = ev(2, { a: 1, b: 99 });
    expect(changedKeys(p, n)).toEqual({ b: true });
  });
  it("formatValue 不等视为变", () => {
    // 同一个 array 但长度不同 → 视为变
    const p = ev(1, { arr: [1, 2] });
    const n = ev(2, { arr: [1, 2, 3] });
    expect(changedKeys(p, n)).toEqual({ arr: true });
  });
  it("next 空 → 空集", () => {
    expect(changedKeys(ev(1, { a: 1 }), undefined)).toEqual({});
  });
});

describe("pickNumericArray", () => {
  it("首个全数字数组", () => {
    expect(pickNumericArray(ev(1, { data: [1, 2, 3], meta: [4, "x"] }))).toEqual({
      name: "data",
      values: [1, 2, 3]
    });
  });
  it("空数组跳过", () => {
    expect(pickNumericArray(ev(1, { data: [] }))).toBeNull();
  });
  it("非数字混合跳过", () => {
    expect(pickNumericArray(ev(1, { data: [1, "x"] }))).toBeNull();
  });
  it("undefined → null", () => {
    expect(pickNumericArray(undefined)).toBeNull();
  });
});

describe("changedIndices", () => {
  it("逐下标对比", () => {
    expect(changedIndices([1, 2, 3], [1, 9, 3])).toEqual({ 1: true });
  });
  it("长度不同 → 空集（视为整体替换）", () => {
    expect(changedIndices([1, 2], [1, 2, 3])).toEqual({});
  });
  it("prev undefined → 空集", () => {
    expect(changedIndices(undefined, [1, 2])).toEqual({});
  });
});

describe("normalizeHeights", () => {
  it("归一到 [0,1] · max = 4", () => {
    expect(normalizeHeights([1, 2, 4])).toEqual([0.25, 0.5, 1]);
  });
  it("全 0 → 全 0.5（避免退化）", () => {
    expect(normalizeHeights([0, 0, 0])).toEqual([0.5, 0.5, 0.5]);
  });
  it("负数取绝对值，max=1 → 全 1", () => {
    expect(normalizeHeights([-1, 1])).toEqual([1, 1]);
  });
  it("混合正负，最大绝对值=4 → 0.25/0.5/1", () => {
    expect(normalizeHeights([-1, 2, -4])).toEqual([0.25, 0.5, 1]);
  });
  it("空数组", () => {
    expect(normalizeHeights([])).toEqual([]);
  });
});

describe("type guards", () => {
  it("isArrayView", () => {
    expect(isArrayView("ArrayView")).toBe(true);
    expect(isArrayView("FrameStackView")).toBe(false);
  });
  it("isFrameView", () => {
    expect(isFrameView("FrameStackView")).toBe(true);
    expect(isFrameView("GeneralView")).toBe(true);
    expect(isFrameView("ArrayView")).toBe(false);
  });
});