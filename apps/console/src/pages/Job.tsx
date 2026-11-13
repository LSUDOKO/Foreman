import { useApp } from "../ctx";
import { absTime, human, slotLabel } from "../lib";
import { STEPS } from "../state";
import type { Customer } from "../state";
import { Badge, Card, Code, Empty, cx } from "../ui";

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
            {i > 0 && <span className={cx("h-px w-3 sm:w-5", reached[i] ? "bg-accent" : "bg-line")} />}
            <span className={cx("grid h-2.5 w-2.5 place-items-center rounded-full border", reached[i] ? (i === last && !ended ? "border-accent bg-accent ring-4 ring-accent/20" : "border-accent bg-accent") : "border-line bg-bg")} />
          </li>
        ))}
      </ol>
      <span className="text-[12px] text-muted">{STEPS[last]?.[1]}</span>
      {ended && <Badge tone={ended.tone}>{ended.label}</Badge>}
      {c.refusal && c.state !== "skipped" && <Code code={c.refusal} />}
    </div>
  );
}

export default function Job() {
  const { state } = useApp();
  if (!state.customers.length) return <Card title="Job"><Empty>No customers yet. Upload no-shows in the Business view to start a job.</Empty></Card>;
  return (
    <Card title="Job" aside={<span className="text-[12px]">{state.customers.length} no-shows</span>} pad={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-normal">Customer</th>
              <th className="px-4 py-2 font-normal">Missed</th>
              <th className="px-4 py-2 font-normal">Progress</th>
              <th className="px-4 py-2 font-normal">Offered / booked</th>
              <th className="px-4 py-2 font-normal">Attempts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {state.customers.map((c) => (
              <tr key={c.id} className="align-middle">
                <td className="px-4 py-3">
                  <div>{c.name}</div>
                  <div className="font-mono text-[11.5px] text-faint">{c.phone || c.id}{!c.consent && " · no consent"}</div>
                </td>
                <td className="px-4 py-3 text-muted">{c.missedAt ? slotLabel(c.missedAt) : "—"}</td>
                <td className="px-4 py-3"><Stepper c={c} /></td>
                <td className="px-4 py-3 text-[12px] text-muted" title={c.planReason}>
                  {c.slot ? <span className="text-ink">{slotLabel(c.slot)}</span> : c.offers.length ? c.offers.map((o) => slotLabel(o)).join(" or ") : "—"}
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
