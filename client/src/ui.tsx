// Thành phần giao diện dùng chung (theo hệ thống thiết kế trên Figma)
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type IconName =
  | "search" | "cart" | "chevron" | "plus" | "minus" | "trash" | "clock" | "check" | "arrow"
  | "eye" | "download" | "menu" | "chart" | "close" | "card" | "cash" | "bell" | "edit" | "logout" | "print" | "refresh";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    cart: <><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H7" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M5 20h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    chart: <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
    cash: <><rect x="3" y="6" width="18" height="13" rx="2" /><circle cx="12" cy="12.5" r="3" /><path d="M7 9H6v2m11-2h1v2M7 16H6v-2m11 2h1v-2" /></>,
    bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    edit: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" />,
    logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
    print: <><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><path d="M7 14h10v7H7z" /></>,
    refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function Button({ children, variant = "primary", onClick, icon, disabled, className = "", type = "button", loading }: {
  children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; onClick?: () => void; icon?: IconName;
  disabled?: boolean; className?: string; type?: "button" | "submit"; loading?: boolean;
}) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled || loading}>
      {loading ? "Đang xử lý…" : children}{icon && !loading && <Icon name={icon} size={18} />}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "red" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Field({ label, value, onChange, placeholder, error, type = "text", inputMode, autoFocus, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; type?: string;
  inputMode?: "numeric" | "text"; autoFocus?: boolean; maxLength?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={error ? "input-error" : ""} inputMode={inputMode} autoFocus={autoFocus} maxLength={maxLength} />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function Stepper({ value, onChange, min = 1, max = 10, onLimit }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; onLimit?: () => void;
}) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Giảm" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" size={18} /></button>
      <strong>{value}</strong>
      <button type="button" aria-label="Tăng" className={value >= max ? "at-limit" : ""}
        onClick={() => (value >= max ? onLimit?.() : onChange(value + 1))}><Icon name="plus" size={18} /></button>
    </div>
  );
}

export function Modal({ title, children, onClose, symbol = "!" }: { title: string; children: ReactNode; onClose: () => void; symbol?: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-symbol">{symbol}</div><h2>{title}</h2><button onClick={onClose} aria-label="Đóng"><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Alert({ tone, title, children }: { tone: "error" | "success"; title: string; children?: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{tone === "error" ? "!" : <Icon name="check" />}</span>
      <div><b>{title}</b>{children && <p>{children}</p>}</div>
    </div>
  );
}

/** Ảnh món ăn, tự hiển thị ảnh mặc định khi không tải được */
export function FoodImage({ src, alt, drink }: { src: string | null; alt: string; drink?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <div className="food-fallback" role="img" aria-label={alt}><span>{drink ? "🥤" : "🍕"}</span></div>;
  return <img src={src} alt={alt} onError={() => setBroken(true)} loading="lazy" />;
}

/* Thông báo nhanh (toast) */
type Toast = { id: number; text: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.tone === "error" ? "!" : t.tone === "success" ? "✓" : "i"}<span>{t.text}</span></div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/** Gọi lại một hàm theo chu kỳ (dùng để cập nhật trạng thái gần thời gian thực) */
export function usePolling(fn: () => void, ms: number, deps: unknown[] = []) {
  useEffect(() => {
    fn();
    const t = setInterval(fn, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
