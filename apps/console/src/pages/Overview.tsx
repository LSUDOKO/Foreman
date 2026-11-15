import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowUpRight, CalendarCheck, Phone, Play, Scale, Square } from "lucide-react";
import { Bolt, Coin, Sparks, StarFilled, Tooth } from "../art";
import { useApp } from "../ctx";
import { Feed } from "../feed";
import { api, short, slotLabel, useCountUp, usd } from "../lib";
import { APPOINTMENT_VALUE } from "../state";
import type { Customer } from "../state";
import { Badge, CAPS, cx } from "../ui";

const HATCH = "repeating-linear-gradient(135deg, #0e0e0e 0 2px, #fffdf4 2px 7px)";
const STAGGER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const ITEM: Variants = { hidden: { opacity: 0, y: 18, rotate: -1 }, show: { opacity: 1, y: 0, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 24 } } };
const LIFT = { x: -2, y: -2, boxShadow: "8px 8px 0 #0e0e0e" };
const TILE = "relative min-w-0 overflow-hidden rounded-[6px] border-2 border-ink shadow-[5px_5px_0_#0e0e0e]";
const TAG = "rounded-[3px] border-[1.5px] border-ink bg-surface px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.04em] hover:bg-yellow";

/** Paper dashboard card that staggers in and lifts on hover. */
export function Panel({ title, aside, children, className, pad = true }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <motion.section variants={ITEM} whileHover={LIFT} className={cx(TILE, "bg-surface", pad && "p-5", className)}>
      {title && (
        <header className={cx("mb-4 flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/25 pb-3", !pad && "px-5 pt-4")}>
          <h2 className={CAPS}>{title}</h2>
          {aside}
        </header>
      )}
      {children}
    </motion.section>
  );
}

function Stat({ label, value, fmt, sub, hero, to }: { label: string; value: number; fmt: (n: number) => string; sub: string; hero?: boolean; to: string }) {
  const { go } = useApp();
  const v = useCountUp(value);
  return (
    <motion.div variants={ITEM} whileHover={LIFT} className={cx(TILE, "p-4 sm:p-5", hero ? "bg-pink" : "bg-surface")}>
      {hero && <Bolt className="absolute -bottom-4 -right-3 w-[70px] rotate-12" color="#f7ef1c" />}
      {hero && <Sparks className="absolute bottom-12 right-12 w-7" />}
      <div className="relative flex items-start justify-between gap-2">
        <span className="text-[13px] font-extrabold uppercase leading-tight tracking-[0.05em]">{label}</span>
        <button onClick={() => go(to)} aria-label={`Open ${label}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-ink text-white transition-transform hover:rotate-45">
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="display relative mt-3 text-[38px] tabular-nums sm:text-[52px]">{fmt(v)}</div>
      <div className={cx("relative mt-2 text-[12.5px] font-semibold", hero ? "pr-14 text-ink" : "text-ink/65")}>{sub}</div>
    </motion.div>
  );
}

const ENDED = new Set(["declined", "no_answer", "opted_out", "failed", "skipped", "cancelled"]);
const DONE = new Set(["confirmed", "paid", "attended", "paid_attended"]);
const LABEL: Record<string, [string, "in" | "out" | "neutral" | "refuse" | "accent"]> = {
  paid_attended: ["Attended", "in"], attended: ["Attended", "in"], paid: ["Confirmed", "in"], confirmed: ["Confirmed", "in"],
  declined: ["Declined", "neutral"], no_answer: ["No answer", "out"], skipped: ["No consent", "refuse"], opted_out: ["Opted out", "neutral"], failed: ["Failed", "refuse"],
};
const status = (c: Customer) => LABEL[c.state] ?? ["In progress", "accent"];

const Swatch = ({ bg, label }: { bg: string; label: string }) => (
  <span className="flex items-center gap-1.5"><i className="h-3 w-3 border-[1.5px] border-ink" style={{ background: bg }} />{label}</span>
);

function SpendChart() {
  const { state } = useApp();
  const spend = (id: string) => state.payments.filter((p) => p.direction === "out" && p.customerId === id).reduce((a, p) => a + Number(p.amount), 0);
  const rows = state.customers.map((c) => ({ c, s: spend(c.id) }));
  const max = Math.max(0.5, ...rows.map((r) => r.s));
  const top = rows.reduce((a, r) => (r.s > a.s ? r : a), rows[0] ?? { s: 0 } as any);
  return (
    <Panel title="Cost per customer" aside={<span className="text-[12px] font-semibold text-ink/60">workers + oracle</span>}>
      <div className="flex h-[184px] items-end justify-around gap-2 border-b-2 border-ink sm:gap-3">
        {rows.length === 0 && <p className="self-center text-[13px] font-semibold text-ink/70">No customers yet.</p>}
        {rows.map(({ c, s }) => {
          const h = Math.max(18, (s / max) * 140);
          const fill = DONE.has(c.state) ? (c === top?.c ? "#0e0e0e" : "#ff2ea8") : ENDED.has(c.state) ? HATCH : "#f7ef1c";
          return (
            <div key={c.id} className="flex min-w-0 flex-1 flex-col items-center">
              {s > 0 && <span className="num mb-1 rounded-[3px] border-[1.5px] border-ink bg-surface px-1 text-[10.5px] font-bold">{usd(s)}</span>}
              <motion.div title={`${c.name}: ${usd(s)} spent`} initial={{ height: 0 }} animate={{ height: h }} transition={{ type: "spring", stiffness: 120, damping: 18 }}
                className="w-full max-w-[52px] border-2 border-b-0 border-ink" style={{ background: fill }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-around gap-2 sm:gap-3">
        {rows.map(({ c }) => <span key={c.id} className="min-w-0 flex-1 truncate text-center text-[12px] font-bold">{c.name}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-semibold text-ink/75">
        <Swatch bg="#ff2ea8" label="Rebooked" /><Swatch bg="#0e0e0e" label="Costliest win" /><Swatch bg="#f7ef1c" label="In progress" /><Swatch bg={HATCH} label="Lost" />
      </div>
    </Panel>
  );
}

function NextBooking() {
  const { state, go } = useApp();
  const o = [...state.outcomes].sort((a, b) => a.slot.localeCompare(b.slot))[0];
  return (
    <Panel title="Next rebooked visit">
      <Tooth className="pointer-events-none absolute right-3 top-14 w-[54px] rotate-12" />
      {o ? (
        <>
          <p className="display text-[44px]"><span className="hl">{o.name}</span></p>
          <p className="mt-2 text-[14px] font-bold">{slotLabel(o.slot)}</p>
          <p className="mt-0.5 text-[13px] text-ink/70">{o.state}</p>
          <p className="num mt-1 text-[11.5px] text-faint">booking {short(o.bookingUid, 4)}</p>
          <button onClick={() => go("job")} style={{ "--brut-gap": "#fffdf4" } as React.CSSProperties} className="brut mt-5 w-[calc(100%-6px)] text-[15px]!"><CalendarCheck size={16} />Open job</button>
        </>
      ) : <p className="pr-12 text-[14px] font-semibold text-ink/75">No bookings yet. They appear here as soon as a customer picks a slot.</p>}
    </Panel>
  );
}

function AgentList() {
  const { state, go } = useApp();
  const Icon = (n: string) => (n === "Oracle" ? Scale : Phone);
  return (
    <Panel title="Agents hired" aside={<button onClick={() => go("workers")} className={TAG}>Reputation</button>}>
      <ul className="space-y-3">
        {state.workers.map((w) => {
          const I = Icon(w.name);
          return (
            <li key={w.name} className="flex items-center gap-3">
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border-2 border-ink shadow-[2px_2px_0_#0e0e0e]", w.reputation < 50 ? "bg-refuse text-white" : "bg-yellow text-ink")}><I size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold">{w.name}</div>
                <div className="text-[12px] text-ink/65">{usd(w.price)} per call · {w.pass} passed · {w.fail} failed</div>
              </div>
              <span className={cx("display text-[28px]", w.reputation < 50 ? "text-refuse" : "text-ink")}>{w.reputation}</span>
            </li>
          );
        })}
        {state.workers.length === 0 && <li className="text-[14px] font-semibold text-ink/70">Workers appear when Foreman hires one.</li>}
      </ul>
    </Panel>
  );
}

const AVATAR = [["#ff2ea8", "#0e0e0e"], ["#f7ef1c", "#0e0e0e"], ["#0e0e0e", "#ffffff"], ["#fffdf4", "#0e0e0e"]] as const;

function Customers() {
  const { state, go } = useApp();
  return (
    <Panel title="Customers" aside={<button onClick={() => go("job")} className={TAG}>Full job</button>}>
      <ul className="space-y-3">
        {state.customers.map((c, i) => {
          const [label, tone] = status(c);
          const [bg, fg] = AVATAR[i % AVATAR.length]!;
          return (
            <li key={c.id} className="flex items-center gap-3">
              <span className={cx("display grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink pt-0.5 text-[18px] shadow-[2px_2px_0_#0e0e0e]", i % 2 ? "rotate-3" : "-rotate-3")} style={{ background: bg, color: fg }}>{c.name[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold">{c.name}</div>
                <div className="truncate text-[12px] text-ink/65">{c.slot ? `Rebooked for ${slotLabel(c.slot)}` : c.refusal ? c.refusal.replace(/_/g, " ") : `${c.attempts.length} call${c.attempts.length === 1 ? "" : "s"}`}</div>
              </div>
              <Badge tone={tone}>{label}</Badge>
            </li>
          );
        })}
        {state.customers.length === 0 && <li className="text-[14px] font-semibold text-ink/70">Upload no-shows in Business view to start.</li>}
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
  const arc = "M20 110 A90 90 0 0 1 200 110";
  return (
    <Panel title="Rebooking rate">
      <div className="relative mx-auto w-full max-w-[260px]">
        <svg viewBox="0 0 220 126" className="w-full">
          <defs><pattern id="fm-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fffdf4" /><rect width="2.4" height="7" fill="#0e0e0e" /></pattern></defs>
          <path d={arc} fill="none" stroke="#0e0e0e" strokeWidth="32" strokeLinecap="round" />
          <path d={arc} fill="none" stroke="url(#fm-hatch)" strokeWidth="26" strokeLinecap="round" />
          {done + live > 0 && <motion.path d={arc} fill="none" stroke="#f7ef1c" strokeWidth="26" strokeLinecap="round" strokeDasharray={`${seg(done + live)} ${L}`} initial={false} />}
          {done > 0 && <motion.path d={arc} fill="none" stroke="#ff2ea8" strokeWidth="26" strokeLinecap="round" strokeDasharray={`${seg(done)} ${L}`} initial={false} />}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="display text-[48px]">{pct}%</div>
          <div className="text-[12px] font-semibold text-ink/70">{done} of {eligible.length} consenting customers</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] font-semibold text-ink/75">
        <Swatch bg="#ff2ea8" label="Rebooked" /><Swatch bg="#f7ef1c" label="In progress" /><Swatch bg={HATCH} label="Not rebooked" />
      </div>
    </Panel>
  );
}

function Settlement() {
  const { state, src, live, act } = useApp();
  const real = state.payments.filter((p) => p.link);
  const last = state.payments[state.payments.length - 1];
  return (
    <motion.section variants={ITEM} whileHover={LIFT} className={cx(TILE, "bg-ink p-5 text-white")}>
      <Coin className="pointer-events-none absolute -right-4 top-10 w-[96px] rotate-12" />
      <span className="display absolute right-16 top-[70px] rotate-[-8deg] border-2 border-ink bg-pink px-2 py-0.5 text-[14px] text-ink shadow-[2px_2px_0_#fffdf4]">on-chain</span>
      <div className="relative">
        <div className="flex items-center justify-between"><h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em]">Kite settlement</h2><span className="font-mono text-[10.5px] uppercase tracking-wider text-white/60">chain 2368</span></div>
        <div className="display mt-4 text-[80px] tabular-nums text-yellow">{real.length}</div>
        <div className="text-[13.5px] font-semibold text-white/80">payments settled on Kite testnet</div>
        {last ? (
          <a href={last.link ?? undefined} target="_blank" rel="noreferrer" className="num mt-1 block truncate text-[12px] text-white/65 hover:text-pink">last: {last.direction === "in" ? "+" : "−"}{usd(last.amount)} · {short(last.txHash, 6)}</a>
        ) : <p className="mt-1 text-[12px] text-white/65">No payments yet.</p>}
        <div className="mt-5 flex items-center gap-3">
          <a href={real[0]?.link ?? src.explorer} target="_blank" rel="noreferrer" aria-label="Open on Kitescan" className="grid h-11 w-11 place-items-center rounded-[4px] border-2 border-white bg-yellow text-ink transition-transform hover:-translate-y-0.5"><Play size={17} /></a>
          <button disabled={!live || state.kill.on} onClick={() => act("Kill switch engaged — every action is refused", () => api("POST", "/api/kill"))} aria-label="Kill switch"
            title={live ? "Stop all spending now" : "Disabled in replay"} className="grid h-11 w-11 place-items-center rounded-[4px] border-2 border-white bg-refuse text-white transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-60"><Square size={15} fill="currentColor" /></button>
          <span className="text-[12px] font-semibold text-white/65">Kitescan · kill switch</span>
        </div>
      </div>
    </motion.section>
  );
}

export function Kpis() {
  const { state } = useApp();
  const t = state.totals;
  return (
    <motion.div variants={STAGGER} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Stat hero label="Foreman earned" value={t.earned} fmt={usd} sub="paid by the clinic, only on proof" to="ledger" />
      <Stat label="Spent on agents" value={t.spent} fmt={usd} sub="callers and the proof oracle" to="ledger" />
      <Stat label="Margin" value={t.margin} fmt={usd} sub="earned minus spent" to="ledger" />
      <Stat label="Recovered for clinic" value={t.recovered} fmt={(n) => usd(Math.round(n))} sub={`${t.confirmed} visits at $${APPOINTMENT_VALUE}, assumed`} to="business" />
    </motion.div>
  );
}

export default function Overview() {
  const { state, now, open } = useApp();
  return (
    <div className="space-y-5">
      <Kpis />
      <motion.div variants={STAGGER} initial="hidden" animate="show" className="grid gap-5 lg:grid-cols-[1.35fr_1fr_1fr]">
        <SpendChart />
        <NextBooking />
        <AgentList />
      </motion.div>
      <motion.div variants={STAGGER} initial="hidden" animate="show" className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Customers />
        <Gauge />
        <Settlement />
      </motion.div>
      <motion.div variants={STAGGER} initial="hidden" animate="show">
        <Panel title={<span className="flex items-center gap-2"><StarFilled className="w-4" color="#ff2ea8" />Live feed</span>} aside={<span className="num text-[12px] font-semibold text-ink/60">{state.events.length} events</span>} pad={false}>
          <Feed events={state.events} onOpen={open} now={now} />
        </Panel>
      </motion.div>
    </div>
  );
}
