import { useState } from "react";
import { useApp } from "../ctx";
import { human } from "../lib";
import { Badge, Card, Code, Empty, Time, cx } from "../ui";

export default function Safety() {
  const { state, now, open } = useApp();
  const [filter, setFilter] = useState<string | null>(null);
  const codes = [...new Set(state.refusals.map((r) => r.code))];
  const rows = state.refusals.filter((r) => !filter || r.code === filter).slice().reverse();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card title="Typed refusals" aside={<span className="num text-[12px]">{state.refusals.length}</span>} pad={false}>
          {codes.length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5" role="group" aria-label="Filter by code">
              <button onClick={() => setFilter(null)} className={cx("rounded-md border px-2 py-0.5 text-[12px]", !filter ? "border-accent text-ink" : "border-line text-muted")}>All</button>
              {codes.map((c) => (
                <button key={c} onClick={() => setFilter(c === filter ? null : c)} aria-pressed={c === filter}
                  className={cx("rounded-md border px-2 py-0.5 font-mono text-[11.5px]", c === filter ? "border-refuse text-[#FF8A8A]" : "border-line text-muted hover:text-ink")}>
                  {c} <span className="text-faint">{state.refusals.filter((r) => r.code === c).length}</span>
                </button>
              ))}
            </div>
          )}
          {rows.length === 0 ? (
            <Empty>No refusals yet — the firewall hasn't had to say no.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="text-left text-[12px] text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-normal">When</th><th className="px-4 py-2 font-normal">Code</th><th className="px-4 py-2 font-normal">Requested</th>
                    <th className="px-4 py-2 font-normal">Evidence</th><th className="px-4 py-2 font-normal">Blocked by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const ev = r.evidence;
                    const who = ev.name ?? state.customers.find((c) => c.id === ev.customerId)?.name ?? ev.worker ?? ev.to;
                    return (
                      <tr key={r.eventId} className="cursor-pointer align-top hover:bg-raised" onClick={() => open(state.events.find((e) => e.id === r.eventId)!)}>
                        <td className="px-4 py-2.5"><Time ts={r.ts} now={now} /></td>
                        <td className="px-4 py-2.5"><Code code={r.code} /></td>
                        <td className="px-4 py-2.5"><span className="font-mono text-[12px]">{r.action}</span><div className="text-[11.5px] text-faint">by {r.by}</div></td>
                        <td className="w-[40%] px-4 py-2.5 text-muted">
                          {ev.excerpt ? <span className="line-clamp-2 italic text-ink" title={ev.excerpt}>“{ev.excerpt}”</span> : null}
                          <div className="text-[12px]">{[who, ev.subCode, ev.amount && `$${ev.amount}`, ev.reputation !== undefined && `reputation ${ev.reputation}`, ev.note].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-muted">{r.clause}</td>
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
              <span className={cx("h-2 w-2 rounded-full", state.kill.on ? "bg-refuse" : "bg-in")} />
              <span>{state.kill.on ? "Engaged — every action is refused" : "Released — the contract governs spending"}</span>
            </div>
            {state.kill.history.length > 0 && (
              <ul className="mt-3 space-y-1 text-[12px] text-muted">
                {state.kill.history.map((h, i) => <li key={i} className="flex justify-between"><span>{h.on ? "engaged" : "released"}</span><Time ts={h.ts} now={now} /></li>)}
              </ul>
            )}
          </Card>
          <Card title="Always on">
            <ul className="space-y-1.5 text-[12.5px] text-muted">
              {["Consent gate before any call", "AI disclosure in the first sentence", "Quiet hours in the clinic's time zone", "Payee allowlist and per-payment cap", "Idempotency keys on every side effect", "Oracle PASS before any payment"].map((x) => (
                <li key={x} className="flex gap-2"><Badge tone="in">on</Badge>{x}</li>
              ))}
            </ul>
            {state.contract && (
              <p className="mt-3 text-[11.5px] text-faint">Permitted: {(state.contract.json.permittedActions ?? []).map(human).join(", ")}.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
