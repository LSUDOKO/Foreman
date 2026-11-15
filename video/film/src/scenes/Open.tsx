import React from "react";
import { interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { BAR, C, Card, Centre, Chip, DISPLAY, Drop, Frame, Giant, ease, MARKER, MONO, Marker, Marquee, Mono, Narrator, SANS, T, At, Brush, clamp, full, hit, inOut, lerp, lin, pop, useT, HARD, fade } from "../kit";
import { Bolt, Chair, Coin, CalendarPage, Crown, Handset, HardHat, Person, RectStamp, Sparks, Squiggle, Stamp, Star, StarFilled, Sticky, Tape, Tooth, Arrow } from "../art";

/** pops a child in at `at`: scale spring, slight spin; `out` blurs it away */
export const Pop: React.FC<{ at: number; x: number; y: number; rot?: number; out?: number; from?: number; children: React.ReactNode; spin?: number; drift?: number }> = ({ at, x, y, rot = 0, out, from = 0, children, spin = 18, drift = 1 }) => {
  const t = useT(), p = pop(t, at, 11, 190), o = out === undefined ? 1 : 1 - lerp(t, out - 0.2, out, 0, 1);
  if (t < at || o <= 0) return null;
  const wob = noise2D(`p${at}${x}`, t * 0.5, 0) * 2 * drift, fy = noise2D(`py${at}${y}`, 0, t * 0.4) * 8 * drift;
  return <At x={x} y={y + fy} style={{ opacity: Math.min(1, (t - at) * 12) * o, filter: o < 0.99 ? `blur(${(1 - o) * 12}px)` : undefined }}>
    <div style={{ transform: `scale(${from + (1 - from) * p}) rotate(${rot + (1 - p) * spin + wob}deg)` }}>{children}</div></At>;
};

// ═══ bars 0–4 · the hook: the phone buzzes at 9:29, then the chair is empty ═══
export const Hook: React.FC = () => {
  const t = useT();
  if (t < T(1)) {
    const buzz = (a: number, z: number) => (t >= a && t < z ? 1 : 0), b = Math.max(buzz(0.0, 0.5), buzz(0.85, 1.35)), sec = t < 0.85 ? 58 : 59;
    return <Frame a={0} z={T(1)} bg={C.ink} dots={C.yellow} push={0.16}>
      <Centre y={250}><Mono size={120} color={C.paper} style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>09:29:<span style={{ color: C.yellow }}>{sec}</span></Mono></Centre>
      <At x={960} y={600}><div style={{ transform: `rotate(${-14 + Math.sin(t * 95) * 5 * b}deg) translateX(${Math.sin(t * 120) * 7 * b}px) scale(${1 + 0.04 * b})` }}><Handset w={330} /></div></At>
      {[0, 1].map((k) => <At key={k} x={k ? 1180 : 740} y={k ? 470 : 690}><div style={{ transform: `rotate(${k ? 0 : 180}deg)`, opacity: b }}><Sparks w={120} color={C.yellow} draw={b} /></div></At>)}
      <Centre y={880}><Marker size={44} color={C.pink} style={{ ...fade(t, 0.15), transform: "rotate(-2deg)" }}>Smile Dental · front desk</Marker></Centre>
    </Frame>;
  }
  const card = pop(t, T(3, 8), 12, 170);
  return <Frame a={T(1)} z={T(4)} push={0.07} shake={[T(1), T(2), T(3), T(3, 12)]}>
    {/* the chair waits behind the words */}
    {t >= T(3, 4) && <Pop at={T(3, 4)} x={830} y={560} rot={-3} from={0.3}><Chair w={640} lamp={0.4 + 0.6 * Math.abs(Math.sin(t * 2))} /></Pop>}
    {t >= T(3, 8) && <At x={1450} y={540}><div style={{ transform: `translateX(${(1 - card) * 700}px) rotate(${7 - (1 - card) * 20}deg)` }}>
      <Card style={{ width: 420, padding: "30px 34px" }}>
        <Mono size={22} color={C.muted}>APPOINTMENT</Mono>
        <div style={{ fontFamily: DISPLAY, fontSize: 110, lineHeight: 1, marginTop: 6 }}>9:30 AM</div>
        <div style={{ fontFamily: MARKER, fontSize: 52, marginTop: 8 }}>Asha</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: C.muted, marginTop: 4 }}>Smile Dental</div>
        {t >= T(3, 12) && <div style={{ position: "absolute", right: -40, bottom: 40, transform: `rotate(-14deg) scale(${1 + 1.6 * (1 - pop(t, T(3, 12), 14, 320))})` }}><RectStamp text="NO-SHOW" size={70} /></div>}
      </Card></div></At>}
    {t >= T(3, 6) && <Star w={90} draw={lerp(t, T(3, 6), T(3, 12), 0, 1)} color={C.pink} style={{ position: "absolute", left: 300, top: 250, transform: "rotate(12deg)" }} />}
    {t >= T(3, 6) && <Sparks w={100} draw={lerp(t, T(3, 8), T(3, 14), 0, 1)} style={{ position: "absolute", left: 1120, top: 330 }} />}
    <Giant word="9:30 AM." at={T(1, 0)} shrink={T(1, 10)} big={430} small={120} toY={130} rot={-3} />
    <Giant word="The chair" at={T(2, 0)} hold={T(2, 14)} big={360} />
    <Giant word="is empty." at={T(3, 0)} hold={T(3, 7)} big={380} chip />
    {t >= T(3, 6) && <Centre y={940}><Drop words={["The", "chair", "is", "empty."]} at={T(3, 6)} size={104} pill={[2, 3]} display /></Centre>}
  </Frame>;
};

// ═══ bars 4–14 · the problem: Asha missed it, nobody can call, AI callers bill by the minute ═══
const NOTES: [string, number, number, number, string][] = [
  ["Call Meera", 300, 260, -8, "#fff27a"], ["Call Rahul", 1620, 300, 7, "#ffd6ec"], ["Call Kiran", 520, 780, 5, C.paper], ["Call Dev", 1420, 800, -6, "#fff27a"],
  ["Walk-in at 10!", 960, 210, 3, "#ffd6ec"], ["Insurance forms", 230, 560, -4, C.paper], ["Billing??", 1700, 600, 9, "#fff27a"], ["Hold line 2", 1100, 880, -3, "#ffd6ec"],
];
export const Problem: React.FC = () => {
  const t = useT();
  const toLeft = lerp(t, T(6), T(6, 6), 0, 1, inOut), gone = lerp(t, T(10) - 0.1, T(10, 4), 0, 1, inOut);
  const ring = [T(8, 0), T(8, 8), T(9, 0), T(9, 8)], ringing = ring.some((r) => t >= r && t < r + 0.45);
  const meter = t >= T(11, 6), mins = Math.floor(lin(t, T(11, 10), T(14), 1, 47));
  return <Frame a={T(4)} z={T(14)} push={0.05} shake={[T(4, 8), T(13)]}>
    {/* P1–P3: Asha's card */}
    {t < T(10, 4) && <At x={interpolate(toLeft, [0, 1], [700, 470])} y={interpolate(toLeft, [0, 1], [500, 470])} style={{ opacity: 1 - gone, filter: gone > 0.01 ? `blur(${gone * 14}px)` : undefined }}>
      <div style={{ transform: `rotate(${-4 + noise2D("ac", t * 0.4, 0) * 1.5}deg) scale(${(1 - 0.16 * toLeft) * pop(t, T(4) - 0.05, 12, 170)}) translateY(${-gone * 300}px)` }}>
        <Card style={{ width: 500, padding: 30 }}>
          <div style={{ border: `3px solid ${C.ink}`, overflow: "hidden" }}><Person w={434} /></div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 16 }}>
            <span style={{ fontFamily: MARKER, fontSize: 70 }}>Asha</span><Mono size={26} color={C.muted}>9:30 AM</Mono></div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, color: C.muted }}>patient · Smile Dental</div>
          {t >= T(4, 8) && <div style={{ position: "absolute", left: 60, top: 230, transform: `rotate(-12deg) scale(${1 + 1.6 * (1 - pop(t, T(4, 8), 14, 320))})`, opacity: Math.min(1, (t - T(4, 8)) * 10) }}><RectStamp text="NO-SHOW" sub="MISSED APPOINTMENT" size={84} /></div>}
        </Card></div></At>}
    {/* P2: the handset and the note */}
    {t >= T(6) && t < T(10, 4) && <Pop at={T(6, 0)} x={1330} y={400} rot={-10} out={T(10, 4)} from={0.2}>
      <div style={{ transform: `rotate(${ringing ? Math.sin(t * 90) * 7 : 0}deg)` }}><Handset w={380} /></div></Pop>}
    {t >= T(6, 6) && t < T(10, 4) && <Pop at={T(6, 6)} x={1300} y={760} rot={6} out={T(10, 2)} from={1.6} spin={-30}><Sticky text="CALL ASHA BACK!!" w={300} /></Pop>}
    {t >= T(7, 0) && t < T(10) && <Arrow w={170} draw={lerp(t, T(7, 0), T(7, 6), 0, 1)} color={C.pink} style={{ position: "absolute", left: 1080, top: 620, transform: `rotate(-120deg) scaleY(-1)`, opacity: 1 - gone }} />}
    {/* P3: the phone rings, nobody can pick up, notes pile up */}
    {ring.map((r, k) => t >= r && t < T(10) && <Pop key={k} at={r} x={1330 + [-260, 230, -220, 250][k]} y={400 + [-210, -180, 150, 170][k]} rot={[-12, 10, 8, -8][k]} out={r + 0.7} from={2}>
      <span style={{ fontFamily: MARKER, fontSize: 84, color: C.pink, WebkitTextStroke: `2px ${C.ink}` }}>RING!</span></Pop>)}
    {NOTES.map(([s, x, y, r, c], k) => { const at = T(8, 2) + k * (BAR / 8);
      return t >= at && t < T(10, 6) && <At key={s} x={x + gone * (x - 960) * 1.4} y={y - gone * 700} style={{ opacity: 1 - gone }}>
        <div style={{ transform: `rotate(${r + gone * r * 6}deg) scale(${1 + 1.2 * (1 - pop(t, at, 13, 300))})`, opacity: Math.min(1, (t - at) * 14) }}><Sticky text={s} color={c} w={260} /></div></At>; })}
    {/* P4: so the chair stays empty */}
    {t >= T(10) && t < T(11, 10) && <Pop at={T(10, 0)} x={960} y={520} from={0.5} out={T(11, 10)}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: -200, top: -160, width: 1100, height: 900, background: "radial-gradient(ellipse at 50% 40%, rgba(255,253,244,.85), rgba(255,253,244,0) 60%)" }} />
        <Chair w={700} lamp={1} />
        {t >= T(10, 8) && <div style={{ position: "absolute", left: 470, top: -40, ...fade(t, T(10, 8)) }}><Marker size={56} color={C.pinkText} style={{ transform: "rotate(-6deg)" }}>still empty.</Marker></div>}
        {t >= T(10, 8) && <Arrow w={150} draw={lerp(t, T(10, 8), T(10, 14), 0, 1)} color={C.pinkText} style={{ position: "absolute", left: 380, top: 30, transform: "rotate(150deg)" }} />}
      </div></Pop>}
    {/* P5: AI callers bill for trying */}
    {meter && <div style={{ ...full, opacity: 1 - lerp(t, T(13) - 0.1, T(13, 3), 0, 0.75), filter: t > T(13) ? `blur(${lerp(t, T(13), T(13, 4), 0, 10)}px)` : undefined }}>
      <Pop at={T(11, 6)} x={620} y={470} rot={-3} from={0.3}>
        <Card bg={C.ink} shadow={C.pink} style={{ width: 620, padding: "34px 40px" }}>
          <Mono size={24} color={C.yellow}>AI CALLER · BILLED PER MINUTE</Mono>
          <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 150, color: C.yellow, lineHeight: 1.05, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>{String(mins).padStart(2, "0")}<span style={{ fontSize: 60 }}> min</span></div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>{Array.from({ length: 12 }, (_, k) => <div key={k} style={{ flex: 1, height: 22, background: k < (mins / 4) ? C.pink : "rgba(255,253,244,.12)" }} />)}</div>
        </Card></Pop>
      {[["no answer", T(12, 0)], ["voicemail", T(12, 6)], ["“not now”", T(12, 12)]].map(([s, at], k) =>
        <Pop key={k} at={at as number} x={1380} y={300 + k * 150} rot={[2, -2, 1][k]} from={0.4}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, width: 560, padding: "18px 26px", background: C.paper, border: `3px solid ${C.ink}`, boxShadow: HARD(6) }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 36, flex: 1 }}>call {k + 1} · {s}</span><Chip bg={C.pink} fg={C.ink} size={26}>billed</Chip></div></Pop>)}
      {t >= T(12, 14) && <Pop at={T(12, 14)} x={1380} y={760} rot={-4} from={2}><RectStamp text="BOOKED: 0" size={80} /></Pop>}
    </div>}
    {t >= T(13) - 0.05 && <Centre y={500} style={{ flexDirection: "column", gap: 10 }}>
      <Drop words={["Paid", "per", "minute."]} at={T(13) - 0.05} size={150} display />
      <Drop words={["Not", "per", "result."]} at={T(13, 6)} size={150} display pill={[0, 1, 2]} /></Centre>}
    <Narrator lines={[
      [T(4), T(6), "She missed it.", ["missed"]],
      [T(6), T(8), "Someone has to call her back.", ["call", "back."]],
      [T(8), T(10), "But the front desk is full.", ["full."]],
      [T(10), T(11, 8), "So the chair stays empty.", ["empty."]],
      [T(11, 8), T(13), "And AI callers? You pay them for trying.", ["trying."]],
    ]} />
  </Frame>;
};

// ═══ bars 14–16 · the question ═══
export const Question: React.FC = () => {
  const t = useT(), up = lerp(t, T(15) - 0.1, T(15, 3), 0, 1, inOut);
  return <Frame a={T(14)} z={T(16)} bg={C.ink} dots={C.yellow} push={0.06}>
    <div style={{ ...full, transform: `translateY(${-up * 150}px)`, opacity: 1 - up * 0.65, filter: up > 0.01 ? `blur(${up * 3}px)` : undefined }}>
      <Centre y={440}><Drop words={["What", "if", "the", "agent"]} at={T(14) - 0.05} size={150} display color={C.paper} /></Centre>
      {t >= T(14, 6) && <Centre y={610}><Drop words={["only", "got", "paid…"]} at={T(14, 6)} size={150} display color={C.paper} pill={[0, 1, 2]} pillColor={C.ink} /></Centre>}
    </div>
    {t >= T(15) && <Centre y={720}><Drop words={["…when", "she", "came", "back?"]} at={T(15, 1)} size={170} display color={C.paper} pill={[2, 3]} brush="yellow" pillColor={C.ink} /></Centre>}
  </Frame>;
};

// ═══ bars 16–18 · the hard hat drops, lands, charges ═══
export const Charge: React.FC = () => {
  const t = useT(), fall = lerp(t, T(16, 8), T(17), 0, 1, (x) => x * x * x), land = t >= T(17), y = land ? 540 - 40 * hit(t, T(17), 10) * Math.sin((t - T(17)) * 30) : lerp(t, T(16) - 0.05, T(16) + 0.6, -380, 190, ease) + 350 * fall;
  const charge = Math.min(1, lin(t, T(16, 4), T(17), 0, 0.6) + (land ? lin(t, T(17), T(18), 0.4, 1) : 0));
  const pulse = land ? Math.abs(Math.sin(((t - T(17)) / (BAR / 8)) * Math.PI)) : 0, flash = lerp(t, T(17, 12), T(18), 0, 1, (x) => x * x);
  return <Frame a={T(16)} z={T(18)} bg={C.ink} dots={C.yellow} push={0.1} shake={[T(17)]}>
    {land && [0, 1, 2].map((k) => { const u = ((t - T(17) - k * 0.18) % 0.6) / 0.6; return u > 0 && <At key={k} x={960} y={600}>
      <div style={{ width: 300, height: 300, borderRadius: "50%", border: `6px solid ${C.yellow}`, opacity: (1 - u) * 0.7, transform: `scale(${0.6 + u * 3})` }} /></At>; })}
    <At x={960} y={y}><div style={{ transform: `rotate(${land ? -6 + 4 * hit(t, T(17), 6) : -6 + Math.sin(t * 5) * 8 * (1 - fall)}deg) scale(${1 + 0.06 * pulse})`, filter: `drop-shadow(0 0 ${40 * charge * (0.5 + pulse)}px rgba(247,239,28,.7))` }}><HardHat w={620} charge={charge} /></div></At>
    {land && [[-1, -1, 0], [1, -1, 90], [-1, 1, 200], [1, 1, 300]].map(([sx, sy, r], k) =>
      <At key={k} x={960 + sx * (330 + 60 * lin(t, T(17), T(17, 6), 0, 1))} y={560 + sy * (190 + 40 * lin(t, T(17), T(17, 6), 0, 1))}><div style={{ transform: `rotate(${r}deg)` }}><Sparks w={130} color={C.yellow} draw={lerp(t, T(17), T(17, 4), 0, 1)} /></div></At>)}
    {flash > 0 && <At x={960} y={460}><div style={{ width: 200, height: 200, borderRadius: "50%", background: C.yellow, transform: `scale(${flash * 14})` }} /></At>}
  </Frame>;
};

// ═══ bars 18–31 · the reveal: FOREMAN, the promise, built on SERV · Kite · x402, one real run ═══
const PROMISE = [
  { k: "Calls", t: "Phones every no-show.", b: "Says it's an AI. Offers real free times.", art: <Handset w={190} />, bg: C.paper, r: -3 },
  { k: "Proves", t: "Checks every claim.", b: "Asks the carrier and the calendar before money moves.", art: <Stamp text="PASS" w={190} />, bg: C.pink, r: 2 },
  { k: "Gets paid", t: "Only on outcomes.", b: "$4 per proven rebooking. No proof, no invoice.", art: <Coin w={170} />, bg: C.paper, r: -2 },
];
export const Reveal: React.FC = () => {
  const t = useT();
  const word = "FOREMAN", letters = Math.max(0, Math.min(7, Math.floor((t - T(18)) / (BAR / 16)) + 1));
  const mark = lerp(t, T(19, 14), T(20, 4), 0, 1, inOut);  // the wordmark rises into the corner
  const r2 = t >= T(19, 14) && t < T(22, 2), r3 = t >= T(21, 14) && t < T(26, 2), r4 = t >= T(25, 14) && t < T(28, 2), r5 = t >= T(28) - 0.05;
  return <Frame a={T(18)} z={T(31)} push={0.04} shake={[T(18), T(22), T(23), T(24), T(26, 4), T(26, 8), T(26, 12), T(28)]}>
    {/* ribbons */}
    {t < T(22) && <Marquee items={["No-shows in", "Bookings out", "Paid on proof"]} tone="black" y={150} rot={3} o={lerp(t, T(19), T(19, 4), 0, 1) * (1 - lerp(t, T(19, 10), T(19, 15), 0, 1))} dir={-1} />}
    <Marquee items={["Paid on proof", "Calls", "Bookings", "Proof", "Payments"]} tone="pink" y={interpolate(lerp(t, T(19), T(19, 6), 0, 1, inOut), [0, 1], [1300, t < T(22) ? 900 : 1010])} rot={-3} size={t < T(22) ? 76 : 50} />
    {/* R1: the wordmark */}
    {t < T(28) && <div style={{ ...full, transform: `translate(${-mark * 560}px, ${-mark * 395}px) scale(${1 - mark * 0.62})`, opacity: t > T(25, 14) ? 1 - lerp(t, T(25, 14), T(26), 0, 1) : 1 }}>
      <Centre y={520} style={{ gap: 30 }}>
        <div style={{ transform: `scale(${pop(t, T(18) - 0.04, 10, 220)}) rotate(${-8 + 8 * hit(t, T(18), 4)}deg)` }}><Bolt w={240} color={C.pink} /></div>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 330, lineHeight: 1, textShadow: `12px 12px 0 ${C.pink}` }}>
          {word.split("").map((ch, k) => { const at = T(18) + k * (BAR / 16), p = pop(t, at, 12, 300);
            return <span key={k} style={{ display: "inline-block", opacity: k < letters ? 1 : 0, transform: `translateY(${(1 - p) * -160}px) rotate(${(1 - p) * (k % 2 ? 14 : -14)}deg) scale(${1 + 0.6 * (1 - p)})` }}>{ch}</span>; })}</div>
      </Centre>
      {t >= T(18, 8) && <At x={720} y={300}><div style={{ transform: `translateY(${(1 - pop(t, T(18, 8), 10, 200)) * -500}px) rotate(-14deg)` }}><HardHat w={300} /></div></At>}
      {t >= T(18, 10) && <Sparks w={130} draw={lerp(t, T(18, 10), T(18, 15), 0, 1)} style={{ position: "absolute", left: 520, top: 170, transform: "rotate(-30deg)" }} />}
      {t >= T(18, 12) && <Star w={110} draw={lerp(t, T(18, 12), T(19, 2), 0, 1)} color={C.ink} style={{ position: "absolute", left: 1600, top: 620, transform: "rotate(14deg)" }} />}
      {t >= T(19, 2) && <Centre y={730}><Marker size={56} style={{ transform: "rotate(-2deg)", ...fade(t, T(19, 2)) }}>the AI agent for no-shows</Marker></Centre>}
    </div>}
    {/* R2: the tagline */}
    {r2 && <div style={{ ...full, opacity: 1 - lerp(t, T(21, 14), T(22, 2), 0, 1) }}>
      <div style={{ position: "absolute", left: 170, top: 250 }}>
        {[["No-shows?", T(20, 0)], ["We call", T(20, 4)], ["them back.", T(20, 8)]].map(([s, at], k) => { const p = lerp(t, at as number, (at as number) + 0.4, 0, 1, (x) => 1 - Math.pow(1 - x, 4));
          return <div key={k} style={{ overflow: "hidden", padding: "4px 0" }}><div style={{ fontFamily: DISPLAY, fontSize: 168, lineHeight: 0.95, textTransform: "uppercase", transform: `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 3}deg)` }}>
            {k === 1 ? <Brush p={lerp(t, T(20, 7), T(20, 12), 0, 1, inOut)}>{s as string}</Brush> : s as string}</div></div>; })}
        <div style={{ width: 760, marginTop: 26, fontFamily: SANS, fontWeight: 700, fontSize: 34, lineHeight: 1.25, ...fade(t, T(21, 0)) }}>
          Foreman phones your missed appointments, rebooks them in your real calendar, and only gets paid when the booking is proven.</div>
      </div>
      <Pop at={T(20, 8)} x={1430} y={430} rot={-8}><CalendarPage w={300} stampP={lerp(t, T(21, 2), T(21, 5), 0, 1)} /></Pop>
      <Pop at={T(20, 12)} x={1700} y={720} rot={14}><Coin w={170} /></Pop>
      <Pop at={T(21, 0)} x={1240} y={760} rot={-10}><Tooth w={180} /></Pop>
      {t >= T(21, 4) && <Crown w={90} draw={lerp(t, T(21, 4), T(21, 10), 0, 1)} style={{ position: "absolute", left: 1600, top: 230, transform: "rotate(14deg)" }} />}
    </div>}
    {/* R3: three promises */}
    {r3 && <div style={{ ...full, opacity: 1 - lerp(t, T(25, 14), T(26, 2), 0, 1), transform: `translateY(${-lerp(t, T(25, 12), T(26, 2), 0, 260, inOut)}px)` }}>
      {PROMISE.map((c, i) => { const at = T(22 + i), p = pop(t, at - 0.04, 12, 170);
        return t >= at - 0.04 && <At key={c.k} x={420 + i * 540} y={600}><div style={{ transform: `translateY(${(1 - p) * 700}px) rotate(${c.r + (1 - p) * 18 + noise2D(`pc${i}`, t * 0.5, 0) * 1.2}deg)` }}>
          <Card bg={c.bg} style={{ width: 470, height: 600, padding: "30px 34px" }}>
            <Crown w={60} color={c.bg === C.pink ? C.paper : C.ink} style={{ position: "absolute", right: 20, top: 18 }} />
            <div style={{ height: 210, display: "grid", placeItems: "center" }}>{c.art}</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 92, lineHeight: 1, textTransform: "uppercase" }}>{c.k}</div>
            <Squiggle w={150} color={c.bg === C.pink ? C.ink : C.pink} style={{ height: 18, marginTop: 6 }} />
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 38, lineHeight: 1.1, marginTop: 14 }}>{c.t}</div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, lineHeight: 1.2, marginTop: 8 }}>{c.b}</div>
          </Card></div></At>; })}
      {t >= T(25) - 0.05 && <Centre y={150} style={{ transform: "translateX(330px)" }}><Drop words={["Paid", "on", "proof."]} at={T(25) - 0.05} size={120} display pill={[2]} /></Centre>}
    </div>}
    {/* R4: built on */}
    {r4 && <div style={{ ...full, opacity: 1 - lerp(t, T(27, 14), T(28, 2), 0, 1) }}>
      <Giant word="Built on" at={T(26)} shrink={T(26, 3)} big={260} small={110} toY={250} shadow={null} rot={0} />
      {([["SERV", "reasoning", T(26, 4), C.paper, C.ink, DISPLAY, 200], ["Kite", "chain 2368", T(26, 8), C.pink, C.ink, MARKER, 170], ["x402", "pay per request", T(26, 12), C.ink, C.yellow, MONO, 150]] as const).map(([n, s, at, bg, fg, ff, fs], i) =>
        <Pop key={n} at={at} x={430 + i * 530} y={590} rot={[-4, 3, -2][i]} from={2.2} spin={0}>
          <div style={{ width: 440, height: 330, background: bg, color: fg, border: `4px solid ${C.ink}`, boxShadow: HARD(10), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <Tape w={120} style={{ left: 160, top: -16, transform: "rotate(3deg)" }} />
            <div style={{ fontFamily: ff, fontSize: fs, lineHeight: 1, fontWeight: ff === MONO ? 700 : 400, textTransform: ff === DISPLAY ? "uppercase" : undefined }}>{n}</div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, marginTop: 14, opacity: 0.85 }}>{s}</div>
            {n === "Kite" && <div style={{ position: "absolute", right: -50, top: -60, transform: `rotate(14deg) rotateY(${t * 120}deg)` }}><Coin w={130} /></div>}</div></Pop>)}
      {t >= T(27) && <Centre y={900}><Mono size={30} color={C.ink} style={{ ...fade(t, T(27)) }}>reasons with SERV · settles on Kite · pays agents over x402</Mono></Centre>}
    </div>}
    {/* R5: one real run */}
    {r5 && <div style={full}>
      <Giant word="One real run." at={T(28)} shrink={T(28, 8)} big={300} small={170} toY={400} chip rot={-2} />
      {t >= T(29) && <Centre y={590}><Marker size={60} style={{ ...fade(t, T(29)), transform: "rotate(-1.5deg)" }}>Sunday, 15 Nov 2026 · Smile Dental</Marker></Centre>}
      {t >= T(29, 8) && <Centre y={720} style={{ gap: 22 }}>
        {["5 no-shows", "real phones", "real calendar", "real inbox"].map((s, k) => <span key={s} style={{ transform: `scale(${pop(t, T(29, 8) + k * 0.12, 11, 220)}) rotate(${[-3, 2, -2, 3][k]}deg)` }}><Chip bg={k % 2 ? C.pink : C.ink} fg={k % 2 ? C.ink : C.yellow} size={40}>{s}</Chip></span>)}</Centre>}
      <Pop at={T(28, 4)} x={260} y={820} rot={-12}><Handset w={230} /></Pop>
      <Pop at={T(28, 8)} x={1680} y={830} rot={10}><Stamp text="PASS" w={220} /></Pop>
      <Pop at={T(28, 12)} x={1690} y={230} rot={8}><StarFilled w={110} color={C.pink} /></Pop>
    </div>}
  </Frame>;
};
