import {
  ArrowRight, Search, Ban, Bot, Briefcase, Building2, Download, FileText, LayoutDashboard, Menu, Pause, Play, Receipt, Rewind, ShieldAlert, Users, X,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Crown, HalftoneDefs, HardHat, Sparks, Star, StarFilled } from "./art";
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
import { Badge, Button, Dialog, PageTitle, Sheet, Skeleton, Toaster, cx, useToast } from "./ui";

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

const SQ = "grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border-2 border-ink bg-ink text-white transition-transform hover:-translate-y-0.5 hover:bg-pink hover:text-ink";

function ReplayBar({ src }: { src: Source }) {
  const r = src.replay!;
  const total = r.recording.events.length;
  const moments = useMemo(() => demoMoments(r.recording.events), [r.recording]);
  const m = r.recording.modes;
  const pct = total ? (r.index / total) * 100 : 0;
  return (
    <div className="mb-5 rounded-[6px] border-2 border-ink bg-surface px-4 py-3 shadow-[5px_5px_0_#0e0e0e]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button className={SQ} onClick={() => { r.setIndex(0); r.setPlaying(true); }} title="Restart" aria-label="Restart"><Rewind size={15} /></button>
          <button className={SQ} onClick={() => r.setPlaying(!r.playing)} title={r.playing ? "Pause" : "Play"} aria-label={r.playing ? "Pause" : "Play"}>{r.playing ? <Pause size={15} /> : <Play size={15} />}</button>
          {[1, 4, 10].map((s) => (
            <button key={s} onClick={() => r.setSpeed(s)} aria-pressed={r.speed === s}
              className={cx("num h-7 rounded-[3px] border-[1.5px] border-ink px-2 text-[12px] font-bold", r.speed === s ? "bg-ink text-yellow" : "bg-surface hover:bg-yellow")}>{s}×</button>
          ))}
        </div>
        <div className="relative h-7 min-w-[200px] flex-1">
          <div className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 overflow-hidden rounded-[3px] border-2 border-ink bg-ink">
            <div className="h-full bg-yellow" style={{ width: `${pct}%` }} />
          </div>
          <input type="range" min={0} max={total} value={r.index} onChange={(e) => { r.setIndex(Number(e.target.value)); }} aria-label="Scrub replay"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-[2px] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-surface [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[2px] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-[2px_2px_0_#0e0e0e]" />
          {moments.map((mo) => (
            <button key={mo.label} title={mo.label} onClick={() => r.setIndex(mo.index + 1)} style={{ left: `${((mo.index + 1) / total) * 100}%` }}
              className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-pink transition-transform hover:scale-125" aria-label={`Jump to ${mo.label}`} />
          ))}
        </div>
        <span className="num text-[12px] font-semibold">{r.index}/{total}</span>
      </div>
      <p className="mt-2 text-[12px] text-ink/70">
        Replay of a recorded run · SERV {m.serv} · calls {m.carrier} · calendar {m.calendar} · {new Date(r.recording.exportedAt).toLocaleString()}
        {m.payments === "sim" ? " · simulated settlement (local facilitator) — Kitescan links appear for live testnet runs" : ` · every tx link is live on Kitescan${r.recording.network.token?.symbol === "fUSD" ? " · paid in fUSD, our EIP-3009 test token, settled by our own facilitator (testnet pieUSD isn't on the public faucet)" : ""}`}
        {r.recording.audit?.ok && <> · audit chain verified ({r.recording.audit.events} events)</>}
      </p>
      <div className="mt-2 hidden flex-wrap gap-1.5 md:flex">
        {moments.map((mo) => (
          <button key={mo.label} onClick={() => r.setIndex(mo.index + 1)} className="flex items-center gap-1.5 rounded-[3px] border-[1.5px] border-ink bg-surface px-2 py-0.5 text-[11.5px] font-bold hover:bg-yellow">
            <span className="h-2 w-2 rounded-full border border-ink bg-pink" />{mo.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const DOODLE = "h-auto w-full text-pink";
const TITLES: Record<string, [string, string, ReactNode]> = {
  overview: ["Dashboard", "Rebook no-shows and get paid only when the booking is proven.", <Star className={DOODLE} color="#e0007a" />],
  job: ["The job", "Every no-show, every call, every step until it's booked.", <Sparks className={DOODLE} color="#e0007a" />],
  ledger: ["Ledger", "Money in from the clinic, money out to the agents Foreman hired.", <Crown className={DOODLE} color="#e0007a" />],
  workers: ["Workers", "Phone agents on hire, scored by the proof oracle.", <Star className={DOODLE} color="#e0007a" />],
  safety: ["Safety", "Every request the firewall said no to, with the clause that blocked it.", <Sparks className={DOODLE} color="#e0007a" />],
  decisions: ["Decisions", "What SERV was asked, what it answered, and how long it took.", <Crown className={DOODLE} color="#e0007a" />],
  contract: ["Contract", "The clinic's goal compiled into terms. Nothing runs outside them.", <Star className={DOODLE} color="#e0007a" />],
  business: ["Business view", "What the clinic sees: give a job, pay only for proven rebookings.", <Sparks className={DOODLE} color="#e0007a" />],
};

const MCP_CMD = "claude mcp add foreman -- bun services/mcp/src/stdio.ts";

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

  // Lock page scroll behind the mobile menu.
  useEffect(() => { document.body.style.overflow = navOpen ? "hidden" : ""; }, [navOpen]);

  const business = state.contract?.business ?? "Smile Dental";
  const Page = PAGES.find(([k]) => k === page)![3];
  const c = state.contract;
  const [title, sub, doodle] = TITLES[page]!;

  const [q, setQ] = useState("");
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim().toLowerCase();
    if (!t) return;
    const hit = PAGES.find(([k, l]) => k.includes(t) || l.toLowerCase().includes(t));
    go(hit ? hit[0] : state.customers.some((x) => x.name.toLowerCase().includes(t)) ? "job" : "overview");
  };
  const searchBox = (cls: string) => (
    <form onSubmit={search} className={cx("items-center gap-2 rounded-[4px] border-2 border-ink bg-yellow px-3 py-1.5 focus-within:shadow-[3px_3px_0_#0e0e0e]", cls)}>
      <Search size={15} className="shrink-0" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a page or customer" aria-label="Search" className="w-full bg-transparent text-[14px] font-semibold outline-none placeholder:text-ink/55" />
    </form>
  );
  const count = (k: string) => (k === "safety" ? state.refusals.length : k === "decisions" ? state.decisions.length : 0);
  const copyMcp = () => { void navigator.clipboard?.writeText(MCP_CMD); toast("in", "MCP command copied"); };

  const navLink = (k: string, label: string, Icon: typeof Ban) => {
    const on = page === k;
    const n = count(k);
    return (
      <a key={k} href={`#${k}`} aria-current={on ? "page" : undefined}
        className={cx("relative mb-1 flex items-center gap-3 px-3 py-2 text-[15px] font-extrabold uppercase tracking-[0.03em] transition-colors", on ? "text-ink" : "text-ink/70 hover:text-ink")}>
        {on && <motion.span layoutId="nav-on" className="absolute inset-0 -rotate-1 rounded-[4px] border-2 border-ink bg-pink shadow-[3px_3px_0_#0e0e0e]" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
        <Icon size={17} className="relative" aria-hidden />
        <span className="relative">{label}</span>
        {n > 0 && <span className={cx("num relative ml-auto rounded-[3px] border-[1.5px] border-ink px-1.5 text-[10.5px] font-bold", on ? "bg-surface text-ink" : k === "safety" ? "bg-pink text-ink" : "bg-ink text-white")}>{n}</span>}
      </a>
    );
  };

  return (
    <AppCtx.Provider value={{ state, src, now, live, open: setDetail, act, go }}>
      <HalftoneDefs />
      <div className="grain flex h-full gap-4 p-3 md:p-4">
        {/* sidebar */}
        <nav className="hidden w-[240px] shrink-0 flex-col overflow-y-auto rounded-[6px] border-2 border-ink bg-surface p-4 shadow-[5px_5px_0_#0e0e0e] md:flex">
          <a href="/" className="mb-6 px-1 pt-1" aria-label="Foreman home"><Wordmark size={22} /></a>
          <p className="marker mb-1.5 px-3 text-[14px] text-accent">Menu</p>
          {PAGES.slice(0, 6).map(([k, label, Icon]) => navLink(k, label, Icon))}
          <p className="marker mb-1.5 mt-4 px-3 text-[14px] text-accent">Business</p>
          {PAGES.slice(6).map(([k, label, Icon]) => navLink(k, label, Icon))}
          <div className="relative mt-auto overflow-hidden rounded-[6px] border-2 border-ink bg-ink p-4 pt-5 text-white">
            <HardHat className="absolute -right-3 -top-2 w-[78px] rotate-12" />
            <StarFilled className="absolute bottom-14 right-3 w-5 rotate-12" color="#ff2ea8" />
            <p className="display relative pr-14 text-[26px]">Run Foreman <span className="text-yellow">from Claude</span></p>
            <p className="relative mt-2 text-[12.5px] text-white/70">Ten MCP tools. Approving spend stays with you.</p>
            <button onClick={copyMcp} style={{ "--brut-gap": "#fffdf4" } as React.CSSProperties} className="brut brut-pink brut-sm relative mt-4 w-[calc(100%-6px)] text-ink!">Copy MCP command</button>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* top bar */}
          <header className="flex shrink-0 items-center gap-2 rounded-[6px] border-2 border-ink bg-surface px-2.5 py-2 shadow-[5px_5px_0_#0e0e0e] sm:gap-3 md:px-3">
            <button className={cx(SQ, "md:hidden")} onClick={() => setNavOpen(true)} aria-label="Open menu" aria-expanded={navOpen}><Menu size={18} /></button>
            <a href="/" className="md:hidden" aria-label="Foreman home"><Wordmark size={19} /></a>
            {searchBox("hidden min-w-[200px] max-w-[320px] flex-1 md:flex")}
            {c && (
              <span className="hidden items-center gap-2 text-[12px] 2xl:flex">
                <span className="font-mono font-semibold">{c.id}</span>
                <Badge tone={c.status === "running" ? "accent" : c.status === "draft" ? "out" : "neutral"}>{c.status}</Badge>
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <ModeBadges modes={state.modes ?? src.modes} />
              {src.mode === "loading" ? <Skeleton className="h-6 w-16" /> : live ? (
                <span className="display flex items-center gap-1.5 border-2 border-ink bg-in px-2 py-0.5 text-[14px] text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-yellow" />Live</span>
              ) : (
                <span className="display rotate-2 border-2 border-ink bg-pink px-2 py-0.5 text-[14px]">Replay</span>
              )}
              {state.kill.on ? (
                <Button tone="default" disabled={!live} onClick={() => { setConfirmText(""); setKillOpen(true); }} className="text-refuse!"><Ban size={14} />Killed · release</Button>
              ) : (
                <Button tone="danger" disabled={!live} title={live ? "Stop all spending now" : "Disabled in replay"} onClick={() => act("Kill switch engaged — every action is refused", () => api("POST", "/api/kill"))}>
                  <Ban size={14} />Kill
                </Button>
              )}
              <div className="ml-1 hidden items-center gap-2.5 border-l-2 border-dashed border-ink/25 pl-3 sm:flex">
                <span className="display grid h-9 w-9 -rotate-3 place-items-center rounded-full border-2 border-ink bg-pink pt-0.5 text-[17px] shadow-[2px_2px_0_#0e0e0e]">{business[0]}</span>
                <div className="hidden whitespace-nowrap leading-tight 2xl:block">
                  <div className="text-[14px] font-extrabold">{business}</div>
                  <div className="font-mono text-[11px] text-muted">{(() => { const a = (state.identities[business] ?? src.identities?.[business])?.address; return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "clinic wallet"; })()}</div>
                </div>
              </div>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0.5 pb-6 pr-2">
            {src.replay && <ReplayBar src={src} />}
            {src.error && <div className="mb-4 rounded-[4px] border-2 border-ink bg-[#ffe8c9] px-4 py-2 text-[13px] font-semibold text-out">{src.error}</div>}
            {src.mode === "loading" ? (
              <div className="space-y-4"><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[130px]" />)}</div><Skeleton className="h-[420px]" /></div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={page} initial={{ opacity: 0, y: 14, rotate: -0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
                  <PageTitle title={title} sub={sub} doodle={doodle}
                    aside={page === "overview" && (
                      <div className="flex gap-3">
                        <button onClick={() => go("business")} className="brut brut-sm"><Play size={15} />New run</button>
                        <button onClick={() => go("ledger")} className="brut brut-light brut-sm"><Download size={15} />Ledger</button>
                      </div>
                    )} />
                  <Page />
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>
      </div>

      {/* mobile menu */}
      <AnimatePresence>
        {navOpen && (
          <motion.div className="grain fixed inset-0 z-50 flex flex-col overflow-y-auto bg-yellow px-4 pb-8 pt-3 md:hidden" role="dialog" aria-modal="true" aria-label="Menu"
            initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
            <div className="flex items-center justify-between py-1.5">
              <Wordmark size={22} />
              <button onClick={() => setNavOpen(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-ink text-white"><X size={20} /></button>
            </div>
            {searchBox("mt-4 flex")}
            <motion.ul className="mt-5 border-t-2 border-ink" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } } }}>
              {PAGES.map(([k, label]) => (
                <motion.li key={k} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0 } }} className="border-b-2 border-ink">
                  <a href={`#${k}`} onClick={() => setNavOpen(false)} aria-current={page === k ? "page" : undefined} className="flex items-center justify-between gap-3 py-2.5">
                    <span className={cx("display text-[44px] leading-none", page === k && "hl")}>{label}</span>
                    <span className="flex items-center gap-2">
                      {count(k) > 0 && <span className="num rounded-[3px] border-[1.5px] border-ink bg-ink px-1.5 text-[12px] font-bold text-white">{count(k)}</span>}
                      <ArrowRight size={30} strokeWidth={3} />
                    </span>
                  </a>
                </motion.li>
              ))}
            </motion.ul>
            <div className="relative mt-6 rounded-[6px] border-2 border-ink bg-ink p-4 text-white">
              <HardHat className="absolute -right-2 -top-4 w-[72px] rotate-12" />
              <p className="display pr-16 text-[26px]">Run Foreman <span className="text-yellow">from Claude</span></p>
              <button onClick={copyMcp} style={{ "--brut-gap": "#fffdf4" } as React.CSSProperties} className="brut brut-pink brut-sm mt-3 text-ink!">Copy MCP command</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? <span className="flex items-center gap-2">{describe(detail)?.text ?? human(detail.type)}</span> : ""}>
        {detail && <EventDetail e={detail} state={state} />}
      </Sheet>
      <Dialog open={killOpen} onClose={() => setKillOpen(false)} title="Release the kill switch">
        <p className="mb-3 text-[14px] text-ink/80">Spending resumes under the contract's limits. Type <span className="font-mono font-bold text-ink">{business.toUpperCase()}</span> to confirm.</p>
        <input autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mb-5 w-full rounded-[4px] border-2 border-ink bg-yellow px-3 py-2 font-mono text-[13px] font-semibold outline-none focus:shadow-[3px_3px_0_#ff2ea8]" aria-label="Business name" />
        <div className="flex justify-end gap-3">
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
