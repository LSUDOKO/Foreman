// Foreman collage stickers, ported from apps/console/src/art.tsx: pure SVG, no classes, no framer-motion.
// `draw` (0..1) draws a marker doodle on through pathLength; everything else is driven by the caller's frame.
import React from "react";

type P = { style?: React.CSSProperties; color?: string; draw?: number; w?: number };
const INK = "#0e0e0e";
const stroke = (c = INK, w = 5, draw = 1) => ({
  fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - Math.max(0, Math.min(1, draw)),
});
/** white cut-out outline + hard drop shadow, the site's `.sticker` */
export const STICKER = "drop-shadow(6px 8px 0 rgba(0,0,0,.28))";
const sv = (w: number | undefined, style: React.CSSProperties | undefined, sticker = false): React.CSSProperties =>
  ({ width: w, display: "block", overflow: "visible", ...(sticker ? { filter: STICKER } : {}), ...style });

// ───────── marker doodles ─────────
export const Star = ({ style, color, draw = 1, w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}><path d="M48 8 L60 40 L94 41 L66 61 L78 93 L50 73 L21 92 L33 60 L6 40 L40 39 L50 10" {...stroke(color, 6, draw)} /></svg>);
export const StarFilled = ({ style, color = INK, w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}>
    <path d="M50 4 L62 38 L98 40 L69 61 L80 96 L50 75 L19 95 L31 61 L3 40 L38 38Z" fill={color} />
    <path d="M44 30 L50 16" stroke="#fffdf4" strokeWidth="4" strokeLinecap="round" opacity=".6" /></svg>);
export const Crown = ({ style, color, draw = 1, w }: P) => (
  <svg viewBox="0 0 100 80" style={sv(w, style)}><path d="M10 66 L16 20 L36 46 L50 10 L64 46 L84 20 L90 66 Z M8 72 L92 70" {...stroke(color, 5, draw)} /></svg>);
export const Bolt = ({ style, color = "#ff2ea8", w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}><path d="M60 3 L18 56 L45 56 L33 97 L84 38 L55 38 L68 3Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" /></svg>);
export const Sparks = ({ style, color, draw = 1, w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}><path d="M20 70 L6 82 M34 50 L14 40 M58 40 L56 16" {...stroke(color, 6, draw)} /></svg>);
export const Smiley = ({ style, color = "#f7ef1c", w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}>
    <circle cx="50" cy="50" r="42" fill={color} stroke={INK} strokeWidth="5" />
    <path d="M36 36 L36 46 M64 36 L64 46" {...stroke(INK, 6)} /><path d="M28 58 C36 76 64 78 72 58" {...stroke(INK, 5)} /></svg>);
export const Squiggle = ({ style, color = "#ff2ea8", draw = 1, w }: P) => (
  <svg viewBox="0 0 300 30" preserveAspectRatio="none" style={sv(w, style)}><path d="M4 18 C40 8 70 24 110 14 S180 8 220 16 S270 20 296 10" {...stroke(color, 7, draw)} /></svg>);
export const Arrow = ({ style, color, draw = 1, w }: P) => (
  <svg viewBox="0 0 120 80" style={sv(w, style)}><path d="M8 60 C30 20 70 10 104 26 M104 26 L84 10 M104 26 L90 46" {...stroke(color, 5, draw)} /></svg>);
export const Check = ({ style, color = INK, draw = 1, w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}><path d="M14 54 L40 80 L88 18" {...stroke(color, 9, draw)} /></svg>);
export const Cross = ({ style, color = "#d4101e", draw = 1, w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}><path d="M16 16 L84 84 M84 18 L18 82" {...stroke(color, 10, draw)} /></svg>);
export const Circle = ({ style, color = "#ff2ea8", draw = 1, w }: P) => (
  <svg viewBox="0 0 200 100" preserveAspectRatio="none" style={sv(w, style)}><path d="M150 12 C60 0 6 24 10 54 C14 88 120 96 172 76 C204 62 196 26 140 14" {...stroke(color, 6, draw)} /></svg>);
export const Globe = ({ style, color = "#ff2ea8", w }: P) => (
  <svg viewBox="0 0 100 100" style={sv(w, style)}>
    <circle cx="50" cy="50" r="40" fill={color} stroke={INK} strokeWidth="5" />
    <path d="M10 50 H90 M50 10 C30 30 30 70 50 90 M50 10 C70 30 70 70 50 90 M18 30 H82 M18 70 H82" {...stroke(INK, 4)} /></svg>);

/** Shared halftone patterns. Render once at the root. */
export const HalftoneDefs = () => (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <defs>
      <pattern id="ht-fine" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2.5" cy="2.5" r="1.25" fill={INK} /></pattern>
      <pattern id="ht-bold" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="3.5" cy="3.5" r="2.3" fill={INK} /></pattern>
      <pattern id="ht-pink" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3" cy="3" r="1.7" fill="#ff2ea8" /></pattern>
      <linearGradient id="shade-l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" /><stop offset=".7" stopColor="#000" /></linearGradient>
      <mask id="m-shade-l"><rect width="400" height="400" fill="url(#shade-l)" /></mask>
      <filter id="rough"><feTurbulence baseFrequency=".9" numOctaves="2" result="t" /><feDisplacementMap in="SourceGraphic" in2="t" scale="4" /></filter>
    </defs>
  </svg>);

// ───────── halftone stickers ─────────
/** The foreman's hard hat: the brand object. `charge` 0..1 lights the bolt. */
export const HardHat = ({ style, w, charge = 0 }: P & { charge?: number }) => (
  <svg viewBox="0 0 320 220" style={sv(w, style, true)}>
    <path d="M44 150 C44 70 96 26 160 26 C224 26 276 70 276 150 Z" fill="#e9e6dc" stroke={INK} strokeWidth="6" />
    <path d="M44 150 C44 70 96 26 160 26 C224 26 276 70 276 150 Z" fill="url(#ht-fine)" mask="url(#m-shade-l)" opacity=".75" />
    <path d="M136 30 C130 60 128 110 132 150 L188 150 C192 110 190 60 184 30 C170 26 150 26 136 30Z" fill="#cfcabd" stroke={INK} strokeWidth="5" />
    <path d="M136 30 C130 60 128 110 132 150 L150 150 C148 100 148 60 152 28Z" fill="url(#ht-bold)" opacity=".55" />
    <path d="M14 150 C14 140 30 136 50 136 L270 136 C290 136 306 140 306 150 L306 160 C306 176 290 182 270 182 L50 182 C30 182 14 176 14 160Z" fill={INK} />
    <path d="M30 152 L292 152" stroke="#fffdf4" strokeWidth="3" opacity=".35" />
    {charge > 0 && <path d="M168 62 L140 108 L160 108 L150 140 L190 92 L168 92 L178 62Z" fill="#f7ef1c" opacity={charge} style={{ filter: `drop-shadow(0 0 ${18 * charge}px #f7ef1c)` }} />}
    <path d="M168 62 L140 108 L160 108 L150 140 L190 92 L168 92 L178 62Z" fill={charge > 0.5 ? "#f7ef1c" : "#ff2ea8"} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    <path d="M70 92 C78 70 96 54 116 46" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".8" fill="none" />
  </svg>);

const HS = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";
/** Old-school phone handset with curly cord. */
export const Handset = ({ style, w, color = "#e6e3d8" }: P) => (
  <svg viewBox="0 0 240 240" style={sv(w, style, true)}>
    <defs><clipPath id="hs-clip"><path transform="translate(20 20) scale(8)" d={HS} /></clipPath></defs>
    <path transform="translate(20 20) scale(8)" d={HS} fill={color} />
    <rect x="0" y="0" width="240" height="240" fill="url(#ht-fine)" clipPath="url(#hs-clip)" mask="url(#m-shade-l)" opacity=".8" />
    <path transform="translate(20 20) scale(8)" d={HS} fill="none" stroke={INK} strokeWidth=".7" strokeLinejoin="round" />
    <path d="M196 196 c10 6 4 16 -4 12 c-8 -4 2 -14 8 -6 c6 8 -6 14 -10 6 c-4 -8 8 -12 10 -2 c2 10 -10 12 -12 4 l-14 18" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
  </svg>);

/** Rubber stamp. */
export const Stamp = ({ text = "PASS", sub = "PROOF CHECKED", foot = "★ ORACLE ★", ok = true, style, w }: P & { text?: string; sub?: string; foot?: string; ok?: boolean }) => {
  const c = ok ? "#0b7a3b" : "#d4101e", fs = text.length > 6 ? 300 / text.length : 54;
  return (
    <svg viewBox="0 0 200 200" style={sv(w, style)}>
      <g opacity=".9">
        <circle cx="100" cy="100" r="88" fill="none" stroke={c} strokeWidth="8" />
        <circle cx="100" cy="100" r="72" fill="none" stroke={c} strokeWidth="3" />
        <text x="100" y={100 + fs * 0.3} textAnchor="middle" fontFamily="Anton" fontSize={fs} fill={c}>{text}</text>
        <text x="100" y="62" textAnchor="middle" fontFamily="Barlow Semi Condensed" fontWeight="800" fontSize="16" letterSpacing="2" fill={c}>{sub}</text>
        <text x="100" y="152" textAnchor="middle" fontFamily="Barlow Semi Condensed" fontWeight="800" fontSize="14" letterSpacing="3" fill={c}>{foot}</text>
      </g>
    </svg>);
};
/** Rectangular rubber stamp (NO-SHOW, PAID FOR EFFORT…). */
export const RectStamp = ({ text, sub, color = "#d4101e", style, size = 80 }: { text: string; sub?: string; color?: string; style?: React.CSSProperties; size?: number }) => (
  <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", padding: `${size * 0.12}px ${size * 0.3}px`, border: `${size * 0.09}px solid ${color}`, outline: `${size * 0.035}px solid ${color}`, outlineOffset: size * 0.06,
    color, fontFamily: "Anton", fontSize: size, lineHeight: 1, letterSpacing: "0.02em", whiteSpace: "nowrap", opacity: 0.92, ...style }}>
    {text}{sub && <span style={{ fontFamily: "'Barlow Semi Condensed'", fontWeight: 800, fontSize: size * 0.24, letterSpacing: "0.18em", marginTop: size * 0.08 }}>{sub}</span>}
  </div>);

/** fUSD coin on Kite. `spin` in degrees turns it like a coin on a table. */
export const Coin = ({ style, w, label }: P & { label?: string }) => (
  <svg viewBox="0 0 200 200" style={sv(w, style, true)}>
    <circle cx="100" cy="100" r="88" fill="#f7ef1c" stroke={INK} strokeWidth="6" />
    <circle cx="100" cy="100" r="88" fill="url(#ht-fine)" opacity=".25" />
    <circle cx="100" cy="100" r="70" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="4 7" />
    <path d="M100 42 L134 92 L100 158 L66 92Z" fill="#ff2ea8" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    <path d="M66 92 L134 92 M100 42 L100 158" stroke={INK} strokeWidth="3" />
    {label && <text x="100" y="190" textAnchor="middle" fontFamily="Anton" fontSize="22" fill={INK}>{label}</text>}
  </svg>);

/** Halftone tooth with a sparkle: the clinic. */
export const Tooth = ({ style, w }: P) => (
  <svg viewBox="0 0 200 220" style={sv(w, style, true)}>
    <path d="M40 40 C60 14 90 26 100 34 C110 26 140 14 160 40 C178 64 170 96 160 118 C150 140 148 190 132 196 C118 202 114 160 100 150 C86 160 82 202 68 196 C52 190 50 140 40 118 C30 96 22 64 40 40Z" fill="#f1eee5" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    <path d="M40 40 C60 14 90 26 100 34 C110 26 140 14 160 40 C178 64 170 96 160 118 C150 140 148 190 132 196 C118 202 114 160 100 150 C86 160 82 202 68 196 C52 190 50 140 40 118 C30 96 22 64 40 40Z" fill="url(#ht-fine)" mask="url(#m-shade-l)" opacity=".6" />
    <path d="M58 56 C66 44 80 42 88 48" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
    <path d="M170 10 L176 26 L192 30 L176 36 L170 52 L164 36 L148 30 L164 26Z" fill="#ff2ea8" stroke={INK} strokeWidth="3" />
  </svg>);

/** The empty dental chair: the film's image of a no-show. */
export const Chair = ({ style, w, lamp = 1 }: P & { lamp?: number }) => (
  <svg viewBox="0 0 420 360" style={sv(w, style, true)}>
    <ellipse cx="205" cy="338" rx="120" ry="14" fill={INK} opacity=".18" />
    <path d="M150 340 L260 340 L250 322 L160 322Z" fill={INK} />
    <rect x="188" y="246" width="34" height="80" fill="#cfcabd" stroke={INK} strokeWidth="6" />
    <rect x="188" y="246" width="16" height="80" fill="url(#ht-bold)" opacity=".5" />
    <path d="M222 262 C262 150 300 92 340 72" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
    <path d="M318 52 C340 36 372 44 382 62 L346 92 C330 84 318 70 318 52Z" fill="#cfcabd" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    {lamp > 0 && <path d="M346 92 L382 62 L400 150 L300 170Z" fill="#fffbd0" opacity={0.55 * lamp} />}
    <path d="M86 226 L282 226 Q300 226 300 244 L300 258 L86 258 Q70 258 72 242 Q74 226 86 226Z" fill="#e9e6dc" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    <path d="M86 226 L282 226 Q300 226 300 244 L300 258 L86 258 Q70 258 72 242 Q74 226 86 226Z" fill="url(#ht-fine)" mask="url(#m-shade-l)" opacity=".7" />
    <path d="M286 230 L384 276 Q394 282 388 294 L382 304 L284 258Z" fill="#e9e6dc" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    <path d="M96 232 L38 86 Q34 70 50 66 L70 62 Q86 60 90 76 L140 230Z" fill="#e9e6dc" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    <path d="M96 232 L38 86 Q34 70 50 66 L60 64 L104 232Z" fill="url(#ht-bold)" opacity=".45" />
    <rect x="22" y="22" width="64" height="34" rx="16" transform="rotate(-18 54 39)" fill="#ff2ea8" stroke={INK} strokeWidth="6" />
    <path d="M150 196 L232 196" stroke={INK} strokeWidth="12" strokeLinecap="round" />
    <path d="M60 110 C66 96 74 90 82 88" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".85" />
  </svg>);

/** A photocopied head-and-shoulders silhouette (no photos of real patients). */
export const Person = ({ style, w, color = "#ff2ea8" }: P) => (
  <svg viewBox="0 0 200 200" style={sv(w, style)}>
    <rect width="200" height="200" fill={color} />
    <rect width="200" height="200" fill="url(#ht-bold)" opacity=".22" />
    <circle cx="100" cy="82" r="38" fill="#fffdf4" stroke={INK} strokeWidth="6" />
    <path d="M34 200 C34 150 64 128 100 128 C136 128 166 150 166 200Z" fill="#fffdf4" stroke={INK} strokeWidth="6" />
    <path d="M100 128 C136 128 166 150 166 200 L120 200Z" fill="url(#ht-fine)" opacity=".5" />
  </svg>);

/** Paper calendar page (inline styles, real data only). */
export const CalendarPage = ({ day = "16", month = "NOV", weekday = "MON", line = "9:00 · Asha", style, stamp = "BOOKED", stampP = 1, w = 230 }:
  { day?: string; month?: string; weekday?: string; line?: string; style?: React.CSSProperties; stamp?: string | null; stampP?: number; w?: number }) => (
  <div style={{ position: "relative", width: w, background: "#fffdf4", color: INK, boxShadow: "8px 10px 0 rgba(0,0,0,.28)", ...style }}>
    <div style={{ display: "flex", justifyContent: "space-between", background: "#ff2ea8", padding: `${w * 0.03}px ${w * 0.07}px`, fontFamily: "'Barlow Semi Condensed'", fontWeight: 800, fontSize: w * 0.09, color: "#fff" }}><span>{month}</span><span>{weekday}</span></div>
    <div style={{ fontFamily: "Anton", fontSize: w * 0.5, lineHeight: 0.95, padding: `${w * 0.02}px ${w * 0.07}px 0` }}>{day}</div>
    <div style={{ borderTop: "2px dashed rgba(14,14,14,.3)", padding: `${w * 0.04}px ${w * 0.07}px`, fontFamily: "'Barlow Semi Condensed'", fontWeight: 800, fontSize: w * 0.075 }}>{line}</div>
    {stamp && stampP > 0 && <div style={{ position: "absolute", right: -w * 0.2, bottom: -w * 0.2, transform: `rotate(-12deg) scale(${1 + (1 - stampP) * 1.6})`, opacity: Math.min(1, stampP * 2) }}>
      <Stamp text={stamp} sub={stamp === "NO-SHOW" ? "MISSED" : "CAL.COM"} foot={stamp === "NO-SHOW" ? "★ SMILE DENTAL ★" : "★ CONFIRMED ★"} ok={stamp !== "NO-SHOW"} w={w * 0.6} /></div>}
  </div>);

/** Masking tape strip. */
export const Tape = ({ style, w = 110 }: { style?: React.CSSProperties; w?: number }) => (
  <span style={{ position: "absolute", width: w, height: w * 0.28, background: "rgba(28,28,28,.82)", boxShadow: "0 1px 2px rgba(0,0,0,.25)", zIndex: 3,
    clipPath: "polygon(2% 8%, 12% 0, 30% 10%, 50% 2%, 70% 9%, 88% 1%, 100% 10%, 97% 92%, 84% 100%, 62% 91%, 40% 100%, 20% 92%, 0 100%)", ...style }} />);

/** A sticky note with a marker line. */
export const Sticky = ({ text, color = "#fff27a", style, w = 230 }: { text: string; color?: string; style?: React.CSSProperties; w?: number }) => (
  <div style={{ position: "relative", width: w, height: w * 0.86, background: color, boxShadow: "6px 9px 0 rgba(0,0,0,.25)", padding: w * 0.09, boxSizing: "border-box",
    fontFamily: "'Permanent Marker'", fontSize: w * 0.13, lineHeight: 1.15, color: INK, ...style }}>
    <Tape w={w * 0.42} style={{ left: w * 0.29, top: -w * 0.06, transform: "rotate(-4deg)" }} />{text}</div>);
