/**
 * Toolbar — Reference Component（UI-COMPONENT-BEHAVIOR-MATRIX §6）。
 * Functional Layer：glass-regular 材质 + 顶部 specular；分组靠 divider 不靠每项加框。
 * [A] "Toolbars take on a Liquid Glass appearance, and provide a grouping mechanism..."
 */
import { IconButton } from "./Button";
import { Icon, type IconName } from "../icons/Icon";
import type { ReactNode } from "react";

export interface ToolbarGroup {
  items: Array<{ icon: IconName; label: string; activity?: boolean }>;
}

export interface ToolbarProps {
  groups: ToolbarGroup[];
  /** 组间插入分隔线（ToolbarSpacer 语义 [A]） */
  dividers?: boolean;
  children?: ReactNode;
}

export function Toolbar({ groups, dividers = true, children }: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="工具栏">
      {groups.map((g, gi) => (
        <span key={gi} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-xs)" }}>
          {gi > 0 && dividers && <span className="toolbar__divider" aria-hidden="true" />}
          <span className="toolbar__group">
            {g.items.map((it) => (
              <IconButton key={it.label} icon={it.icon} label={it.label} activity={it.activity} />
            ))}
          </span>
        </span>
      ))}
      {children}
    </div>
  );
}

/** 浮动工具栏内嵌搜索（组合形态：Search 收纳进 Toolbar，不嵌套玻璃内容面） */
export function ToolbarSearchSlot({ children }: { children: ReactNode }) {
  return <span className="toolbar__group">{children}</span>;
}

export { Icon };
