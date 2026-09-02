/**
 * ui/visual-engine/stepping.ts
 *
 * 纯函数：步进语义（ADR-025 §8 验收 #3）。
 *
 * 栈深 = `events[i].frames.length`（§4.2，`frames[0]` 为当前帧）。
 *
 * 与 HTML 原型 `visual-engine.html` 中的 stepping 段一一对应：
 *   - into      ↓ 单步进入（含进入被调用函数）
 *   - over      → 单步跳过（跳到下一个栈深 ≤ 当前的事件）
 *   - out       ↑ 单步跳出（跳到下一个栈深 < 当前的事件）
 *   - back      ← 上一步（轨迹全量已录，无需重放）
 *   - continue  Space 继续到末步
 *   - restart   R 回到起点
 *
 * 边界：越界一律 clamp，末步再按 into 仍停在末步。
 */
import type { TraceEvent, StepAction } from "./types";

export function stackDepth(ev: TraceEvent | undefined): number {
  return ev ? ev.frames.length : 0;
}

/**
 * 计算下一个步号。
 *
 * @param events   全量轨迹
 * @param current  当前步号（非法值会先 clamp）
 * @param action   步进动作
 * @returns 下一个合法步号；不可达时返回 current 本身
 */
export function nextStepIndex(
  events: TraceEvent[],
  current: number,
  action: StepAction
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
      const d = stackDepth(events[cur]);
      for (let i = cur + 1; i <= last; i++) {
        if (stackDepth(events[i]) <= d) return i;
      }
      return last;
    }
    case "out": {
      const d = stackDepth(events[cur]);
      for (let i = cur + 1; i <= last; i++) {
        if (stackDepth(events[i]) < d) return i;
      }
      return last;
    }
  }
}

/**
 * 判断动作是否可执行——按钮 disabled 由本函数判定，
 * 调用方不必自己做边界判断（ADR §8 步进语义·注释）。
 */
export function canStep(
  events: TraceEvent[],
  current: number,
  action: StepAction
): boolean {
  if (events.length === 0) return false;
  const cur = Math.min(Math.max(current, 0), events.length - 1);
  return nextStepIndex(events, current, action) !== cur;
}