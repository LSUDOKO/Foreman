import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { BAR, C, T, TOTAL, Grain, TornWipe, clamp, full, has, useT } from "./kit";
import { HalftoneDefs } from "./art";
import { Hook, Problem, Question, Charge, Reveal } from "./scenes/Open";
import { Compile, Approve, Call, Liar, Scam, Confirm, Confirm2, Filled, Flashes, PRODUCT_CLICKS } from "./scenes/Product";
import { Build2, GetPaid } from "./scenes/Money";
import { Benefits, Numbers, Mcp, Outro } from "./scenes/Close";
import { CallCaptions } from "./scenes/Captions";

// Foreman · "Asha's empty chair" (3:10, 136 BPM, 108 bars). Story and numbers: video/STORY.md.
const ACTS: [number, number, React.FC][] = [
  [0, T(4), Hook], [T(4), T(14), Problem], [T(14), T(16), Question], [T(16), T(18), Charge], [T(18), T(31), Reveal],
  [T(31), T(34), Compile], [T(34), T(36), Approve], [T(36), T(43), Call], [T(43), T(47), Liar], [T(47), T(51), Scam], [T(51), T(53), Confirm], [T(53), T(55), Confirm2], [T(55), T(58), Filled],
  [T(58), T(60), Build2], [T(60), T(72), GetPaid], [T(72), T(80), Benefits], [T(80), T(86), Numbers], [T(86), T(94), Mcp], [T(94), T(100), Flashes], [T(100), 1e9, Outro],
];
const WIPES: [number, "pink" | "yellow" | "black"][] = [[T(14), "black"], [T(31), "pink"], [T(58), "black"], [T(60), "yellow"], [T(72), "pink"], [T(86), "black"], [T(94), "pink"], [T(100), "yellow"]];

// ── sound: one cue list, [time, file, volume] ──
const S = (bar: number, step: number, f: string, v = 1): [number, string, number] => [T(bar, step), f, v];
const step = (a: number, n: number, every: number, f: string, v = 1) => Array.from({ length: n }, (_, i) => [a + i * every, f, v] as [number, string, number]);
const SFX: [number, string, number][] = [
  [0, "tick", 0.9], [0.85, "tick", 0.9], S(1, 0, "slam", 0.5), S(2, 0, "slam", 0.5), S(3, 0, "slam", 0.5), S(3, 8, "whoosh", 0.7), S(3, 12, "stamp"),
  S(4, 0, "whoosh", 0.6), S(4, 8, "stamp"), S(6, 0, "whoosh", 0.6), S(6, 6, "slam", 0.5), ...[0, 8, 16, 24].map((s) => S(8, s, "phone-ring", 0.45)),
  ...step(T(8, 2), 8, BAR / 8, "tick", 0.5), S(10, 0, "whoosh-long", 0.6), S(11, 6, "whoosh", 0.6), S(12, 0, "error", 0.4), S(12, 6, "error", 0.4), S(12, 12, "error", 0.4), S(12, 14, "stamp"),
  S(13, 0, "impact", 0.7), S(13, 6, "slam", 0.7), S(14, 0, "whoosh-long", 0.6), S(15, 1, "slam", 0.8),
  S(16, 0, "riser", 0.8), S(16, 8, "whoosh-long", 0.6), S(17, 0, "impact"), S(17, 12, "whoosh", 0.7),
  S(18, 0, "impact"), S(18, 0, "tear", 0.8), S(18, 8, "slam", 0.7), S(20, 0, "whoosh", 0.5), S(20, 4, "whoosh", 0.5), S(20, 8, "whoosh", 0.5), S(21, 2, "stamp", 0.8),
  S(22, 0, "slam"), S(23, 0, "slam"), S(24, 0, "slam"), S(25, 0, "whoosh", 0.6), S(26, 0, "whoosh", 0.6), S(26, 4, "slam"), S(26, 8, "slam"), S(26, 12, "slam"),
  S(28, 0, "impact", 0.8), S(28, 8, "whoosh", 0.5), ...step(T(29, 8), 4, 0.12, "tick", 0.6), [T(31) - 0.35, "tear", 0.9],
  ...[31, 34, 36, 43, 47, 51, 55].map((b) => S(b, 0, "slam", 0.8)), ...[31, 34, 36, 43, 47, 51, 55].map((b) => [T(b) + BAR * 0.45, "whoosh", 0.5] as [number, string, number]),
  S(41, 8, "whoosh", 0.6), S(42, 0, "stamp"), S(44, 8, "stamp"), S(44, 8, "error", 0.5), S(45, 8, "whoosh", 0.5), S(49, 12, "stamp"), S(49, 12, "error", 0.5), S(50, 2, "tick", 0.6), [T(43) + 2, "click", 0.9], [T(47) + 1.6, "click", 0.9], [T(47) + 3.4, "click", 0.9],
  ...step(T(56), 3, BAR / 4, "whoosh", 0.5), S(56, 8, "stamp", 0.8), S(32, 8, "tick", 0.6), S(32, 12, "tick", 0.6),
  [T(58) - 0.35, "tear", 0.8], S(58, 0, "whoosh-long", 0.6), S(58, 8, "slam"), S(59, 0, "riser", 0.9), [T(60) - 0.35, "tear", 0.8], S(60, 0, "impact"),
  ...step(T(60, 4), 5, BAR * 0.36, "coin", 0.8), S(62, 4, "stamp"), S(62, 10, "slam", 0.5), [T(63) - 0.1, "whoosh", 0.6], S(63, 2, "whoosh", 0.5), S(63, 10, "error", 0.6), S(63, 12, "stamp"),
  S(64, 2, "type", 0.6), S(64, 10, "coin", 0.9), S(65, 2, "whoosh", 0.5), S(65, 4, "stamp"), S(65, 4, "ding", 0.6), [T(66) - 0.1, "whoosh", 0.6],
  ...step(T(66, 4), 16, BAR / 4.6, "slam", 0.35), S(70, 0, "impact", 0.8), S(70, 2, "whoosh", 0.6), [T(72) - 0.35, "tear", 0.8], S(72, 0, "whoosh"), S(74, 8, "whoosh"), S(77, 0, "whoosh"), S(79, 0, "ding", 0.7),
  S(80, 0, "slam"), ...step(T(80, 10), 8, BAR / 4, "tick", 0.6), S(84, 8, "stamp"), [T(86) - 0.35, "tear", 0.8], S(86, 0, "slam"), S(86, 8, "slam"), S(87, 0, "riser", 0.8), S(88, 0, "impact"),
  ...[[88, 4], [89, 0], [91, 4]].flatMap(([b, s]) => step(T(b, s), 6, 0.13, "type", 0.5)), S(93, 4, "ding", 0.7),
  [T(94) - 0.35, "tear", 0.8], ...[94, 95, 96, 97, 98, 99].flatMap((b) => [S(b, 0, "whoosh", 0.6), S(b, 0, "slam", 0.7)]),
  [T(100) - 0.35, "tear", 0.8], S(100, 0, "impact"), S(100, 8, "whoosh", 0.5), ...step(T(101, 8), 6, 0.1, "type", 0.4), ...step(T(101), 4, BAR / 4, "tick", 0.5), S(102, 8, "ding", 0.6),
];
const CALLS: [number, string][] = [[T(37, 14), "audio/asha-call.wav"], [T(47, 8), "audio/scam-call.wav"]];
const SPANS: [number, number][] = [[T(37, 14), T(37, 14) + 9], [T(47, 8), T(47, 8) + 5.95]];
const inCall = (t: number) => SPANS.some(([a, z]) => t > a - 0.2 && t < z + 0.1);
/** the bed dips a little more under the two real calls */
const bedDip = (t: number) => 1 - 0.35 * Math.max(...SPANS.map(([a, z]) => interpolate(t, [a - 0.4, a, z, z + 0.4], [0, 1, 1, 0], clamp)));

export const Film: React.FC = () => {
  const { fps } = useVideoConfig(), t = useT();
  const sfx = [...SFX, ...PRODUCT_CLICKS().map((c) => [c, "click", 0.9] as [number, string, number])].filter(([, f]) => has(`audio/sfx/${f}.wav`));
  return <AbsoluteFill style={{ background: C.ink }}>
    <HalftoneDefs />
    {has("audio/bed.wav") && <Audio src={staticFile("audio/bed.wav")} volume={(f) => interpolate(f / fps, [0, 0.02, TOTAL - 0.4, TOTAL], [0, 1, 1, 0], clamp) * bedDip(f / fps)} />}
    {CALLS.map(([a, f]) => has(f) && <Sequence key={f} from={Math.round(a * fps)} layout="none"><Audio src={staticFile(f)} volume={1} /></Sequence>)}
    {sfx.map(([a, f, v], i) => <Sequence key={i} from={Math.max(0, Math.round(a * fps))} durationInFrames={Math.round(4 * fps)} layout="none"><Audio src={staticFile(`audio/sfx/${f}.wav`)} volume={v * (inCall(a) ? 0.25 : 0.75)} /></Sequence>)}
    {ACTS.map(([a, z, Sc]) => t >= a && t < z ? <div key={a} style={full}><Sc /></div> : null)}
    <CallCaptions />
    {WIPES.map(([at, c]) => <TornWipe key={at} at={at} color={c} rot={at % 2 > 1 ? 4 : -4} />)}
    <Grain />
  </AbsoluteFill>;
};
