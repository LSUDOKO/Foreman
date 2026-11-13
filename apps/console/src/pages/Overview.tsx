import { Building2, Diamond, Phone, Scale } from "lucide-react";
import { useApp } from "../ctx";
import { Feed } from "../feed";
import { useCountUp, usd } from "../lib";
import { APPOINTMENT_VALUE } from "../state";
import { Addr, Badge, Card, Skeleton, cx } from "../ui";

function Kpi({ label, value, fmt, sub, tone }: { label: string; value: number; fmt: (n: number) => string; sub?: React.ReactNode; tone?: string }) {
  const v = useCountUp(value);
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={cx("num mt-1 text-[22px] font-medium tracking-tight", tone)}>{fmt(v)}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-faint">{sub}</div>}
    </div>
  );
}

export function Kpis() {
  const { state } = useApp();
  const t = state.totals;
  const noShows = state.customers.length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi label="Recovered for clinic" value={t.recovered} fmt={(n) => usd(Math.round(n))} sub={`$${APPOINTMENT_VALUE} per visit, assumed`} tone="text-in" />
      <Kpi label="Rebookings confirmed" value={t.confirmed} fmt={(n) => `${Math.round(n)} / ${noShows}`} sub="of uploaded no-shows" />
      <Kpi label="Foreman spend" value={t.spent} fmt={usd} sub="workers + oracle" tone="text-out" />
      <Kpi label="Foreman earned" value={t.earned} fmt={usd} sub="paid only on proof" tone="text-in" />
      <Kpi label="Margin" value={t.margin} fmt={usd} sub="earned − spend" tone={t.margin >= 0 ? "text-ink" : "text-refuse"} />
    </div>
  );
}

const ROLE_ICON = { Foreman: Diamond, ClearCall: Phone, QuickDial: Phone, Oracle: Scale } as Record<string, typeof Phone>;

export function AgentsRail() {
  const { state, src } = useApp();
  const ids = Object.keys(state.identities).length ? state.identities : src.identities;
  const rep = Object.fromEntries(state.workers.map((w) => [w.name, w]));
  const budget = Number(state.contract?.budget ?? 0);
  const pct = budget ? Math.min(100, (state.totals.spent / budget) * 100) : 0;
  return (
    <div className="space-y-4">
      <Card title="Agents" pad={false}>
        {Object.keys(ids).length === 0 ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : (
          <ul className="divide-y divide-line">
            {Object.entries(ids).map(([name, id]) => {
              const Icon = ROLE_ICON[name] ?? Building2;
              const w = rep[name];
              return (
                <li key={name} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon size={14} className={name === "Foreman" ? "text-accent" : name === "Oracle" ? "text-proof" : w ? "text-muted" : "text-in"} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px]">{name}{w?.badge && <Badge tone="out" title={w.badge}>test</Badge>}</div>
                    <Addr address={id.address} explorer={src.explorer} />
                  </div>
                  {w && <span className={cx("num text-[15px]", w.reputation < 50 ? "text-refuse" : "text-ink")} title="reputation">{w.reputation}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title="Budget">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="num text-[18px]">{usd(state.totals.spent)}</span>
          <span className="num text-[12px] text-muted">of {usd(budget)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={cx("h-full rounded-full transition-all", pct >= 80 ? "bg-out" : "bg-accent")} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[11.5px] text-faint">The firewall refuses any payment that would cross this line.</p>
      </Card>
    </div>
  );
}

export default function Overview() {
  const { state, now, open } = useApp();
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <Kpis />
        <Card title="Live feed" aside={<span className="num text-[12px]">{state.events.length} events</span>} pad={false}>
          <Feed events={state.events} onOpen={open} now={now} />
        </Card>
      </div>
      <AgentsRail />
    </div>
  );
}
