import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../ctx";
import { usd } from "../lib";
import type { Worker } from "../state";
import { Addr, Badge, Card, Empty, cx } from "../ui";

function RepChart({ w, floor }: { w: Worker; floor: number }) {
  const data = w.history.map((h, i) => ({ i, rep: h.rep, reason: h.reason, drop: h.delta <= -40 ? h.rep : null }));
  return (
    <div className="h-[110px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="#cbbd9f" vertical={false} />
          <XAxis dataKey="i" hide />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "#8f7c84", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
          <ReferenceLine y={floor} stroke="#ae2a1f" strokeDasharray="3 3" strokeOpacity={0.6} />
          <Tooltip
            contentStyle={{ background: "#f4eee2", border: "1px solid #cbbd9f", borderRadius: 6, fontSize: 12 }}
            labelFormatter={() => ""}
            formatter={(v: any, _n: any, p: any) => [`${v} · ${p.payload.reason}`, "reputation"]}
          />
          <Line type="stepAfter" dataKey="rep" stroke={w.reputation < floor ? "#ae2a1f" : "#5a1530"} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: "#6b5560" }} isAnimationActive={false} />
          <Line dataKey="drop" stroke="none" dot={{ r: 5, fill: "#ae2a1f", stroke: "#f4eee2", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Workers() {
  const { state, src } = useApp();
  const floor = state.contract?.json?.workerPolicy?.reputationFloor ?? 50;
  if (!state.workers.length) return <Card title="Workers"><Empty>Workers appear when a job starts.</Empty></Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {state.workers.map((w) => {
        const verdicts = w.pass + w.fail;
        const last = Object.values(state.attempts).filter((a) => a.worker === w.name && a.verdict).at(-1)?.verdict;
        return (
          <Card key={w.name} title={<span className="flex items-center gap-2">{w.name}{w.isNew && <Badge>new</Badge>}{w.badge && <Badge tone="out">{w.badge}</Badge>}</span>} aside={<Addr address={w.payTo} explorer={src.explorer} />}>
            <div className="flex items-end justify-between gap-6">
              <div>
                <div className="text-[12px] text-muted">Reputation</div>
                <div className={cx("num text-[40px] leading-none tracking-tight", w.reputation < floor ? "text-refuse" : "text-ink")}>{w.reputation}</div>
                <div className="num mt-1 text-[12px] text-faint">started {w.startRep} · floor {floor}</div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px]">
                <dt className="text-muted">Per call</dt><dd className="num text-right">{usd(w.price)}</dd>
                <dt className="text-muted">Proven-call bonus</dt><dd className="num text-right">{usd(w.bonus)}</dd>
                <dt className="text-muted">Calls</dt><dd className="num text-right">{w.calls}</dd>
                <dt className="text-muted">Oracle pass rate</dt><dd className="num text-right">{verdicts ? `${Math.round((w.pass / verdicts) * 100)}%` : "—"}</dd>
                <dt className="text-muted">Last verdict</dt><dd className="text-right">{last ? <Badge tone={last.verdict === "PASS" ? "proof" : "refuse"} mono>{last.verdict}{last.code ? ` ${last.code}` : ""}</Badge> : "—"}</dd>
              </dl>
            </div>
            <div className="mt-4"><RepChart w={w} floor={floor} /></div>
            {w.reputation < floor && <p className="mt-2 text-[12px] text-refuse">Below the reputation floor: the firewall won't hire {w.name} again.</p>}
          </Card>
        );
      })}
    </div>
  );
}
