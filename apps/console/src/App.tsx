import {
  Ban, Bot, Briefcase, Building2, FileText, LayoutDashboard, Menu, Pause, Play, Receipt, Rewind, ShieldAlert, Users,
} from "lucide-react";
import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wordmark } from "./brand";
import { AppCtx } from "./ctx";
import { EventDetail, describe } from "./feed";
import { api, human, useNow, useSource, usd } from "./lib";
import type { Source } from "./lib";
import Business from "./pages/Business";
import Contract from "./pages/Contract";
import Decisions from "./pages/Decisions";
import Job from "./pages/Job";
import Ledger from "./pages/Ledger";
import Overview from "./pages/Overview";
import Safety from "./pages/Safety";
import Workers from "./pages/Workers";
import { deriveState, demoMoments } from "./state";
import type { FeedEvent, Modes } from "./state";
import { Badge, Button, Dialog, Sheet, Skeleton, Toaster, cx, useToast } from "./ui";

const PAGES = [
  ["overview", "Overview", LayoutDashboard, Overview],
  ["job", "Job", Briefcase, Job],
  ["ledger", "Ledger", Receipt, Ledger],
  ["workers", "Workers", Users, Workers],
  ["safety", "Safety", ShieldAlert, Safety],
  ["decisions", "Decisions", Bot, Decisions],
  ["contract", "Contract", FileText, Contract],
  ["business", "Business view", Building2, Business],
] as const;

const pageFromHash = () => (PAGES.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : "overview");

function ModeBadges({ modes }: { modes: Modes | null }) {
  if (!modes) return null;
  const items: [string, string, boolean][] = [
    ["SERV", modes.serv, modes.serv === "live"],
    ["pay", modes.payments === "sim" ? "sim" : modes.payments.replace("kite-", "kite "), modes.payments !== "sim"],
    ["calls", modes.carrier, modes.carrier === "twilio"],
    ["calendar", modes.calendar, modes.calendar === "calcom"],
    ["email", modes.email, modes.email === "smtp"],
  ];
  return (
    <div className="hidden items-center gap-1 xl:flex" aria-label="Adapter modes">
      {items.map(([k, v, real]) => (
        <Badge key={k} tone={real ? "in" : "neutral"} mono title={real ? `${k}: real service` : `${k}: simulated locally`}>{k} {v}</Badge>
      ))}
    </div>
  );
}

function ReplayBar({ src }: { src: Source }) {
  const r = src.replay!;
  const total = r.recording.events.length;
  const moments = useMemo(() => demoMoments(r.recording.events), [r.recording]);
  const m = r.recording.modes;
  return (
    <div className="border-b border-line bg-surface/70 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button tone="ghost" onClick={() => { r.setIndex(0); r.setPlaying(true); }} title="Restart"><Rewind size={14} /></Button>
          <Button tone="ghost" onClick={() => r.setPlaying(!r.playing)} title={r.playing ? "Pause" : "Play"}>{r.playing ? <Pause size={14} /> : <Play size={14} />}</Button>
          {[1, 4, 10].map((s) => (
            <button key={s} onClick={() => r.setSpeed(s)} aria-pressed={r.speed === s} className={cx("num h-7 rounded px-2 text-[12px]", r.speed === s ? "bg-raised text-ink" : "text-muted hover:text-ink")}>{s}×</button>
          ))}
        </div>
        <div className="relative min-w-[240px] flex-1">
          <input type="range" min={0} max={total} value={r.index} onChange={(e) => { r.setIndex(Number(e.target.value)); }} aria-label="Scrub replay" className="w-full accent-[#5a1530]" />
          <div className="pointer-events-none absolute inset-x-0 top-[-2px] h-0">
            {moments.map((mo) => (
              <button key={mo.label} title={mo.label} onClick={() => r.setIndex(mo.index + 1)} style={{ left: `${((mo.index + 1) / total) * 100}%` }}
                className="pointer-events-auto absolute -translate-x-1/2 rounded-full border-2 border-bg bg-out p-[3px]" aria-label={`Jump to ${mo.label}`} />
            ))}
          </div>
        </div>
        <span className="num text-[12px] text-muted">{r.index}/{total}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-faint">
        Replay of a recorded run · SERV {m.serv} · calls {m.carrier} · calendar {m.calendar} · {new Date(r.recording.exportedAt).toLocaleString()}
        {m.payments === "sim" ? " · simulated settlement (local facilitator) — Kitescan links appear for live testnet runs" : ` · every tx link is live on Kitescan${r.recording.network.token?.symbol === "fUSD" ? " · paid in fUSD, our EIP-3009 test token, settled by our own facilitator (testnet pieUSD isn't on the public faucet)" : ""}`}
        {r.recording.audit?.ok && <> · audit chain verified ({r.recording.audit.events} events)</>}
      </p>
      <div className="mt-1 hidden flex-wrap gap-3 text-[11px] text-faint md:flex">
        {moments.map((mo) => <button key={mo.label} onClick={() => r.setIndex(mo.index + 1)} className="hover:text-ink"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-out" />{mo.label}</button>)}
      </div>
    </div>
  );
}

function Shell() {
  const src = useSource();
  const state = useMemo(() => deriveState(src.events), [src.events]);
  const now = useNow();
  const toast = useToast();
  const [page, setPage] = useState(pageFromHash);
  const [detail, setDetail] = useState<FeedEvent | null>(null);
  const [killOpen, setKillOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const live = src.mode === "live";

  useEffect(() => {
    const h = () => setPage(pageFromHash());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const go = useCallback((p: string) => { location.hash = p; setNavOpen(false); }, []);

  const act = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    if (!live) return toast("neutral", "Replay is read-only. Run the stack locally to act.");
    try { await fn(); toast("in", label); } catch (e) { toast("refuse", (e as Error).message); }
  }, [live, toast]);

  // Toasts for the moments that matter, only for events arriving now (not the initial backlog).
  const seen = useRef(0);
  useEffect(() => {
    const fresh = src.events.slice(seen.current);
    seen.current = src.events.length;
    if (fresh.length > 6) return;
    for (const e of fresh) {
      const d = e.data;
      if (e.type === "payment_in") toast("in", <>Payment settled: <span className="num">+{usd(d.amount)}</span> from {d.from}</>);
      if (e.type === "oracle_verdict") toast(d.verdict === "PASS" ? "proof" : "refuse", <>Oracle {d.verdict}{d.code ? ` · ${d.code}` : ""} for {d.worker}</>);
      if (e.type === "customer_confirmed") toast("in", <>{d.name} confirmed from their inbox</>);
      if (e.type === "refusal" && ["action_not_permitted", "proof_failed"].includes(d.code)) toast("refuse", <>Refused: <span className="font-mono">{d.code}</span></>);
    }
  }, [src.events, toast]);

  const business = state.contract?.business ?? "Smile Dental";
  const Page = PAGES.find(([k]) => k === page)![3];
  const c = state.contract;

  return (
    <AppCtx.Provider value={{ state, src, now, live, open: setDetail, act, go }}>
      <div className="grain flex h-full flex-col">
        <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4 backdrop-blur-xl">
          <button className="text-muted md:hidden" onClick={() => setNavOpen(!navOpen)} aria-label="Menu"><Menu size={18} /></button>
          <a href="/" aria-label="Foreman home"><Wordmark size={17} /></a>
          <span className="hidden text-muted sm:inline">{business}</span>
          {c && (
            <span className="hidden items-center gap-2 text-[12px] text-muted lg:flex">
              <span className="font-mono">{c.id}</span>
              <Badge tone={c.status === "running" ? "accent" : c.status === "draft" ? "out" : "neutral"}>{c.status}</Badge>
              <span className="font-mono text-faint" title={c.hash}>{c.hash.slice(0, 15)}…</span>
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ModeBadges modes={state.modes ?? src.modes} />
            {src.mode === "loading" ? <Skeleton className="h-5 w-14" /> : (
              <Badge tone={live ? "in" : "out"} mono>{live ? <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-in" />LIVE</> : "REPLAY"}</Badge>
            )}
            {state.kill.on ? (
              <Button tone="default" disabled={!live} onClick={() => { setConfirmText(""); setKillOpen(true); }} className="border-refuse text-refuse"><Ban size={14} />Killed · release</Button>
            ) : (
              <Button tone="danger" disabled={!live} title={live ? "Stop all spending now" : "Disabled in replay"} onClick={() => act("Kill switch engaged — every action is refused", () => api("POST", "/api/kill"))}>
                <Ban size={14} />Kill
              </Button>
            )}
          </div>
        </header>
        {src.replay && <ReplayBar src={src} />}
        {src.error && <div className="border-b border-out/30 bg-out/10 px-4 py-1.5 text-[12px] text-out">{src.error}</div>}
        <div className="flex min-h-0 flex-1">
          <nav className={cx("w-[200px] shrink-0 border-r border-line bg-bg p-2", navOpen ? "fixed inset-y-14 left-0 z-30 block" : "hidden md:block")}>
            {PAGES.map(([k, label, Icon]) => {
              const count = k === "safety" ? state.refusals.length : k === "decisions" ? state.decisions.length : 0;
              return (
                <a key={k} href={`#${k}`} onClick={() => setNavOpen(false)} aria-current={page === k ? "page" : undefined}
                  className={cx("mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]", page === k ? "bg-raised text-ink" : "text-muted hover:text-ink", k === "business" && "mt-3 border-t border-line pt-3")}>
                  <Icon size={14} className={page === k ? (k === "business" ? "text-in" : "text-accent") : ""} aria-hidden />
                  {label}
                  {count > 0 && <span className={cx("num ml-auto text-[11px]", k === "safety" ? "text-refuse" : "text-faint")}>{count}</span>}
                </a>
              );
            })}
            {!live && src.mode !== "loading" && (
              <p className="mt-4 px-2.5 text-[11.5px] leading-relaxed text-faint">Read-only replay. Actions work when the console talks to a running Foreman.</p>
            )}
          </nav>
          <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-5">
            {src.mode === "loading" ? (
              <div className="space-y-3"><div className="grid grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[76px]" />)}</div><Skeleton className="h-[420px]" /></div>
            ) : (
              <Page />
            )}
          </main>
        </div>
      </div>
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? <span className="flex items-center gap-2">{describe(detail)?.text ?? human(detail.type)}</span> : ""}>
        {detail && <EventDetail e={detail} state={state} />}
      </Sheet>
      <Dialog open={killOpen} onClose={() => setKillOpen(false)} title="Release the kill switch">
        <p className="mb-3 text-[13px] text-muted">Spending resumes under the contract's limits. Type <span className="font-mono text-ink">{business.toUpperCase()}</span> to confirm.</p>
        <input autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mb-4 w-full rounded-md border border-line bg-bg px-3 py-2 font-mono text-[13px] outline-none focus:border-accent" aria-label="Business name" />
        <div className="flex justify-end gap-2">
          <Button tone="ghost" onClick={() => setKillOpen(false)}>Keep stopped</Button>
          <Button tone="primary" disabled={confirmText.trim().toUpperCase() !== business.toUpperCase()} onClick={() => act("Kill switch released", async () => { await api("POST", "/api/unkill", { confirm: confirmText }); setKillOpen(false); })}>Release</Button>
        </div>
      </Dialog>
    </AppCtx.Provider>
  );
}

export default function App() {
  return <MotionConfig reducedMotion="user"><Toaster><Shell /></Toaster></MotionConfig>;
}
