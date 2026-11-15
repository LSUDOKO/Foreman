import React from "react";
import { interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { BAR, C, Card, Centre, Chip, Count, DISPLAY, Drop, Frame, Giant, MARKER, MONO, Marker, Mono, Narrator, SANS, T, At, clamp, full, hit, inOut, lerp, lin, pop, useT, HARD, fade, usd } from "../kit";
import { Bolt, Coin, Handset, HardHat, RectStamp, Stamp, Tooth, Tape, Sparks, StarFilled } from "../art";
import { Pop } from "./Open";
import TXJ from "../txs.json";

// ═══ bars 58–60 · the build: who gets paid? ═══
export const Build2: React.FC = () => {
  const t = useT();
  return <Frame a={T(58)} z={T(60)} bg={C.ink} dots={C.yellow} push={0.12} shake={[T(59)]}>
    {Array.from({ length: 9 }, (_, k) => { const at = T(58, 2) + k * (BAR / 8), u = lin(t, at, at + 1.2, 0, 1);
      return t >= at && <At key={k} x={200 + ((k * 653) % 1520)} y={-150 + u * 1400}><div style={{ transform: `rotate(${k * 47 + u * 300}deg) scaleX(${Math.cos(u * 9 + k)})` }}><Coin w={140} /></div></At>; })}
    <Giant word="Who" at={T(58)} hold={T(58, 8)} big={420} color={C.paper} />
    <Giant word="gets paid?" at={T(58, 8)} shrink={T(59)} big={330} small={190} color={C.paper} chip shadow={null} />
    {t >= T(59, 4) && <Centre y={760}><Marker size={60} color={C.yellow} style={{ ...fade(t, T(59, 4)), transform: "rotate(-2deg)" }}>only when she comes back.</Marker></Centre>}
  </Frame>;
};

// ═══ bars 60–72 · get paid: the ledger, the x402 flow, Kite ═══
const LEDGER: [string, number, number][] = [["Asha · booking confirmed", 4, 0], ["Meera · booking confirmed", 4, 1], ["Rahul · booking confirmed", 4, 2], ["patient attended", 2, 3], ["patient attended", 2, 4]];
const Ledger: React.FC = () => {
  const t = useT(), at = (i: number) => T(60) + 0.12 + i * (BAR * 0.38), sum = LEDGER.reduce((s, [, v], i) => s + (t >= at(i) ? v : 0), 0);
  return <>
    <At x={590} y={530}><div style={{ transform: `rotate(-2deg) translateY(${(1 - pop(t, T(60) - 0.05, 12, 170)) * 900}px)` }}>
      <div style={{ position: "relative", width: 760, background: C.paper, padding: "40px 46px 60px", boxShadow: "12px 14px 0 rgba(0,0,0,.3)", fontFamily: MONO,
        clipPath: "polygon(0 0,100% 0,100% 97%,95% 100%,90% 97%,85% 100%,80% 97%,75% 100%,70% 97%,65% 100%,60% 97%,55% 100%,50% 97%,45% 100%,40% 97%,35% 100%,30% 97%,25% 100%,20% 97%,15% 100%,10% 97%,5% 100%,0 97%)" }}>
        <div style={{ textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: "0.06em" }}>SMILE DENTAL → FOREMAN</div>
        <div style={{ textAlign: "center", fontSize: 20, color: C.muted, marginTop: 4 }}>paid on outcomes · 15 Nov run</div>
        <div style={{ marginTop: 24 }}>{LEDGER.map(([s, v], i) => { const p = lerp(t, at(i), at(i) + 0.18, 0, 1);
          return <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "2px dashed rgba(14,14,14,.25)", fontSize: 30, opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}>
            <span>{s}</span><span style={{ color: C.green, fontWeight: 700 }}>+{usd(v)}</span></div>; })}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontSize: 30, color: C.muted, ...fade(t, T(61, 14)) }}><span>Dev · no consent · skipped</span><span>$0.00</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 30, color: C.muted, ...fade(t, T(62, 0)) }}><span>Kiran · declined</span><span>$0.00</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 44, fontWeight: 700 }}><span>TOTAL</span><span>{usd(sum)}</span></div>
      </div></div></At>
    <At x={1450} y={400}><div style={{ textAlign: "center", transform: `scale(${pop(t, T(60, 2), 12, 170) * (1 + 0.05 * hit(t, at(Math.max(0, LEDGER.filter((_, i) => t >= at(i)).length - 1)), 9))})` }}>
      <Mono size={30} color={C.ink}>FOREMAN EARNED</Mono>
      <div style={{ fontFamily: DISPLAY, fontSize: 260, lineHeight: 1, textShadow: `10px 10px 0 ${C.pink}` }}>{usd(sum)}</div></div></At>
    {t >= T(62, 4) && <Pop at={T(62, 4)} x={1450} y={700} rot={-8} from={2.6} spin={0}><RectStamp text="PAID FOR EFFORT: $0.00" size={70} color={C.red} /></Pop>}
    {t >= T(61, 8) && <Pop at={T(61, 8)} x={1450} y={160} rot={2} from={0.4}><Chip bg={C.paper} fg={C.ink} size={30}>15 Nov · settled locally while Kite testnet was paused</Chip></Pop>}
    {t >= T(62, 10) && <Pop at={T(62, 10)} x={1450} y={890} rot={3} from={2} spin={0}><Chip bg={C.ink} fg={C.yellow} size={44}>spent $3.20 on agents · kept $12.80</Chip></Pop>}
    {Array.from({ length: 5 }, (_, i) => { const a = at(i), u = lin(t, a - 0.35, a, 0, 1); return t >= a - 0.35 && t < a + 0.05 && <At key={i} x={interpolate(u, [0, 1], [1450, 900])} y={400 - Math.sin(u * Math.PI) * 200 + u * 30}><div style={{ transform: `rotate(${u * 400}deg)` }}><Coin w={110} /></div></At>; })}
  </>;
};

const Node: React.FC<{ x: number; y: number; at: number; title: string; sub: string; art: React.ReactNode; bg?: string; r?: number }> = ({ x, y, at, title, sub, art, bg = C.paper, r = 0 }) =>
  <Pop at={at} x={x} y={y} rot={r} from={0.3}>
    <div style={{ width: 330, padding: "22px 20px", background: bg, border: `4px solid ${C.ink}`, boxShadow: HARD(9), textAlign: "center", position: "relative" }}>
      <Tape w={100} style={{ left: 115, top: -14 }} />
      <div style={{ height: 150, display: "grid", placeItems: "center" }}>{art}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 64, lineHeight: 1, textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, marginTop: 6 }}>{sub}</div></div></Pop>;
// ── Kite: the real x402 payments (public/kite/txs.json, read from the Kite testnet RPC) ──
type Tx = { hash: string; dir: string; from: string; to: string; amount: string; purpose: string; block: number; status: string };
const TXS = TXJ as Tx[];
const sh = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
const STEPS: [number, string][] = [[T(63, 2), "ask"], [T(63, 10), "402"], [T(64, 2), "sign"], [T(64, 10), "settle"], [T(65, 2), "200 OK"]];
const Handshake: React.FC = () => {
  const t = useT(), tx = TXS[0], st = STEPS.filter(([a]) => t >= a).length;
  const arrow = (x1: number, x2: number, y: number, at: number, label: string, col = C.ink) => { const d = lerp(t, at, at + 0.3, 0, 1, inOut); if (t < at) return null;
    return <><div style={{ position: "absolute", left: Math.min(x1, x2), top: y - 5, width: Math.abs(x2 - x1) * d, height: 10, background: col, marginLeft: x2 < x1 ? Math.abs(x2 - x1) * (1 - d) : 0 }} />
      <div style={{ position: "absolute", left: (x2 > x1 ? x1 + (x2 - x1) * d - 30 : x1 - (x1 - x2) * d), top: y - 26, fontFamily: DISPLAY, fontSize: 52, lineHeight: 1, color: col, transform: x2 < x1 ? "scaleX(-1)" : undefined }}>▶</div>
      <At x={(x1 + x2) / 2} y={y - 50}><div style={{ transform: `scale(${pop(t, at + 0.15, 11, 200)})` }}><Mono size={28} color={C.ink} style={{ background: C.paper, border: `2.5px solid ${C.ink}`, padding: "2px 12px", fontWeight: 700 }}>{label}</Mono></div></At></>; };
  return <>
    <Centre y={95}><Drop words={["How", "an", "agent", "pays", "an", "agent:", "x402"]} at={T(63) - 0.05} size={84} display pill={[6]} /></Centre>
    <Node x={330} y={430} at={T(63) - 0.04} title="Foreman" sub="hires a caller" art={<HardHat w={230} />} bg={C.pink} r={-2} />
    <Node x={1590} y={430} at={T(63, 1)} title="ClearCall" sub="phone caller" art={<Handset w={130} />} r={2} />
    {arrow(510, 1410, 330, T(63, 2), "POST /call")}
    {arrow(1410, 510, 450, T(63, 10), "402 · pay $0.50 fUSD", C.red)}
    {t >= T(63, 12) && <Pop at={T(63, 12)} x={960} y={655} rot={-6} from={2.6} spin={0}><RectStamp text="402 PAYMENT REQUIRED" size={48} color={C.red} /></Pop>}
    {t >= T(64, 2) && <Pop at={T(64, 2)} x={420} y={790} rot={-3} from={0.4}><div style={{ width: 560, padding: "18px 24px", background: C.ink, color: C.paper, border: `3px solid ${C.ink}`, boxShadow: HARD(8, C.yellow) }}>
      <Mono size={22} color={C.yellow}>FOREMAN SIGNS · EIP-3009</Mono><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, marginTop: 6 }}>transferWithAuthorization</div>
      <div style={{ fontFamily: MONO, fontSize: 24, marginTop: 4, opacity: 0.8 }}>to ClearCall · {tx.amount} fUSD</div>
      <svg width={300} height={50} style={{ display: "block", marginTop: 6 }}><path d="M5 35 C30 5 45 45 70 20 S110 40 130 15 S170 45 200 20 S250 30 290 18" fill="none" stroke={C.yellow} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - lerp(t, T(64, 3), T(64, 8), 0, 1)} /></svg></div></Pop>}
    {t >= T(64, 10) && <Pop at={T(64, 10)} x={1180} y={800} rot={2} from={0.4}><div style={{ display: "flex", alignItems: "center", gap: 22, width: 640, padding: "18px 24px", background: C.paper, border: `4px solid ${C.ink}`, boxShadow: HARD(9, C.pink) }}>
      <div style={{ transform: `rotateY(${t * 200}deg)` }}><Coin w={120} /></div>
      <div><Mono size={22} color={C.muted}>SETTLED ON KITE · CHAIN 2368 · 14 NOV</Mono><div style={{ fontFamily: DISPLAY, fontSize: 56, lineHeight: 1.05 }}>block {tx.block.toLocaleString("en-US")}</div>
        <Mono size={24} color={C.green} style={{ fontWeight: 700 }}>✓ {tx.status} · {sh(tx.hash)}</Mono></div></div></Pop>}
    {arrow(1410, 510, 560, T(65, 2), "200 OK · call placed", C.green)}
    {t >= T(65, 4) && <Pop at={T(65, 4)} x={1590} y={700} rot={10} from={2.6} spin={0}><Stamp text="200" sub="OK · CALL PLACED" foot="★ x402 ★" w={210} /></Pop>}
    <div style={{ position: "absolute", left: 0, right: 0, top: 985, display: "flex", justifyContent: "center", gap: 12 }}>
      {STEPS.map(([, s], i) => <span key={s} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 28, padding: "4px 18px", border: `3px solid ${C.ink}`, background: i < st ? (i === 1 ? C.red : C.ink) : C.paper, color: i < st ? C.yellow : C.ink }}>{i + 1} · {s}</span>)}</div>
  </>;
};
const Wall: React.FC = () => {
  const t = useT(), at = (i: number) => T(66, 4) + i * (BAR / 4.6), n = TXS.filter((_, i) => t >= at(i)).length;
  return <>
    <div style={{ position: "absolute", left: 110, top: 40, display: "flex", alignItems: "baseline", gap: 26 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 150, lineHeight: 1, textShadow: `8px 8px 0 ${C.pink}`, fontVariantNumeric: "tabular-nums" }}>{n}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: 64, lineHeight: 1, textTransform: "uppercase" }}>payments settled</span>
      <Chip bg={C.green} fg={C.paper} size={36}>{n}/{n || 16} success</Chip><Chip bg={C.ink} fg={C.yellow} size={30}>14 Nov run · on Kite chain 2368</Chip></div>
    {TXS.map((x, i) => { const p = pop(t, at(i), 13, 260), col = i % 4, row = Math.floor(i / 4), inn = x.dir === "in";
      return t >= at(i) && <div key={x.hash} style={{ position: "absolute", left: 110 + col * 430, top: 230 + row * 200, width: 400, height: 178, boxSizing: "border-box", padding: "12px 18px",
        background: inn ? C.pink : C.paper, border: `3px solid ${C.ink}`, boxShadow: HARD(7), transform: `scale(${1 + 0.9 * (1 - p)}) rotate(${((i * 37) % 7) - 3 + (1 - p) * 10}deg)`, opacity: Math.min(1, (t - at(i)) * 12) }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 19, fontWeight: 600 }}><span>block {x.block}</span><span style={{ color: C.green }}>✓ {x.status}</span></div>
        <div style={{ fontFamily: DISPLAY, fontSize: 52, lineHeight: 1.1, marginTop: 4 }}>{inn ? "+" : "−"}{x.amount} <span style={{ fontSize: 30 }}>fUSD</span></div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24 }}>{inn ? `${x.from} → ${x.to} · ${x.purpose.replace("invoice_", "")}` : `→ ${x.to} · ${x.purpose.replace("_", " ")}`}</div>
        <div style={{ fontFamily: MONO, fontSize: 17, opacity: 0.7 }}>{sh(x.hash)}</div></div>; })}
  </>;
};
const Chain: React.FC = () => {
  const t = useT();
  return <>
    <At x={430} y={500}><div style={{ transform: `scale(${pop(t, T(70) - 0.04, 10, 160)}) rotateY(${t * 160}deg)` }}><Coin w={420} /></div></At>
    <At x={1180} y={500}><div style={{ transform: `rotate(-2deg) translateX(${(1 - pop(t, T(70, 2), 12, 160)) * 900}px)` }}>
      <Card style={{ width: 960, padding: "34px 44px" }}>
        <div style={{ fontFamily: MARKER, fontSize: 92, lineHeight: 1 }}>Kite testnet</div>
        {([["chain", "2368"], ["run", "14 Nov 2026 · x402"], ["token", "fUSD · EIP-3009 · 0xef57…b4bb"], ["blocks", "22,044,661 → 22,044,680"], ["payments", "16 · 16/16 success"]] as const).map(([k, v], i) =>
          <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 18, borderTop: "2px dashed rgba(14,14,14,.25)", paddingTop: 12, ...fade(t, T(70, 4) + i * 0.15) }}>
            <Mono size={28} color={C.muted} style={{ width: 170 }}>{k}</Mono><span style={{ fontFamily: i ? MONO : DISPLAY, fontWeight: 700, fontSize: i ? 38 : 64 }}>{v}</span></div>)}
      </Card></div></At>
  </>;
};
export const GetPaid: React.FC = () => {
  const t = useT(), out = (z: number) => ({ opacity: 1 - lerp(t, z - 0.2, z, 0, 1), filter: t > z - 0.2 ? `blur(${lerp(t, z - 0.2, z, 0, 12)}px)` : undefined });
  return <Frame a={T(60)} z={T(72)} push={0.04} shake={[T(60), T(62, 4), T(63, 12), T(65, 4), T(70)]}>
    {t < T(63) && <div style={{ ...full, ...out(T(63)) }}><Ledger /></div>}
    {t >= T(63) - 0.05 && t < T(66) && <div style={{ ...full, ...out(T(66)) }}><Handshake /></div>}
    {t >= T(66) - 0.05 && t < T(70) && <div style={{ ...full, ...out(T(70)) }}><Wall /></div>}
    {t >= T(70) - 0.05 && <div style={full}><Chain /></div>}
    <Narrator lines={[[T(60, 4), T(62, 4), "Foreman is paid only for chairs filled.", ["chairs", "filled."]], [T(70, 6), T(72) - 0.05, "16 payments on Kite. Check them yourself.", ["Kite."]]]} />
  </Frame>;
};
