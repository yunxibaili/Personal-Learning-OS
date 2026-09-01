/**
 * 步进语义测试（M9-005）
 *
 * 夹具是**后端 run_trace() 真实产出**的轨迹（`__fixtures__/factorial.json`），
 * 不是手写的假事件——手写 dict 会让测试通过但真实数据上出错
 * （M9-003 审核教训：契约测试只测手工 dict = 形同虚设）。
 *
 * 夹具由后端重新生成：改了 runner 的取帧逻辑就要重跑，否则这里测的是旧事实。
 */
import { describe, expect, it } from "vitest";
import type { TraceEvent, TraceRun } from "@shared/types/trace";
import factorialRaw from "./__fixtures__/factorial.json";
import { canStep, nextStepIndex, stackDepth } from "./stepping";

const trace = factorialRaw as unknown as TraceRun;
const events: readonly TraceEvent[] = trace.events;

const depths = (evts: readonly TraceEvent[]) => evts.map((e) => stackDepth(e));

/** 第一个「本层调用更深栈」的位置：即 Call 指令所在步，Step Over 的作用点 */
function firstCallSite(): number {
  const d = depths(events);
  for (let i = 0; i < d.length - 1; i++) {
    if (d[i + 1] > d[i]) return i;
  }
  throw new Error("fixture has no call site");
}

describe("stackDepth", () => {
  it("栈深 = 帧数量", () => {
    expect(stackDepth(events[0])).toBe(events[0].frames.length);
  });

  it("undefined 事件栈深为 0（不是抛错）", () => {
    expect(stackDepth(undefined)).toBe(0);
  });
});

describe("nextStepIndex · 边界", () => {
  it("空轨迹任何动作都停在 0", () => {
    for (const a of ["into", "over", "out", "continue", "back", "restart"] as const) {
      expect(nextStepIndex([], 0, a)).toBe(0);
    }
  });

  it("越界下标被 clamp，不返回 undefined", () => {
    expect(nextStepIndex(events, -5, "into")).toBe(1);
    expect(nextStepIndex(events, 9999, "back")).toBe(events.length - 2);
  });

  it("首步 back 停在 0，不减成负数", () => {
    expect(nextStepIndex(events, 0, "back")).toBe(0);
  });

  it("末步 into 停在末步，不溢出", () => {
    expect(nextStepIndex(events, events.length - 1, "into")).toBe(events.length - 1);
  });

  it("continue 直达末步", () => {
    expect(nextStepIndex(events, 0, "continue")).toBe(events.length - 1);
  });

  it("restart 回到 0", () => {
    expect(nextStepIndex(events, 10, "restart")).toBe(0);
  });

  it("into 每次前进 1 步", () => {
    for (let i = 0; i < events.length - 1; i++) {
      expect(nextStepIndex(events, i, "into")).toBe(i + 1);
    }
  });
});

describe("nextStepIndex · 真实递归轨迹（factorial）", () => {
  it("Step Over 不进入被调用函数内部", () => {
    const call = firstCallSite();
    const target = nextStepIndex(events, call, "over");
    // 落点必须回到本层（栈深 <= 调用点），而不是下一步（更深）
    expect(stackDepth(events[target])).toBeLessThanOrEqual(stackDepth(events[call]));
    expect(target).toBeGreaterThan(call);
    // 且中间确实跨过了整个递归：落点远大于 call + 1
    expect(target).toBeGreaterThan(call + 1);
  });

  it("Step Into 进入被调用函数内部（下一步栈更深）", () => {
    const call = firstCallSite();
    const target = nextStepIndex(events, call, "into");
    expect(stackDepth(events[target])).toBeGreaterThan(stackDepth(events[call]));
  });

  it("Step Out 一路返回到更浅的栈", () => {
    const call = firstCallSite();
    const inside = call + 1; // 已在被调函数内
    const target = nextStepIndex(events, inside, "out");
    expect(stackDepth(events[target])).toBeLessThan(stackDepth(events[inside]));
  });

  it("Step Out 在最外层（module 帧）不会卡死，落到末步", () => {
    const last = events.length - 1;
    expect(nextStepIndex(events, last, "out")).toBe(last);
  });

  it("全程 into 能走完且不越界", () => {
    let i = 0;
    for (let n = 0; n < events.length + 5; n++) {
      i = nextStepIndex(events, i, "into");
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(events.length);
    }
  });
});

describe("canStep", () => {
  it("末步不能再 into / continue", () => {
    const last = events.length - 1;
    expect(canStep(events, last, "into")).toBe(false);
    expect(canStep(events, last, "continue")).toBe(false);
  });

  it("首步不能再 back / restart", () => {
    expect(canStep(events, 0, "back")).toBe(false);
    expect(canStep(events, 0, "restart")).toBe(false);
  });

  it("中间步可以 into，末步前可以 continue", () => {
    expect(canStep(events, 0, "into")).toBe(true);
    expect(canStep(events, 0, "continue")).toBe(true);
  });

  it("空轨迹一切动作均不可用", () => {
    expect(canStep([], 0, "into")).toBe(false);
  });
});
