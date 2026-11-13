// Every view is a pure function of the event log. Live mode streams it over SSE; replay mode plays a recorded export.

export interface FeedEvent {
  id: number;
  ts: string;
  contractId: string | null;
  type: string;
  actor: string;
  data: any;
  prevHash: string;
  hash: string;
}

export interface Modes { serv: string; payments: string; carrier: string; calendar: string; email: string }
export interface Identity { address: string; role: string; signer?: string }

/** Assumption shown in the UI: average value of one recovered appointment. */
export const APPOINTMENT_VALUE = 60;

export const STEPS = [
  ["eligible", "Eligible"],
  ["planned", "Planned"],
  ["calling", "Calling"],
  ["call_verified", "Call verified"],
  ["booked", "Booked"],
  ["confirmation_sent", "Confirmation sent"],
  ["confirmed", "Confirmed"],
  ["paid", "Paid"],
  ["attended", "Attended"],
  ["paid_attended", "Paid"],
] as const;

export interface Customer {
  id: string; name: string; phone: string; email: string; missedAt: string; consent: boolean;
  state: string; refusal?: string; steps: Record<string, string>; offers: string[]; planReason?: string;
  outcomeId?: string; slot?: string; attempts: string[];
}
export interface Worker {
  name: string; payTo: string; price: string; bonus: string; reputation: number; startRep: number; isNew: boolean; badge?: string | null;
  history: { ts: string; rep: number; reason: string; delta: number }[]; calls: number; pass: number; fail: number;
}
export interface Payment {
  eventId: number; ts: string; direction: "in" | "out"; from: string; to: string; amount: string; purpose: string;
  txHash: string; link: string | null; customerId?: string; refId?: string; outcomeId?: string;
}
export interface Refusal { eventId: number; ts: string; code: string; action: string; clause: string; by: string; evidence: Record<string, any> }
export interface Decision { eventId: number; ts: string; actor: string; purpose: string; model: string; effort?: string; source: string; ms: number; tokens?: { input: number; output: number } | null; guards: string[]; decision: any; error?: string; customerId?: string }
export interface Attempt {
  id: string; worker: string; customerId: string; name: string; probation: boolean; reason: string; hiredAt: string; price: string;
  callSid?: string; offers?: string[]; claim?: any; verdict?: any; audit?: any;
}
export interface Outcome {
  id: string; customerId: string; name: string; bookingUid: string; slot: string; state: string;
  confirmedAt?: string; attendedAt?: string; paidConfirmed?: Payment; paidAttended?: Payment;
}

export interface State {
  contract: null | {
    id: string; json: any; hash: string; summary: string; rejected: { request: string; reason: string }[];
    status: string; approvedBy?: string; budget: string; business: string; compiledAt: string;
  };
  modes: Modes | null;
  identities: Record<string, Identity>;
  customers: Customer[];
  workers: Worker[];
  payments: Payment[];
  refusals: Refusal[];
  decisions: Decision[];
  attempts: Record<string, Attempt>;
  outcomes: Outcome[];
  kill: { on: boolean; history: { ts: string; on: boolean }[] };
  totals: { spent: number; earned: number; margin: number; confirmed: number; recovered: number };
  events: FeedEvent[];
}

const cents = (s: string | undefined) => Math.round(Number(s ?? 0) * 100);

export function deriveState(events: FeedEvent[]): State {
  const s: State = {
    contract: null, modes: null, identities: {}, customers: [], workers: [], payments: [], refusals: [], decisions: [],
    attempts: {}, outcomes: [], kill: { on: false, history: [] },
    totals: { spent: 0, earned: 0, margin: 0, confirmed: 0, recovered: 0 }, events,
  };
  const cust = new Map<string, Customer>();
  const work = new Map<string, Worker>();
  const outs = new Map<string, Outcome>();
  const getC = (id: string, name?: string) => {
    let c = cust.get(id);
    if (!c) {
      c = { id, name: name ?? id, phone: "", email: "", missedAt: "", consent: true, state: "eligible", steps: {}, offers: [], attempts: [] };
      cust.set(id, c);
    }
    return c;
  };

  for (const e of events) {
    const d = e.data ?? {};
    switch (e.type) {
      case "contract_compiled":
        s.contract = {
          id: d.contract.id, json: d.contract, hash: d.hash, summary: d.summary ?? "", rejected: d.rejectedRequests ?? [],
          status: "draft", budget: d.contract.spend.totalBudget, business: d.contract.business.name, compiledAt: e.ts,
        };
        for (const x of d.customers ?? []) Object.assign(getC(x.id, x.name), { ...x, consent: !!x.consent, steps: { eligible: e.ts } });
        break;
      case "contract_approved":
        if (s.contract) {
          Object.assign(s.contract, { status: "approved", approvedBy: d.by });
          const j = (s.contract as any).json;
          if (j?.approval) j.approval = { ...j.approval, approvedBy: d.by, approvedAt: d.approvedAt ?? e.ts };
        }
        break;
      case "contract_started":
        if (s.contract) s.contract.status = "running";
        s.modes = d.modes ?? s.modes;
        s.identities = d.identities ?? s.identities;
        for (const w of d.workers ?? [])
          work.set(w.name, { ...w, startRep: w.reputation, history: [{ ts: e.ts, rep: w.reputation, reason: "start of job", delta: 0 }], calls: 0, pass: 0, fail: 0 });
        break;
      case "contract_completed":
        if (s.contract) s.contract.status = "completed";
        break;
      case "customer_state": {
        const c = getC(d.customerId, d.name);
        c.state = d.state;
        c.steps[d.step ?? d.state] = e.ts;
        if (d.refusal) c.refusal = d.refusal;
        break;
      }
      case "serv_decision":
        s.decisions.push({ eventId: e.id, ts: e.ts, actor: e.actor, purpose: d.purpose, model: d.model, effort: d.effort, source: d.source, ms: d.ms, tokens: d.tokens, guards: d.guards ?? [], decision: d.decision, error: d.error, customerId: d.customerId });
        if (d.purpose === "plan_calls")
          for (const o of d.decision?.order ?? []) {
            const c = getC(o.customerId);
            c.offers = o.offer;
            c.planReason = o.reason;
          }
        break;
      case "worker_hired": {
        s.attempts[d.attemptId] = { id: d.attemptId, worker: d.worker, customerId: d.customerId, name: d.name, probation: !!d.probation, reason: d.reason, hiredAt: e.ts, price: d.price };
        getC(d.customerId, d.name).attempts.push(d.attemptId);
        const w = work.get(d.worker);
        if (w) w.calls++;
        break;
      }
      case "call_started":
        if (s.attempts[d.attemptId]) Object.assign(s.attempts[d.attemptId]!, { callSid: d.callSid, offers: d.offers });
        break;
      case "call_reported":
        if (s.attempts[d.attemptId]) s.attempts[d.attemptId]!.claim = d;
        break;
      case "oracle_verdict": {
        if (d.kind === "call" && s.attempts[d.attemptId]) s.attempts[d.attemptId]!.verdict = d;
        const w = work.get(d.worker);
        if (w) d.verdict === "PASS" ? w.pass++ : w.fail++;
        break;
      }
      case "transcript_audited":
        if (s.attempts[d.attemptId]) s.attempts[d.attemptId]!.audit = d;
        break;
      case "reputation_changed": {
        const w = work.get(d.worker);
        if (w) {
          w.reputation = d.to;
          w.history.push({ ts: e.ts, rep: d.to, reason: d.reason, delta: d.delta });
        }
        break;
      }
      case "payment_out":
      case "payment_in": {
        const p: Payment = {
          eventId: e.id, ts: e.ts, direction: e.type === "payment_in" ? "in" : "out",
          from: e.type === "payment_in" ? d.from : "Foreman", to: d.to, amount: d.amount, purpose: d.purpose,
          txHash: d.txHash, link: d.link ?? null, customerId: d.customerId, refId: d.refId, outcomeId: d.outcomeId,
        };
        s.payments.push(p);
        if (p.direction === "in" && d.outcomeId) {
          const o = outs.get(d.outcomeId);
          if (o) d.milestone === "attended" ? (o.paidAttended = p) : (o.paidConfirmed = p);
        }
        break;
      }
      case "booking_created": {
        const o: Outcome = { id: d.outcomeId, customerId: d.customerId, name: d.name, bookingUid: d.bookingUid, slot: d.slot, state: "booked" };
        outs.set(o.id, o);
        Object.assign(getC(d.customerId, d.name), { outcomeId: o.id, slot: d.slot });
        break;
      }
      case "confirmation_sent":
        if (outs.get(d.outcomeId)) outs.get(d.outcomeId)!.state = "confirmation_sent";
        break;
      case "customer_confirmed":
        if (outs.get(d.outcomeId)) Object.assign(outs.get(d.outcomeId)!, { state: "confirmed", confirmedAt: e.ts });
        break;
      case "customer_declined":
      case "booking_cancelled":
        if (d.outcomeId && outs.get(d.outcomeId)) outs.get(d.outcomeId)!.state = "cancelled";
        break;
      case "attended_attested":
        if (outs.get(d.outcomeId)) Object.assign(outs.get(d.outcomeId)!, { state: "attended", attendedAt: e.ts });
        break;
      case "refusal":
        s.refusals.push({ eventId: e.id, ts: e.ts, code: d.code, action: d.action, clause: d.clause, by: d.by ?? e.actor, evidence: d.evidence ?? {} });
        break;
      case "kill_switch":
        s.kill.on = !!d.on;
        s.kill.history.push({ ts: e.ts, on: !!d.on });
        break;
    }
  }

  s.customers = [...cust.values()];
  s.workers = [...work.values()];
  s.outcomes = [...outs.values()];
  const spent = s.payments.filter((p) => p.direction === "out").reduce((a, p) => a + cents(p.amount), 0);
  const earned = s.payments.filter((p) => p.direction === "in").reduce((a, p) => a + cents(p.amount), 0);
  const confirmed = s.outcomes.filter((o) => o.confirmedAt).length;
  s.totals = { spent: spent / 100, earned: earned / 100, margin: (earned - spent) / 100, confirmed, recovered: confirmed * APPOINTMENT_VALUE };
  return s;
}

/** Positions of the five demo moments in the event list, for the replay scrub bar. */
export function demoMoments(events: FeedEvent[]) {
  const find = (label: string, f: (e: FeedEvent) => boolean, last = false) => {
    const i = last ? events.findLastIndex(f) : events.findIndex(f);
    return i < 0 ? null : { label, index: i };
  };
  return [
    find("Consent gate", (e) => e.type === "customer_skipped"),
    find("Customer confirmed", (e) => e.type === "customer_confirmed"),
    find("Oracle catches a lie", (e) => e.type === "oracle_verdict" && e.data.verdict === "FAIL"),
    find("Phone attack refused", (e) => e.type === "refusal" && ["injection_detected", "action_not_permitted"].includes(e.data.code)),
    find("Final payment", (e) => e.type === "payment_in", true),
  ].filter((m): m is { label: string; index: number } => !!m).sort((a, b) => a.index - b.index);
}
