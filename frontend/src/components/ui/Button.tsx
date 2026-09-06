/**
 * Button / IconButton — Reference Components（UI-COMPONENT-BEHAVIOR-MATRIX §1–2）。
 * Anatomy：label · icon · prominence · size · loading。
 * [A] press state 强制；命中区 ≥44px；prominent 每屏 1–2 个由使用方保证。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../icons/Icon";

export type ButtonProminence = "regular" | "prominent" | "plain" | "destructive" | "glass";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  prominence?: ButtonProminence;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconName;
  iconPosition?: "start" | "end";
  children?: ReactNode;
}

const PROMINENCE_CLASS: Record<ButtonProminence, string> = {
  regular: "btn--regular",
  prominent: "btn--prominent",
  plain: "btn--plain",
  destructive: "btn--destructive",
  glass: "btn--glass",
};

export function Button({
  prominence = "regular",
  size = "md",
  loading = false,
  icon,
  iconPosition = "start",
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = ["btn", PROMINENCE_CLASS[prominence], size !== "md" && `btn--${size}`, className]
    .filter(Boolean)
    .join(" ");
  const iconEl = loading ? (
    <span className="btn__spinner" aria-hidden="true" />
  ) : icon ? (
    <Icon name={icon} size={size === "sm" ? 16 : 20} />
  ) : null;
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon && iconPosition === "start" ? iconEl : null}
      {children}
      {icon && iconPosition === "end" && !loading ? <Icon name={icon} size={size === "sm" ? 16 : 20} /> : null}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 语义名（绘制用） */
  icon: IconName;
  /** 必需：icon-only 的无障碍名称 [矩阵 §2] */
  label: string;
  prominence?: Extract<ButtonProminence, "regular" | "glass">;
  activity?: boolean;
  loading?: boolean;
}

export function IconButton({ icon, label, prominence = "regular", activity, loading, className, type = "button", ...rest }: IconButtonProps) {
  const cls = ["icon-btn", prominence === "glass" && "btn--glass", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} aria-label={label} title={label} aria-busy={loading || undefined} disabled={loading} {...rest}>
      <Icon name={icon} activity={activity} />
    </button>
  );
}
