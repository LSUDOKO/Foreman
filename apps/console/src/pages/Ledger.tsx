import { Download } from "lucide-react";
import { useApp } from "../ctx";
import { clock, human, usd } from "../lib";
import type { Payment } from "../state";
import { Button, Card, Empty, TxRef, cx } from "../ui";

function Lines({ rows, dir }: { rows: Payment[]; dir: "in" | "out" }) {
  const { state } = useApp();
  if (!rows.length) return <Empty>{dir === "in" ? "No money in yet. The clinic pays only after the oracle proves a confirmed rebooking." : "No payments out yet."}</Empty>;
  return (
    <table className="w-full text-[13px]">
      <tbody className="divide-y divide-line">
        {rows.map((p) => {
          const who = p.customerId ? state.customers.find((c) => c.id === p.customerId)?.name : undefined;
          return (
            <tr key={p.eventId}>
              <td className="num w-[88px] py-2 pl-4 pr-3 text-[11.5px] text-faint">{clock(p.ts)}</td>
              <td className="py-2 pr-2">
                <div className="truncate">{p.from} <span className="text-faint">to</span> {p.to}</div>
                <div className="text-[11.5px] text-muted">{human(p.purpose)}{who ? ` · ${who}` : ""}</div>
              </td>
              <td className="py-2 pr-2"><TxRef tx={p.txHash} link={p.link} /></td>
              <td className={cx("num py-2 pr-4 text-right", dir === "in" ? "text-in" : "text-out")}>{dir === "in" ? "+" : "−"}{usd(p.amount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function exportCsv(rows: Payment[]) {
  const head = "time,direction,from,to,purpose,amount,tx\n";
  const body = rows.map((p) => [p.ts, p.direction, p.from, p.to, p.purpose, p.amount, p.txHash].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
  a.download = "foreman-ledger.csv";
  a.click();
}

export default function Ledger() {
  const { state } = useApp();
  const ins = state.payments.filter((p) => p.direction === "in");
  const outs = state.payments.filter((p) => p.direction === "out");
  const t = state.totals;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-in" />Money in · from the clinic</span>} aside={<span className="num text-in">{usd(t.earned)}</span>} pad={false}>
          <Lines rows={ins} dir="in" />
        </Card>
        <Card title={<span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-out" />Money out · to agents Foreman hired</span>} aside={<span className="num text-out">{usd(t.spent)}</span>} pad={false}>
          <Lines rows={outs} dir="out" />
        </Card>
      </div>
      <div className="order-first flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap gap-8">
          <div><div className="text-[12px] text-muted">Earned</div><div className="num text-[18px] text-in">{usd(t.earned)}</div></div>
          <div><div className="text-[12px] text-muted">Spent</div><div className="num text-[18px] text-out">{usd(t.spent)}</div></div>
          <div><div className="text-[12px] text-muted">Margin</div><div className="num text-[18px]">{usd(t.margin)}</div></div>
          <div><div className="text-[12px] text-muted">Recovered for the clinic</div><div className="num text-[18px] text-in">{usd(t.recovered)}</div></div>
        </div>
        <Button onClick={() => exportCsv(state.payments)} disabled={!state.payments.length}><Download size={14} />Export CSV</Button>
      </div>
    </div>
  );
}
