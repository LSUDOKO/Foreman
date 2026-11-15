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
          <CartesianGrid stroke="rgba(14,14,14,.14)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="i" hide />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "#48463c", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
          <ReferenceLine y={floor} stroke="#d4101e" strokeWidth={2} strokeDasharray="5 4" />
          <Tooltip
            contentStyle={{ background: "#fffdf4", border: "2px solid #0e0e0e", borderRadius: 4, boxShadow: "3px 3px 0 #0e0e0e", fontSize: 12, fontWeight: 600 }}
            labelFormatter={() => ""}
            formatter={(v: any, _n: any, p: any) => [`${v} · ${p.payload.reason}`, "reputation"]}
          />
          <Line type="stepAfter" dataKey="rep" stroke={w.reputation < floor ? "#d4101e" : "#0e0e0e"} strokeWidth={3} dot={{ r: 3.5, stroke: "#0e0e0e", strokeWidth: 1.5, fill: "#ff2ea8" }} isAnimationActive={false} />
          <Line dataKey="drop" stroke="none" dot={{ r: 6, fill: "#d4101e", stroke: "#0e0e0e", strokeWidth: 2 }} isAnimationActive={false} />
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
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="text-[12px] font-extrabold uppercase tracking-[0.05em]">Reputation</div>
                <div className={cx("display mt-1 text-[64px]", w.reputation < floor ? "text-refuse" : "text-ink")}>{w.reputation}</div>
                <div className="num mt-1 text-[12px] font-semibold text-ink/60">started {w.startRep} · floor {floor}</div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] font-semibold">
                <dt className="text-ink/65">Per call</dt><dd className="num text-right">{usd(w.price)}</dd>
                <dt className="text-ink/65">Proven-call bonus</dt><dd className="num text-right">{usd(w.bonus)}</dd>
                <dt className="text-ink/65">Calls</dt><dd className="num text-right">{w.calls}</dd>
                <dt className="text-ink/65">Oracle pass rate</dt><dd className="num text-right">{verdicts ? `${Math.round((w.pass / verdicts) * 100)}%` : "—"}</dd>
                <dt className="text-ink/65">Last verdict</dt><dd className="text-right">{last ? <Badge tone={last.verdict === "PASS" ? "proof" : "refuse"} mono>{last.verdict}{last.code ? ` ${last.code}` : ""}</Badge> : "—"}</dd>
              </dl>
            </div>
            <div className="mt-4"><RepChart w={w} floor={floor} /></div>
            {w.reputation < floor && <p className="mt-2 text-[12.5px] font-bold text-refuse">Below the reputation floor: the firewall won't hire {w.name} again.</p>}
          </Card>
        );
      })}
    </div>
  );
}
