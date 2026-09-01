/**
 * IDE 步进语义（纯函数 · 无 React · 可单测）
 *
 * 用调试器的语义而非播放器语义：Step Into / Over / Out / Continue。
 * 轨迹是全量录得的，所以「时间倒流」（back / restart）天然成立——
 * 这不是播放器的倒带，而是调试器的「回到上一步」。
 *
 * 栈深 = frames.length（ADR-025 §4.2，frames[0] 为当前帧）。
 */
import type { TraceEvent } from "@shared/types/trace";

export type StepAction =
  | "into" // F11 进入被调用的函数
  | "over" // F10 在本层执行完这一行，不进入函数内部
  | "out" // Shift+F11 执行到当前函数返回
  | "continue" // F5 执行到结束
  | "back" // 回到上一步
  | "restart"; // 回到起点

/** 栈深：帧数量。Step Over / Out 的判据。 */
export function stackDepth(event: TraceEvent | undefined): number {
  return event ? event.frames.length : 0;
}

/**
 * 计算下一个 step 下标（0-based，指向 events 数组）。
 *
 * 越界输入一律 clamp 到合法范围——调用方（键盘/按钮）不必自己做边界判断，
 * 末步继续按 Step Into 就停在末步，不会溢出成 undefined。
 */
export function nextStepIndex(
  events: readonly TraceEvent[],
  current: number,
  action: StepAction,
): number {
  const n = events.length;
  if (n === 0) return 0;

  const last = n - 1;
  const cur = Math.min(Math.max(current, 0), last);

  switch (action) {
    case "restart":
      return 0;

    case "back":
      return Math.max(0, cur - 1);

    case "into":
      return Math.min(last, cur + 1);

    case "continue":
      return last;

    case "over": {
      // 同层或更浅的第一个后续事件：跳过被调用函数内部的全部事件
      const d = stackDepth(events[cur]);
      for (let i = cur + 1; i <= last; i++) {
        if (stackDepth(events[i]) <= d) return i;
      }
      return last; // 后面再没有回到本层的事件了（当前是最后的收尾）
    }

    case "out": {
      // 栈更浅的第一个后续事件：当前函数已返回
      const d = stackDepth(events[cur]);
      for (let i = cur + 1; i <= last; i++) {
        if (stackDepth(events[i]) < d) return i;
      }
      return last;
    }
  }
}

/** 该动作在当前步是否可用（末步不能再 over，首步不能再 back） */
export function canStep(
  events: readonly TraceEvent[],
  current: number,
  action: StepAction,
): boolean {
  if (events.length === 0) return false;
  const target = nextStepIndex(events, current, action);
  return target !== Math.min(Math.max(current, 0), events.length - 1);
}
