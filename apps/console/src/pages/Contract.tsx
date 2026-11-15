import { BadgeCheck, Play } from "lucide-react";
import { useApp } from "../ctx";
import { api } from "../lib";
import { Badge, Button, Card, CopyBtn, Empty, Json } from "../ui";

export default function Contract() {
  const { state, live, act, go } = useApp();
  const c = state.contract;
  if (!c) return <Card title="Contract"><Empty>No contract yet. Write the clinic's goal in the Business view and SERV compiles it here.</Empty></Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <Card title="In plain English" aside={<Badge tone={c.status === "draft" ? "out" : c.status === "running" ? "accent" : "neutral"}>{c.status}</Badge>}>
          <p className="text-[15px] font-medium leading-relaxed">{c.summary}</p>
          <div className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.05em] text-accent">Goal as written</div>
          <blockquote className="mt-1 border-l-4 border-pink pl-3 text-[13.5px] text-ink/75">{c.json.goal}</blockquote>
          {c.approvedBy && <p className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-in"><BadgeCheck size={13} />Approved by {c.approvedBy}</p>}
          <div className="mt-5 flex gap-2">
            {c.status === "draft" && <Button tone="primary" disabled={!live} onClick={() => act("Contract approved", () => api("POST", `/api/contracts/${c.id}/approve`))}><BadgeCheck size={14} />Approve contract</Button>}
            {c.status === "approved" && <Button tone="primary" disabled={!live} onClick={() => act("Job started", async () => { await api("POST", `/api/contracts/${c.id}/start`); go("overview"); })}><Play size={14} />Start job</Button>}
          </div>
        </Card>
        <Card title="Requests SERV refused to put in the contract">
          {c.rejected.length === 0 ? (
            <p className="text-[14px] font-semibold text-ink/75">None. The goal stayed within the five permitted actions.</p>
          ) : (
            <ul className="space-y-1.5">{c.rejected.map((r) => <li key={r.request} className="flex flex-wrap gap-2"><Badge tone="refuse" mono>{r.request}</Badge><span className="text-ink/70">{r.reason}</span></li>)}</ul>
          )}
        </Card>
        <Card title="Proof required before any payment">
          <ul className="flex flex-wrap gap-1.5">{(c.json.outcome?.proof?.confirmed ?? []).map((p: string) => <Badge key={p} tone="proof" mono>{p}</Badge>)}</ul>
          <p className="mt-3 text-[12.5px] text-ink/70">Attendance: signed business attestation. The model never authorises a payment.</p>
        </Card>
      </div>
      <Card title={<span className="font-mono">{c.id}</span>} aside={<span className="flex items-center gap-1.5 font-mono text-[11.5px] normal-case" title={c.hash}>{c.hash.slice(0, 19)}…<CopyBtn text={c.hash} /></span>}>
        <Json value={c.json} />
        <p className="mt-3 text-[12px] text-ink/60">The hash covers the terms (not the approval stamp) and is stamped on every event in the audit chain. Changing the contract means a new id.</p>
      </Card>
    </div>
  );
}
