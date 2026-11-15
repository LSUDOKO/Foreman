import React from "react";
import { Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile } from "remotion";
import { noise2D } from "@remotion/noise";
import { BAR, C, CAST, Centre, Chip, DISPLAY, Frame, MARKER, MONO, Marker, Mono, Narrator, SANS, T, At, type Line, PersonCursor, Ripple, type Who, clamp, full, has, hit, inOut, lerp, lin, pop, useT, HARD, fade, ease, back } from "../kit";
import { Bolt, CalendarPage, RectStamp, Stamp, Tape, Sparks, Arrow, Circle } from "../art";
import CLIPS from "../clips.json";
import { Pop } from "./Open";

// ── the recorded clips (public/clips/clips.json, copied to src/clips.json) ──
export type Click = { t: number; x: number; y: number; label?: string; who?: string };
export type Clip = { file: string; w: number; h: number; dur: number; what?: string; clicks?: Click[]; type?: unknown; marks?: Record<string, number> };
const LIST: Clip[] = Array.isArray(CLIPS) ? (CLIPS as Clip[]) : Object.entries(CLIPS as unknown as Record<string, Clip>).map(([k, v]) => ({ ...v, file: v.file ?? k }));
export const clip = (name: string): Clip | undefined => name.startsWith("page:") ? { file: `pages/${name.slice(5)}.png`, w: 1600, h: 900, dur: 999 } : LIST.find((c) => c.file?.replace(/^.*\//, "").replace(/\.mp4$/, "") === name);
const src = (c: Clip) => (c.file.includes("/") ? c.file : `clips/${c.file}`);
const usable = (c?: Clip): c is Clip => !!c && has(src(c));
// console screens: the header row (search, run chips, kill switch) is cropped out of frame
const CROP = (name: string) => (name.startsWith("page:") || ["contract-approve", "job-board", "ledger", "business-view"].includes(name) ? 66 : 0);

type Src = { name: string; from: number; rate?: number };
/** the clip's video, started at film time `a`, trimmed to `from` seconds, at `rate`; holds its last frame if the shot outlasts it */
const Vid: React.FC<{ s: Src; a: number; z: number; w: number; h: number }> = ({ s, a, z, w, h }) => {
  const c = clip(s.name);
  if (!usable(c)) return <div style={{ width: w, height: h, background: C.raised, display: "grid", placeItems: "center" }}>
    <Marker size={Math.max(24, w / 30)} color={C.muted}>{s.name}</Marker></div>;
  const fh = (w * c.h) / c.w, st: React.CSSProperties = { width: w, height: fh, display: "block", marginTop: -(CROP(s.name) * w) / c.w };
  if (c.file.endsWith(".png")) return <div style={{ width: w, height: h, overflow: "hidden" }}><Img src={staticFile(src(c))} style={st} /></div>;
  const rate = s.rate ?? 1, play = Math.max(0.05, (c.dur - s.from - 0.05) / rate);
  const A = Math.round(a * 60), P = Math.max(1, Math.round(Math.min(play, z - a) * 60)), Z = Math.round(z * 60) + 2;
  return <div style={{ width: w, height: h, overflow: "hidden" }}>
    <Sequence from={A} durationInFrames={P} layout="none"><OffthreadVideo src={staticFile(src(c))} trimBefore={Math.round(s.from * 60)} playbackRate={rate} muted style={st} /></Sequence>
    {A + P < Z && <Sequence from={A + P} durationInFrames={Z - A - P} layout="none"><Freeze frame={0}><OffthreadVideo src={staticFile(src(c))} trimBefore={Math.max(0, Math.floor((c.dur - 0.06) * 60))} muted style={st} /></Freeze></Sequence>}
  </div>;
};

/** film time of a clip click */
const clicksIn = (s: Src, a: number, z: number, who?: Who) => {
  const c = clip(s.name);
  return (c?.clicks ?? []).map((k) => ({ ...k, ft: a + (k.t - s.from) / (s.rate ?? 1) })).filter((k) => k.ft > a + 0.25 && k.ft < z - 0.15).map((k) => ({ ...k, who: (k.who as Who) in CAST ? (k.who as Who) : who }));
};
/** a cursor that glides on an arc into each click: anticipation, overshoot, press */
const cursorAt = (t: number, pts: { ft: number; x: number; y: number }[], start: [number, number]) => {
  let px = start[0], py = start[1], pt = -1e9, press = 0, tilt = 0;
  for (const p of pts) {
    const travel = Math.min(0.75, Math.max(0.25, p.ft - pt - 0.25)), s0 = p.ft - 0.06 - travel;
    if (t < s0) break;
    const u = Math.min(1, (t - s0) / travel), e = back(u), mx = (px + p.x) / 2 + (p.y - py) * 0.18, my = (py + p.y) / 2 - (p.x - px) * 0.18;
    const qx = (1 - e) ** 2 * px + 2 * (1 - e) * e * mx + e * e * p.x, qy = (1 - e) ** 2 * py + 2 * (1 - e) * e * my + e * e * p.y;
    tilt = u < 1 ? Math.sin(u * Math.PI) * Math.sign(p.x - px) * -8 : 0;
    press = Math.max(press, Math.max(0, 1 - Math.abs(t - p.ft) / 0.12));
    if (u < 1) return { x: qx, y: qy, press, tilt };
    px = p.x; py = p.y; pt = p.ft;
  }
  return { x: px + Math.sin(t * 1.3) * 4, y: py + Math.cos(t * 1.1) * 3, press, tilt };
};

/** Browser window, brand style: paper chrome, black outline, hard shadow. */
const Browser: React.FC<{ w: number; h: number; url: string; children: React.ReactNode }> = ({ w, h, url, children }) =>
  <div style={{ width: w, background: C.paper, border: `4px solid ${C.ink}`, boxShadow: HARD(16), position: "relative" }}>
    <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: `4px solid ${C.ink}`, background: C.paper }}>
      {[C.pink, C.yellow, C.paper].map((c, i) => <span key={i} style={{ width: 16, height: 16, borderRadius: 8, background: c, border: `2.5px solid ${C.ink}` }} />)}
      <div style={{ marginLeft: 60, flex: 1, maxWidth: 760, height: 32, border: `2.5px solid ${C.ink}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", fontFamily: MONO, fontSize: 18, fontWeight: 600, color: C.ink, background: "#fff" }}>
        <svg width={14} height={14} viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z" fill="none" stroke={C.ink} strokeWidth={2.5} /></svg>{url}</div>
      <Bolt w={30} color={C.pink} style={{ marginLeft: "auto" }} />
    </div>
    <div style={{ width: w - 8, height: h, overflow: "hidden", position: "relative", background: "#fff" }}>{children}</div>
  </div>;
/** Phone frame. */
const Phone: React.FC<{ w: number; h: number; children: React.ReactNode; label?: string }> = ({ w, h, children, label }) =>
  <div style={{ position: "relative", width: w + 28, height: h + 28, borderRadius: 54, background: C.ink, padding: 14, boxSizing: "border-box", boxShadow: HARD(14, C.pink) }}>
    <div style={{ width: w, height: h, borderRadius: 42, overflow: "hidden", position: "relative", background: "#000" }}>{children}</div>
    <div style={{ position: "absolute", left: "50%", top: 22, width: 90, height: 22, marginLeft: -45, borderRadius: 11, background: C.ink }} />
    {label && <div style={{ position: "absolute", left: -30, top: -34, transform: "rotate(-6deg)" }}><Chip bg={C.yellow} fg={C.ink} size={26}>{label}</Chip></div>}
  </div>;

/** Chapter word: lands huge over the shot, then flies into a label at the top-left. */
const Chapter: React.FC<{ word: string; a: number; n: number }> = ({ word, a, n }) => {
  const t = useT(), p = pop(t, a - 0.04, 12, 260), m = lerp(t, a + BAR * 0.45, a + BAR * 0.75, 0, 1, inOut);
  if (t < a - 0.04) return null;
  const x = interpolate(m, [0, 1], [960, 64]), y = interpolate(m, [0, 1], [500, 66]), size = interpolate(m, [0, 1], [330, 64]);
  return <>
    {m < 1 && <div style={{ ...full, background: C.yellow, opacity: 0.9 * (1 - m) * Math.min(1, p * 2), zIndex: 30 }} />}
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(${-50 * (1 - m)}%, ${-50 * (1 - m)}%) scale(${1.3 - 0.3 * p}) rotate(${-3 * (1 - m) - 2 * m}deg)`, zIndex: 31,
      display: "flex", alignItems: "center", gap: size * 0.2, padding: m > 0.5 ? "4px 20px" : 0, background: m > 0.5 ? C.ink : "transparent", border: m > 0.5 ? `3px solid ${C.ink}` : undefined, boxShadow: m > 0.5 ? HARD(6, C.pink) : undefined }}>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: size * 0.32, color: m > 0.5 ? C.pink : C.pinkText }}>{String(n).padStart(2, "0")}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, textTransform: "uppercase", color: m > 0.5 ? C.yellow : C.ink, textShadow: m > 0.5 ? undefined : `${size * 0.03}px ${size * 0.03}px 0 ${C.pink}` }}>{word}</span>
    </div></>;
};

type ShotProps = { a: number; z: number; word: string; n: number; main: Src; url: string; who?: Who; phone?: Src; phoneLabel?: string; lines: Line[]; children?: React.ReactNode; tilt?: number; zoom?: number; focus?: [number, number, number, number][]; covers?: [number, number, number, number, string][]; extra?: Click[]; phonePush?: [number, number] };
/** One product shot: the recording in a tilted browser (+ phone), a named cursor into each click, a camera that pushes in on the work. */
const Shot: React.FC<ShotProps> = ({ a, z, word, n, main, url, who = "clinic", phone, phoneLabel, lines, children, tilt = 1, zoom = 0.38, focus, extra = [], phonePush }) => {
  const t = useT(), c = clip(main.name), cr = CROP(main.name), cw = c?.w ?? 1920, ch = (c?.h ?? 1080) - cr;
  const W = phone ? 1280 : 1500, H = Math.round(((W - 8) * ch) / cw), bx = phone ? 70 : 210, by = Math.max(110, (1080 - H - 56) / 2 - 10);
  const k = (W - 8) / cw, cl = [...clicksIn(main, a, z, who), ...extra.map((e) => ({ ...e, ft: a + e.t, who: (e.who as Who) ?? who }))].map((q) => ({ ...q, y: q.y - cr })).sort((p, q) => p.ft - q.ft);
  // camera: gaussian pull toward clicks (or explicit focus keys in clip px)
  let fx = cw / 2, fy = ch / 2, sc = 1;
  if (focus) { const ks = focus; fx = interpolate(t, ks.map((q) => q[0]), ks.map((q) => q[1]), { ...clamp, easing: inOut }); fy = interpolate(t, ks.map((q) => q[0]), ks.map((q) => q[2] - cr), { ...clamp, easing: inOut }); sc = interpolate(t, ks.map((q) => q[0]), ks.map((q) => q[3]), { ...clamp, easing: inOut }); }
  else if (cl.length) { let sw = 0, sx = 0, sy = 0, mw = 0; for (const q of cl) { const wq = Math.exp(-(((t - q.ft) / 1.0) ** 2)); sw += wq; sx += wq * q.x; sy += wq * q.y; mw = Math.max(mw, wq); }
    const g = sw > 1e-4 ? Math.min(1, sw * 4) : 0; fx = cw / 2 + ((sw > 1e-4 ? sx / sw : cw / 2) - cw / 2) * g; fy = ch / 2 + ((sw > 1e-4 ? sy / sw : ch / 2) - ch / 2) * g; sc = 1 + zoom * mw; }
  const land = word ? lerp(t, a - 0.05, a + 0.6, 0, 1, inOut) : lerp(t, a - 0.05, a + 0.3, 0.7, 1, ease);
  const pfx = bx + 4 + fx * k, pfy = by + 52 + fy * k;  // focus point in frame px
  const m = 1 - Math.min(1, (sc - 1) / 0.38) * 0.55;  // pulls the focus toward the centre as the camera pushes in
  const ry = -6 * tilt + noise2D(`sy${a}`, t * 0.25, 0) * 3 * tilt, rx = 5 * tilt + noise2D(`sx${a}`, 0, t * 0.25) * 2 * tilt;
  const cur = cursorAt(t, cl, [cw * 0.85, ch * 1.05]), curO = lerp(t, a + 0.3, a + 0.6, 0, 1) * (1 - lerp(t, z - 0.25, z, 0, 1));
  return <Frame a={a} z={z} push={0.02} float={0.4}>
    <div style={{ ...full, perspective: 2400 }}>
      <div style={{ ...full, transform: `translateY(${(1 - land) * 600}px) rotateX(${rx + (1 - land) * 20}deg) rotateY(${ry}deg)`, transformOrigin: "50% 60%" }}>
        <div style={{ ...full, transformOrigin: `${960}px ${540}px`, transform: `scale(${sc}) translate(${(pfx - 960) * (m / sc - 1)}px, ${(pfy - 540) * (m / sc - 1)}px)` }}>
          <div style={{ position: "absolute", left: bx, top: by }}>
            <Browser w={W} h={H} url={url}><Vid s={main} a={a} z={z} w={W - 8} h={H} />
                            {cl.map((q, i) => <Ripple key={i} x={q.x * k} y={q.y * k} at={q.ft} color={CAST[q.who ?? who].arrow === C.ink ? C.pink : CAST[q.who ?? who].arrow} />)}
              {cl.length > 0 && t >= a + 0.3 && <PersonCursor who={cl.find((q) => q.ft >= t - 0.5)?.who ?? cl[cl.length - 1].who ?? who} x={cur.x * k} y={cur.y * k} press={cur.press} tilt={cur.tilt} o={curO} scale={1 / Math.sqrt(sc)} />}
            </Browser>
          </div>
        </div>
        {phone && <PhoneIn s={phone} a={a} z={z} label={phoneLabel} push={phonePush} />}
      </div>
    </div>
    {children}
    {word && <Chapter word={word} a={a} n={n} />}
    <Narrator lines={lines} />
  </Frame>;
};
const PhoneIn: React.FC<{ s: Src; a: number; z: number; label?: string; push?: [number, number] }> = ({ s, a, z, label, push }) => {
  const t = useT(), c = clip(s.name), pw = 360, ph = Math.round((pw * (c?.h ?? 1600)) / (c?.w ?? 720)), p = pop(t, a + 0.35, 12, 150);
  const u = push ? lerp(t, push[0], push[1], 0, 1, inOut) * (1 - lerp(t, z - 0.6, z, 0, 1, inOut)) : 0;
  return <div style={{ position: "absolute", left: 1400, top: 540 - ph / 2 - 14, transformOrigin: "50% 50%", transform: `translateX(${(1 - p) * 700 - u * 160}px) scale(${1 + 0.16 * u}) rotate(${4 - (1 - p) * 20 + noise2D(`ph${a}`, t * 0.4, 0) * 1.5}deg)` }}>
    <Phone w={pw} h={ph} label={label}><Vid s={s} a={a} z={z} w={pw} h={ph} /></Phone></div>;
};

// ── overlays ──
const Bubble: React.FC<{ at: number; out: number; x: number; y: number; who: "agent" | "caller"; text: string; w?: number }> = ({ at, out, x, y, who, text, w = 520 }) =>
  <Pop at={at} x={x} y={y} out={out} rot={who === "agent" ? -2 : 2} from={0.5}>
    <div style={{ width: w, padding: "18px 24px", background: who === "agent" ? C.ink : C.paper, color: who === "agent" ? C.paper : C.ink, border: `3px solid ${C.ink}`, boxShadow: HARD(7, who === "agent" ? C.yellow : C.pink),
      borderRadius: who === "agent" ? "26px 26px 26px 4px" : "26px 26px 4px 26px", fontFamily: SANS, fontWeight: 700, fontSize: 32, lineHeight: 1.15 }}>
      <div style={{ fontFamily: MONO, fontSize: 18, opacity: 0.7, marginBottom: 6 }}>{who === "agent" ? "FOREMAN · AI AGENT" : "ASHA"}</div>{text}</div></Pop>;

// ═══ the shots (bars 31–58), cut from the recorded run ═══
const CA = (from: number, rate = 1): Src => ({ name: "contract-approve", from, rate });
const JB = (from: number, rate = 1): Src => ({ name: "job-board", from, rate });
export const SHOTS: { a: number; z: number; main: Src }[] = [
  { a: T(31), z: T(34), main: CA(0, 0.45) }, { a: T(34), z: T(36), main: CA(5.8) }, { a: T(36), z: T(43), main: JB(0, 0.5) }, { a: T(43), z: T(47), main: { name: "page:workers", from: 0 } },
  { a: T(47), z: T(51), main: { name: "page:safety", from: 0 } }, { a: T(51), z: T(53), main: { name: "gmail-asha-email", from: 0.4 } }, { a: T(53), z: T(55), main: { name: "confirm-page", from: 0.6 } },
  { a: T(55), z: T(58), main: { name: "calcom-bookings", from: 0, rate: 0.7 } },
];
export const Compile: React.FC = () => <Shot a={T(31)} z={T(34)} n={1} word="Compile" main={SHOTS[0].main} url="foreman-agent.pages.dev/app/contract" who="clinic"
  lines={[[T(31, 10), T(34) - 0.05, "SERV turns one sentence into a contract.", ["SERV", "contract."]]]}>
  <ChipsAt a={T(32, 4)} items={["$5.00 budget", "$0.60 per call", "calls 09:00–21:00"]} />
</Shot>;
const ChipsAt: React.FC<{ a: number; items: string[] }> = ({ a, items }) => { const t = useT();
  return <>{items.map((s, i) => t >= a + i * 0.25 && <Pop key={s} at={a + i * 0.25} x={1600} y={640 + i * 110} rot={[-4, 3, -2][i]} from={2} spin={0}><Chip bg={i === 1 ? C.pink : C.yellow} fg={C.ink} size={42}>{s}</Chip></Pop>)}</>; };
export const Approve: React.FC = () => <Shot a={T(34)} z={T(36)} n={2} word="Approve" main={SHOTS[1].main} url="foreman-agent.pages.dev/app/contract" who="clinic"
  lines={[[T(34, 8), T(36) - 0.05, "A person approves the spend. Then: start.", ["person", "approves"]]]} />;
export const Call: React.FC = () => {
  const t = useT();
  return <Shot a={T(36)} z={T(43)} n={3} word="Call" main={SHOTS[2].main} url="foreman-agent.pages.dev/app/job" who="foreman" phone={{ name: "phone-asha-call", from: 19 - (T(37, 14) - T(36)) }} phoneLabel="Asha's phone · live call" phonePush={[T(37, 8), T(39, 8)]}
    focus={[[T(36), 800, 368, 1], [T(37, 8), 800, 368, 1], [T(38, 8), 420, 250, 1.35], [T(41), 420, 250, 1.35], [T(42), 800, 368, 1.05]]}
    lines={[[T(36, 10), T(38) - 0.1, "Foreman calls Asha. Says it's an AI.", ["AI."]], [T(41, 8), T(43) - 0.05, "Booked. Real calendar.", ["Booked"]]]}>
    {t >= T(37, 14) + 6.25 && <Pop at={T(37, 14) + 6.25} x={760} y={720} rot={-10} from={2.8} spin={0}><Stamp text="BOOKED" sub="MON 16 NOV · 9:00" foot="★ ASHA ★" w={280} /></Pop>}
    {t >= T(41, 8) && <Pop at={T(41, 8)} x={560} y={330} rot={-8} from={0.2}><CalendarPage w={280} line="9:00 · Asha" stampP={lerp(t, T(42), T(42, 3), 0, 1)} /></Pop>}
  </Shot>;
};
export const Liar: React.FC = () => {
  const t = useT();
  return <Shot a={T(43)} z={T(47)} n={4} word="Prove" main={SHOTS[3].main} url="foreman-agent.pages.dev/app/workers" who="quickdial" extra={[{ t: 2.0, x: 1410, y: 392, who: "clinic" }]}
    focus={[[T(43), 800, 450, 1], [T(43, 12), 800, 450, 1], [T(44, 8), 1180, 380, 1.5], [T(47), 1200, 400, 1.55]]}
    lines={[[T(43, 10), T(45, 8), "QuickDial says it called. The carrier says no.", ["carrier", "no."]], [T(45, 8), T(47) - 0.05, "No proof, no bonus. Reputation 80 → 40.", ["80", "40."]]]}>
    {t >= T(43, 10) && <div style={{ position: "absolute", left: 0, right: 0, top: 860, zIndex: 32, display: "flex", justifyContent: "center", transform: `rotate(-1deg) scale(${pop(t, T(43, 10), 12, 200)})` }}><Chip bg={C.ink} fg={C.yellow} size={28}>QuickDial is our built-in bad actor: it's there to prove the oracle catches lies.</Chip></div>}
    {t >= T(44, 12) && <Pop at={T(44, 12)} x={560} y={330} rot={-12} from={2.6} spin={0}><Stamp text="FAIL" sub="CALL NOT FOUND" ok={false} w={300} /></Pop>}
    {t >= T(45, 8) && <Pop at={T(45, 8)} x={560} y={640} rot={-4} from={0.3}><div style={{ padding: "14px 26px", background: C.paper, border: `4px solid ${C.ink}`, boxShadow: HARD(8) }}>
      <Mono size={22} color={C.muted}>QUICKDIAL · REPUTATION</Mono><div style={{ fontFamily: DISPLAY, fontSize: 110, lineHeight: 1 }}>80 <span style={{ color: C.red }}>→ {Math.round(lin(t, T(45, 10), T(46, 4), 80, 40))}</span></div></div></Pop>}
  </Shot>;
};
export const Scam: React.FC = () => {
  const t = useT();
  return <Shot a={T(47)} z={T(51)} n={5} word="Refuse" main={SHOTS[4].main} url="foreman-agent.pages.dev/app/safety" who="clinic" extra={[{ t: 1.6, x: 440, y: 372 }, { t: 3.4, x: 436, y: 680 }]} phone={{ name: "phone-kiran-call", from: 26 - (T(47, 8) - T(47)) }} phoneLabel="Kiran's call · live"
    focus={[[T(47), 800, 450, 1], [T(47, 8), 800, 450, 1], [T(49), 760, 500, 1.4], [T(51), 760, 520, 1.45]]}
    lines={[[T(50, 8), T(51) - 0.05, "Refused. Logged. Nothing paid.", ["Refused."]]]}>
    {t >= T(49, 12) && <Pop at={T(49, 12)} x={560} y={380} rot={-14} from={2.8} spin={0}><Stamp text="NOPE" sub="NOT PERMITTED" foot="★ FOREMAN ★" ok={false} w={320} /></Pop>}
    {t >= T(50, 2) && ["injection_detected", "action_not_permitted"].map((s, i) => <Pop key={s} at={T(50, 2) + i * 0.2} x={640 + i * 60} y={620 + i * 90} rot={[-3, 2][i]} from={2} spin={0}><Chip bg={C.red} fg={C.paper} size={34} mono>{s}</Chip></Pop>)}
  </Shot>;
};
export const Confirm: React.FC = () => <Shot a={T(51)} z={T(53)} n={6} word="Confirm" main={SHOTS[5].main} url="mail.google.com" who="asha"
  lines={[[T(51, 10), T(53) - 0.05, "Asha confirms from her inbox.", ["Asha", "inbox."]]]} />;
export const Confirm2: React.FC = () => {
  const t = useT();
  return <Shot a={T(53)} z={T(55)} n={6} word="" main={SHOTS[6].main} url="foreman-agent.pages.dev/confirm" who="meera"
    lines={[[T(53, 2), T(55) - 0.05, "Meera taps yes. Booked.", ["Booked."]]]}>
    {t >= T(54, 4) && <Pop at={T(54, 4)} x={1500} y={430} rot={8} from={0.2}><CalendarPage w={260} line="10:30 · Meera" stampP={lerp(t, T(54, 8), T(54, 11), 0, 1)} /></Pop>}
  </Shot>;
};
export const Filled: React.FC = () => {
  const t = useT();
  const BK: [string, string][] = [["9:00", "Asha"], ["10:30", "Meera"], ["12:00", "Rahul"]];
  return <Shot a={T(55)} z={T(58)} n={7} word="Filled" main={SHOTS[7].main} url="app.cal.com/bookings/upcoming" who="clinic"
    focus={[[T(55), 800, 368, 1], [T(55, 10), 800, 368, 1], [T(56, 8), 500, 330, 1.35], [T(58), 500, 340, 1.4]]}
    lines={[[T(56, 8), T(58) - 0.05, "Three chairs filled. Monday.", ["Three", "filled."]]]}>
    {BK.map(([h, n], i) => t >= T(56) + i * (BAR / 4) && <Pop key={n} at={T(56) + i * (BAR / 4)} x={1180 + i * 250} y={800} rot={[-7, 3, 8][i]} from={0.2}><CalendarPage w={210} line={`${h} · ${n}`} stampP={lerp(t, T(56, 8) + i * 0.15, T(56, 11) + i * 0.15, 0, 1)} /></Pop>)}
  </Shot>;
};

// ═══ bars 94–100 · the montage: the real moments, one per bar ═══
const FLASH: [Src, string, string][] = [
  [{ name: "calcom-bookings", from: 0 }, "Booked", C.pink], [{ name: "job-board", from: 2.9 }, "Caught", C.yellow], [{ name: "page:safety", from: 0 }, "Refused", C.pink],
  [{ name: "gmail-asha-email", from: 1 }, "Confirmed", C.yellow], [{ name: "business-view", from: 1.6 }, "Paid", C.pink], [{ name: "ledger", from: 2 }, "Paid on proof", C.yellow],
];
export const Flashes: React.FC = () => {
  const t = useT(), k = Math.max(0, Math.min(5, Math.floor((t - T(94)) / BAR))), at = T(94) + k * BAR, p = pop(t, at - 0.03, 13, 230), side = k % 2 ? 1 : -1, [s, label, col] = FLASH[k];
  const c = clip(s.name), W = 1300, H = Math.round((W - 8) * ((c?.h ?? 1080) - CROP(s.name)) / (c?.w ?? 1920));
  return <Frame a={T(94)} z={T(100)} bg={col === C.pink ? C.yellow : C.pink} push={0.06} shake={[0, 1, 2, 3, 4, 5].map((i) => T(94 + i))}>
    <div style={{ ...full, perspective: 1600 }}>
      <div style={{ position: "absolute", left: 960 - W / 2, top: 540 - H / 2 - 70, transform: `translateX(${(1 - p) * side * 900}px) rotateY(${(1 - p) * side * -30 + side * 7}deg) rotate(${side * -2}deg) scale(${0.9 + 0.05 * lin(t, at, at + BAR, 0, 1)})` }}>
        <Browser w={W} h={H} url="foreman-agent.pages.dev"><Vid key={k} s={s} a={at} z={at + BAR} w={W - 8} h={H} /></Browser></div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 850, textAlign: "center", transform: `scale(${1.4 - 0.4 * p}) rotate(${side * 3}deg)`, zIndex: 5 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 124, textTransform: "uppercase", padding: "0 40px", background: C.ink, color: col, border: `4px solid ${C.ink}`, boxShadow: HARD(10, col === C.pink ? C.yellow : C.pink) }}>{label}</span></div>
  </Frame>;
};

/** every cursor click in the product section, for the click SFX */
export const PRODUCT_CLICKS = (): number[] => SHOTS.flatMap(({ main, a, z }) => clicksIn(main, a, z).map((c) => c.ft));
