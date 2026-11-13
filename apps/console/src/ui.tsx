import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { absTime, relTime, short } from "./lib";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ title, aside, children, className, pad = true }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-medium text-ink">{title}</h2>
          {aside && <div className="flex items-center gap-2 text-muted">{aside}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "border-line text-muted bg-raised",
  accent: "border-accent/40 text-[#B7A6FF] bg-accent/10",
  in: "border-in/40 text-in bg-in/10",
  out: "border-out/40 text-out bg-out/10",
  refuse: "border-refuse/40 text-[#FF8A8A] bg-refuse/10",
  proof: "border-proof/40 text-proof bg-proof/10",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", mono, children, className, title }: { tone?: Tone; mono?: boolean; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] border px-1.5 py-px text-[11px] leading-[18px]", mono && "font-mono", TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Typed refusal codes always render as mono red badges. */
export const Code = ({ code, shake }: { code: string; shake?: boolean }) => (
  <Badge tone="refuse" mono className={shake ? "shake-once" : undefined}>{code}</Badge>
);

export function Button({ children, onClick, tone = "default", disabled, title, type = "button", className }: { children: ReactNode; onClick?: () => void; tone?: "default" | "primary" | "danger" | "ghost" | "in"; disabled?: boolean; title?: string; type?: "button" | "submit"; className?: string }) {
  const t = {
    default: "border-line bg-raised text-ink hover:border-[#323949]",
    primary: "border-accent bg-accent text-white hover:bg-[#6C4BF5]",
    danger: "border-refuse bg-refuse text-white hover:bg-[#DC3535]",
    ghost: "border-transparent text-muted hover:text-ink hover:bg-raised",
    in: "border-in/60 bg-in/15 text-in hover:bg-in/25",
  }[tone];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={cx("inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40", t, className)}>
      {children}
    </button>
  );
}

export function Time({ ts, now }: { ts: string; now?: number }) {
  return <time dateTime={ts} title={absTime(ts)} className="num whitespace-nowrap text-[12px] text-muted">{relTime(ts, now)}</time>;
}

export function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      aria-label="Copy"
      className="text-faint hover:text-ink"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
    >
      {ok ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export function Addr({ address, explorer }: { address?: string; explorer: string }) {
  if (!address) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted">
      <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" className="hover:text-ink" title={address}>{short(address)}</a>
      <CopyBtn text={address} />
    </span>
  );
}

/** Simulated settlements are labelled, never linked: a fake Kitescan link would be worse than none. */
export function TxRef({ tx, link }: { tx?: string; link?: string | null }) {
  if (!tx) return <span className="text-faint">—</span>;
  if (tx.startsWith("sim:"))
    return (
      <span className="inline-flex items-center gap-1.5" title={`Simulated settlement (local facilitator): ${tx}`}>
        <Badge mono>SIM</Badge>
        <span className="font-mono text-[11px] text-faint">{short(tx.slice(4), 3)}</span>
      </span>
    );
  return (
    <a href={link ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] text-proof hover:underline" title={tx}>
      {short(tx, 4)} <ExternalLink size={11} />
    </a>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export const Empty = ({ children }: { children: ReactNode }) => <p className="px-4 py-10 text-center text-[13px] text-muted">{children}</p>;

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-line bg-surface"
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.18 }}
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="text-[14px] font-medium">{title}</div>
              <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><X size={16} /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-[420px] rounded-xl border border-line bg-surface p-5 shadow-2xl">
        <h3 className="mb-3 text-[15px] font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export const Json = ({ value }: { value: unknown }) => (
  <pre className="max-h-[420px] overflow-auto rounded-md border border-line bg-bg p-3 font-mono text-[11.5px] leading-relaxed text-muted">{JSON.stringify(value, null, 2)}</pre>
);

// ───────── toasts ─────────
interface Toast { id: number; tone: Tone; text: ReactNode }
const ToastCtx = createContext<(tone: Tone, text: ReactNode) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((tone: Tone, text: ReactNode) => {
    const id = Math.random();
    setItems((xs) => [...xs.slice(-3), { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={cx("pointer-events-auto rounded-lg border bg-surface px-3 py-2.5 text-[13px] shadow-xl", TONES[t.tone].split(" ")[0])}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
