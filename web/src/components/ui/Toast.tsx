import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type Tone = "ok" | "err" | "warn" | "brand" | "neutral";

interface ToastItem {
  id: number;
  message: string;
  detail?: string;
  tone: Tone;
  /** spring 入场：挂载后下一帧加 .show（ui: .toast translateX(120%) → 0） */
  shown: boolean;
}

interface ToastApi {
  push: (message: string, tone?: Tone, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DEFAULT_DURATION = 4000; // ui/motion-primitives：4s 自动消失

const TONE_ICON: Record<Tone, string> = {
  ok: "✓",
  err: "!",
  warn: "!",
  brand: "✦",
  neutral: "·",
};

/** Toast（ui: motion-primitives .toast，右上角 spring 400ms 入场，4s 消失）。 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((message: string, tone: Tone = "neutral", detail?: string) => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, message, detail, tone, shown: false }]);
    // 双 rAF 确保初始 transform 先渲染，再触发 spring 入场
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setItems((prev) => prev.map((t) => (t.id === id ? { ...t, shown: true } : t))),
      ),
    );
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, DEFAULT_DURATION);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "neutral" ? "" : t.tone} ${t.shown ? "show" : ""}`.trim()}>
            <div className="ic" aria-hidden="true">{TONE_ICON[t.tone]}</div>
            <div>
              <div className="nm">{t.message}</div>
              {t.detail && <div className="sub">{t.detail}</div>}
            </div>
            <button
              type="button"
              className="x"
              aria-label="关闭"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
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
