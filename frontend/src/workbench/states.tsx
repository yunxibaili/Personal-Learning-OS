import { Icon } from "../components/icons/Icon";
import type { IconName } from "../components/icons/Icon";

export function WorkState({ kind, title, hint }: { kind: "empty" | "loading" | "error"; title: string; hint?: string }) {
  const icon: IconName = kind === "error" ? "error" : kind === "loading" ? "sync" : "notes";
  return (
    <div className={`wb-state${kind === "error" ? " wb-state--error" : ""}`}>
      <Icon name={icon} size={22} activity={kind === "loading"} />
      <div className="wb-state__title">{title}</div>
      {hint && <div className="t-callout">{hint}</div>}
    </div>
  );
}

