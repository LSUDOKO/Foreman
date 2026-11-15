import { useState } from "react";
import { useApp } from "../ctx";
import { human } from "../lib";
import { Badge, Card, Code, Empty, TBODY, THEAD, Time, cx } from "../ui";

export default function Safety() {
  const { state, now, open } = useApp();
  const [filter, setFilter] = useState<string | null>(null);
  const codes = [...new Set(state.refusals.map((r) => r.code))];
  const rows = state.refusals.filter((r) => !filter || r.code === filter).slice().reverse();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card title="Typed refusals" aside={<Badge tone="refuse" mono>{state.refusals.length}</Badge>} pad={false}>
          {codes.length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b-2 border-dashed border-ink/25 px-4 py-2.5" role="group" aria-label="Filter by code">
              <button onClick={() => setFilter(null)} className={cx("rounded-[3px] border-[1.5px] border-ink px-2 py-0.5 text-[12px] font-bold", !filter ? "bg-ink text-white" : "bg-surface hover:bg-yellow")}>All</button>
              {codes.map((c) => (
                <button key={c} onClick={() => setFilter(c === filter ? null : c)} aria-pressed={c === filter}
                  className={cx("rounded-[3px] border-[1.5px] border-ink px-2 py-0.5 font-mono text-[11.5px] font-bold", c === filter ? "bg-refuse text-white" : "bg-surface hover:bg-yellow")}>
                  {c} <span className="opacity-60">{state.refusals.filter((r) => r.code === c).length}</span>
                </button>
              ))}
            </div>
          )}
          {rows.length === 0 ? (
            <Empty>No refusals yet — the firewall hasn't had to say no.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className={THEAD}>
                  <tr>
                    <th className="px-4 py-2 font-extrabold">When</th><th className="px-4 py-2 font-extrabold">Code</th><th className="px-4 py-2 font-extrabold">Requested</th>
                    <th className="px-4 py-2 font-extrabold">Evidence</th><th className="px-4 py-2 font-extrabold">Blocked by</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {rows.map((r) => {
                    const ev = r.evidence;
                    const who = ev.name ?? state.customers.find((c) => c.id === ev.customerId)?.name ?? ev.worker ?? ev.to;
                    return (
                      <tr key={r.eventId} className="cursor-pointer align-top even:bg-raised/50 hover:bg-yellow/40" onClick={() => open(state.events.find((e) => e.id === r.eventId)!)}>
                        <td className="px-4 py-2.5"><Time ts={r.ts} now={now} /></td>
                        <td className="px-4 py-2.5"><Code code={r.code} /></td>
                        <td className="px-4 py-2.5"><span className="font-mono text-[12px]">{r.action}</span><div className="text-[11.5px] text-ink/55">by {r.by}</div></td>
                        <td className="w-[40%] px-4 py-2.5 text-ink/70">
                          {ev.excerpt ? <span className="line-clamp-2 italic text-ink" title={ev.excerpt}>“{ev.excerpt}”</span> : null}
                          <div className="text-[12px]">{[who, ev.subCode, ev.amount && `$${ev.amount}`, ev.reputation !== undefined && `reputation ${ev.reputation}`, ev.note].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-ink/70">{r.clause}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Kill switch">
            <div className="flex items-center gap-2">
              <span className={cx("h-3.5 w-3.5 shrink-0 border-2 border-ink", state.kill.on ? "bg-refuse" : "bg-in")} />
              <span className="font-bold">{state.kill.on ? "Engaged — every action is refused" : "Released — the contract governs spending"}</span>
            </div>
            {state.kill.history.length > 0 && (
              <ul className="mt-3 space-y-1 text-[12px] font-semibold text-ink/70">
                {state.kill.history.map((h, i) => <li key={i} className="flex justify-between"><span>{h.on ? "engaged" : "released"}</span><Time ts={h.ts} now={now} /></li>)}
              </ul>
            )}
          </Card>
          <Card title="Always on">
            <ul className="space-y-1.5 text-[13px] font-semibold">
              {["Consent gate before any call", "AI disclosure in the first sentence", "Quiet hours in the clinic's time zone", "Payee allowlist and per-payment cap", "Idempotency keys on every side effect", "Oracle PASS before any payment"].map((x) => (
                <li key={x} className="flex gap-2"><Badge tone="in">on</Badge>{x}</li>
              ))}
            </ul>
            {state.contract && (
              <p className="mt-3 text-[12px] text-ink/60">Permitted: {(state.contract.json.permittedActions ?? []).map(human).join(", ")}.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
