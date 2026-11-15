// Foreman collage kit: marker doodles + halftone photocopy stickers, all drawn here (no stock art).
import type { CSSProperties, ReactNode } from "react";
import { cx } from "./ui";

type P = { className?: string; style?: CSSProperties; color?: string };
const stroke = (c = "#0e0e0e", w = 5) => ({ fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

// ───────── marker doodles (paths carry data-draw so GSAP can draw them on) ─────────
export const Star = ({ className, style, color }: P) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
    <path data-draw d="M48 8 L60 40 L94 41 L66 61 L78 93 L50 73 L21 92 L33 60 L6 40 L40 39 L50 10" {...stroke(color, 6)} />
  </svg>
);
export const StarFilled = ({ className, style, color = "#0e0e0e" }: P) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
    <path d="M50 4 L62 38 L98 40 L69 61 L80 96 L50 75 L19 95 L31 61 L3 40 L38 38Z" fill={color} />
    <path d="M44 30 L50 16" stroke="#fffdf4" strokeWidth="4" strokeLinecap="round" opacity=".6" />
  </svg>
);
export const Crown = ({ className, style, color }: P) => (
  <svg viewBox="0 0 100 80" className={className} style={style} aria-hidden>
    <path data-draw d="M10 66 L16 20 L36 46 L50 10 L64 46 L84 20 L90 66 Z M8 72 L92 70" {...stroke(color, 5)} />
  </svg>
);
export const Bolt = ({ className, style, color = "#ff2ea8" }: P) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
    <path d="M60 3 L18 56 L45 56 L33 97 L84 38 L55 38 L68 3Z" fill={color} stroke="#0e0e0e" strokeWidth="4" strokeLinejoin="round" />
  </svg>
);
export const Sparks = ({ className, style, color }: P) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
    <path data-draw d="M20 70 L6 82 M34 50 L14 40 M58 40 L56 16" {...stroke(color, 6)} />
  </svg>
);
export const Smiley = ({ className, style, color = "#f7ef1c" }: P) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
    <circle cx="50" cy="50" r="42" fill={color} stroke="#0e0e0e" strokeWidth="5" />
    <path d="M36 36 L36 46 M64 36 L64 46" {...stroke("#0e0e0e", 6)} />
    <path d="M28 58 C36 76 64 78 72 58" {...stroke("#0e0e0e", 5)} />
  </svg>
);
export const Squiggle = ({ className, style, color = "#ff2ea8" }: P) => (
  <svg viewBox="0 0 300 30" preserveAspectRatio="none" className={className} style={style} aria-hidden>
    <path data-draw d="M4 18 C40 8 70 24 110 14 S180 8 220 16 S270 20 296 10" {...stroke(color, 7)} />
  </svg>
);
export const Arrow = ({ className, style, color }: P) => (
  <svg viewBox="0 0 120 80" className={className} style={style} aria-hidden>
    <path data-draw d="M8 60 C30 20 70 10 104 26 M104 26 L84 10 M104 26 L90 46" {...stroke(color, 5)} />
  </svg>
);
export const Globe = ({ className, style, color = "#ff2ea8" }: P) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
    <circle cx="50" cy="50" r="40" fill={color} stroke="#0e0e0e" strokeWidth="5" />
    <path d="M10 50 H90 M50 10 C30 30 30 70 50 90 M50 10 C70 30 70 70 50 90 M18 30 H82 M18 70 H82" {...stroke("#0e0e0e", 4)} />
  </svg>
);
export const Check = ({ className, style, color = "#0e0e0e" }: P) => (
  <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
    <path data-draw d="M14 54 L40 80 L88 18" {...stroke(color, 9)} />
  </svg>
);

/** Shared halftone patterns. Render once per page. */
export function HalftoneDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <pattern id="ht-fine" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2.5" cy="2.5" r="1.25" fill="#0e0e0e" /></pattern>
        <pattern id="ht-bold" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="3.5" cy="3.5" r="2.3" fill="#0e0e0e" /></pattern>
        <pattern id="ht-pink" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3" cy="3" r="1.7" fill="#ff2ea8" /></pattern>
        <linearGradient id="shade-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="1" /></linearGradient>
        <mask id="m-shade-l"><rect width="400" height="400" fill="url(#shade-l)" /></mask>
        <linearGradient id="shade-l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" /><stop offset=".7" stopColor="#000" /></linearGradient>
      </defs>
    </svg>
  );
}

// ───────── halftone stickers ─────────

/** The foreman's hard hat: the brand object. */
export const HardHat = ({ className, style }: P) => (
  <svg viewBox="0 0 320 220" className={cx("sticker", className)} style={style} aria-hidden>
    <path d="M44 150 C44 70 96 26 160 26 C224 26 276 70 276 150 Z" fill="#e9e6dc" stroke="#0e0e0e" strokeWidth="6" />
    <path d="M44 150 C44 70 96 26 160 26 C224 26 276 70 276 150 Z" fill="url(#ht-fine)" mask="url(#m-shade-l)" opacity=".75" />
    <path d="M136 30 C130 60 128 110 132 150 L188 150 C192 110 190 60 184 30 C170 26 150 26 136 30Z" fill="#cfcabd" stroke="#0e0e0e" strokeWidth="5" />
    <path d="M136 30 C130 60 128 110 132 150 L150 150 C148 100 148 60 152 28Z" fill="url(#ht-bold)" opacity=".55" />
    <path d="M14 150 C14 140 30 136 50 136 L270 136 C290 136 306 140 306 150 L306 160 C306 176 290 182 270 182 L50 182 C30 182 14 176 14 160Z" fill="#0e0e0e" />
    <path d="M30 152 L292 152" stroke="#fffdf4" strokeWidth="3" opacity=".35" />
    <path d="M168 62 L140 108 L160 108 L150 140 L190 92 L168 92 L178 62Z" fill="#ff2ea8" stroke="#0e0e0e" strokeWidth="4" strokeLinejoin="round" />
    <path d="M70 92 C78 70 96 54 116 46" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".8" fill="none" />
  </svg>
);

/** Old-school phone handset with curly cord. */
export const Handset = ({ className, style }: P) => (
  <svg viewBox="0 0 240 240" className={cx("sticker", className)} style={style} aria-hidden>
    <defs><clipPath id="hs-clip"><path transform="translate(20 20) scale(8)" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></clipPath></defs>
    <path transform="translate(20 20) scale(8)" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="#e6e3d8" />
    <rect x="0" y="0" width="240" height="240" fill="url(#ht-fine)" clipPath="url(#hs-clip)" mask="url(#m-shade-l)" opacity=".8" />
    <path transform="translate(20 20) scale(8)" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="#0e0e0e" strokeWidth=".7" strokeLinejoin="round" />
    <path d="M196 196 c10 6 4 16 -4 12 c-8 -4 2 -14 8 -6 c6 8 -6 14 -10 6 c-4 -8 8 -12 10 -2 c2 10 -10 12 -12 4 l-14 18" fill="none" stroke="#0e0e0e" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

/** Rubber stamp. */
export const Stamp = ({ text = "PASS", sub = "PROOF CHECKED", ok = true, className, style }: P & { text?: string; sub?: string; ok?: boolean }) => {
  const c = ok ? "#0b7a3b" : "#d4101e";
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden>
      <defs><filter id={`rough-${text}`}><feTurbulence baseFrequency=".9" numOctaves="2" result="t" /><feDisplacementMap in="SourceGraphic" in2="t" scale="4" /></filter></defs>
      <g filter={`url(#rough-${text})`} opacity=".88">
        <circle cx="100" cy="100" r="88" fill="none" stroke={c} strokeWidth="8" />
        <circle cx="100" cy="100" r="72" fill="none" stroke={c} strokeWidth="3" />
        <text x="100" y="116" textAnchor="middle" fontFamily="Anton, Impact" fontSize="54" fill={c}>{text}</text>
        <text x="100" y="62" textAnchor="middle" fontFamily="Barlow Semi Condensed" fontWeight="800" fontSize="16" letterSpacing="2" fill={c}>{sub}</text>
        <text x="100" y="152" textAnchor="middle" fontFamily="Barlow Semi Condensed" fontWeight="800" fontSize="14" letterSpacing="3" fill={c}>★ ORACLE ★</text>
      </g>
    </svg>
  );
};

/** fUSD coin on Kite. */
export const Coin = ({ className, style, label = "fUSD" }: P & { label?: string }) => (
  <svg viewBox="0 0 200 200" className={cx("sticker", className)} style={style} aria-hidden>
    <circle cx="100" cy="100" r="88" fill="#f7ef1c" stroke="#0e0e0e" strokeWidth="6" />
    <circle cx="100" cy="100" r="88" fill="url(#ht-fine)" opacity=".25" />
    <circle cx="100" cy="100" r="70" fill="none" stroke="#0e0e0e" strokeWidth="3" strokeDasharray="4 7" />
    <path d="M100 42 L134 92 L100 158 L66 92Z" fill="#ff2ea8" stroke="#0e0e0e" strokeWidth="5" strokeLinejoin="round" />
    <path d="M66 92 L134 92 M100 42 L100 158" stroke="#0e0e0e" strokeWidth="3" />
  </svg>
);

/** Halftone tooth with a sparkle: the clinic. */
export const Tooth = ({ className, style }: P) => (
  <svg viewBox="0 0 200 220" className={cx("sticker", className)} style={style} aria-hidden>
    <path d="M40 40 C60 14 90 26 100 34 C110 26 140 14 160 40 C178 64 170 96 160 118 C150 140 148 190 132 196 C118 202 114 160 100 150 C86 160 82 202 68 196 C52 190 50 140 40 118 C30 96 22 64 40 40Z" fill="#f1eee5" stroke="#0e0e0e" strokeWidth="6" strokeLinejoin="round" />
    <path d="M40 40 C60 14 90 26 100 34 C110 26 140 14 160 40 C178 64 170 96 160 118 C150 140 148 190 132 196 C118 202 114 160 100 150 C86 160 82 202 68 196 C52 190 50 140 40 118 C30 96 22 64 40 40Z" fill="url(#ht-fine)" mask="url(#m-shade-l)" opacity=".6" />
    <path d="M58 56 C66 44 80 42 88 48" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
    <path d="M170 10 L176 26 L192 30 L176 36 L170 52 L164 36 L148 30 L164 26Z" fill="#ff2ea8" stroke="#0e0e0e" strokeWidth="3" />
  </svg>
);

// ───────── paper props (HTML so they carry real data) ─────────

export function Polaroid({ children, caption, className, style, tape = true }: { children: ReactNode; caption?: ReactNode; className?: string; style?: CSSProperties; tape?: boolean }) {
  return (
    <figure className={cx("relative bg-[#fffdf4] p-3 pb-2 shadow-[6px_8px_0_rgba(0,0,0,.28)]", className)} style={style}>
      {tape && <span className="tape left-1/2 -top-3 -translate-x-1/2 -rotate-3" />}
      <div className="overflow-hidden bg-ink">{children}</div>
      {caption && <figcaption className="marker px-1 pt-2 text-[17px] leading-tight text-ink">{caption}</figcaption>}
    </figure>
  );
}

export function CalendarPage({ day = "16", month = "NOV", weekday = "MON", time = "10:00", what = "Dental check-up", className, style }: P & { day?: string; month?: string; weekday?: string; time?: string; what?: string }) {
  return (
    <div className={cx("relative w-[190px] bg-[#fffdf4] text-ink shadow-[6px_8px_0_rgba(0,0,0,.28)]", className)} style={style}>
      <div className="flex justify-between bg-pink px-3 py-1.5 font-bold text-white"><span>{month}</span><span>{weekday}</span></div>
      <div className="display px-3 pt-1 text-[96px] leading-[.95]">{day}</div>
      <div className="border-t-2 border-dashed border-ink/30 px-3 py-2 text-[14px] font-bold">{time} · {what}</div>
      <Stamp text="BOOKED" sub="CAL.COM" className="absolute -right-8 -bottom-8 w-[104px] -rotate-12" />
    </div>
  );
}

export function Receipt({ lines, total, tx, className, style }: { lines: [string, string][]; total: string; tx?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={cx("relative w-[210px] bg-[#fffdf4] px-4 pt-4 pb-6 font-mono text-[11.5px] text-ink shadow-[6px_8px_0_rgba(0,0,0,.28)]", className)}
      style={{ clipPath: "polygon(0 0,100% 0,100% 96%,95% 100%,90% 96%,85% 100%,80% 96%,75% 100%,70% 96%,65% 100%,60% 96%,55% 100%,50% 96%,45% 100%,40% 96%,35% 100%,30% 96%,25% 100%,20% 96%,15% 100%,10% 96%,5% 100%,0 96%)", ...style }}>
      <div className="mb-2 text-center font-sans text-[15px] font-extrabold tracking-wide">x402 RECEIPT</div>
      <div className="mb-2 text-center text-[10px] text-muted">KITE TESTNET · CHAIN 2368</div>
      {lines.map(([k, v]) => <div key={k} className="flex justify-between border-b border-dashed border-ink/25 py-1"><span>{k}</span><span>{v}</span></div>)}
      <div className="mt-2 flex justify-between text-[13px] font-bold"><span>TOTAL</span><span>{total}</span></div>
      {tx && <div className="mt-2 truncate text-[10px] text-muted">tx {tx}</div>}
    </div>
  );
}

/** A phone running a Foreman call. */
export function CallPhone({ name = "Asha", lines, className, style }: { name?: string; lines: { who: string; text: string }[]; className?: string; style?: CSSProperties }) {
  return (
    <div className={cx("relative w-[230px] rounded-[34px] border-[7px] border-ink bg-ink p-1 shadow-[8px_10px_0_rgba(0,0,0,.3)]", className)} style={style}>
      <div className="relative overflow-hidden rounded-[26px] bg-[#fffdf4]">
        <div className="mx-auto mt-1.5 h-4 w-20 rounded-full bg-ink" />
        <div className="flex items-center gap-2 px-3 pt-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-yellow"><Bolt className="h-5 w-5" color="#0e0e0e" /></span>
          <div className="leading-tight"><div className="text-[13px] font-extrabold">Foreman</div><div className="text-[10.5px] text-muted">calling {name} · AI agent</div></div>
        </div>
        <div className="m-2 space-y-1.5 rounded-xl bg-pink p-2">
          {lines.slice(0, 3).map((l, i) => (
            <div key={i} data-bubble className={cx("rounded-xl px-2.5 py-1.5 text-[11px] leading-snug", l.who === "agent" ? "bg-ink text-white" : "ml-5 bg-[#fffdf4] text-ink")}>{l.text}</div>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 pb-3 text-[11px] font-bold"><span className="text-in">● booked</span><span className="num text-muted">01:04</span></div>
      </div>
    </div>
  );
}

/** Torn-edge band (top or bottom) between sections. */
export const TornEdge = ({ color, side = "top", className }: { color: "black" | "pink" | "yellow"; side?: "top" | "bottom"; className?: string }) => (
  <div aria-hidden className={cx("pointer-events-none h-6 w-full bg-repeat-x md:h-8", className)} style={{ backgroundImage: `url(/assets/textures/torn-${color}-${side}.svg)`, backgroundSize: "600px 100%" }} />
);
