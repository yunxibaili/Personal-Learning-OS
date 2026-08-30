import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type Tone = "neutral" | "ok" | "warn" | "err" | "brand";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  push: (message: string, tone?: Tone, durationMs?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DEFAULT_DURATION = 4000;  // UI_DESIGN §7.1：4s 自动消失

/** Toast 供应商（P1）：应用根部挂一次，业务用 useToast().push(message, tone)。 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback(
    (message: string, tone: Tone = "neutral", durationMs = DEFAULT_DURATION) => {
      const id = ++seq.current;
      setItems((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    [],
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toast-stack" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`ui-toast ui-toast--${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** 获取 Toast 推送器；未包裹 ToastProvider 时返回空实现（不崩溃）。 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? { push: () => undefined };
}
