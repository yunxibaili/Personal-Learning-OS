/**
 * 内部图标集（UI-ICON-MOTION-SPEC §1–2）。
 * 不引入 icon library [指令书 §36]；不复制 Apple 资产。
 * 分层结构：base geometry / semantic layer / state layer —— 供语义动效使用。
 * 全部 stroke 制（fill 仅 Play），24 网格，round cap/join。
 */
import type { CSSProperties } from "react";

export type IconName =
  | "search" | "close" | "back" | "forward" | "chevron-down" | "chevron-up"
  | "play" | "pause" | "sync" | "save" | "success" | "error"
  | "review" | "tutor" | "notes" | "graph" | "galaxy" | "mindmap"
  | "algorithm" | "settings" | "plus";

const PATHS: Record<IconName, { stroke: string[]; fill?: string[] }> = {
  search: { stroke: ["M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z", "m20 20-4-4"] },
  close: { stroke: ["M6 6l12 12", "M18 6 6 18"] },
  back: { stroke: ["M19 12H5", "m11 6-6 6 6 6"] },
  forward: { stroke: ["M5 12h14", "m13 6 6 6-6 6"] },
  "chevron-down": { stroke: ["m6 9 6 6 6-6"] },
  "chevron-up": { stroke: ["m6 15 6-6 6 6"] },
  play: { stroke: [], fill: ["M8 5.5v13l11-6.5-11-6.5Z"] },
  pause: { stroke: ["M9 5v14", "M15 5v14"] },
  sync: { stroke: ["M20 12a8 8 0 1 1-2.3-5.6", "M20 4v4h-4"] },
  save: { stroke: ["M5 5h11l3 3v11H5V5Z", "M8 5v4h7V5", "M8 14h8v5H8v-5Z"] },
  success: { stroke: ["m5 13 4 4L19 7"] },
  error: { stroke: ["M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z", "M12 8v5", "M12 16h.01"] },
  review: { stroke: ["M5 4h14v16H5V4Z", "M9 9h6", "M9 13h6"] },
  tutor: { stroke: ["M12 4a6 6 0 0 1 6 6c0 2.5-1.5 4.2-3 5v3H9v-3c-1.5-.8-3-2.5-3-5a6 6 0 0 1 6-6Z", "M10 21h4"] },
  notes: { stroke: ["M6 4h12v16H6V4Z", "M9 8h6", "M9 12h6", "M9 16h4"] },
  graph: { stroke: ["M6 18a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z", "M18 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z", "M11 19a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z", "m8 14 7.5-6"] },
  galaxy: { stroke: ["M12 12a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z", "M12 21c-5 0-9-2.5-9-5.5 0-1.8 1.6-3.4 4-4.3", "M12 21c5 0 9-2.5 9-5.5 0-1.8-1.6-3.4-4-4.3"] },
  mindmap: { stroke: ["M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z", "M5 16a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z", "M19 16a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z", "M12 8v4", "m11 12-5 4", "m13 12 5 4"] },
  algorithm: { stroke: ["M8 6 3.5 12 8 18", "M16 6l4.5 6L16 18", "m13 5-2 14"] },
  settings: { stroke: ["M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z", "M12 3.5 13 6a6.3 6.3 0 0 1 2.1.9l2.5-.7 1.9 3.2-1.8 1.9a6.5 6.5 0 0 1 0 2.4l1.8 1.9-1.9 3.2-2.5-.7a6.3 6.3 0 0 1-2.1.9L12 20.5 11 18a6.3 6.3 0 0 1-2.1-.9l-2.5.7-1.9-3.2 1.8-1.9a6.5 6.5 0 0 1 0-2.4L4.5 8.4l1.9-3.2 2.5.7A6.3 6.3 0 0 1 11 6l1-2.5Z"] },
  plus: { stroke: ["M12 5v14", "M5 12h14"] },
};

export interface IconProps {
  name: IconName;
  /** 像素尺寸，默认 20（--icon-md 语义） */
  size?: number;
  /** 持续活动（Breathe）：Sync 中 / 生成中。reduced-motion 下自动切常亮。 */
  activity?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 装饰性使用必须传 aria-hidden（默认 true）；语义图标由外层 label 承担 [ICON-MOTION-SPEC §5]。 */
export function Icon({ name, size = 20, activity = false, className, style }: IconProps) {
  const def = PATHS[name];
  const cls = ["icon", activity && "icon--breathe", className].filter(Boolean).join(" ");
  return (
    <svg
      className={cls}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon={name}
    >
      {def.stroke.map((d) => (
        <path key={d} d={d} />
      ))}
      {(def.fill ?? []).map((d) => (
        <path key={d} d={d} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
