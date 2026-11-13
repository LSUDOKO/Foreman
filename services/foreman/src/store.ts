// Thin typed accessors over the SQLite tables. Business logic lives in runner.ts.
import { contractHash, OutcomeContract } from "@foreman/shared/contract";
import type { ContractStatus } from "@foreman/shared/contract";
import { addUsd } from "@foreman/shared/money";
import type { CallResult, Verdict } from "@foreman/shared/types";
import type { CsvCustomer } from "./csv";
import type { DB } from "./db";
import { nowIso } from "./db";

export type CustomerState = "eligible" | "skipped" | "planned" | "calling" | "call_verified" | "booked" | "confirmation_sent"
  | "confirmed" | "paid" | "attended" | "paid_attended" | "declined" | "no_answer" | "opted_out" | "failed" | "cancelled";
export type OutcomeState = "booked" | "confirmation_sent" | "confirmed_by_customer" | "paid_confirmed" | "attended_attested" | "paid_attended" | "cancelled";

export interface Customer extends CsvCustomer {
  contractId: string; optedOut: boolean; state: CustomerState; refusal: string | null; offers: string[]; planReason: string | null; steps: Record<string, string>;
}
export interface Worker { name: string; payTo: `0x${string}`; callUrl: string; bonusUrl: string; price: string; bonus: string; reputation: number; probationLeft: number; isNew: boolean; badge: string | null }
export interface Attempt { id: string; contractId: string; customerId: string; worker: string; attemptNo: number; callSid: string | null; offers: string[]; result: CallResult | null; verdict: Verdict | null; quality: number | null; createdAt: string; status: string }
export interface Outcome { id: string; contractId: string; customerId: string; attemptId: string | null; bookingUid: string | null; slotStart: string | null; confirmTokenHash: string | null; confirmExpiresAt: string | null; confirmedAt: string | null; attendedSig: string | null; createdAt: string; state: OutcomeState }
export interface Payment { id: string; contractId: string; direction: "in" | "out"; from: string; to: string; counterparty: string; purpose: string; amount: string; txHash: string; refId: string; createdAt: string }

const j = <T>(s: string | null, d: T): T => (s ? (JSON.parse(s) as T) : d);

export class Store {
  constructor(readonly db: DB) {}

  // contracts
  saveContract(c: OutcomeContract, status: ContractStatus, rejected: unknown[] = []) {
    this.db.query(`INSERT INTO contracts (id, json, hash, status, rejected, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET json = excluded.json, hash = excluded.hash, status = excluded.status`)
      .run(c.id, JSON.stringify(c), contractHash(c), status, JSON.stringify(rejected), nowIso());
  }
  contract(id: string) {
    const r = this.db.query("SELECT * FROM contracts WHERE id = ?").get(id) as any;
    return r ? { contract: OutcomeContract.parse(JSON.parse(r.json)), hash: r.hash as string, status: r.status as ContractStatus, rejected: j<unknown[]>(r.rejected, []), createdAt: r.created_at as string } : null;
  }
  latestContractId(): string | null {
    return (this.db.query("SELECT id FROM contracts ORDER BY created_at DESC, rowid DESC LIMIT 1").get() as { id: string } | null)?.id ?? null;
  }
  setStatus(id: string, s: ContractStatus) { this.db.query("UPDATE contracts SET status = ? WHERE id = ?").run(s, id); }

  // customers
  addCustomers(contractId: string, cs: CsvCustomer[]) {
    const q = this.db.query("INSERT INTO customers (id, contract_id, name, phone, email, missed_at, consent_source, steps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    this.db.transaction(() => { for (const c of cs) q.run(c.id, contractId, c.name, c.phone, c.email, c.missedAt, c.consentSource, JSON.stringify({ eligible: nowIso() })); })();
  }
  customers(contractId: string): Customer[] {
    return (this.db.query("SELECT * FROM customers WHERE contract_id = ? ORDER BY rowid").all(contractId) as any[]).map(toCustomer);
  }
  customer(contractId: string, id: string): Customer | null {
    const r = this.db.query("SELECT * FROM customers WHERE contract_id = ? AND id = ?").get(contractId, id);
    return r ? toCustomer(r) : null;
  }
  /** Moves a customer and stamps the stepper (`step` defaults to the state name). */
  setCustomer(contractId: string, id: string, state: CustomerState, extra: { refusal?: string | null; offers?: string[]; planReason?: string; optedOut?: boolean; step?: string } = {}) {
    const c = this.customer(contractId, id);
    if (!c) return;
    const steps = { ...c.steps, [extra.step ?? state]: nowIso() };
    this.db.query("UPDATE customers SET state = ?, steps = ?, refusal = COALESCE(?, refusal), offers = COALESCE(?, offers), plan_reason = COALESCE(?, plan_reason), opted_out = ? WHERE contract_id = ? AND id = ?")
      .run(state, JSON.stringify(steps), extra.refusal ?? null, extra.offers ? JSON.stringify(extra.offers) : null, extra.planReason ?? null, extra.optedOut ?? c.optedOut ? 1 : 0, contractId, id);
  }
  /** Opt-outs are global for the business: never call that number again, in any job. */
  optedOutPhones(): Set<string> {
    return new Set((this.db.query("SELECT DISTINCT phone FROM customers WHERE opted_out = 1").all() as { phone: string }[]).map((r) => r.phone));
  }

  // workers
  upsertWorker(w: Worker) {
    this.db.query(`INSERT INTO workers (name, pay_to, call_url, bonus_url, price, bonus, reputation, probation_left, is_new, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET pay_to = excluded.pay_to, call_url = excluded.call_url, bonus_url = excluded.bonus_url, price = excluded.price, bonus = excluded.bonus, badge = excluded.badge`)
      .run(w.name, w.payTo, w.callUrl, w.bonusUrl, w.price, w.bonus, w.reputation, w.probationLeft, w.isNew ? 1 : 0, w.badge);
  }
  workers(): Worker[] { return (this.db.query("SELECT * FROM workers ORDER BY rowid").all() as any[]).map(toWorker); }
  worker(name: string): Worker | null { const r = this.db.query("SELECT * FROM workers WHERE name = ?").get(name); return r ? toWorker(r) : null; }
  setReputation(name: string, rep: number) { this.db.query("UPDATE workers SET reputation = ? WHERE name = ?").run(rep, name); }
  useProbation(name: string) { this.db.query("UPDATE workers SET probation_left = MAX(0, probation_left - 1) WHERE name = ?").run(name); }

  // attempts
  addAttempt(a: Omit<Attempt, "result" | "verdict" | "quality" | "callSid">) {
    this.db.query("INSERT INTO attempts (id, contract_id, customer_id, worker, attempt_no, offers, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(a.id, a.contractId, a.customerId, a.worker, a.attemptNo, JSON.stringify(a.offers), a.createdAt, a.status);
  }
  updateAttempt(id: string, p: { callSid?: string; result?: CallResult; verdict?: Verdict; quality?: number; status?: string }) {
    this.db.query("UPDATE attempts SET call_sid = COALESCE(?, call_sid), result_json = COALESCE(?, result_json), verdict_json = COALESCE(?, verdict_json), quality = COALESCE(?, quality), status = COALESCE(?, status) WHERE id = ?")
      .run(p.callSid ?? null, p.result ? JSON.stringify(p.result) : null, p.verdict ? JSON.stringify(p.verdict) : null, p.quality ?? null, p.status ?? null, id);
  }
  attempt(id: string): Attempt | null { const r = this.db.query("SELECT * FROM attempts WHERE id = ?").get(id); return r ? toAttempt(r) : null; }
  attempts(contractId: string, customerId?: string): Attempt[] {
    const rows = customerId
      ? this.db.query("SELECT * FROM attempts WHERE contract_id = ? AND customer_id = ? ORDER BY rowid").all(contractId, customerId)
      : this.db.query("SELECT * FROM attempts WHERE contract_id = ? ORDER BY rowid").all(contractId);
    return (rows as any[]).map(toAttempt);
  }

  // outcomes
  addOutcome(o: Omit<Outcome, "confirmTokenHash" | "confirmExpiresAt" | "confirmedAt" | "attendedSig">) {
    this.db.query("INSERT INTO outcomes (id, contract_id, customer_id, attempt_id, booking_uid, slot_start, created_at, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(o.id, o.contractId, o.customerId, o.attemptId, o.bookingUid, o.slotStart, o.createdAt, o.state);
  }
  updateOutcome(id: string, p: Partial<Pick<Outcome, "state" | "confirmTokenHash" | "confirmExpiresAt" | "confirmedAt" | "attendedSig">>) {
    this.db.query("UPDATE outcomes SET state = COALESCE(?, state), confirm_token_hash = COALESCE(?, confirm_token_hash), confirm_expires_at = COALESCE(?, confirm_expires_at), confirmed_at = COALESCE(?, confirmed_at), attended_sig = COALESCE(?, attended_sig) WHERE id = ?")
      .run(p.state ?? null, p.confirmTokenHash ?? null, p.confirmExpiresAt ?? null, p.confirmedAt ?? null, p.attendedSig ?? null, id);
  }
  /** Compare-and-set so a double click or a racing invoice can't move state twice. */
  transitionOutcome(id: string, from: OutcomeState, to: OutcomeState, p: { confirmedAt?: string } = {}): boolean {
    return this.db.query("UPDATE outcomes SET state = ?, confirmed_at = COALESCE(?, confirmed_at) WHERE id = ? AND state = ?").run(to, p.confirmedAt ?? null, id, from).changes > 0;
  }
  outcome(id: string): Outcome | null { const r = this.db.query("SELECT * FROM outcomes WHERE id = ?").get(id); return r ? toOutcome(r) : null; }
  outcomeByToken(hash: string): Outcome | null { const r = this.db.query("SELECT * FROM outcomes WHERE confirm_token_hash = ?").get(hash); return r ? toOutcome(r) : null; }
  outcomes(contractId: string): Outcome[] { return (this.db.query("SELECT * FROM outcomes WHERE contract_id = ? ORDER BY rowid").all(contractId) as any[]).map(toOutcome); }
  outcomesInState(state: OutcomeState): Outcome[] { return (this.db.query("SELECT * FROM outcomes WHERE state = ?").all(state) as any[]).map(toOutcome); }

  // ledger
  addPayment(p: Payment) {
    this.db.query("INSERT INTO payments (id, contract_id, direction, from_addr, to_addr, counterparty, purpose, amount, tx_hash, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(p.id, p.contractId, p.direction, p.from, p.to, p.counterparty, p.purpose, p.amount, p.txHash, p.refId, p.createdAt);
  }
  payments(contractId: string): Payment[] {
    return (this.db.query("SELECT * FROM payments WHERE contract_id = ? ORDER BY created_at, rowid").all(contractId) as any[]).map((r) => ({
      id: r.id, contractId: r.contract_id, direction: r.direction, from: r.from_addr, to: r.to_addr, counterparty: r.counterparty,
      purpose: r.purpose, amount: r.amount, txHash: r.tx_hash, refId: r.ref_id, createdAt: r.created_at,
    }));
  }
  spent(contractId: string): string { return addUsd("0.00", ...this.payments(contractId).filter((p) => p.direction === "out").map((p) => p.amount)); }
  earned(contractId: string): string { return addUsd("0.00", ...this.payments(contractId).filter((p) => p.direction === "in").map((p) => p.amount)); }

  refusals(contractId: string) {
    return (this.db.query("SELECT * FROM refusals WHERE contract_id = ? OR contract_id IS NULL ORDER BY created_at, rowid").all(contractId) as any[])
      .map((r) => ({ id: r.id, code: r.code, actor: r.actor, action: r.action, clause: r.clause, evidence: j(r.evidence, {}), createdAt: r.created_at }));
  }
}

const toCustomer = (r: any): Customer => ({
  id: r.id, contractId: r.contract_id, name: r.name, phone: r.phone, email: r.email, missedAt: r.missed_at, consentSource: r.consent_source,
  optedOut: !!r.opted_out, state: r.state, refusal: r.refusal, offers: j(r.offers, []), planReason: r.plan_reason, steps: j(r.steps, {}),
});
const toWorker = (r: any): Worker => ({
  name: r.name, payTo: r.pay_to, callUrl: r.call_url, bonusUrl: r.bonus_url, price: r.price, bonus: r.bonus,
  reputation: r.reputation, probationLeft: r.probation_left, isNew: !!r.is_new, badge: r.badge,
});
const toAttempt = (r: any): Attempt => ({
  id: r.id, contractId: r.contract_id, customerId: r.customer_id, worker: r.worker, attemptNo: r.attempt_no, callSid: r.call_sid,
  offers: j(r.offers, []), result: j(r.result_json, null), verdict: j(r.verdict_json, null), quality: r.quality, createdAt: r.created_at, status: r.status,
});
const toOutcome = (r: any): Outcome => ({
  id: r.id, contractId: r.contract_id, customerId: r.customer_id, attemptId: r.attempt_id, bookingUid: r.booking_uid, slotStart: r.slot_start,
  confirmTokenHash: r.confirm_token_hash, confirmExpiresAt: r.confirm_expires_at, confirmedAt: r.confirmed_at, attendedSig: r.attended_sig,
  createdAt: r.created_at, state: r.state,
});
