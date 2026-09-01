/**
 * DebugToolbar：IDE 步进控制（M9-005）
 *
 * **不是播放器**：没有播放三角、没有拖拽进度条。语义来自调试器——
 *   Step Into  进入被调用的函数
 *   Step Over  在本层执行完这一行，不进入函数内部
 *   Step Out   执行到当前函数返回
 *   Continue   执行到结束
 *   Step Back  回到上一步（轨迹全量已录，时间倒流天然成立）
 *
 * 快捷键避开 F10/F11/F5（会被浏览器抢走：F5 刷新、F11 全屏），
 * 改用方向键 + 空格，只在面板聚焦时生效。
 */
import type { TraceEvent } from "@shared/types/trace";
import { Button } from "..";
import { canStep, stackDepth, type StepAction } from "./stepping";

interface DebugToolbarProps {
  events: readonly TraceEvent[];
  current: number;
  onStep: (action: StepAction) => void;
}

export const KEY_BINDINGS: Array<{ key: string; action: StepAction; label: string }> = [
  { key: "ArrowDown", action: "into", label: "↓ 单步进入" },
  { key: "ArrowRight", action: "over", label: "→ 单步跳过" },
  { key: "ArrowUp", action: "out", label: "↑ 单步跳出" },
  { key: " ", action: "continue", label: "空格 继续" },
  { key: "ArrowLeft", action: "back", label: "← 上一步" },
  { key: "r", action: "restart", label: "R 重新开始" },
];

export function DebugToolbar({ events, current, onStep }: DebugToolbarProps) {
  const total = events.length;
  const depth = stackDepth(events[current]);

  return (
    <div className="ve-toolbar">
      <div className="ve-toolbar__steps">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onStep("restart")}
          disabled={!canStep(events, current, "restart")}
          title="回到起点（R）"
        >
          ⟲ 重新开始
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onStep("back")}
          disabled={!canStep(events, current, "back")}
          title="回到上一步（←）"
        >
          ← 上一步
        </Button>
      </div>

      <div className="ve-toolbar__steps">
        <Button
          size="sm"
          onClick={() => onStep("into")}
          disabled={!canStep(events, current, "into")}
          title="单步进入（↓）"
        >
          单步进入 ↓
        </Button>
        <Button
          size="sm"
          onClick={() => onStep("over")}
          disabled={!canStep(events, current, "over")}
          title="单步跳过（→）"
        >
          单步跳过 →
        </Button>
        <Button
          size="sm"
          onClick={() => onStep("out")}
          disabled={!canStep(events, current, "out")}
          title="单步跳出（↑）"
        >
          单步跳出 ↑
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onStep("continue")}
          disabled={!canStep(events, current, "continue")}
          title="执行到结束（空格）"
        >
          继续 ␣
        </Button>
      </div>

      <div className="ve-toolbar__status">
        <span className="ve-toolbar__pos">
          {total === 0 ? "—" : `${current + 1} / ${total}`}
        </span>
        <span className="ve-toolbar__depth">栈深 {depth}</span>
      </div>
    </div>
  );
}
