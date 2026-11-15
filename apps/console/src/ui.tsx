import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Smiley } from "./art";
import { absTime, relTime, short } from "./lib";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Shared table styling: black header strip, dashed rows. */
export const THEAD = "bg-ink text-left text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-white";
export const TBODY = "divide-y-2 divide-dashed divide-ink/15";
/** Card heading: bold condensed caps. */
export const CAPS = "text-[14px] font-extrabold uppercase tracking-[0.05em] text-ink";

export function Card({ title, aside, children, className, pad = true }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("min-w-0 overflow-hidden rounded-[6px] border-2 border-ink bg-surface shadow-[5px_5px_0_#0e0e0e]", className)}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b-2 border-dashed border-ink/25 px-5 py-3">
          <h2 className={CAPS}>{title}</h2>
          {aside && <div className="flex items-center gap-2 text-ink/70">{aside}</div>}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

/** Huge display page heading with a marker doodle and one-line subtitle. */
export function PageTitle({ title, sub, doodle, aside }: { title: string; sub: string; doodle?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-start gap-2">
          <span className="display hl text-[52px] sm:text-[68px] lg:text-[84px]">{title}</span>
          {doodle && <span className="-mt-1 w-9 shrink-0 sm:w-12">{doodle}</span>}
        </h1>
        <p className="mt-2 text-[15px] font-semibold text-ink/80">{sub}</p>
      </div>
      {aside}
    </div>
  );
}

const TONES = {
  neutral: "bg-surface text-ink",
  accent: "bg-ink text-pink",
  in: "bg-[#d6f5e1] text-in",
  out: "bg-[#ffe8c9] text-out",
  refuse: "bg-[#ffe1e1] text-refuse",
  proof: "bg-[#dfe7ff] text-proof",
} as const;
export type Tone = keyof typeof TONES;
const BAR: Record<Tone, string> = { neutral: "bg-ink", accent: "bg-pink", in: "bg-in", out: "bg-out", refuse: "bg-refuse", proof: "bg-proof" };

export function Badge({ tone = "neutral", mono, children, className, title }: { tone?: Tone; mono?: boolean; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border-[1.5px] border-ink px-1.5 text-[11px] font-bold leading-[18px]", mono && "font-mono", TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Typed refusal codes always render as mono red badges. */
export const Code = ({ code, shake }: { code: string; shake?: boolean }) => (
  <Badge tone="refuse" mono className={shake ? "shake-once" : undefined}>{code}</Badge>
);

type BtnTone = "default" | "primary" | "danger" | "ghost" | "in" | "pink";
/** `gap` is the colour behind the button, so the offset shadow reads as a cut-out. */
export function Button({ children, onClick, tone = "default", disabled, title, type = "button", className, gap = "#fffdf4" }: { children: ReactNode; onClick?: () => void; tone?: BtnTone; disabled?: boolean; title?: string; type?: "button" | "submit"; className?: string; gap?: string }) {
  if (tone === "ghost")
    return (
      <button type={type} title={title} disabled={disabled} onClick={onClick} className={cx("inline-flex h-9 items-center gap-1.5 rounded-[4px] px-3 text-[14px] font-bold text-ink hover:bg-ink/[.07] disabled:cursor-not-allowed disabled:opacity-40", className)}>
        {children}
      </button>
    );
  const t = { default: "brut-light", primary: "", danger: "bg-refuse!", in: "bg-in!", pink: "brut-pink" }[tone];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} style={{ "--brut-gap": gap } as CSSProperties} className={cx("brut brut-sm whitespace-nowrap", t, className)}>
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
      className="text-faint hover:text-accent"
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
      <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" className="hover:text-accent" title={address}>{short(address)}</a>
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
    <a href={link ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-proof underline decoration-2 underline-offset-2 hover:text-accent" title={tx}>
      {short(tx, 4)} <ExternalLink size={11} />
    </a>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton rounded-[4px] border-2 border-ink/20", className)} />;

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
    <Smiley className="wiggle h-12 w-12" />
    <p className="max-w-[420px] text-[14px] font-semibold text-ink/75">{children}</p>
  </div>
);

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
          <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l-2 border-ink bg-surface shadow-[-6px_0_0_#0e0e0e]"
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <header className="flex items-center justify-between gap-3 border-b-2 border-ink bg-yellow px-5 py-3">
              <div className="min-w-0 text-[15px] font-bold">{title}</div>
              <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-surface hover:bg-pink"><X size={15} /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 16, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: 10 }}
            className="relative w-full max-w-[440px] rounded-[6px] border-2 border-ink bg-surface p-5 shadow-[8px_8px_0_#0e0e0e]">
            <h3 className="display mb-3 text-[30px]">{title}</h3>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export const Json = ({ value }: { value: unknown }) => (
  <pre className="max-h-[420px] overflow-auto rounded-[4px] border-2 border-ink bg-raised p-3 font-mono text-[11.5px] leading-relaxed text-ink/80">{JSON.stringify(value, null, 2)}</pre>
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
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2.5" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, x: 30 }}
              className="pointer-events-auto flex overflow-hidden rounded-[4px] border-2 border-ink bg-surface text-[13.5px] font-semibold shadow-[4px_4px_0_#0e0e0e]">
              <span className={cx("w-2 shrink-0 border-r-2 border-ink", BAR[t.tone])} />
              <div className="px-3 py-2.5">{t.text}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
