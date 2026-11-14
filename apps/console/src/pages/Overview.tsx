import { motion } from "framer-motion";
import { ArrowUpRight, CalendarCheck, Download, Phone, Play, Scale, Square } from "lucide-react";
import { useApp } from "../ctx";
import { Feed } from "../feed";
import { api, short, slotLabel, useCountUp, usd } from "../lib";
import { APPOINTMENT_VALUE } from "../state";
import type { Customer } from "../state";
import { Badge, cx } from "../ui";

const HATCH = "repeating-linear-gradient(135deg, rgba(42,14,25,.32) 0 2px, transparent 2px 7px)";

/** Rounded dashboard card. */
export function Panel({ title, aside, children, className, pad = true }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("min-w-0 rounded-[22px] bg-surface shadow-[0_1px_0_rgba(255,255,255,.8)_inset,0_10px_30px_-24px_rgba(90,21,48,.45)]", pad && "p-5", className)}>
      {title && (
        <header className={cx("mb-4 flex items-center justify-between gap-3", !pad && "px-5 pt-5")}>
          <h2 className="text-[16px] font-semibold tracking-tight" style={{ fontStretch: "108%" }}>{title}</h2>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

function Stat({ label, value, fmt, sub, hero, to }: { label: string; value: number; fmt: (n: number) => string; sub: string; hero?: boolean; to: string }) {
  const { go } = useApp();
  const v = useCountUp(value);
  return (
    <div className={cx("relative overflow-hidden rounded-[22px] p-5", hero ? "text-[#f6efe2]" : "bg-surface shadow-[0_10px_30px_-24px_rgba(90,21,48,.45)]")}
      style={hero ? { background: "radial-gradient(120% 140% at 100% 100%, #c8481a 0%, #7a2742 38%, #3a0c20 80%)" } : undefined}>
      {hero && <div className="orb" style={{ width: 180, height: 180, right: -50, top: -60, ["--c" as any]: "#d49a28", opacity: 0.55 }} />}
      <div className="relative flex items-start justify-between">
        <span className="text-[14.5px] font-medium">{label}</span>
        <button onClick={() => go(to)} aria-label={`Open ${label}`} className={cx("grid h-8 w-8 place-items-center rounded-full border transition-transform hover:rotate-45", hero ? "border-white/40 bg-white/15" : "border-ink/25 bg-surface")}>
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="display relative mt-3 text-[40px] tabular-nums">{fmt(v)}</div>
      <div className={cx("relative mt-2 text-[12px]", hero ? "text-white/75" : "text-muted")}>{sub}</div>
    </div>
  );
}

const ENDED = new Set(["declined", "no_answer", "opted_out", "failed", "skipped", "cancelled"]);
const DONE = new Set(["confirmed", "paid", "attended", "paid_attended"]);
const LABEL: Record<string, [string, "in" | "out" | "neutral" | "refuse" | "accent"]> = {
  paid_attended: ["Attended", "in"], attended: ["Attended", "in"], paid: ["Confirmed", "in"], confirmed: ["Confirmed", "in"],
  declined: ["Declined", "neutral"], no_answer: ["No answer", "out"], skipped: ["No consent", "refuse"], opted_out: ["Opted out", "neutral"], failed: ["Failed", "refuse"],
};
const status = (c: Customer) => LABEL[c.state] ?? ["In progress", "accent"];

function SpendChart() {
  const { state } = useApp();
  const spend = (id: string) => state.payments.filter((p) => p.direction === "out" && p.customerId === id).reduce((a, p) => a + Number(p.amount), 0);
  const rows = state.customers.map((c) => ({ c, s: spend(c.id) }));
  const max = Math.max(0.5, ...rows.map((r) => r.s));
  const top = rows.reduce((a, r) => (r.s > a.s ? r : a), rows[0] ?? { s: 0 } as any);
  return (
    <Panel title="Cost per customer" aside={<span className="text-[12px] text-muted">workers + oracle</span>}>
      <div className="flex h-[176px] items-end justify-around gap-3">
        {rows.length === 0 && <p className="self-center text-[13px] text-muted">No customers yet.</p>}
        {rows.map(({ c, s }) => {
          const h = Math.max(18, (s / max) * 150);
          const fill = DONE.has(c.state) ? (c === top?.c ? "linear-gradient(180deg,#6e1e3e,#3a0c20)" : "linear-gradient(180deg,#a8452c,#5a1530)") : ENDED.has(c.state) ? HATCH : "linear-gradient(180deg,#e2672f,#c8481a)";
          return (
            <div key={c.id} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full max-w-[48px] flex-col items-center">
                {s > 0 && <span className="num mb-1 rounded-full border border-ink/15 bg-bg px-1.5 text-[10.5px]">{usd(s)}</span>}
                <motion.div title={`${c.name}: ${usd(s)} spent`} initial={{ height: 0 }} animate={{ height: h }} transition={{ type: "spring", stiffness: 120, damping: 18 }}
                  className="w-full rounded-full border border-ink/10" style={{ background: fill }} />
              </div>
              <span className="text-[12px] text-muted">{c.name}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function NextBooking() {
  const { state, go } = useApp();
  const o = [...state.outcomes].sort((a, b) => a.slot.localeCompare(b.slot))[0];
  return (
    <Panel title="Next rebooked visit">
      {o ? (
        <>
          <p className="display text-[26px] leading-tight text-accent">{o.name}</p>
          <p className="mt-1.5 text-[13px] text-muted">{slotLabel(o.slot)} · {o.state}</p>
          <p className="num mt-1 text-[11.5px] text-faint">booking {short(o.bookingUid, 4)}</p>
          <button onClick={() => go("job")} className="glass glass-ink mt-5 w-full !py-3 text-[14px]"><CalendarCheck size={16} />Open job</button>
        </>
      ) : <p className="text-[13px] text-muted">No bookings yet. They appear here as soon as a customer picks a slot.</p>}
    </Panel>
  );
}

function AgentList() {
  const { state, go } = useApp();
  const Icon = (n: string) => (n === "Oracle" ? Scale : Phone);
  return (
    <Panel title="Agents hired" aside={<button onClick={() => go("workers")} className="chip !text-[11px] hover:bg-ink/5">Reputation</button>}>
      <ul className="space-y-3.5">
        {state.workers.map((w) => {
          const I = Icon(w.name);
          return (
            <li key={w.name} className="flex items-center gap-3">
              <span className={cx("grid h-9 w-9 place-items-center rounded-xl", w.reputation < 50 ? "bg-refuse/10 text-refuse" : "bg-accent/10 text-accent")}><I size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{w.name}</div>
                <div className="text-[11.5px] text-muted">{usd(w.price)} per call · {w.pass} passed · {w.fail} failed</div>
              </div>
              <span className={cx("num text-[15px]", w.reputation < 50 ? "text-refuse" : "text-ink")}>{w.reputation}</span>
            </li>
          );
        })}
        {state.workers.length === 0 && <li className="text-[13px] text-muted">Workers appear when Foreman hires one.</li>}
      </ul>
    </Panel>
  );
}

function Customers() {
  const { state, go } = useApp();
  const tint = ["#c8481a", "#5a1530", "#d49a28", "#7a2742", "#2c6a3a"];
  return (
    <Panel title="Customers" aside={<button onClick={() => go("job")} className="chip !text-[11px] hover:bg-ink/5">Full job</button>}>
      <ul className="space-y-3">
        {state.customers.map((c, i) => {
          const [label, tone] = status(c);
          return (
            <li key={c.id} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white" style={{ background: tint[i % tint.length] }}>{c.name[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{c.name}</div>
                <div className="truncate text-[11.5px] text-muted">{c.slot ? `Rebooked for ${slotLabel(c.slot)}` : c.refusal ? c.refusal.replace(/_/g, " ") : `${c.attempts.length} call${c.attempts.length === 1 ? "" : "s"}`}</div>
              </div>
              <Badge tone={tone}>{label}</Badge>
            </li>
          );
        })}
        {state.customers.length === 0 && <li className="text-[13px] text-muted">Upload no-shows in Business view to start.</li>}
      </ul>
    </Panel>
  );
}

function Gauge() {
  const { state } = useApp();
  const eligible = state.customers.filter((c) => c.state !== "skipped");
  const done = eligible.filter((c) => DONE.has(c.state)).length;
  const lost = eligible.filter((c) => ENDED.has(c.state)).length;
  const live = eligible.length - done - lost;
  const pct = eligible.length ? Math.round((done / eligible.length) * 100) : 0;
  const R = 90, L = Math.PI * R;
  const seg = (n: number) => (eligible.length ? (n / eligible.length) * L : 0);
  return (
    <Panel title="Rebooking rate">
      <div className="relative mx-auto w-full max-w-[260px]">
        <svg viewBox="0 0 220 124" className="w-full">
          <defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="7" fill="rgba(42,14,25,.35)" /></pattern></defs>
          <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="url(#hatch)" strokeWidth="26" strokeLinecap="round" />
          <motion.path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="#c8481a" strokeWidth="26" strokeLinecap="round" strokeDasharray={`${seg(done + live)} ${L}`} initial={false} />
          <motion.path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="#5a1530" strokeWidth="26" strokeLinecap="round" strokeDasharray={`${seg(done)} ${L}`} initial={false} />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="display text-[38px]">{pct}%</div>
          <div className="text-[11.5px] text-muted">{done} of {eligible.length} consenting customers</div>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-accent" />Rebooked</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ember" />In progress</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: HATCH }} />Not rebooked</span>
      </div>
    </Panel>
  );
}

function Settlement() {
  const { state, src, live, act } = useApp();
  const real = state.payments.filter((p) => p.link);
  const last = state.payments[state.payments.length - 1];
  return (
    <section className="relative overflow-hidden rounded-[22px] bg-[#1c0811] p-5 text-[#f4eee2]">
      <div className="orb" style={{ width: 260, height: 260, right: -80, bottom: -110, ["--c" as any]: "#c8481a", opacity: 0.7 }} />
      <div className="orb" style={{ width: 200, height: 200, left: -70, top: -90, ["--c" as any]: "#7a2742", opacity: 0.8 }} />
      <div className="relative">
        <div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold">Kite settlement</h2><span className="font-mono text-[10.5px] uppercase tracking-wider text-white/55">chain 2368</span></div>
        <div className="display mt-4 text-[48px] tabular-nums">{real.length}</div>
        <div className="text-[13px] text-white/70">payments settled on Kite testnet</div>
        {last ? (
          <a href={last.link ?? undefined} target="_blank" rel="noreferrer" className="num mt-1 block truncate text-[12px] text-white/60 hover:text-white">last: {last.direction === "in" ? "+" : "−"}{usd(last.amount)} · {short(last.txHash, 6)}</a>
        ) : <p className="mt-1 text-[12px] text-white/60">No payments yet.</p>}
        <div className="mt-5 flex items-center gap-3">
          <a href={real[0]?.link ?? src.explorer} target="_blank" rel="noreferrer" aria-label="Open on Kitescan" className="grid h-11 w-11 place-items-center rounded-full bg-[#f4eee2] text-ink transition-transform hover:scale-105"><Play size={17} /></a>
          <button disabled={!live || state.kill.on} onClick={() => act("Kill switch engaged — every action is refused", () => api("POST", "/api/kill"))} aria-label="Kill switch"
            title={live ? "Stop all spending now" : "Disabled in replay"} className="grid h-11 w-11 place-items-center rounded-full bg-refuse text-white transition-transform enabled:hover:scale-105 disabled:opacity-60"><Square size={15} fill="currentColor" /></button>
          <span className="text-[12px] text-white/60">Kitescan · kill switch</span>
        </div>
      </div>
    </section>
  );
}

export function Kpis() {
  const { state } = useApp();
  const t = state.totals;
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Stat hero label="Foreman earned" value={t.earned} fmt={usd} sub="paid by the clinic, only on proof" to="ledger" />
      <Stat label="Spent on agents" value={t.spent} fmt={usd} sub="callers and the proof oracle" to="ledger" />
      <Stat label="Margin" value={t.margin} fmt={usd} sub="earned minus spent" to="ledger" />
      <Stat label="Recovered for clinic" value={t.recovered} fmt={(n) => usd(Math.round(n))} sub={`${t.confirmed} visits at $${APPOINTMENT_VALUE}, assumed`} to="business" />
    </div>
  );
}

export default function Overview() {
  const { state, now, open, go } = useApp();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[34px] md:text-[40px]">Dashboard</h1>
          <p className="mt-1 text-[13.5px] text-muted">Rebook no-shows and get paid only when the booking is proven.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => go("business")} className="glass glass-ink !py-2.5 text-[14px]"><Play size={15} />New run</button>
          <button onClick={() => go("ledger")} className="glass !py-2.5 text-[14px]"><Download size={15} />Ledger</button>
        </div>
      </div>
      <Kpis />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr_1fr]">
        <SpendChart />
        <NextBooking />
        <AgentList />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Customers />
        <Gauge />
        <Settlement />
      </div>
      <Panel title="Live feed" aside={<span className="num text-[12px] text-muted">{state.events.length} events</span>} pad={false}>
        <Feed events={state.events} onOpen={open} now={now} />
      </Panel>
    </div>
  );
}
