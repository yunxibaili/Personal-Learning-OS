/**
 * ui/visual-engine/stepping.test.ts
 *
 * 步进语义单测（13 项，锁 §8 验收 #3 与 #4 步进方向）。
 * 边界越界一律 clamp，与 HTML 原型 stepping 段同源。
 */
import { describe, it, expect } from "vitest";
import { nextStepIndex, canStep, stackDepth } from "./stepping";
import type { TraceEvent } from "./types";

function ev(line: number, depth: number, func = "main"): TraceEvent {
  return {
    step: 0,
    line,
    frames: Array.from({ length: depth }, (_, i) => ({
      func: i === 0 ? func : `f${i}`,
      line,
      locals: {},
    })),
    stdout: "",
    metadata: {},
  };
}

describe("stepping.stackDepth", () => {
  it("undefined → 0", () => {
    expect(stackDepth(undefined)).toBe(0);
  });
  it("counted", () => {
    expect(stackDepth(ev(1, 3))).toBe(3);
  });
});

describe("stepping.nextStepIndex · into / back / restart / continue", () => {
  const evs = [ev(1, 1), ev(2, 1), ev(3, 1), ev(4, 1)];
  it("into 前进 1", () => {
    expect(nextStepIndex(evs, 0, "into")).toBe(1);
  });
  it("back 后退 1", () => {
    expect(nextStepIndex(evs, 2, "back")).toBe(1);
  });
  it("restart → 0", () => {
    expect(nextStepIndex(evs, 3, "restart")).toBe(0);
  });
  it("continue → last", () => {
    expect(nextStepIndex(evs, 0, "continue")).toBe(3);
  });
  it("末步 into 仍停在末步（clamp）", () => {
    expect(nextStepIndex(evs, 3, "into")).toBe(3);
  });
  it("首步 back 仍停在 0（clamp）", () => {
    expect(nextStepIndex(evs, 0, "back")).toBe(0);
  });
});

describe("stepping.nextStepIndex · over / out", () => {
  // 深度序列：1 1 1 2 3 3 2 1 1
  const depthSeq = [1, 1, 1, 2, 3, 3, 2, 1, 1];
  const evs = depthSeq.map((d, i) => ev(i + 1, d));

  // over = 找首个深度 ≤ 当前；从深 1 跳到下一条深 ≤ 1 的事件（行内继续）
  it("over：深度 1 → 1，index 0 跳到 index 1", () => {
    expect(nextStepIndex(evs, 0, "over")).toBe(1);
  });
  it("over：深度 2（index 3）→ 2（index 6）", () => {
    expect(nextStepIndex(evs, 3, "over")).toBe(6);
  });
  it("over：深度 3（index 4）→ 3（index 5）", () => {
    expect(nextStepIndex(evs, 4, "over")).toBe(5);
  });

  // out = 找首个深度 < 当前
  it("out：深度 1，找不到 < 1 → last", () => {
    expect(nextStepIndex(evs, 0, "out")).toBe(8);
  });
  it("out：深度 2（index 3）→ 1（index 7）", () => {
    expect(nextStepIndex(evs, 3, "out")).toBe(7);
  });
  it("out：深度 2（index 6）→ 1（index 7）", () => {
    expect(nextStepIndex(evs, 6, "out")).toBe(7);
  });
  it("末步 over/out 找不到 → last", () => {
    expect(nextStepIndex(evs, 8, "over")).toBe(8);
    expect(nextStepIndex(evs, 8, "out")).toBe(8);
  });
});

describe("stepping.canStep", () => {
  const evs = [ev(1, 1), ev(2, 1)];
  it("into 首步可走", () => {
    expect(canStep(evs, 0, "into")).toBe(true);
  });
  it("into 末步不可走", () => {
    expect(canStep(evs, 1, "into")).toBe(false);
  });
  it("back 首步不可走", () => {
    expect(canStep(evs, 0, "back")).toBe(false);
  });
  it("空轨迹任何动作都不可走", () => {
    expect(canStep([], 0, "into")).toBe(false);
  });
});