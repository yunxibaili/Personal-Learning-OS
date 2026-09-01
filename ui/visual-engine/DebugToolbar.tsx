/**
 * ui/visual-engine/DebugToolbar.tsx
 *
 * 步进控制条（ADR-025 §8 · 验收 #3）。
 *
 * 交互范式：IDE 调试器语义（Step Over / Into / Out / Continue / Back / Restart），
 * 不是播放器——无播放三角，无进度条。
 *
 * 按钮 disabled 由 `canStep()` 判定，调用方不必自己做边界判断。
 * 变体：primary = 当前最常用动作（into），secondary = 其他调试动作，ghost = 元动作（back/restart）。
 *
 * 快捷键在 VisualEngine 根上挂载，不在按钮上——避免 button + keydown 重复触发。
 */
import * as React from "react";
import type { TraceEvent, StepAction } from "./types";
import { canStep, stackDepth } from "./stepping";

export interface DebugToolbarProps {
  events: TraceEvent[];
  current: number;
  onStep: (action: StepAction) => void;
}

interface ButtonDef {
  action: StepAction;
  label: string;
  title: string;
  variant: "primary" | "secondary" | "ghost";
}

const BUTTONS: ButtonDef[] = [
  { action: "restart",  label: "⟲ 重新开始", variant: "ghost",     title: "回到起点（R）" },
  { action: "back",     label: "← 上一步",   variant: "ghost",     title: "回到上一步（←）" },
  { action: "into",     label: "单步进入 ↓", variant: "primary",   title: "单步进入（↓）" },
  { action: "over",     label: "单步跳过 →", variant: "secondary", title: "单步跳过（→）" },
  { action: "out",      label: "单步跳出 ↑", variant: "secondary", title: "单步跳出（↑）" },
  { action: "continue", label: "继续 ␣",     variant: "secondary", title: "执行到结束（空格）" },
];

export function DebugToolbar({ events, current, onStep }: DebugToolbarProps): React.ReactElement {
  function renderGroup(actions: ButtonDef[]): React.ReactElement {
    return (
      <div className="ve-toolbar__steps">
        {actions.map((a) => {
          const disabled = !canStep(events, current, a.action);
          return (
            <button
              key={a.action}
              type="button"
              className={`ve-btn ve-btn--${a.variant}`}
              title={a.title}
              disabled={disabled}
              onClick={() => onStep(a.action)}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    );
  }

  const depth = stackDepth(events[current]);

  return (
    <div className="ve-toolbar">
      {renderGroup(BUTTONS.slice(0, 2))}
      {renderGroup(BUTTONS.slice(2))}
      <div className="ve-toolbar__status">
        <span className="ve-toolbar__pos">
          {events.length === 0 ? "—" : `${current + 1} / ${events.length}`}
        </span>
        <span>栈深 {depth}</span>
      </div>
    </div>
  );
}

/**
 * 键位定义（在 VisualEngine 根上挂 keydown 监听器使用）。
 * 避开 F5/F10/F11（浏览器会抢走），改用方向键 + 空格 + R。
 */
export const KEY_BINDINGS: ReadonlyArray<{ key: string; action: StepAction }> = [
  { key: "ArrowDown",  action: "into" },
  { key: "ArrowRight", action: "over" },
  { key: "ArrowUp",    action: "out" },
  { key: " ",          action: "continue" },
  { key: "ArrowLeft",  action: "back" },
  { key: "r",          action: "restart" },
  { key: "R",          action: "restart" },
];