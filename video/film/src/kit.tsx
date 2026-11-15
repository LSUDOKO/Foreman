import React from "react";
import { Easing, continueRender, delayRender, getStaticFiles, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { Bolt, Tape } from "./art";

// ── fonts: self-hosted woff2 (public/fonts), loaded before the first frame renders ──
const face = (family: string, file: string, weight: string) => {
  if (typeof document === "undefined") return;
  const h = delayRender(`font ${file}`), f = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight });
  f.load().then(() => { (document.fonts as unknown as { add: (f: FontFace) => void }).add(f); continueRender(h); }).catch((e) => { console.error(e); continueRender(h); });
};
face("Anton", "anton.woff2", "400");
for (const w of [500, 600, 700, 800]) face("Barlow Semi Condensed", `barlow-${w}.woff2`, String(w));
face("Permanent Marker", "marker.woff2", "400");
face("JetBrains Mono", "jetbrains.woff2", "100 800");
export const DISPLAY = "Anton, Impact, sans-serif";
export const SANS = "'Barlow Semi Condensed', sans-serif";
export const MARKER = "'Permanent Marker', cursive";
export const MONO = "'JetBrains Mono', monospace";

// ── Foreman brand tokens (apps/console/src/index.css) ──
export const C = { yellow: "#F7EF1C", pink: "#FF2EA8", ink: "#0E0E0E", paper: "#FFFDF4", pinkText: "#E0007A", green: "#0B7A3B", red: "#D4101E", blue: "#1442D0",
  raised: "#F1ECDC", muted: "#48463C", faint: "#77735F", orange: "#FFB341", grey: "#D9D6CC" };
export const HARD = (n = 6, c = C.ink) => `${n}px ${n}px 0 ${c}`;

// ── time: 136 BPM, 16 steps a bar, 108 bars; the composer works on the same bar map ──
export const BPM = 136, BAR = 240 / BPM, FPS = 60;
export const T = (bar: number, step = 0) => bar * BAR + step * (BAR / 16);
export const TOTAL = 108 * BAR;

// ── files that exist in public/ when the bundle is made (audio and clips arrive from other agents) ──
const FILES = new Set(getStaticFiles().map((f) => f.name));
export const has = (p: string) => FILES.has(p);

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const back = Easing.bezier(0.34, 1.56, 0.64, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const full: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden" };
export const useT = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };
export const lerp = (t: number, a: number, b: number, x: number, y: number, e = ease) => interpolate(t, [a, b], [x, y], { ...clamp, easing: e });
export const lin = (t: number, a: number, b: number, x: number, y: number) => interpolate(t, [a, b], [x, y], clamp);
export const pop = (t: number, at: number, damping = 11, stiffness = 170) => spring({ frame: Math.round((t - at) * 60), fps: 60, config: { damping, stiffness, mass: 0.7 } });
export const hit = (t: number, a: number, k = 7) => (t >= a ? Math.exp(-(t - a) * k) : 0);
export const fade = (t: number, a: number, z = 1e9, fi = 0.25, fo = 0.25): React.CSSProperties => {
  const i = lerp(t, a, a + fi, 0, 1), o = lerp(t, z - fo, z, 0, 1, inOut);
  return { opacity: i * (1 - o), filter: i < 0.99 || o > 0.01 ? `blur(${(1 - i) * 10 + o * 14}px)` : undefined };
};
/** keyframes [time, value...] → eased value */
export const kf = (t: number, keys: number[][], i: number, e = inOut) => interpolate(t, keys.map((k) => k[0]), keys.map((k) => k[i]), { ...clamp, easing: e });
/** slam in: scale from big, settle with a spring; returns [scale, opacity] */
export const slam = (t: number, at: number, from = 1.6) => { const p = pop(t, at, 13, 260); return [from - (from - 1) * p, Math.min(1, (t - at) * 14)] as const; };

export const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 24, color = C.muted, style }) =>
  <div style={{ fontFamily: MONO, fontSize: size, color, whiteSpace: "nowrap", fontWeight: 500, ...style }}>{children}</div>;
export const Marker: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 34, color = C.ink, style }) =>
  <div style={{ fontFamily: MARKER, fontSize: size, color, whiteSpace: "nowrap", lineHeight: 1.1, ...style }}>{children}</div>;
/** Centres its children on the line y; `style` applies to the inner box. */
export const Centre: React.FC<{ y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ y = 540, children, style }) =>
  <div style={{ position: "absolute", left: 0, right: 0, top: y, transform: "translateY(-50%)", display: "flex", justifyContent: "center" }}>
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", ...style }}>{children}</div></div>;
/** absolutely placed box, centred on x,y */
export const At: React.FC<{ x: number; y: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, children, style }) =>
  <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
    <div style={{ flex: "none" }}>{children}</div></div>;

/** Paper grain, multiplied, shifted every frame so it reads as film grain (cheap: one tiled svg). */
export const Grain: React.FC<{ o?: number }> = ({ o = 0.22 }) => {
  const f = useCurrentFrame(), ox = (f * 97) % 240, oy = (f * 61) % 240;
  return <>
    <div style={{ ...full, pointerEvents: "none", backgroundImage: `url(${staticFile("tex/grain.svg")})`, backgroundPosition: `${ox}px ${oy}px`, opacity: o }} />
    <div style={{ ...full, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 48%, transparent 60%, rgba(14,14,14,.22) 100%)" }} />
  </>;
};
/** photocopy halftone dots drifting across a surface */
export const Dots: React.FC<{ color?: string; o?: number; size?: number; seed?: string }> = ({ color = C.ink, o = 0.07, size = 16, seed = "d" }) => {
  const t = useT(), dx = noise2D(seed, t * 0.08, 0) * 60 + t * 6, dy = noise2D(seed, 0, t * 0.08) * 40;
  return <div style={{ ...full, opacity: o, backgroundImage: `radial-gradient(${color} 22%, transparent 26%)`, backgroundSize: `${size}px ${size}px`, backgroundPosition: `${dx}px ${dy}px`,
    maskImage: "radial-gradient(ellipse at 70% 30%, black 0%, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at 70% 30%, black 0%, transparent 70%)" }} />;
};

/** A scene: a printed surface and a camera that never rests (push + slow 3D float + impact shake). */
export const Frame: React.FC<{ a: number; z: number; bg?: string; push?: number; dots?: string | null; shake?: number[]; children: React.ReactNode; float?: number }> =
  ({ a, z, bg = C.yellow, push = 0.05, dots = C.ink, shake = [], children, float = 1 }) => {
    const t = useT(), s = 1 + push * lin(t, a, z, 0, 1), rx = noise2D(`rx${a}`, t * 0.45, 0) * 1.6 * float, ry = noise2D(`ry${a}`, 0, t * 0.45) * 2.2 * float, dx = noise2D(`dx${a}`, t * 0.3, 3) * 12 * float;
    const sh = shake.reduce((acc, at) => acc + hit(t, at, 9), 0), sx = Math.sin(t * 83) * 14 * sh, sy = Math.cos(t * 71) * 10 * sh;
    return <div style={{ ...full, background: bg }}>{dots && <Dots color={dots} seed={`d${a}`} />}
      <div style={{ ...full, perspective: 2200 }}><div style={{ ...full, transform: `translate(${dx + sx}px, ${sy}px) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)` }}>{children}</div></div></div>;
  };

/** Pink (or yellow) brush highlight wiped in from the left behind its children. */
export const Brush: React.FC<{ p: number; color?: "pink" | "yellow"; children: React.ReactNode; style?: React.CSSProperties; pad?: string }> = ({ p, color = "pink", children, style, pad = "0 .12em" }) =>
  <span style={{ position: "relative", display: "inline-block", padding: pad, ...style }}>
    <span style={{ position: "absolute", inset: "6% -3% 2% -3%", background: `url(${staticFile(`tex/brush-${color}.svg`)}) center / 100% 100% no-repeat`, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }} />
    <span style={{ position: "relative" }}>{children}</span></span>;

/** A word lands huge (Anton), then shrinks in place to a line. */
export const Giant: React.FC<{ word: string; at: number; shrink?: number; big?: number; small?: number; y?: number; hold?: number; color?: string; shadow?: string | null; chip?: boolean; rot?: number; toY?: number }> =
  ({ word, at, shrink, big = 380, small = 110, y = 540, hold, color = C.ink, shadow = C.pink, chip, rot = -2, toY }) => {
    const t = useT(), p = pop(t, at - 0.05, 12, 260), sh = shrink === undefined ? 0 : lerp(t, shrink, shrink + 0.32, 0, 1, inOut), size = interpolate(sh, [0, 1], [big, small]);
    const o = Math.min(1, p * 1.6) * (hold === undefined ? 1 : 1 - lerp(t, hold - 0.1, hold, 0, 1)), bl = sh > 0 && sh < 1 ? (1 - Math.abs(sh - 0.5) * 2) * 8 : 0;
    if (t < at - 0.05 || (hold !== undefined && t > hold)) return null;
    const yy = toY === undefined ? y : interpolate(sh, [0, 1], [y, toY]), off = Math.max(3, size * 0.035);
    return <div style={{ position: "absolute", left: 0, right: 0, top: yy, transform: `translateY(-50%) scale(${1.25 - 0.25 * p}) rotate(${rot * (1 - sh)}deg)`, textAlign: "center", fontFamily: DISPLAY, fontSize: size,
      lineHeight: 1.02, whiteSpace: "nowrap", textTransform: "uppercase", color, opacity: o, filter: bl > 0.5 || p < 0.9 ? `blur(${bl + (1 - Math.min(1, p)) * 10}px)` : undefined,
      textShadow: shadow ? `${off}px ${off}px 0 ${shadow}` : undefined }}>
      {chip ? <Brush p={lerp(t, at + 0.05, at + 0.3, 0, 1, inOut)}>{word}</Brush> : word}</div>;
  };

/** Words drop one at a time; consecutive `pill` words share one pink brush chip wiped in from the left. */
export const Drop: React.FC<{ words: string[]; at: number; gap?: number; size: number; color?: string; pill?: number[]; display?: boolean; weight?: number; brush?: "pink" | "yellow"; pillColor?: string }> =
  ({ words, at, gap = 0.09, size, color = C.ink, pill = [], display, weight = 800, brush = "pink", pillColor }) => {
    const t = useT(), groups: number[][] = [];
    words.forEach((_, i) => { const on = pill.includes(i), last = groups[groups.length - 1]; if (on && last && pill.includes(last[last.length - 1]) && last[last.length - 1] === i - 1) last.push(i); else groups.push([i]); });
    const word = (i: number, on: boolean) => { const a = at + i * gap, p = pop(t, a, 13, 260), o = lerp(t, a, a + 0.12, 0, 1);
      return <span key={i} style={{ position: "relative", display: "inline-block", fontFamily: display ? DISPLAY : SANS, fontWeight: display ? 400 : weight, fontSize: size, textTransform: display ? "uppercase" : undefined,
        letterSpacing: display ? "0" : "-0.01em", lineHeight: 1.1, color: on ? (pillColor ?? color) : color, opacity: o, transform: `translateY(${(1 - p) * size * 0.4}px) rotate(${(1 - p) * 6}deg)`, filter: o < 0.99 ? `blur(${(1 - o) * 10}px)` : undefined }}>{words[i]}</span>; };
    return <span style={{ display: "inline-flex", gap: size * 0.24, alignItems: "baseline", whiteSpace: "nowrap" }}>{groups.map((g) => {
      if (!pill.includes(g[0])) return word(g[0], false);
      const a = at + g[0] * gap, wp = lerp(t, a + 0.08, a + 0.08 + 0.14 * g.length, 0, 1, inOut);
      return <span key={`g${g[0]}`} style={{ position: "relative", display: "inline-flex", gap: size * 0.24, padding: `0 ${size * 0.16}px` }}>
        <span style={{ position: "absolute", inset: "8% -2% 0 -2%", background: `url(${staticFile(`tex/brush-${brush}.svg`)}) center / 100% 100% no-repeat`, clipPath: `inset(0 ${(1 - wp) * 100}% 0 0)` }} />
        {g.map((i) => word(i, true))}</span>; })}</span>;
  };

/** The narrator: a paper strip at the bottom; each line wipes in, its words blur in, then it blurs out. */
export type Line = [number, number, string, string[]?];
export const Narrator: React.FC<{ lines: Line[]; y?: number; size?: number; dark?: boolean }> = ({ lines, y = 968, size = 44, dark }) => {
  const t = useT(), cur = lines.find(([a, z]) => t >= a - 0.08 && t < z);
  if (!cur) return null;
  const [a, z, text, hl = []] = cur, out = lerp(t, z - 0.24, z, 0, 1, inOut), ws = text.split(" "), wipe = lerp(t, a - 0.08, a + 0.22, 0, 1, inOut);
  return <Centre y={y} style={{ opacity: 1 - out, filter: out > 0.01 ? `blur(${out * 12}px)` : undefined, transform: `rotate(${-0.8 + noise2D(`nr${a}`, t * 0.3, 0) * 0.6}deg) translateY(${out * 20}px)` }}>
    <div style={{ position: "relative", display: "flex", gap: size * 0.24, padding: `${size * 0.2}px ${size * 0.5}px`, background: dark ? C.ink : C.paper, border: `3px solid ${C.ink}`, boxShadow: HARD(7, dark ? C.pink : C.ink),
      fontFamily: SANS, fontWeight: 700, fontSize: size, color: dark ? C.paper : C.ink, clipPath: `inset(-20px ${(1 - wipe) * 100}% -20px -20px)` }}>
      <Tape w={86} style={{ left: -34, top: -14, transform: "rotate(-24deg)" }} />
      {ws.map((w, i) => { const at = a + 0.1 + i * 0.06, p = lerp(t, at, at + 0.36, 0, 1), on = hl.includes(w.replace(/[.,?!:…]/g, ""));
        return <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 12}px)`, filter: p < 0.99 ? `blur(${(1 - p) * 12}px)` : undefined, color: on ? (dark ? C.yellow : C.pinkText) : undefined, fontWeight: on ? 800 : 700 }}>{w}</span>; })}
    </div></Centre>;
};

// ── the cast: named cursors ──
export const CAST = {
  clinic: { name: "Smile Dental", role: "clinic", bg: C.ink, fg: C.yellow, arrow: C.ink, edge: C.paper },
  asha: { name: "Asha", role: "patient", bg: C.pink, fg: C.ink, arrow: C.pink, edge: C.ink },
  foreman: { name: "Foreman", role: "agent", bg: C.yellow, fg: C.ink, arrow: C.yellow, edge: C.ink },
  quickdial: { name: "QuickDial", role: "caller", bg: C.grey, fg: C.ink, arrow: C.grey, edge: C.ink },
  meera: { name: "Meera", role: "patient", bg: "#9BE8FF", fg: C.ink, arrow: "#9BE8FF", edge: C.ink },
  rahul: { name: "Rahul", role: "caller", bg: C.orange, fg: C.ink, arrow: C.orange, edge: C.ink },
} as const;
export type Who = keyof typeof CAST;
export const NameTag: React.FC<{ who: Who; size?: number; style?: React.CSSProperties }> = ({ who, size = 24, style }) => {
  const P = CAST[who];
  return <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3, padding: `${size * 0.18}px ${size * 0.5}px`, background: P.bg, color: P.fg, border: `2.5px solid ${C.ink}`, boxShadow: HARD(4),
    fontFamily: SANS, fontWeight: 800, fontSize: size, whiteSpace: "nowrap", lineHeight: 1.15, ...style }}>
    {who === "foreman" && <Bolt w={size * 0.9} color={C.ink} />}{P.name}<span style={{ fontWeight: 600, opacity: 0.75 }}>· {P.role}</span></div>;
};
/** A person as a cursor: the arrow, with their name tag riding beside it. */
export const PersonCursor: React.FC<{ who: Who; x: number; y: number; press?: number; o?: number; scale?: number; tilt?: number }> = ({ who, x, y, press = 0, o = 1, scale = 1, tilt = 0 }) => {
  const P = CAST[who];
  return <div style={{ position: "absolute", left: x, top: y, opacity: o, transform: `scale(${scale})`, transformOrigin: "0 0", zIndex: 20, pointerEvents: "none" }}>
    <svg width={50} height={50} viewBox="0 0 24 24" style={{ position: "absolute", left: -7, top: -5, transform: `rotate(${tilt}deg) scale(${1 - 0.2 * press})`, transformOrigin: "7px 5px", filter: "drop-shadow(4px 5px 0 rgba(14,14,14,.35))" }}>
      <path d="M4 2l15 11.5-6.6.8 3.9 7.6-3 1.5-3.9-7.7L4 20z" fill={P.arrow} stroke={P.edge} strokeWidth={1.4} strokeLinejoin="round" /></svg>
    <div style={{ position: "absolute", left: 30, top: 38, transform: `rotate(${-2 + tilt * 0.2}deg) scale(${1 - 0.06 * press})`, transformOrigin: "0 0" }}><NameTag who={who} size={22} /></div>
  </div>;
};
/** Click ripple at a point: a hard ring and a few marker sparks. */
export const Ripple: React.FC<{ x: number; y: number; at: number; color?: string }> = ({ x, y, at, color = C.pink }) => {
  const t = useT(), u = (t - at) / 0.5;
  if (u < 0 || u > 1) return null;
  const e = 1 - Math.pow(1 - u, 3);
  return <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none", zIndex: 19 }}>
    <div style={{ position: "absolute", left: -30, top: -30, width: 60, height: 60, borderRadius: "50%", border: `5px solid ${color}`, outline: `2px solid ${C.ink}`, opacity: 1 - u, transform: `scale(${0.4 + e * 2.2})` }} />
    {[0, 1, 2, 3, 4, 5].map((k) => { const ang = (k / 6) * Math.PI * 2 + 0.4, r0 = 24 + e * 46, r1 = r0 + 18 * (1 - u);
      return <div key={k} style={{ position: "absolute", left: Math.cos(ang) * r0, top: Math.sin(ang) * r0, width: r1 - r0, height: 5, background: C.ink, borderRadius: 3, opacity: 1 - u, transform: `rotate(${(ang * 180) / Math.PI}deg)`, transformOrigin: "0 50%" }} />; })}
  </div>;
};

/** Count-up number. */
export const Count: React.FC<{ from: number; to: number; a: number; b: number; style?: React.CSSProperties; fmt?: (v: number) => string }> = ({ from, to, a, b, style, fmt = (v) => Math.round(v).toLocaleString("en-US") }) => {
  const t = useT(); return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{fmt(interpolate(t, [a, b], [from, to], { ...clamp, easing: inOut }))}</span>;
};
export const usd = (v: number) => `$${v.toFixed(2)}`;

/** A marquee ribbon with torn edges. */
export const Marquee: React.FC<{ items: string[]; tone?: "pink" | "black" | "yellow"; y: number; rot?: number; speed?: number; size?: number; o?: number; dir?: 1 | -1 }> = ({ items, tone = "pink", y, rot = -3, speed = 260, size = 76, o = 1, dir = 1 }) => {
  const t = useT(), bg = { pink: C.pink, black: C.ink, yellow: C.yellow }[tone], fg = tone === "black" ? C.yellow : C.ink;
  const row = items.flatMap((s, i) => [s, i % 2 ? "✸" : "★"]), x = -((t * speed) % 2400) * dir - (dir < 0 ? 2400 : 0);
  const edge = (side: "top" | "bottom") => <div style={{ height: 30, backgroundImage: `url(${staticFile(`tex/torn-${tone}-${side}.svg`)})`, backgroundSize: "600px 100%", backgroundRepeat: "repeat-x" }} />;
  return <div style={{ position: "absolute", left: -300, right: -300, top: y, transform: `translateY(-50%) rotate(${rot}deg)`, opacity: o }}>
    {edge("top")}
    <div style={{ background: bg, overflow: "hidden", height: size * 1.25, marginTop: -1, marginBottom: -1 }}>
      <div style={{ display: "flex", whiteSpace: "nowrap", transform: `translateX(${x}px)` }}>
        {Array.from({ length: 8 }, (_, k) => row.map((s, i) => <span key={`${k}-${i}`} style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.25, color: fg, padding: `0 ${size * 0.3}px`, textTransform: "uppercase" }}>{s}</span>))}
      </div></div>
    {edge("bottom")}
  </div>;
};

/** A torn sheet of paper wiping across the frame; fully covers it at `at`. */
export const TornWipe: React.FC<{ at: number; color?: "pink" | "yellow" | "black"; dur?: number; rot?: number }> = ({ at, color = "pink", dur = 0.7, rot = -4 }) => {
  const t = useT();
  if (t < at - dur / 2 || t > at + dur / 2) return null;
  const u = lerp(t, at - dur / 2, at + dur / 2, 0, 1, inOut), H = 1700, y = interpolate(u, [0, 1], [1180, -H - 100]);
  const bg = { pink: C.pink, yellow: C.yellow, black: C.ink }[color];
  const edge = (side: "top" | "bottom") => <div style={{ height: 60, backgroundImage: `url(${staticFile(`tex/torn-${color}-${side}.svg`)})`, backgroundSize: "900px 100%", backgroundRepeat: "repeat-x" }} />;
  return <div style={{ position: "absolute", left: -400, right: -400, top: y, transform: `rotate(${rot}deg)`, zIndex: 50 }}>
    {edge("top")}<div style={{ height: H, background: bg, marginTop: -1, marginBottom: -1, position: "relative", overflow: "hidden" }}>
      <div style={{ ...full, opacity: 0.12, backgroundImage: `radial-gradient(${color === "black" ? C.yellow : C.ink} 22%, transparent 26%)`, backgroundSize: "18px 18px" }} /></div>{edge("bottom")}
  </div>;
};

/** A paper card with a hard shadow and a strip of tape. */
export const Card: React.FC<{ children: React.ReactNode; bg?: string; style?: React.CSSProperties; tape?: boolean; shadow?: string; border?: number }> = ({ children, bg = C.paper, style, tape = true, shadow = C.ink, border = 3 }) =>
  <div style={{ position: "relative", background: bg, border: `${border}px solid ${C.ink}`, boxShadow: HARD(9, shadow), boxSizing: "border-box", ...style }}>
    {tape && <Tape w={110} style={{ left: 36, top: -14, transform: "rotate(-5deg)" }} />}{children}</div>;

/** A sticker label chip (Anton on a colour, hard shadow). */
export const Chip: React.FC<{ children: React.ReactNode; bg?: string; fg?: string; size?: number; style?: React.CSSProperties; mono?: boolean }> = ({ children, bg = C.ink, fg = C.yellow, size = 34, style, mono }) =>
  <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3, padding: `${size * 0.14}px ${size * 0.42}px`, background: bg, color: fg, border: `2.5px solid ${C.ink}`, boxShadow: HARD(5),
    fontFamily: mono ? MONO : SANS, fontWeight: mono ? 600 : 800, fontSize: size, whiteSpace: "nowrap", lineHeight: 1.15, ...style }}>{children}</span>;
