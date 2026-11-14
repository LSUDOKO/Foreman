import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Ban, CalendarCheck, Clock, Code2, Hand, MicVocal, PhoneOff, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Corner, Cross, Glass, Mark, Orb, Wordmark } from "./brand";
import type { Recording } from "./lib";
import { short, slotLabel, usd } from "./lib";
import { deriveState } from "./state";
import type { State } from "./state";
import { cx } from "./ui";

const REPO = "https://github.com/LSUDOKO/Foreman";
const C = { ember: "#d2541f", maroon: "#5a1530", mustard: "#d9a12c", plum: "#7a2742" };

function useRun() {
  const [run, setRun] = useState<{ rec: Recording; s: State } | null>(null);
  useEffect(() => {
    fetch("/recorded-run.json").then((r) => r.json()).then((rec: Recording) => setRun({ rec, s: deriveState(rec.events) })).catch(() => {});
  }, []);
  return run;
}

// ───────────────────────── nav ─────────────────────────
function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > 40));
  return (
    <header className={cx("fixed inset-x-0 top-0 z-50 transition-all duration-300", solid ? "py-2" : "py-4")}>
      <nav className={cx("mx-auto flex max-w-[1180px] items-center gap-6 rounded-full border border-white/60 bg-[#f4eee2]/55 px-4 py-2 backdrop-blur-xl transition-all duration-300", solid && "bg-[#f4eee2]/75 shadow-[0_10px_30px_-18px_rgba(90,21,48,.6)]")}>
        <a href="/" aria-label="Foreman home"><Wordmark size={19} /></a>
        <div className="ml-auto hidden items-center gap-6 text-[13.5px] text-ink/80 md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#proof" className="hover:text-ink">Proof</a>
          <a href="#kite" className="hover:text-ink">Kite and SERV</a>
          <a href="#mcp" className="hover:text-ink">MCP</a>
        </div>
        <Glass href="/app" ink className="ml-auto !px-4 !py-2 text-[13px] md:ml-0">Open dashboard</Glass>
      </nav>
    </header>
  );
}

// ───────────────────────── hero ─────────────────────────
function Hero({ run }: { run: ReturnType<typeof useRun> }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yA = useTransform(p, [0, 1], [0, -220]);
  const yB = useTransform(p, [0, 1], [0, 160]);
  const yC = useTransform(p, [0, 1], [0, -90]);
  const rot = useTransform(p, [0, 1], [0, 40]);
  const scale = useTransform(p, [0, 1], [1, 0.86]);
  const fade = useTransform(p, [0, 0.7], [1, 0]);
  const firstTx = run?.s.payments.find((x) => x.link)?.link;
  return (
    <section ref={ref} className="relative isolate h-[100svh] min-h-[640px] overflow-hidden">
      {/* survey grid */}
      {[18, 50, 82].map((x) => <div key={x} className="dash-y absolute inset-y-0" style={{ left: `${x}%` }} />)}
      {[22, 64, 88].map((y) => <div key={y} className="dash-x absolute inset-x-0" style={{ top: `${y}%` }} />)}
      {[[18, 22], [50, 22], [82, 22], [18, 64], [82, 64], [18, 88], [50, 88], [82, 88]].map(([x, y]) => (
        <div key={`${x}-${y}`} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}><Cross className="-translate-x-1/2 -translate-y-1/2" /></div>
      ))}
      {/* overprinted orbs */}
      <motion.div className="absolute inset-0 -z-10 origin-center max-md:!scale-[.6]" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }}>
        <Orb color={C.ember} size={520} style={{ left: "34%", top: "-24%" }} y={yA} />
        <Orb color={C.maroon} size={420} style={{ left: "52%", top: "-10%", mixBlendMode: "multiply" }} y={yA} rotate={rot} />
        <Orb color={C.mustard} size={300} style={{ left: "64%", top: "16%", mixBlendMode: "multiply" }} y={yC} />
        <Orb color={C.ember} size={360} style={{ left: "-14%", top: "18%" }} y={yC} />
        <Orb color={C.mustard} size={640} style={{ left: "16%", top: "70%" }} y={yB} />
        <Orb color={C.plum} size={460} style={{ left: "42%", top: "78%", mixBlendMode: "multiply" }} y={yB} />
      </motion.div>
      {/* paper fold */}
      <div className="pointer-events-none absolute inset-y-0 left-[49%] w-px bg-gradient-to-b from-transparent via-ink/10 to-transparent" />

      <Corner pos="tl">Kite testnet<br />chain {run?.rec.network.chainId ?? 2368}</Corner>
      <Corner pos="tr">Paid only<br />on proof</Corner>
      <Corner pos="bl">SERV reasoning<br />{run ? `${run.s.decisions.length} live decisions` : "live"}</Corner>
      <Corner pos="br">x402 exact<br />EIP-3009</Corner>

      <motion.div style={{ scale, opacity: fade }} className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[70%] -translate-y-1/2 md:hidden" style={{ background: "radial-gradient(closest-side, rgba(235,227,210,.92), rgba(235,227,210,.6) 60%, transparent)" }} />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex items-center gap-3 md:gap-5">
          <Mark size={88} className="h-10 w-10 sm:h-14 sm:w-14 md:h-[96px] md:w-[96px]" />
          <h1 className="display text-[50px] text-ink sm:text-[96px] md:text-[132px]">Foreman</h1>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }} className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="chip">Rebooks no-shows</span><span className="chip">Paid per outcome</span>
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 0.7 }}
          className="mt-7 max-w-[600px] text-[17px] leading-relaxed text-ink/85 md:text-[19px]">
          An AI agent that phones a clinic's missed appointments, rebooks them in the real calendar, and charges only when the booking is proven.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.7 }} className="mt-8 flex flex-wrap justify-center gap-3">
          <Glass href="/app?replay" ink>Watch a real run</Glass>
          {firstTx && <Glass href={firstTx} target="_blank">First payment on Kitescan <ArrowUpRight size={16} /></Glass>}
        </motion.div>
      </motion.div>
      {/* ruler */}
      <div className="absolute bottom-[9%] left-[6%] right-[40%] hidden h-3 border-b border-ink/50 md:block" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(42,14,25,.5) 0 1px, transparent 1px 48px)", backgroundSize: "100% 10px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" }} />
    </section>
  );
}

// ───────────────────────── steps ─────────────────────────
type Step = { title: string; body: string; visual: ReactNode };

function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-[22px] border border-ink/15 bg-[#f7f2e8] p-5 shadow-[0_30px_60px_-30px_rgba(90,21,48,.45)]", className)}>{children}</div>;
}
const Row = ({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-ink/20 py-2 text-[13.5px] last:border-0">
    <span className="text-ink/60">{k}</span><span className={cx("text-right", mono && "num")}>{v}</span>
  </div>
);
const Stamp = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
  <span className={cx("inline-flex -rotate-3 items-center rounded-md border-2 px-2.5 py-0.5 font-mono text-[13px] font-semibold tracking-wide", ok ? "border-in text-in" : "border-refuse text-refuse")}>{children}</span>
);

function steps(run: NonNullable<ReturnType<typeof useRun>>): Step[] {
  const { s, rec } = run;
  const compile = s.decisions.find((d) => d.purpose === "compile_contract");
  const c = compile?.decision ?? {};
  const call = rec.events.find((e) => e.type === "call_reported" && e.data.outcome === "accepted")?.data;
  const pass = rec.events.find((e) => e.type === "oracle_verdict" && e.data.verdict === "PASS")?.data;
  const fail = rec.events.find((e) => e.type === "oracle_verdict" && e.data.verdict === "FAIL")?.data;
  const hire = s.payments.find((p) => p.direction === "out" && p.purpose === "call");
  const paidIn = s.payments.filter((p) => p.direction === "in");
  return [
    {
      title: "Compile the goal",
      body: "The clinic writes one sentence. SERV turns it into a signed contract: a budget, a price cap per call, calling hours and how many tries each customer gets.",
      visual: (
        <Paper>
          <p className="mb-3 rounded-xl bg-ink/[.06] px-3 py-2 text-[14px] italic text-ink/80">"Rebook yesterday's no-shows. Don't spend more than five dollars."</p>
          <Row k="Total budget" v={usd(c.totalBudget ?? 5)} />
          <Row k="Cap per call" v={usd(c.perCallCap ?? 0.6)} />
          <Row k="Calling hours" v={c.allowedHours ? `${c.allowedHours.start}–${c.allowedHours.end}` : "09:00–21:00"} />
          <Row k="Tries per customer" v={c.perCustomerMaxAttempts ?? 2} />
          <p className="mt-3 font-mono text-[11px] text-ink/50">{compile?.model} · {compile ? `${(compile.ms / 1000).toFixed(1)}s` : ""}</p>
        </Paper>
      ),
    },
    {
      title: "A person approves the spend",
      body: "Nothing moves until the clinic approves. The contract is hashed, so every later payment can be traced back to exactly what was agreed.",
      visual: (
        <Paper>
          <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">{s.contract?.business}</span><Stamp ok>Approved</Stamp></div>
          <Row k="Contract" v={s.contract?.id} />
          <Row k="Hash" v={short(s.contract?.hash.replace("sha256:", ""), 8)} />
          <Row k="Approved by" v={s.contract?.approvedBy ?? "owner"} mono={false} />
        </Paper>
      ),
    },
    {
      title: "Hire a caller, pay per call",
      body: "Foreman picks a phone agent by price and reputation and pays it upfront over x402. The payment settles on Kite before the phone rings.",
      visual: hire && (
        <Paper>
          <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><Wallet size={16} className="text-ember" />Payment receipt</div>
          <Row k="To" v={hire.to} mono={false} />
          <Row k="Amount" v={`${usd(hire.amount)} ${rec.network.token?.symbol ?? ""}`} />
          <Row k="Network" v={`Kite testnet ${rec.network.chainId}`} mono={false} />
          <Row k="Transaction" v={<a className="text-proof underline-offset-2 hover:underline" href={hire.link ?? "#"} target="_blank" rel="noreferrer">{short(hire.txHash, 6)}</a>} />
        </Paper>
      ),
    },
    {
      title: "Call the customer",
      body: "The caller says it's an AI, offers real free times from the calendar and books the one the customer picks.",
      visual: call && (
        <Paper className="space-y-2">
          <div className="mb-1 flex items-center justify-between text-[12px] text-ink/60"><span>{call.name} · {call.durationSec}s</span><span className="num">{short(call.callSid, 5)}</span></div>
          {call.transcript.map((t: any, i: number) => (
            <div key={i} className={cx("max-w-[88%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug", t.who === "agent" ? "bg-ink text-[#f4eee2]" : "ml-auto bg-mustard/40")}>{t.text}</div>
          ))}
          <div className="flex items-center gap-2 pt-1 text-[12.5px] text-in"><CalendarCheck size={14} />Booked {slotLabel(call.slot)}</div>
        </Paper>
      ),
    },
    {
      title: "Check the proof",
      body: "A separate oracle asks the phone carrier and the calendar directly. One caller claimed a booking it never made. The oracle caught it, so it wasn't paid and its reputation dropped.",
      visual: (
        <div className="space-y-3">
          {[pass, fail].filter(Boolean).map((v: any) => (
            <Paper key={v.attemptId} className="!p-4">
              <div className="mb-2 flex items-center justify-between"><span className="text-[15px] font-semibold">{v.worker}</span><Stamp ok={v.verdict === "PASS"}>{v.verdict}{v.code ? ` · ${v.code}` : ""}</Stamp></div>
              <div className="flex flex-wrap gap-1.5">
                {v.checks.map((ch: any) => <span key={ch.name} className={cx("rounded-full px-2 py-0.5 font-mono text-[11px]", ch.pass ? "bg-in/10 text-in" : "bg-refuse/10 text-refuse")}>{ch.name}</span>)}
              </div>
            </Paper>
          ))}
        </div>
      ),
    },
    {
      title: "Get paid for the outcome",
      body: "When the customer confirms from their inbox, the clinic pays Foreman. If they show up, it pays a little more. No proof, no invoice.",
      visual: (
        <Paper>
          {paidIn.map((p) => <Row key={p.eventId} k={p.purpose.replace(/_/g, " ")} v={<a href={p.link ?? "#"} target="_blank" rel="noreferrer" className="text-in hover:underline">+{usd(p.amount)}</a>} />)}
          <div className="mt-3 flex items-baseline justify-between"><span className="text-ink/60">Kept after costs</span><span className="display text-[40px] text-ink">{usd(s.totals.margin)}</span></div>
        </Paper>
      ),
    },
  ];
}

function useWide() {
  const q = "(min-width: 768px)";
  const [wide, setWide] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const f = () => setWide(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return wide;
}

function How({ run }: { run: NonNullable<ReturnType<typeof useRun>> }) {
  return useWide() ? <HowPinned run={run} /> : <HowStacked run={run} />;
}

function HowStacked({ run }: { run: NonNullable<ReturnType<typeof useRun>> }) {
  const list = useMemo(() => steps(run), [run]);
  return (
    <section id="how" className="px-5 py-20">
      <h2 className="display mb-10 text-[40px]">One run,<br />start to paid.</h2>
      <ol className="space-y-12">
        {list.map((st, k) => (
          <motion.li key={st.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }}>
            <div className="flex items-baseline gap-3"><span className="num text-[12px] text-ember">{String(k + 1).padStart(2, "0")}</span><span className="text-[20px] font-semibold tracking-tight" style={{ fontStretch: "112%" }}>{st.title}</span></div>
            <p className="mb-4 mt-1.5 pl-8 text-[15px] leading-relaxed text-ink/75">{st.body}</p>
            {st.visual}
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function HowPinned({ run }: { run: NonNullable<ReturnType<typeof useRun>> }) {
  const ref = useRef<HTMLElement>(null);
  const list = useMemo(() => steps(run), [run]);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [i, setI] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setI(Math.min(list.length - 1, Math.floor(v * list.length))));
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <section id="how" ref={ref} className="relative" style={{ height: `${list.length * 85}vh` }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <Orb color={C.mustard} size={520} style={{ right: "-12%", top: "8%", opacity: 0.55 }} />
        <div className="relative mx-auto grid w-full max-w-[1180px] gap-10 px-5 md:grid-cols-[1fr_1.05fr] md:gap-16">
          <div className="flex flex-col justify-center">
            <h2 className="display mb-8 text-[44px] md:text-[64px]">One run,<br />start to paid.</h2>
            <ol className="relative space-y-1 border-l border-ink/15 pl-6">
              <motion.span className="absolute -left-px top-0 w-px bg-ember" style={{ height: bar }} />
              {list.map((st, k) => (
                <li key={st.title} className={cx("transition-opacity duration-300", k === i ? "opacity-100" : "opacity-35")}>
                  <div className="flex items-baseline gap-3 py-1.5">
                    <span className="num w-6 text-[12px] text-ember">{String(k + 1).padStart(2, "0")}</span>
                    <span className="text-[19px] font-semibold tracking-tight md:text-[21px]" style={{ fontStretch: "112%" }}>{st.title}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {k === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-9 text-[15px] leading-relaxed text-ink/75">
                        <span className="block max-w-[46ch] pb-2">{st.body}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative hidden min-h-[460px] items-center md:flex">
            <AnimatePresence mode="wait">
              <motion.div key={i} className="w-full" initial={{ opacity: 0, y: 30, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -24, rotate: 1 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
                {list[i]!.visual}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── numbers ─────────────────────────
function Numbers({ run }: { run: NonNullable<ReturnType<typeof useRun>> }) {
  const { s } = run;
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(p, [0, 1], ["0%", "-45%"]);
  const real = s.payments.filter((t) => t.link);
  return (
    <section id="proof" ref={ref} className="relative overflow-hidden bg-ink py-28 text-[#f4eee2]">
      <Orb color={C.ember} size={560} style={{ left: "-10%", top: "-30%", opacity: 0.55 }} />
      <Orb color={C.plum} size={480} style={{ right: "-8%", bottom: "-35%", opacity: 0.8 }} />
      <div className="relative mx-auto max-w-[1180px] px-5">
        <h2 className="display max-w-[14ch] text-[44px] md:text-[64px]"><span className="silver">Real money, on chain, every step.</span></h2>
        <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-[#f4eee2]/70">These figures come from a recorded run on Kite testnet. Each payment below is a real transaction you can open on Kitescan.</p>
        <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {([["Earned from the clinic", usd(s.totals.earned)], ["Paid to callers and oracle", usd(s.totals.spent)], ["Kept", usd(s.totals.margin)], ["Payments settled", String(real.length)]] as const).map(([k, v]) => (
            <div key={k} className="border-t border-white/20 pt-4">
              <dd className="display text-[46px] md:text-[64px]">{v}</dd>
              <dt className="mt-2 text-[13.5px] text-[#f4eee2]/60">{k}</dt>
            </div>
          ))}
        </dl>
      </div>
      <motion.div style={{ x }} className="mt-20 flex gap-3 whitespace-nowrap pl-5">
        {[...real, ...real].map((t, k) => (
          <a key={k} href={t.link!} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[.06] px-4 py-2.5 text-[12.5px] text-[#f4eee2] shadow-[inset_0_1px_0_rgba(255,255,255,.18)] backdrop-blur-md transition-colors hover:bg-white/[.12]">
            <span className={t.direction === "in" ? "text-[#8fd19e]" : "text-[#f2b38f]"}>{t.direction === "in" ? "+" : "−"}{usd(t.amount)}</span>
            <span className="text-white/60">{t.direction === "in" ? `from ${t.from}` : `to ${t.to}`}</span>
            <span className="font-mono text-white/45">{short(t.txHash, 4)}</span>
          </a>
        ))}
      </motion.div>
    </section>
  );
}

// ───────────────────────── kite + serv ─────────────────────────
function Flow({ run }: { run: NonNullable<ReturnType<typeof useRun>> }) {
  const { s, rec } = run;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const draw = useTransform(p, [0, 1], [0, 1]);
  const nodes = [
    { id: "biz", label: s.contract?.business ?? "Clinic", sub: "pays per proven outcome", x: 80, y: 150 },
    { id: "fm", label: "Foreman", sub: "buys work, sells results", x: 400, y: 150 },
    { id: "cc", label: "ClearCall", sub: "honest caller", x: 720, y: 60 },
    { id: "qd", label: "QuickDial", sub: "cheap, lies", x: 720, y: 150 },
    { id: "or", label: "Oracle", sub: "checks the claims", x: 720, y: 240 },
  ];
  const edges = [["biz", "fm", "$4 + $2 per outcome"], ["fm", "cc", "$0.50 per call"], ["fm", "qd", "$0.30 per call"], ["fm", "or", "$0.02 per check"]];
  const at = (id: string) => nodes.find((n) => n.id === id)!;
  const servMs = s.decisions.reduce((a, d) => a + d.ms, 0);
  return (
    <section id="kite" className="relative overflow-hidden py-28">
      <Orb color={C.maroon} size={380} style={{ left: "60%", top: "-6%", opacity: 0.35 }} />
      <div className="relative mx-auto max-w-[1180px] px-5">
        <h2 className="display max-w-[16ch] text-[44px] md:text-[64px]">Agents paying agents, on Kite.</h2>
        <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-ink/75">
          Every arrow is an x402 payment: the seller answers <span className="num">402 Payment Required</span>, Foreman signs an EIP-3009 transfer, and a facilitator settles it on Kite testnet (chain {rec.network.chainId}) in {rec.network.token?.symbol ?? "pieUSD"} before the work starts.
        </p>
        <div ref={ref} className="mt-12 overflow-x-auto">
          <svg viewBox="0 0 860 300" className="min-w-[720px]" role="img" aria-label="Payment flow between the clinic, Foreman, the callers and the oracle">
            {edges.map(([a, b, label]) => {
              const A = at(a!), B = at(b!);
              return (
                <g key={b}>
                  <motion.path d={`M${A.x + 70} ${A.y} C ${(A.x + B.x) / 2} ${A.y}, ${(A.x + B.x) / 2} ${B.y}, ${B.x - 70} ${B.y}`} fill="none" stroke={C.ember} strokeWidth={2} strokeDasharray="1 0" style={{ pathLength: draw }} />
                  <text x={a === "biz" ? (A.x + B.x) / 2 : B.x - 160} y={B.y - 10} textAnchor="middle" stroke="#ebe3d2" strokeWidth={6} style={{ paintOrder: "stroke" }} className="fill-ink font-mono text-[11px]">{label}</text>
                </g>
              );
            })}
            {nodes.map((n) => (
              <g key={n.id}>
                <rect x={n.x - 70} y={n.y - 26} width={140} height={52} rx={26} fill={n.id === "fm" ? C.maroon : "#f7f2e8"} stroke="#2a0e19" strokeOpacity={0.3} />
                <text x={n.x} y={n.y - 2} textAnchor="middle" className={cx("text-[14px] font-semibold", n.id === "fm" ? "fill-[#f4eee2]" : "fill-ink")}>{n.label}</text>
                <text x={n.x} y={n.y + 14} textAnchor="middle" className={cx("text-[10.5px]", n.id === "fm" ? "fill-[#f4eee2]/70" : "fill-ink/60")}>{n.sub}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <Paper>
            <h3 className="mb-1 text-[18px] font-semibold" style={{ fontStretch: "112%" }}>SERV makes the calls a person would</h3>
            <p className="mb-4 text-[14px] leading-relaxed text-ink/70">Writing the contract, planning who to call, reading each reply on the phone and auditing every transcript. {s.decisions.length} decisions in this run, {(servMs / 1000).toFixed(0)}s of reasoning in total.</p>
            {s.decisions.slice(0, 5).map((d) => <Row key={d.eventId} k={d.purpose.replace(/_/g, " ")} v={`${(d.ms / 1000).toFixed(1)}s`} />)}
          </Paper>
          <Paper>
            <h3 className="mb-1 text-[18px] font-semibold" style={{ fontStretch: "112%" }}>Settlement you can check</h3>
            <p className="mb-4 text-[14px] leading-relaxed text-ink/70">Testnet pieUSD isn't on the public faucet, so this run pays in fUSD, our own EIP-3009 test token, through a facilitator we run. Switching back to pieUSD is one setting.</p>
            <Row k="Token" v={<a className="text-proof hover:underline" target="_blank" rel="noreferrer" href={`${rec.network.explorer}/address/${rec.network.token?.address}`}>{rec.network.token?.symbol} {short(rec.network.token?.address)}</a>} />
            <Row k="Scheme" v="x402 exact" />
            <Row k="Audit chain" v={rec.audit?.ok ? `${rec.audit.events} events verified` : "—"} mono={false} />
          </Paper>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── guardrails ─────────────────────────
function Guardrails({ run }: { run: NonNullable<ReturnType<typeof useRun>> }) {
  const codes = new Set(run.s.refusals.map((r) => r.code));
  const items: [typeof Hand, string, string, string?][] = [
    [Hand, "Consent first", "Customers who never opted in are skipped before any call.", "no_consent"],
    [MicVocal, "Says it's an AI", "Every call opens with a disclosure, and SERV checks the transcript for it."],
    [Clock, "Quiet hours", "Calls only happen inside the hours in the contract."],
    [PhoneOff, "Easy opt-out", "A customer who says no is never called again."],
    [ShieldCheck, "Can't be talked into things", "A caller who tries to get refunds or cancellations is refused.", "action_not_permitted"],
    [Ban, "Kill switch", "One button stops every payment at once."],
  ];
  return (
    <section className="relative mx-auto max-w-[1180px] px-5 py-24">
      <h2 className="display max-w-[16ch] text-[44px] md:text-[64px]">Rules it can't argue with.</h2>
      <div className="mt-12 grid gap-px overflow-hidden rounded-[22px] border border-ink/15 bg-ink/15 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([Icon, t, b, code]) => (
          <div key={t} className="bg-[#f2ecdf] p-6">
            <Icon size={20} className="text-ember" />
            <h3 className="mt-4 text-[17px] font-semibold" style={{ fontStretch: "112%" }}>{t}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/70">{b}</p>
            {code && codes.has(code) && <p className="mt-3 font-mono text-[11.5px] text-refuse">refused in this run: {code}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── MCP ─────────────────────────
function Mcp() {
  const tools = ["foreman_status", "foreman_compile_goal", "foreman_start", "foreman_job", "foreman_ledger", "foreman_workers", "foreman_refusals", "foreman_decisions", "foreman_audit_verify", "foreman_kill"];
  return (
    <section id="mcp" className="relative overflow-hidden py-24">
      <Orb color={C.ember} size={420} style={{ left: "-12%", bottom: "-20%", opacity: 0.4 }} />
      <div className="relative mx-auto grid max-w-[1180px] gap-10 px-5 md:grid-cols-2">
        <div>
          <h2 className="display text-[44px] md:text-[64px]">Run it from Claude.</h2>
          <p className="mt-5 max-w-[48ch] text-[16px] leading-relaxed text-ink/75">Foreman ships an MCP server. Ask Claude to draft a campaign, check the ledger or hit the kill switch. Approving spend stays a human click in the dashboard.</p>
          <div className="mt-6 flex flex-wrap gap-1.5">{tools.map((t) => <span key={t} className="chip !text-[11px]">{t}</span>)}</div>
        </div>
        <div className="rounded-[22px] bg-ink p-6 font-mono text-[13px] leading-relaxed text-[#f4eee2]/90 shadow-[0_30px_60px_-30px_rgba(42,14,25,.8)]">
          <p className="text-white/45"># add it to Claude Code</p>
          <p>claude mcp add foreman -- bun services/mcp/src/stdio.ts</p>
          <p className="mt-4 text-white/45"># then ask</p>
          <p className="text-[#f2b38f]">"Draft a campaign to rebook yesterday's no-shows under $5"</p>
          <p className="text-[#f2b38f]">"How much has Foreman earned on this contract?"</p>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── footer ─────────────────────────
function Footer() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(p, [0, 1], [80, 0]);
  return (
    <footer ref={ref} className="relative overflow-hidden bg-[#0d0609] px-5 pb-10 pt-24 text-[#f4eee2]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <h2 className="display max-w-[14ch] text-[38px] md:text-[52px]"><span className="silver">Pay for outcomes, not effort.</span></h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Glass href="/app?replay" ink>Watch a real run</Glass>
              <Glass href={REPO} target="_blank" className="!text-[#f4eee2] !bg-white/10 !border-white/25"><Code2 size={16} />Source</Glass>
            </div>
          </div>
        </div>
        <motion.div style={{ y }} className="mt-20 flex items-center gap-4 border-y border-dashed border-white/20 py-6">
          <Mark size={80} className="h-14 w-14 md:h-24 md:w-24" />
          <span className="display silver text-[64px] sm:text-[110px] md:text-[168px]">Foreman</span>
        </motion.div>
        <div className="mt-6 flex flex-wrap justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.06em] text-white/45">
          <span>SERV hackathon 02 · Kite track</span><span>Testnet only · consenting numbers only</span>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  const run = useRun();
  useEffect(() => { document.title = "Foreman · the agent paid only for outcomes"; }, []);
  return (
    <MotionConfig reducedMotion="user">
      <div className="grain min-h-full overflow-x-clip">
        <Nav />
        <Hero run={run} />
        {run ? (
          <>
            <How run={run} />
            <Numbers run={run} />
            <Flow run={run} />
            <Guardrails run={run} />
            <Mcp />
          </>
        ) : <div className="h-[60vh]" />}
        <Footer />
      </div>
    </MotionConfig>
  );
}
