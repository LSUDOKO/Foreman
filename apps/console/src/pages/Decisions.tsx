import { ChevronRight } from "lucide-react";
import { useApp } from "../ctx";
import { human } from "../lib";
import { Badge, Card, Empty, Json, TBODY, Time } from "../ui";

const WHY: Record<string, string> = {
  compile_contract: "Turn the clinic's goal into a typed contract",
  plan_calls: "Choose call order and the two slots to offer",
  select_worker: "Choose which phone worker to hire",
  parse_turn: "Understand what the caller said (untrusted input)",
  audit_transcript: "Score call quality — reputation only, never money",
};

export default function Decisions() {
  const { state, now } = useApp();
  const ds = state.decisions.slice().reverse();
  const live = state.decisions.filter((d) => d.source === "live").length;
  return (
    <Card
      title="SERV decisions"
      aside={<span className="text-[12px] font-semibold">{state.decisions.length} total · {live} live{state.decisions.length - live ? ` · ${state.decisions.length - live} fallback` : ""}</span>}
      pad={false}
    >
      {ds.length === 0 ? (
        <Empty>SERV hasn't been asked anything yet.</Empty>
      ) : (
        <ul className={TBODY}>
          {ds.map((d) => {
            const reason = d.decision?.reason ?? d.decision?.notes ?? d.decision?.order?.[0]?.reason;
            return (
              <li key={d.eventId}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-yellow/40 group-open:bg-yellow/40">
                    <ChevronRight size={15} strokeWidth={3} className="transition-transform group-open:rotate-90" />
                    <span className="min-w-[140px] font-extrabold uppercase tracking-[0.03em]">{human(d.purpose)}</span>
                    <span className="text-[12.5px] text-ink/65">{WHY[d.purpose] ?? ""}</span>
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      {d.guards.map((g) => <Badge key={g} tone="accent" mono>{g}</Badge>)}
                      <Badge tone={d.source === "live" ? "in" : "out"}>{d.source}</Badge>
                      <span className="num w-[64px] text-right text-[12px] font-bold">{(d.ms / 1000).toFixed(1)} s</span>
                      <Time ts={d.ts} now={now} />
                    </span>
                  </summary>
                  <div className="space-y-3 border-t-2 border-dashed border-ink/15 px-4 py-4 sm:pl-10">
                    <div className="flex flex-wrap gap-1.5 text-[12px]">
                      <Badge mono>{d.actor}</Badge><Badge mono>{d.model}</Badge>{d.effort && <Badge mono>effort {d.effort}</Badge>}
                      {d.tokens && <Badge mono>{d.tokens.input} in / {d.tokens.output} out tokens</Badge>}
                    </div>
                    {reason && <p className="text-[14px] font-medium">{reason}</p>}
                    {d.error && <p className="text-[12.5px] font-semibold text-out">Fell back to the deterministic rule: {d.error.slice(0, 240)}</p>}
                    <Json value={d.decision} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
