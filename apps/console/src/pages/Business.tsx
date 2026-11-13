import { CheckCheck, FileUp, Sparkles } from "lucide-react";
import { useState } from "react";
import { useApp } from "../ctx";
import { api, slotLabel, usd } from "../lib";
import { Badge, Button, Card, Empty, TxRef } from "../ui";

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
          <span className="text-[12px] text-muted">Your goal, in plain English</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} className="mt-1 w-full resize-y rounded-md border border-line bg-bg p-3 text-[13px] outline-none focus:border-in" />
        </label>
        <label className="block">
          <span className="flex items-center justify-between text-[12px] text-muted">
            Yesterday's no-shows (CSV)
            <span className="flex items-center gap-1 text-faint"><FileUp size={12} />
              <input type="file" accept=".csv,text/csv" aria-label="Upload CSV" className="w-[180px] text-[11px] file:mr-2 file:rounded file:border file:border-line file:bg-raised file:px-2 file:text-ink"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
            </span>
          </span>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} spellCheck={false} className="mt-1 w-full resize-y rounded-md border border-line bg-bg p-3 font-mono text-[11.5px] outline-none focus:border-in" />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" tone="in" disabled={!live || busy}><Sparkles size={14} />{busy ? "SERV is compiling…" : "Compile contract"}</Button>
          <span className="text-[12px] text-faint">You pay $4 per confirmed rebooking and $2 when they show up. Nothing for effort.</span>
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
          ["Appointments recovered", usd(state.totals.recovered), "text-in"],
          ["You paid Foreman", usd(state.totals.earned), "text-ink"],
          ["Paid for effort", usd(0), "text-muted"],
        ].map(([l, v, t]) => (
          <div key={l} className="rounded-lg border border-in/25 bg-surface px-4 py-3">
            <div className="text-[12px] text-muted">{l}</div>
            <div className={`num mt-1 text-[22px] ${t}`}>{v}</div>
          </div>
        ))}
      </div>
      <Card title={<span className="text-in">Rebooked patients</span>} pad={false}>
        {outcomes.length === 0 ? (
          <Empty>No rebookings yet. You'll see each one here once the customer confirms from their inbox.</Empty>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-left text-[12px] text-muted"><tr className="border-b border-line">
              <th className="px-4 py-2 font-normal">Patient</th><th className="px-4 py-2 font-normal">New slot</th><th className="px-4 py-2 font-normal">Status</th>
              <th className="px-4 py-2 font-normal">Invoices</th><th className="px-4 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {outcomes.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">{o.name}</td>
                  <td className="px-4 py-3 text-muted">{slotLabel(o.slot)}</td>
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
                    {o.attendedAt && <span className="text-[12px] text-in">attended</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-[12px] text-faint">Your payment agent pays an invoice only after the proof oracle checks the calendar booking and the patient's own confirmation click. {paidIn.length} invoice{paidIn.length === 1 ? "" : "s"} paid.</p>
    </div>
  );
}
