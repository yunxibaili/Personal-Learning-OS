/**
 * 派生逻辑测试（M9-005/006）
 *
 * 夹具同样取自后端真实轨迹（factorial / binary-search），理由见 stepping.test.ts。
 */
import { describe, expect, it } from "vitest";
import type { TraceEvent, TraceRun } from "@shared/types/trace";
import factorialRaw from "./__fixtures__/factorial.json";
import binarySearchRaw from "./__fixtures__/binary-search.json";
import {
  changedIndices,
  changedKeys,
  computeHitCounts,
  formatValue,
  inlineValuesForLine,
  normalizeHeights,
  pickNumericArray,
} from "./derive";

const factorial = factorialRaw as unknown as TraceRun;
const binarySearch = binarySearchRaw as unknown as TraceRun;

describe("formatValue · Python 语义（不是 JS 字面量）", () => {
  it("null 显示 None", () => {
    expect(formatValue(null)).toBe("None");
  });

  it("布尔显示 True / False", () => {
    expect(formatValue(true)).toBe("True");
    expect(formatValue(false)).toBe("False");
  });

  it("整数原样，浮点截断多余的 0", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue(1.5)).toBe("1.5");
  });

  it("字符串带单引号（Python 字符串不分单双）", () => {
    expect(formatValue("hi")).toBe("'hi'");
  });

  it("数组显示为 Python list", () => {
    expect(formatValue([1, 2, 3])).toBe("[1, 2, 3]");
  });

  it("不可序列化对象 / 截断容器 / 超限容器各有表示", () => {
    expect(formatValue({ type: "object", class: "Foo" })).toBe("<Foo object>");
    expect(formatValue({ type: "truncated", n: 12 })).toBe("[… 12 items]");
    expect(formatValue({ type: "depth_limit", class: "list" })).toBe("<list …>");
  });

  it("超长值截断，不会撑爆行内布局", () => {
    expect(formatValue("x".repeat(100), 10).length).toBe(10);
  });
});

describe("computeHitCounts · 真实轨迹", () => {
  it("每行执行次数累计正确", () => {
    const counts = computeHitCounts(factorial.events);
    const byLine = new Map<number, number>();
    for (const e of factorial.events) {
      byLine.set(e.line, (byLine.get(e.line) ?? 0) + 1);
    }
    for (const [line, n] of byLine) {
      expect(counts.get(line)).toBe(n);
    }
  });

  it("空轨迹返回空表，不抛错", () => {
    expect(computeHitCounts([]).size).toBe(0);
  });
});

describe("inlineValuesForLine", () => {
  it("只显示本行出现且在当前帧作用域内的变量", () => {
    const event: TraceEvent = {
      step: 1,
      line: 1,
      frames: [{ func: "factorial", line: 1, locals: { n: 3, acc: 6 } }],
      stdout: "",
      metadata: {},
    };
    const values = inlineValuesForLine("return n * factorial(n - 1)", event);
    expect(values.map((v) => v.name)).toEqual(["n"]);
    expect(values[0].text).toBe("3");
  });

  it("Python 关键字不作为行内值渲染", () => {
    const event: TraceEvent = {
      step: 1,
      line: 1,
      frames: [{ func: "f", line: 1, locals: { n: 1 } }],
      stdout: "",
      metadata: {},
    };
    const values = inlineValuesForLine("if n <= 1:", event);
    // `if` 是关键字不渲染；`n` 在作用域内要渲染
    expect(values.map((v) => v.name)).toEqual(["n"]);
  });

  it("未定义事件或无帧时返回空（不抛错）", () => {
    expect(inlineValuesForLine("x = 1", undefined)).toEqual([]);
    expect(
      inlineValuesForLine("x = 1", {
        step: 1, line: 1, frames: [], stdout: "", metadata: {},
      }),
    ).toEqual([]);
  });

  it("只取栈顶帧的 locals，递归里外层同名变量不串台", () => {
    const event: TraceEvent = {
      step: 1,
      line: 1,
      frames: [
        { func: "factorial", line: 7, locals: { n: 1 } },
        { func: "factorial", line: 7, locals: { n: 5 } },
      ],
      stdout: "",
      metadata: {},
    };
    expect(inlineValuesForLine("return n", event)[0].text).toBe("1");
  });
});

describe("changedKeys", () => {
  const mk = (locals: Record<string, import("@shared/types/trace").TraceValue>): TraceEvent => ({
    step: 1, line: 1,
    frames: [{ func: "f", line: 1, locals }],
    stdout: "", metadata: {},
  });

  it("无上一步时，全部变量视为新增", () => {
    expect(changedKeys(undefined, mk({ a: 1 }))).toEqual(new Set(["a"]));
  });

  it("只标记真正变化的键", () => {
    const changed = changedKeys(mk({ a: 1, b: 2 }), mk({ a: 1, b: 3 }));
    expect(changed).toEqual(new Set(["b"]));
  });

  it("新增的键也算变化", () => {
    expect(changedKeys(mk({ a: 1 }), mk({ a: 1, b: 2 }))).toEqual(new Set(["b"]));
  });
});

describe("pickNumericArray", () => {
  it("从真实 binary-search 轨迹里取出数组", () => {
    const series = pickNumericArray(binarySearch.events[binarySearch.events.length - 1]);
    expect(series).not.toBeNull();
    expect(series!.values.length).toBeGreaterThan(0);
    expect(series!.values.every((v) => typeof v === "number")).toBe(true);
  });

  it("没有数组时返回 null（不是抛错）", () => {
    expect(pickNumericArray(undefined)).toBeNull();
    expect(
      pickNumericArray({
        step: 1, line: 1,
        frames: [{ func: "f", line: 1, locals: { x: 1 } }],
        stdout: "", metadata: {},
      }),
    ).toBeNull();
  });

  it("非数值数组（字符串列表）不被当作 ArrayView 数据源", () => {
    expect(
      pickNumericArray({
        step: 1, line: 1,
        frames: [{ func: "f", line: 1, locals: { xs: ["a", "b"] } }],
        stdout: "", metadata: {},
      }),
    ).toBeNull();
  });
});

describe("changedIndices", () => {
  it("标出变化的下标", () => {
    expect(changedIndices([1, 2, 3], [1, 3, 3])).toEqual(new Set([1]));
  });

  it("长度变化时不做逐位比较（避免误标整排）", () => {
    expect(changedIndices([1, 2], [1, 2, 3])).toEqual(new Set());
  });

  it("无前值或后值时返回空", () => {
    expect(changedIndices(undefined, [1])).toEqual(new Set());
    expect(changedIndices([1], undefined)).toEqual(new Set());
  });
});

describe("normalizeHeights", () => {
  it("按最大值归一到 0..1", () => {
    expect(normalizeHeights([1, 2, 4])).toEqual([0.25, 0.5, 1]);
  });

  it("全零数组退化为等高，不留零高条", () => {
    expect(normalizeHeights([0, 0, 0])).toEqual([0.5, 0.5, 0.5]);
  });

  it("空数组返回空", () => {
    expect(normalizeHeights([])).toEqual([]);
  });

  it("含负数按绝对值取高", () => {
    expect(normalizeHeights([-2, -4])).toEqual([0.5, 1]);
  });
});
