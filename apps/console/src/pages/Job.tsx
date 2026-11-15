import { useApp } from "../ctx";
import { absTime, human, slotLabel } from "../lib";
import { STEPS } from "../state";
import type { Customer } from "../state";
import { Badge, Card, Code, Empty, TBODY, THEAD, cx } from "../ui";

const ENDED: Record<string, { tone: "neutral" | "refuse" | "out"; label: string }> = {
  declined: { tone: "neutral", label: "declined" },
  no_answer: { tone: "out", label: "no answer" },
  opted_out: { tone: "neutral", label: "opted out" },
  failed: { tone: "refuse", label: "failed" },
  cancelled: { tone: "neutral", label: "hold released" },
};

function Stepper({ c }: { c: Customer }) {
  if (c.state === "skipped")
    return <div className="flex items-center gap-2"><Code code={c.refusal ?? "skipped"} /><span className="num text-[12px] text-muted">$0.00 spent</span></div>;
  const reached = STEPS.map(([k]) => !!c.steps[k]);
  const last = reached.lastIndexOf(true);
  const ended = ENDED[c.state];
  return (
    <div className="flex items-center gap-2">
      <ol className="flex items-center" aria-label="progress">
        {STEPS.map(([k, label], i) => (
          <li key={k + i} className="flex items-center" title={c.steps[k] ? `${label} · ${absTime(c.steps[k]!)}` : label}>
            {i > 0 && <span className={cx("h-[3px] w-3 sm:w-5", reached[i] ? "bg-ink" : "bg-ink/15")} />}
            <span className={cx("grid place-items-center rounded-full border-2", reached[i] ? (i === last && !ended ? "h-4 w-4 border-ink bg-pink shadow-[0_0_0_3px_#f7ef1c]" : "h-3 w-3 border-ink bg-pink") : "h-3 w-3 border-ink/25 bg-surface")} />
          </li>
        ))}
      </ol>
      <span className="text-[12px] font-bold">{STEPS[last]?.[1]}</span>
      {ended && <Badge tone={ended.tone}>{ended.label}</Badge>}
      {c.refusal && c.state !== "skipped" && <Code code={c.refusal} />}
    </div>
  );
}

export default function Job() {
  const { state } = useApp();
  if (!state.customers.length) return <Card title="Job"><Empty>No customers yet. Upload no-shows in the Business view to start a job.</Empty></Card>;
  return (
    <Card title="No-shows" aside={<Badge tone="accent">{state.customers.length} no-shows</Badge>} pad={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead className={THEAD}>
            <tr>
              <th className="px-4 py-2 font-extrabold">Customer</th>
              <th className="px-4 py-2 font-extrabold">Missed</th>
              <th className="px-4 py-2 font-extrabold">Progress</th>
              <th className="px-4 py-2 font-extrabold">Offered / booked</th>
              <th className="px-4 py-2 font-extrabold">Attempts</th>
            </tr>
          </thead>
          <tbody className={TBODY}>
            {state.customers.map((c) => (
              <tr key={c.id} className="align-middle even:bg-raised/50">
                <td className="px-4 py-3">
                  <div className="font-extrabold">{c.name}</div>
                  <div className="font-mono text-[11.5px] text-faint">{c.phone || c.id}{!c.consent && " · no consent"}</div>
                </td>
                <td className="px-4 py-3 text-ink/70">{c.missedAt ? slotLabel(c.missedAt) : "—"}</td>
                <td className="px-4 py-3"><Stepper c={c} /></td>
                <td className="px-4 py-3 text-[12px] text-ink/70" title={c.planReason}>
                  {c.slot ? <span className="font-bold text-ink">{slotLabel(c.slot)}</span> : c.offers.length ? c.offers.map((o) => slotLabel(o)).join(" or ") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.attempts.map((id) => {
                      const a = state.attempts[id]!;
                      const v = a.verdict?.verdict;
                      return <Badge key={id} tone={v === "PASS" ? "proof" : v === "FAIL" ? "refuse" : "neutral"} title={a.reason}>{a.worker}{v ? ` · ${v}` : a.claim ? ` · ${human(a.claim.outcome)}` : ""}</Badge>;
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
