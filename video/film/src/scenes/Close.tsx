import React from "react";
import { noise2D } from "@remotion/noise";
import { BAR, C, Card, Centre, Chip, Count, DISPLAY, Drop, Frame, Giant, MARKER, MONO, Marker, Marquee, Mono, SANS, T, At, full, hit, inOut, lerp, lin, pop, useT, HARD, fade, usd, Brush } from "../kit";
import { Bolt, Check, Coin, Crown, Handset, HardHat, Smiley, Sparks, Squiggle, Stamp, Star, StarFilled, Tooth, Globe } from "../art";
import { Pop } from "./Open";

// ═══ bars 72–80 · what it means: for clinics, for patients, for the agents ═══
const FOR = [
  { head: "For clinics", art: <Tooth w={150} />, bg: C.pink, items: ["Pay for chairs filled, not calls made.", "A person approves every spend.", "One kill switch stops every payment."] },
  { head: "For patients", art: <Smiley w={140} />, bg: C.paper, items: ["Told it's an AI, up front.", "Picks a time that works.", "Says no once, never called again."] },
  { head: "For the agents", art: <Handset w={150} />, bg: C.ink, items: ["Paid the moment the work is proven.", "Honest callers gain reputation.", "Liars lose it, and the work."] },
];
export const Benefits: React.FC = () => {
  const t = useT(), starts = [T(72), T(74, 8), T(77)], settle = T(79);
  return <Frame a={T(72)} z={T(80)} push={0.04} shake={starts}>
    {FOR.map((f, i) => { const a = starts[i], p = pop(t, a - 0.04, 12, 170), dark = f.bg === C.ink;
      const next = i < 2 ? starts[i + 1] : settle, park = lerp(t, next - 0.15, next + 0.35, 0, 1, inOut);
      const x = 960 + (420 - 960 + i * 540) * park, y = 540 + 40 * park, s = 1.25 - 0.4 * park;
      return t >= a - 0.04 && <At key={i} x={x} y={y}><div style={{ transform: `translateY(${(1 - p) * 900}px) rotate(${[-2, 1.5, -1][i] + (1 - p) * 14 + noise2D(`b${i}`, t * 0.4, 0) * 1.2}deg) scale(${s})` }}>
        <Card bg={f.bg} shadow={dark ? C.pink : C.ink} style={{ width: 500, padding: "28px 32px 34px", color: dark ? C.paper : C.ink }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 70, lineHeight: 0.95, textTransform: "uppercase", width: 300 }}>{f.head}</div>{f.art}</div>
          <Squiggle w={170} color={dark ? C.yellow : f.bg === C.pink ? C.ink : C.pink} style={{ height: 18, marginTop: 8 }} />
          {f.items.map((s, k) => { const at = a + 0.3 + k * (BAR / 4), q = pop(t, at, 12, 200);
            return <div key={k} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginTop: 20, opacity: Math.min(1, q * 1.5), transform: `translateX(${(1 - q) * 60}px)` }}>
              <span style={{ flex: "none", width: 40, height: 40, display: "grid", placeItems: "center", background: dark ? C.yellow : C.ink, border: `2px solid ${C.ink}` }}><Check w={28} color={dark ? C.ink : C.yellow} draw={lerp(t, at + 0.1, at + 0.35, 0, 1)} /></span>
              <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 33, lineHeight: 1.12 }}>{s}</span></div>; })}
        </Card></div></At>; })}
    {t >= settle && <Centre y={110}><Drop words={["Everyone", "wins", "on", "outcomes."]} at={settle} size={96} display pill={[3]} /></Centre>}
  </Frame>;
};

// ═══ bars 80–86 · this run in numbers ═══
const NUMS: { v: number; f: (v: number) => string; l: string; bg: string }[] = [
  { v: 5, f: (v) => String(Math.round(v)), l: "no-shows", bg: C.paper }, { v: 4, f: (v) => String(Math.round(v)), l: "called, with consent", bg: C.paper },
  { v: 3, f: (v) => String(Math.round(v)), l: "rebooked + confirmed", bg: C.pink }, { v: 75, f: (v) => `${Math.round(v)}%`, l: "rebooking rate", bg: C.yellow },
  { v: 16, f: (v) => usd(v), l: "earned on outcomes", bg: C.pink }, { v: 0, f: () => "$0.00", l: "paid for effort", bg: C.paper },
  { v: 12.8, f: (v) => usd(v), l: "kept after paying agents", bg: C.paper }, { v: 13, f: (v) => String(Math.round(v)), l: "SERV decisions", bg: C.ink },
];
export const Numbers: React.FC = () => {
  const t = useT();
  return <Frame a={T(80)} z={T(86)} push={0.05}>
    <Giant word="This run in numbers" at={T(80)} shrink={T(80, 6)} big={170} small={96} toY={120} rot={-1} />
    {NUMS.map((n, i) => { const at = T(80, 10) + i * (BAR / 4), p = pop(t, at, 12, 190), col = i % 4, row = Math.floor(i / 4), dark = n.bg === C.ink;
      return t >= at && <At key={i} x={270 + col * 460} y={410 + row * 360}><div style={{ transform: `translateY(${(1 - p) * 400}px) rotate(${[-2, 1.5, -1, 2][(i + row) % 4] + (1 - p) * 12}deg)` }}>
        <div style={{ width: 410, height: 300, padding: "26px 28px", boxSizing: "border-box", background: n.bg, color: dark ? C.yellow : C.ink, border: `4px solid ${C.ink}`, boxShadow: HARD(9, dark ? C.pink : C.ink) }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 150, lineHeight: 1 }}><Count from={0} to={n.v} a={at} b={at + 0.7} fmt={n.f} /></div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, lineHeight: 1.1, marginTop: 14, textTransform: "uppercase" }}>{n.l}</div></div></div></At>; })}
    {t >= T(84, 8) && <Pop at={T(84, 8)} x={1600} y={115} rot={8} from={2.4} spin={0}><Stamp text="REAL" sub="15 NOV 2026" foot="★ ONE RUN ★" w={220} /></Pop>}
  </Frame>;
};

// ═══ bars 86–94 · run it from Claude: the MCP terminal ═══
type L = [number, string, string];  // [start time, colour, text]  (typed out at a fixed speed)
const TERM: L[] = [
  [T(88, 4), C.yellow, "$ claude mcp add foreman -- bun services/mcp/src/stdio.ts"],
  [T(88, 14), "#9BE8B4", "✓ foreman connected"],
  [T(89), C.pink, "> How much has Foreman earned on this contract?"],
  [T(90), "rgba(255,253,244,.55)", "  ⎿ foreman_ledger"],
  [T(90, 6), C.paper, "  Earned $16.00 · spent $3.20 on agents · kept $12.80"],
  [T(91, 4), C.pink, "> Draft a campaign to rebook yesterday's no-shows under $5"],
  [T(92, 4), "rgba(255,253,244,.55)", "  ⎿ foreman_compile_goal"],
  [T(92, 10), C.paper, "  Contract: $5.00 budget · $0.60 per call · calls 09:00–21:00"],
  [T(93, 4), C.yellow, "  Waiting for your approval."],
];
const TOOLS = ["foreman_status", "foreman_compile_goal", "foreman_start", "foreman_ledger", "foreman_workers", "foreman_refusals", "foreman_decisions", "foreman_kill"];
export const Mcp: React.FC = () => {
  const t = useT(), up = lerp(t, T(87, 10), T(88, 2), 0, 1, inOut), cps = 70;
  return <Frame a={T(86)} z={T(94)} bg={C.ink} dots={C.yellow} push={0.05} shake={[T(88)]}>
    <div style={{ ...full, transform: `translateY(${-up * 390}px) scale(${1 - up * 0.55})`, transformOrigin: "50% 50%" }}>
      <Giant word="Run it" at={T(86)} big={300} color={C.paper} y={420} shadow={C.pink} />
      {t >= T(86, 8) && <Centre y={680}><Drop words={["from", "Claude."]} at={T(86, 8)} size={240} display color={C.paper} pill={[1]} pillColor={C.ink} /></Centre>}
    </div>
    {t >= T(88) - 0.04 && <At x={960} y={660}><div style={{ transform: `translateY(${(1 - pop(t, T(88) - 0.04, 13, 160)) * 800}px) rotate(${1 + noise2D("tm", t * 0.4, 0)}deg)` }}>
      <div style={{ position: "relative", width: 1320, height: 600, background: "#141414", border: `4px solid ${C.yellow}`, boxShadow: HARD(14, C.pink), padding: "26px 38px", boxSizing: "border-box", fontFamily: MONO, fontSize: 31, lineHeight: 1.55 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>{[C.pink, C.yellow, C.paper].map((c) => <span key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />)}
          <span style={{ marginLeft: 16, color: "rgba(255,253,244,.5)", fontSize: 22 }}>claude code · foreman MCP</span></div>
        {TERM.map(([a, col, s], i) => { const n = Math.max(0, Math.min(s.length, Math.floor((t - a) * cps * (s.startsWith(">") || s.startsWith("$") ? 1 : 3)))), typing = n > 0 && n < s.length;
          return t >= a && <div key={i} style={{ color: col, whiteSpace: "pre", fontWeight: s.startsWith(">") ? 600 : 400 }}>{s.slice(0, n)}{(typing || (i === TERM.length - 1 && n === s.length)) && <span style={{ display: "inline-block", width: 16, height: 32, marginLeft: 4, verticalAlign: -5, background: C.yellow, opacity: Math.floor(t * 3) % 2 ? 1 : 0.2 }} />}</div>; })}
      </div></div></At>}
    {t >= T(88, 8) && TOOLS.map((s, k) => { const at = T(88, 8) + k * 0.12, side = k % 2 ? 1 : -1;
      return <At key={s} x={960 + side * 790} y={330 + Math.floor(k / 2) * 170 + (k % 2) * 60}><div style={{ transform: `scale(${pop(t, at, 11, 200)}) rotate(${side * 6}deg)` }}><Chip bg={k % 3 === 0 ? C.pink : C.yellow} fg={C.ink} size={22} mono>{s}</Chip></div></At>; })}
    {t >= T(93, 6) && <Centre y={1010}><Marker size={44} color={C.yellow} style={{ ...fade(t, T(93, 6)), transform: "rotate(-1.5deg)" }}>Approving spend stays your click.</Marker></Centre>}
  </Frame>;
};

// ═══ bars 100–108 · the end card ═══
export const Outro: React.FC = () => {
  const t = useT(), url = "foreman-agent.pages.dev", un = Math.max(0, Math.min(url.length, Math.floor((t - T(101, 8)) * 30)));
  const fl = noise2D("of", t * 0.35, 0) * 8, end = lerp(t, T(107), T(108), 0, 1, inOut);
  return <Frame a={T(100)} z={T(108)} push={0.03} shake={[T(100)]}>
    <div style={{ ...full, transform: `translateY(${fl}px)`, opacity: 1 - end * 0.0 }}>
      <Marquee items={["Pay for outcomes", "Not effort", "Foreman"]} tone="black" y={1000} rot={-2} size={56} o={lerp(t, T(102), T(102, 8), 0, 1)} />
      <At x={960} y={240}><div style={{ transform: `translateY(${(1 - pop(t, T(100) - 0.04, 10, 170)) * -600}px) rotate(${-5 + noise2D("oh", t * 0.5, 0) * 3}deg)` }}><HardHat w={340} charge={0.6 + 0.4 * Math.abs(Math.sin(t * 2))} /></div></At>
      <Centre y={470} style={{ gap: 26 }}>
        <div style={{ transform: `scale(${pop(t, T(100, 2), 11, 220)})` }}><Bolt w={150} color={C.pink} /></div>
        <div style={{ fontFamily: DISPLAY, fontSize: 230, lineHeight: 1, textShadow: `10px 10px 0 ${C.pink}`, transform: `scale(${pop(t, T(100, 2), 12, 220)})` }}>FOREMAN</div>
      </Centre>
      {t >= T(100, 8) && <Centre y={660}><Drop words={["Pay", "for", "outcomes,", "not", "effort."]} at={T(100, 8)} size={92} display pill={[2]} /></Centre>}
      {t >= T(101, 8) && <Centre y={800}><div style={{ display: "flex", alignItems: "center", padding: "14px 34px", background: C.ink, color: C.yellow, border: `3px solid ${C.ink}`, boxShadow: HARD(8, C.pink), fontFamily: MONO, fontWeight: 600, fontSize: 52 }}>
        {url.slice(0, un)}<span style={{ width: 5, height: 56, marginLeft: 6, background: C.pink, opacity: un < url.length || Math.floor(t * 2.6) % 2 ? 1 : 0 }} /></div></Centre>}
      {t >= T(102, 8) && <Centre y={910}><Mono size={30} color={C.ink} style={{ ...fade(t, T(102, 8)) }}>Live on Kite testnet · SERV reasoning · x402</Mono></Centre>}
      <Pop at={T(101)} x={260} y={330} rot={-14}><Coin w={180} /></Pop>
      <Pop at={T(101, 4)} x={1680} y={330} rot={12}><Tooth w={170} /></Pop>
      <Pop at={T(101, 8)} x={1700} y={720} rot={-8}><Handset w={180} /></Pop>
      <Pop at={T(101, 12)} x={230} y={720} rot={8}><Stamp text="PAID" sub="ON PROOF" foot="★ FOREMAN ★" w={190} /></Pop>
      {t >= T(101) && <Star w={80} draw={lerp(t, T(101), T(101, 6), 0, 1)} color={C.pink} style={{ position: "absolute", left: 1400, top: 140, transform: "rotate(12deg)" }} />}
      {t >= T(101, 4) && <Sparks w={100} draw={lerp(t, T(101, 4), T(101, 10), 0, 1)} style={{ position: "absolute", left: 470, top: 130 }} />}
    </div>
    {end > 0 && <div style={{ ...full, background: C.ink, opacity: end }} />}
  </Frame>;
};
