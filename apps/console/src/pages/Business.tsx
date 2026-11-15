import { CheckCheck, FileUp, Sparkles } from "lucide-react";
import { useState } from "react";
import { useApp } from "../ctx";
import { api, slotLabel, usd } from "../lib";
import { Badge, Button, Card, Empty, TBODY, THEAD, TxRef } from "../ui";

const DEMO_GOAL =
  "Call yesterday's no-shows from the CSV and rebook them into free check-up slots this week. Don't spend more than $5 on calls. Only call people who opted in. Calls between 9 AM and 9 PM.";
const DEMO_CSV = `id,name,phone,email,missed_at,consent_source,demo_role
c1,Asha,+919800000001,asha@example.com,2026-11-13T09:30:00+05:30,booking form opt-in 2026-10-02,you: accept slot 1
c2,Meera,+919800000002,meera@example.com,2026-11-13T11:00:00+05:30,booking form opt-in 2026-09-18,friend: accept slot 2 (QuickDial lies first)
c3,Rahul,+919800000003,rahul@example.com,2026-11-13T12:30:00+05:30,booking form opt-in 2026-10-11,friend: social-engineering attack then decline
c4,Dev,+919800000004,dev@example.com,2026-11-13T15:00:00+05:30,,no consent → skipped
c5,Kiran,+919800000005,kiran@example.com,2026-11-13T16:30:00+05:30,booking form opt-in 2026-08-30,your 2nd number: don't answer`;

function Compile() {
  const { live, act, go } = useApp();
  const [goal, setGoal] = useState(DEMO_GOAL);
  const [csv, setCsv] = useState(DEMO_CSV);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Give Foreman a job">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void act("Contract compiled — review and approve it", async () => { await api("POST", "/api/contracts/compile", { goal, csv }); go("contract"); }).finally(() => setBusy(false));
        }}
      >
        <label className="block">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.05em]">Your goal, in plain English</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} className="mt-1.5 w-full resize-y rounded-[4px] border-2 border-ink bg-surface p-3 text-[14px] font-medium outline-none focus:shadow-[4px_4px_0_#ff2ea8]" />
        </label>
        <label className="block">
          <span className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-extrabold uppercase tracking-[0.05em]">
            Yesterday's no-shows (CSV)
            <span className="flex items-center gap-1.5 normal-case tracking-normal"><FileUp size={14} />
              <input type="file" accept=".csv,text/csv" aria-label="Upload CSV" className="w-[200px] text-[11.5px] font-semibold file:mr-2 file:cursor-pointer file:rounded-[3px] file:border-2 file:border-ink file:bg-yellow file:px-2 file:py-0.5 file:font-bold file:text-ink hover:file:bg-pink"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
            </span>
          </span>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} spellCheck={false} className="mt-1.5 w-full resize-y rounded-[4px] border-2 border-ink bg-raised p-3 font-mono text-[11.5px] outline-none focus:shadow-[4px_4px_0_#ff2ea8]" />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" tone="pink" disabled={!live || busy}><Sparkles size={14} />{busy ? "SERV is compiling…" : "Compile contract"}</Button>
          <span className="text-[12.5px] font-semibold text-ink/65">You pay $4 per confirmed rebooking and $2 when they show up. Nothing for effort.</span>
        </div>
      </form>
    </Card>
  );
}

export default function Business() {
  const { state, live, act } = useApp();
  if (!state.contract) return <Compile />;
  const outcomes = state.outcomes;
  const paidIn = state.payments.filter((p) => p.direction === "in");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Appointments recovered", usd(state.totals.recovered), "bg-pink"],
          ["You paid Foreman", usd(state.totals.earned), "bg-surface"],
          ["Paid for effort", usd(0), "bg-yellow"],
        ].map(([l, v, t]) => (
          <div key={l} className={`rounded-[6px] border-2 border-ink px-5 py-4 shadow-[5px_5px_0_#0e0e0e] ${t}`}>
            <div className="text-[12px] font-extrabold uppercase tracking-[0.05em]">{l}</div>
            <div className="display mt-1 text-[44px]">{v}</div>
          </div>
        ))}
      </div>
      <Card title="Rebooked patients" pad={false}>
        {outcomes.length === 0 ? (
          <Empty>No rebookings yet. You'll see each one here once the customer confirms from their inbox.</Empty>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]">
            <thead className={THEAD}><tr>
              <th className="px-4 py-2 font-extrabold">Patient</th><th className="px-4 py-2 font-extrabold">New slot</th><th className="px-4 py-2 font-extrabold">Status</th>
              <th className="px-4 py-2 font-extrabold">Invoices</th><th className="px-4 py-2" />
            </tr></thead>
            <tbody className={TBODY}>
              {outcomes.map((o) => (
                <tr key={o.id} className="even:bg-raised/50">
                  <td className="px-4 py-3 font-extrabold">{o.name}</td>
                  <td className="px-4 py-3 text-ink/70">{slotLabel(o.slot)}</td>
                  <td className="px-4 py-3"><Badge tone={o.state === "cancelled" ? "neutral" : o.confirmedAt ? "in" : "out"}>{o.state === "confirmation_sent" ? "awaiting confirmation" : o.state}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-[12px]">
                      {o.paidConfirmed && <span className="flex items-center gap-2"><span className="num text-in">{usd(o.paidConfirmed.amount)}</span><TxRef tx={o.paidConfirmed.txHash} link={o.paidConfirmed.link} /></span>}
                      {o.paidAttended && <span className="flex items-center gap-2"><span className="num text-in">{usd(o.paidAttended.amount)}</span><TxRef tx={o.paidAttended.txHash} link={o.paidAttended.link} /></span>}
                      {!o.paidConfirmed && !o.paidAttended && <span className="text-faint">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.paidConfirmed && !o.attendedAt && (
                      <Button tone="in" disabled={!live} onClick={() => act(`${o.name} marked attended — your payment agent will verify and pay $2`, () => api("POST", `/api/outcomes/${o.id}/attended`))}>
                        <CheckCheck size={14} />Mark attended
                      </Button>
                    )}
                    {o.attendedAt && <Badge tone="in">attended</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      <p className="text-[12.5px] font-semibold text-ink/70">Your payment agent pays an invoice only after the proof oracle checks the calendar booking and the patient's own confirmation click. {paidIn.length} invoice{paidIn.length === 1 ? "" : "s"} paid.</p>
    </div>
  );
}
