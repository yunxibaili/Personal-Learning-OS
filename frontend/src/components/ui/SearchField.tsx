/**
 * SearchField — Reference Component（UI-COMPONENT-BEHAVIOR-MATRIX §5）。
 * Focus 响应 = 面升起（sunken→elevated）+ 影 + 图标 accent 化 + hint 退场，
 * 不止 border 变色（指令书 §23）。
 */
import { useId, useRef, useState } from "react";
import { Icon } from "../icons/Icon";

export interface SearchFieldProps {
  placeholder?: string;
  shortcutHint?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  loading?: boolean;
  "aria-label"?: string;
}

export function SearchField({
  placeholder = "Search notes…",
  shortcutHint = "⌘K",
  value,
  defaultValue,
  onValueChange,
  loading = false,
  "aria-label": ariaLabel = "搜索",
}: SearchFieldProps) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const controlled = value !== undefined;
  const current = controlled ? value : inner;

  function set(v: string) {
    if (!controlled) setInner(v);
    onValueChange?.(v);
  }

  return (
    <div className="search">
      <span className="search__icon">
        <Icon name={loading ? "sync" : "search"} activity={loading} size={18} />
      </span>
      <input
        ref={inputRef}
        className="search__input"
        type="search"
        role="searchbox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        placeholder={placeholder}
        value={current}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (current) {
              e.stopPropagation();
              set("");
            } else {
              inputRef.current?.blur();
            }
          }
        }}
      />
      {current ? (
        <button
          type="button"
          className="icon-btn search__clear"
          style={{ width: 24, height: 24 }}
          aria-label="清空搜索"
          onClick={() => {
            set("");
            inputRef.current?.focus();
          }}
        >
          <Icon name="close" size={14} />
        </button>
      ) : (
        <kbd className="search__hint" aria-hidden="true">{shortcutHint}</kbd>
      )}
    </div>
  );
}
