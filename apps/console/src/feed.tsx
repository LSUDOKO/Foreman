import { motion } from "framer-motion";
import {
  Ban, BadgeCheck, Bot, CalendarCheck, CalendarX, CircleDollarSign, FileSignature, Gavel, Hand, Mail, Phone, PhoneCall,
  PhoneOff, Play, Power, Scale, ShieldAlert, Star, TrendingDown, TrendingUp, UserCheck, UserX, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { human, slotLabel, usd } from "./lib";
import type { FeedEvent, State } from "./state";
import { Badge, Code, Empty, Json, TBODY, Time, TxRef, cx } from "./ui";
import type { Tone } from "./ui";

interface Desc { icon: LucideIcon; tone: Tone; text: React.ReactNode; money?: "in" | "out" }

const STEP_TEXT: Record<string, string> = {
  planned: "planned", calling: "being called", call_verified: "call verified", booked: "booked", confirmation_sent: "confirmation email sent",
  confirmed: "confirmed", paid: "paid", attended: "attended", paid_attended: "fully paid", declined: "declined", no_answer: "didn't answer",
  opted_out: "opted out", failed: "failed", cancelled: "hold released", skipped: "skipped",
};

export function describe(e: FeedEvent): Desc | null {
  const d = e.data ?? {};
  switch (e.type) {
    case "contract_compiled": return { icon: FileSignature, tone: "accent", text: <>SERV compiled the goal into contract <span className="font-mono">{d.contract?.id}</span></> };
    case "contract_approved": return { icon: BadgeCheck, tone: "in", text: <>Contract approved by {d.by}</> };
    case "contract_started": return { icon: Play, tone: "accent", text: <>Job started · budget {usd(d.budget)}</> };
    case "contract_completed": return { icon: Workflow, tone: "neutral", text: <>Calling finished · spent {usd(d.spent)}</> };
    case "customer_skipped": return { icon: UserX, tone: "refuse", text: <>{d.name} skipped <Code code={d.code} /> · {usd(d.cost ?? 0)} spent</> };
    case "serv_decision": return { icon: Bot, tone: "accent", text: <>SERV {human(d.purpose)}{d.decision?.intent ? <>: <span className="font-mono">{d.decision.intent}</span></> : d.decision?.worker ? <>: hire {d.decision.worker}</> : null}{d.source === "fallback" && <Badge className="ml-1.5">fallback</Badge>}</> };
    case "worker_hired": return { icon: Hand, tone: "accent", text: <>Hired {d.worker} for {d.name}{d.probation && <Badge tone="out" className="ml-1.5">probation</Badge>}</> };
    case "payment_out": return { icon: CircleDollarSign, tone: "out", money: "out", text: <><span className="num text-out">−{usd(d.amount)}</span> to {d.to} · {human(d.purpose)}</> };
    case "payment_in": return { icon: CircleDollarSign, tone: "in", money: "in", text: <><span className="num text-in">+{usd(d.amount)}</span> from {d.from} · {human(d.purpose)}</> };
    case "call_started": return { icon: PhoneCall, tone: "neutral", text: <>{e.actor} is calling {d.name} <span className="font-mono text-faint">{d.to}</span></> };
    case "call_reported": return { icon: Phone, tone: d.outcome === "accepted" ? "proof" : "neutral", text: <>{e.actor} reports <span className="font-mono">{d.outcome}</span>{d.slot && <> · {slotLabel(d.slot)}</>} <Badge>claim</Badge></> };
    case "oracle_verdict": return { icon: Scale, tone: d.verdict === "PASS" ? "proof" : "refuse", text: <>Oracle {d.verdict === "PASS" ? <Badge tone="proof" mono>PASS</Badge> : <Badge tone="refuse" mono>FAIL {d.code}</Badge>} for {d.worker}'s call</> };
    case "transcript_audited": return { icon: Star, tone: d.flagged ? "out" : "neutral", text: <>Transcript audited · quality <span className="num">{Number(d.quality).toFixed(2)}</span>{d.flagged && <Badge tone="out" className="ml-1.5">review</Badge>}</> };
    case "reputation_changed": return { icon: d.delta >= 0 ? TrendingUp : TrendingDown, tone: d.delta >= 0 ? "in" : "refuse", text: <>{d.worker} reputation <span className="num">{d.from} → {d.to}</span></> };
    case "booking_created": return { icon: CalendarCheck, tone: "proof", text: <>Booked {d.name} · {slotLabel(d.slot)}</> };
    case "booking_cancelled": return { icon: CalendarX, tone: "neutral", text: <>Hold released{d.reason ? ` · ${d.reason}` : ""}</> };
    case "confirmation_sent": return { icon: Mail, tone: "neutral", text: <>Confirmation sent to {d.to}</> };
    case "customer_confirmed": return { icon: UserCheck, tone: "in", text: <>{d.name} confirmed {slotLabel(d.slot)}</> };
    case "customer_declined": return { icon: PhoneOff, tone: "neutral", text: <>{d.name} declined from the link</> };
    case "attended_attested": return { icon: BadgeCheck, tone: "in", text: <>{d.name} attended · signed by the business</> };
    case "refusal": return { icon: d.code === "proof_failed" ? Gavel : ShieldAlert, tone: "refuse", text: <><Code code={d.code} /> <span className="text-muted">{human(d.action ?? "")}</span>{d.evidence?.subCode && <span className="font-mono text-faint"> · {d.evidence.subCode}</span>}</> };
    case "kill_switch": return { icon: d.on ? Ban : Power, tone: d.on ? "refuse" : "in", text: <>Kill switch {d.on ? "engaged" : "released"}</> };
    case "customer_state": {
      const t = STEP_TEXT[d.state];
      return t ? { icon: UserCheck, tone: "neutral", text: <>{d.name} {t}</> } : null;
    }
    default: return { icon: Workflow, tone: "neutral", text: human(e.type) };
  }
}

const TONE_ICON: Record<Tone, string> = {
  neutral: "text-muted", accent: "text-accent", in: "text-in", out: "text-out", refuse: "text-refuse", proof: "text-proof",
};

/** The live feed. Newest on top; money rows flash their colour once; customer_state rows are hidden as noise. */
export function Feed({ events, onOpen, now, limit = 120 }: { events: FeedEvent[]; onOpen: (e: FeedEvent) => void; now: number; limit?: number }) {
  const rows = events.filter((e) => e.type !== "customer_state").slice(-limit).reverse();
  if (!rows.length) return <Empty>Nothing yet. Compile and start a contract and every step lands here.</Empty>;
  return (
    <ol className={TBODY}>
      {rows.map((e) => {
        const d = describe(e);
        if (!d) return null;
        const Icon = d.icon;
        return (
          <motion.li key={e.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
            <button onClick={() => onOpen(e)} className={cx("grid w-full grid-cols-[64px_20px_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2 text-left hover:bg-yellow/40", d.money === "in" && "flash-in", d.money === "out" && "flash-out")}>
              <span className="num text-[11.5px] font-semibold text-ink/55" title={new Date(e.ts).toISOString()}>{new Date(e.ts).toLocaleTimeString(undefined, { hour12: false })}</span>
              <Icon size={14} className={TONE_ICON[d.tone]} aria-hidden />
              <span className="min-w-0 truncate text-[13.5px] font-medium">{d.text}</span>
              <span className="hidden items-center gap-2 sm:flex">
                {e.data?.txHash && <TxRef tx={e.data.txHash} link={e.data.link} />}
                <span className="hidden text-[11px] text-faint md:inline">{e.actor}</span>
                <Time ts={e.ts} now={now} />
              </span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

function Transcript({ lines }: { lines: { who: string; text: string }[] }) {
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className={cx("rounded-[10px] border-2 border-ink px-3 py-2 text-[13.5px]", l.who === "agent" ? "mr-8 bg-ink text-white" : "ml-8 bg-surface")}>
          <div className={cx("mb-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em]", l.who === "agent" ? "text-pink" : "text-accent")}>{l.who === "agent" ? "AI assistant" : "Customer"}</div>
          {l.text}
        </div>
      ))}
    </div>
  );
}

function Checks({ checks }: { checks: { name: string; pass: boolean; evidence: string }[] }) {
  return (
    <table className="w-full text-[12.5px]">
      <tbody className={TBODY}>
        {checks.map((c) => (
          <tr key={c.name}>
            <td className="py-1.5 pr-3 align-top">{c.pass ? <Badge tone="proof" mono>pass</Badge> : <Badge tone="refuse" mono>fail</Badge>}</td>
            <td className="py-1.5 pr-3 align-top font-mono text-[12px]">{c.name}</td>
            <td className="break-all py-1.5 align-top text-ink/70">{c.evidence}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5"><h4 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-accent">{title}</h4>{children}</div>
);

/** Everything known about one event, joined with its attempt when it has one. */
export function EventDetail({ e, state }: { e: FeedEvent; state: State }) {
  const d = e.data ?? {};
  const a = d.attemptId ? state.attempts[d.attemptId] : undefined;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink/70">
        <Badge mono>{e.type}</Badge><span>by {e.actor}</span><Time ts={e.ts} />
      </div>
      {d.summary && <Section title="Plain English"><p className="text-[13px] leading-relaxed">{d.summary}</p></Section>}
      {d.reason && <Section title="Reason"><p>{d.reason}</p></Section>}
      {d.txHash && <Section title="Settlement"><TxRef tx={d.txHash} link={d.link} /></Section>}
      {(d.transcript ?? a?.claim?.transcript) && <Section title={e.type === "call_reported" ? "Worker's claimed transcript" : "Transcript"}><Transcript lines={d.transcript ?? a!.claim.transcript} /></Section>}
      {(d.checks ?? a?.verdict?.checks) && (
        <Section title="Oracle checks (carrier record)">
          <Checks checks={d.checks ?? a!.verdict.checks} />
          {(d.signature ?? a?.verdict?.signature) && (
            <p className="mt-2 break-all font-mono text-[11px] text-faint">
              signature {(d.signature ?? a!.verdict.signature)} · {(d.signatureValid ?? a?.verdict?.signatureValid) ? "verified against the oracle signer" : "not verified"}
            </p>
          )}
        </Section>
      )}
      {e.type === "refusal" && d.evidence?.excerpt && <Section title="What the caller said"><blockquote className="border-l-4 border-refuse pl-3 italic">“{d.evidence.excerpt}”</blockquote></Section>}
      {e.type === "refusal" && <Section title="Contract clause"><span className="font-mono">{d.clause}</span></Section>}
      {e.type === "serv_decision" && (
        <Section title="SERV">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge mono>{d.model}</Badge>{d.effort && <Badge mono>effort {d.effort}</Badge>}<Badge mono>{d.ms} ms</Badge>
            {(d.guards ?? []).map((g: string) => <Badge key={g} tone="accent" mono>{g}</Badge>)}
            <Badge tone={d.source === "live" ? "in" : "out"}>{d.source}</Badge>
          </div>
          {d.error && <p className="mb-2 text-[12px] text-out">Fallback reason: {String(d.error).slice(0, 300)}</p>}
        </Section>
      )}
      <Section title="Event data"><Json value={d} /></Section>
      <p className="break-all font-mono text-[11px] text-faint">#{e.id} · hash {e.hash}<br />prev {e.prevHash}</p>
    </div>
  );
}
