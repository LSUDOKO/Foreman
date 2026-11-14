import { useEffect, useRef, useState } from "react";
import type { FeedEvent, Identity, Modes } from "./state";

export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";
const TOKEN = import.meta.env.VITE_CONSOLE_TOKEN as string | undefined;
export const REPLAY_ONLY = import.meta.env.VITE_REPLAY_ONLY === "1";

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ? `${j.error}${j.expected ? ` (expected ${j.expected})` : ""}` : `HTTP ${r.status}`);
  return j as T;
}

// ───────── formatting ─────────
export const usd = (n: number | string) => {
  const v = typeof n === "string" ? Number(n) : n;
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
};
export const short = (a?: string, n = 4) => (!a ? "—" : a.length <= 2 * n + 4 ? a : `${a.slice(0, n + 2)}…${a.slice(-n)}`);
export const absTime = (ts: string) => new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
export const clock = (ts: string) => new Date(ts).toLocaleTimeString(undefined, { hour12: false });
export function relTime(ts: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(ts).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const slotLabel = (iso: string, tz = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
export const human = (s: string) => s.replace(/_/g, " ");

/** Re-render periodically so relative timestamps stay honest. */
export function useNow(ms = 5000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Animate a number towards its target (KPI count-up). */
export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const val = a + (target - a) * (1 - Math.pow(1 - k, 3));
      setV(val);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// ───────── event source: live SSE or recorded replay ─────────
export interface Recording { exportedAt: string; contractId: string; hash: string; network: { name: string; chainId: number; explorer: string; token?: { symbol: string; address: string } }; modes: Modes; audit: { ok: boolean; events: number; head: string }; events: FeedEvent[] }

export interface Source {
  mode: "loading" | "live" | "replay";
  events: FeedEvent[];
  modes: Modes | null;
  explorer: string;
  identities: Record<string, Identity>;
  error?: string;
  replay?: {
    recording: Recording;
    index: number;
    playing: boolean;
    speed: number;
    setIndex: (i: number) => void;
    setPlaying: (p: boolean) => void;
    setSpeed: (s: number) => void;
  };
}

const wantReplay = () => REPLAY_ONLY || new URLSearchParams(location.search).has("replay");

export function useSource(): Source {
  const [mode, setMode] = useState<Source["mode"]>("loading");
  const [live, setLive] = useState<FeedEvent[]>([]);
  const [meta, setMeta] = useState<{ modes: Modes | null; explorer: string; identities: Record<string, Identity> }>({ modes: null, explorer: "https://testnet.kitescan.ai", identities: {} });
  const [rec, setRec] = useState<Recording | null>(null);
  const [error, setError] = useState<string>();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;
    const startReplay = async () => {
      try {
        const r = (await (await fetch("/recorded-run.json")).json()) as Recording;
        if (cancelled) return;
        setRec(r);
        setMeta({ modes: r.modes, explorer: r.network.explorer, identities: {} });
        setMode("replay");
      } catch {
        setError("No backend at " + API + " and no recorded run found.");
        setMode("replay");
      }
    };
    if (wantReplay()) void startReplay();
    else {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      fetch(`${API}/api/modes`, { signal: ctl.signal, headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((m) => {
          if (cancelled) return;
          clearTimeout(t);
          setMeta({ modes: m.modes, explorer: m.explorer, identities: m.identities ?? {} });
          setMode("live");
          es = new EventSource(`${API}/api/feed?since=0${TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : ""}`);
          es.addEventListener("event", (msg) => {
            const e = JSON.parse((msg as MessageEvent).data) as FeedEvent;
            setLive((xs) => (xs.length && xs[xs.length - 1]!.id >= e.id ? (xs.some((x) => x.id === e.id) ? xs : [...xs, e].sort((a, b) => a.id - b.id)) : [...xs, e]));
          });
          es.onerror = () => setError("Live feed interrupted — reconnecting…");
          es.onopen = () => setError(undefined);
        })
        .catch(() => void startReplay());
    }
    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  // Replay clock: real gaps between events, compressed and capped, divided by speed.
  useEffect(() => {
    if (mode !== "replay" || !rec || !playing || index >= rec.events.length) return;
    const prev = rec.events[index - 1];
    const next = rec.events[index]!;
    const gap = prev ? new Date(next.ts).getTime() - new Date(prev.ts).getTime() : 400;
    const delay = Math.max(40, Math.min(2500, gap * 0.5 + 120) / speed);
    const t = setTimeout(() => setIndex((i) => i + 1), delay);
    return () => clearTimeout(t);
  }, [mode, rec, playing, index, speed]);

  if (mode === "replay" && rec)
    return {
      mode, events: rec.events.slice(0, index), modes: meta.modes, explorer: meta.explorer, identities: meta.identities, error,
      replay: { recording: rec, index, playing, speed, setIndex, setPlaying, setSpeed },
    };
  return { mode, events: live, modes: meta.modes, explorer: meta.explorer, identities: meta.identities, error };
}
