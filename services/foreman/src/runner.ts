// The job runner: plan → hire → verify → book → confirm. SERV makes the judgment calls; the firewall and the
// oracle make the money calls. Customers are processed one at a time so the live feed reads like a story.
import type { OutcomeContract } from "@foreman/shared/contract";
import { calClient, cancelBooking, createBooking, freeSlots } from "@foreman/shared/calcom";
import { addUsd, cents, usd } from "@foreman/shared/money";
import type { ServDecision } from "@foreman/shared/serv";
import { verdictTrusted } from "@foreman/shared/sign";
import { endCall, twilioCreds } from "@foreman/shared/twilio";
import type { CallRequest, CallResult, Hex, Verdict } from "@foreman/shared/types";
import { confirmEmail, newToken } from "./confirm";
import type { DB } from "./db";
import { newId, nowIso, setting } from "./db";
import type { EventLog } from "./events";
import { check } from "./firewall/check";
import type { Action, Ctx } from "./firewall/check";
import { keys } from "./idempotency";
import type { Idempotency } from "./idempotency";
import { sendMail } from "./mailer";
import { mask } from "./mask";
import type { Payments } from "./pay";
import { auditTranscript } from "./planner/audit";
import { planCalls } from "./planner/plan";
import { selectWorker } from "./planner/select";
import type { Customer, CustomerState, Store, Worker } from "./store";

export interface RunnerDeps {
  db: DB;
  store: Store;
  log: EventLog;
  idem: Idempotency;
  payments: Payments;
  oracleUrl: string;
  oracleSigner: () => Promise<Hex>;
  publicUrl: string;
  callbackUrl: string;
  eventTypeId: number;
  resultTimeoutMs?: number;
  now?: () => Date;
}

const TERMINAL: CustomerState[] = ["skipped", "declined", "no_answer", "opted_out", "failed", "confirmed", "paid", "attended", "paid_attended", "cancelled"];
export const DISCLOSURE = (business: string) => `Hi, this is an AI assistant calling on behalf of ${business}.`;

export class Runner {
  private waiting = new Map<string, (r: CallResult) => void>();
  private running = new Set<string>();
  constructor(private d: RunnerDeps) {}

  private now = () => this.d.now?.() ?? new Date();

  ctx(contractId: string): Ctx {
    const c = this.d.store.contract(contractId)!;
    return {
      contract: c.contract, status: c.status, killSwitch: setting(this.d.db, "kill_switch") === "1",
      now: this.now(), spent: this.d.store.spent(contractId), seen: this.d.idem.seen,
    };
  }

  /** Firewall check that logs refusals to the audit chain and the Safety page. */
  guard(contractId: string, a: Action, evidence: Record<string, unknown> = {}): boolean {
    const r = check(a, this.ctx(contractId));
    if (!r.ok) this.d.log.refuse(contractId, r.code, "foreman", a.kind, r.clause, { ...r.details, ...evidence });
    return r.ok;
  }

  setCustomer(contractId: string, c: Customer, state: CustomerState, extra: Parameters<Store["setCustomer"]>[3] = {}) {
    this.d.store.setCustomer(contractId, c.id, state, extra);
    this.d.log.emit("customer_state", "foreman", { customerId: c.id, name: c.name, state, step: extra.step ?? state, refusal: extra.refusal ?? undefined }, contractId);
  }

  serv(contractId: string, d: ServDecision<unknown>, actor = "serv", extra: Record<string, unknown> = {}) {
    this.d.log.emit("serv_decision", actor, {
      purpose: d.purpose, model: d.model, effort: d.effort, source: d.source, ms: d.ms, tokens: d.usage, guards: d.guards,
      decision: d.data, error: d.error, blocked: d.blocked, ...extra,
    }, contractId);
  }

  // ───────────────────────────── job ─────────────────────────────

  async start(contractId: string) {
    if (this.running.has(contractId)) return;
    this.running.add(contractId);
    try {
      await this.run(contractId);
    } finally {
      this.running.delete(contractId);
    }
  }

  private async run(contractId: string) {
    const { store, log } = this.d;
    const { contract } = store.contract(contractId)!;
    const optedOut = store.optedOutPhones();

    // Consent and opt-out are filtered *before* SERV ever sees a customer.
    const eligible: Customer[] = [];
    for (const c of store.customers(contractId)) {
      if (c.state !== "eligible") continue;
      const best = store.workers().sort((a, b) => b.reputation - a.reputation)[0]!;
      const r = check({
        kind: "place_call", idemKey: "",
        customer: { id: c.id, consentSource: c.consentSource, optedOut: c.optedOut || optedOut.has(c.phone), attempts: 0 },
        worker: { name: best.name, reputation: best.reputation, probationLeft: best.probationLeft },
      }, this.ctx(contractId));
      if (!r.ok && (r.code === "no_consent" || r.code === "opted_out")) {
        log.refuse(contractId, r.code, "foreman", "place_call", r.clause, { customerId: c.id, name: c.name, cost: "0.00" });
        log.emit("customer_skipped", "firewall", { customerId: c.id, name: c.name, code: r.code, cost: "0.00" }, contractId);
        this.setCustomer(contractId, c, "skipped", { refusal: r.code });
      } else if (!r.ok) {
        log.refuse(contractId, r.code, "foreman", "place_call", r.clause, { customerId: c.id });
        return; // kill switch, quiet hours, lifecycle: the whole job waits
      } else eligible.push(c);
    }
    if (!eligible.length) return this.maybeComplete(contractId);

    const from = new Date(this.now().getTime() + 2 * 3600_000);
    const to = new Date(this.now().getTime() + contract.outcome.calendar.searchWindowDays * 86400_000);
    const free = await freeSlots(calClient(), contract.outcome.calendar.eventTypeId, from, to, contract.business.timeZone);
    const plan = await planCalls(eligible, free, contract.business.timeZone, this.now());
    this.serv(contractId, plan, "serv", { freeSlots: free.length });

    for (const step of plan.data.order) {
      const c = eligible.find((x) => x.id === step.customerId)!;
      this.setCustomer(contractId, c, "planned", { offers: step.offer, planReason: step.reason });
    }
    for (const step of plan.data.order) {
      if (step.offer.length === 0) continue;
      const c = store.customer(contractId, step.customerId)!;
      await this.processCustomer(contractId, c, step.offer);
    }
    this.maybeComplete(contractId);
  }

  maybeComplete(contractId: string) {
    const c = this.d.store.contract(contractId);
    if (!c || c.status !== "running") return;
    const cs = this.d.store.customers(contractId);
    if (cs.every((x) => TERMINAL.includes(x.state) || x.state === "confirmation_sent")) {
      // Calling phase done. Claims and confirmations continue; own-hold cleanup is still allowed.
      this.d.store.setStatus(contractId, "completed");
      this.d.log.emit("contract_completed", "foreman", {
        spent: this.d.store.spent(contractId), earned: this.d.store.earned(contractId),
        customers: Object.fromEntries(cs.map((x) => [x.id, x.state])),
      }, contractId);
    }
  }

  // ─────────────────────────── one customer ───────────────────────────

  private async processCustomer(contractId: string, c0: Customer, offers: string[]) {
    const { store, log } = this.d;
    const { contract } = store.contract(contractId)!;
    let tried: string[] = [];

    for (let attemptNo = store.attempts(contractId, c0.id).length + 1; attemptNo <= contract.spend.perCustomerMaxAttempts; attemptNo++) {
      const c = store.customer(contractId, c0.id)!;
      const verifiedCalls = store.attempts(contractId).filter((a) => a.status === "verified").length;
      const { sel, decision } = await selectWorker(store.workers(), {
        floor: contract.workerPolicy.reputationFloor, verifiedCalls,
        remainingBudget: usd(Math.max(0, cents(contract.spend.totalBudget) - cents(store.spent(contractId)))), exclude: tried,
      });
      if (decision) this.serv(contractId, decision, "serv", { customerId: c.id });
      if (!sel) {
        log.refuse(contractId, "worker_below_reputation_floor", "foreman", "place_call", "workerPolicy.reputationFloor", { customerId: c.id, note: "no eligible worker" });
        return this.setCustomer(contractId, c, "failed", { refusal: "worker_below_reputation_floor" });
      }
      const w = sel.worker;
      const callKey = keys.call(contractId, c.id, attemptNo);
      const ok = this.guard(contractId, {
        kind: "place_call", idemKey: callKey,
        customer: { id: c.id, consentSource: c.consentSource, optedOut: c.optedOut, attempts: attemptNo - 1 },
        worker: { name: w.name, reputation: w.reputation, probationLeft: w.probationLeft },
      }, { customerId: c.id, worker: w.name });
      if (!ok) return;

      const attemptId = newId("att");
      const createdAt = nowIso();
      store.addAttempt({ id: attemptId, contractId, customerId: c.id, worker: w.name, attemptNo, offers, createdAt, status: "requested" });
      log.emit("worker_hired", "foreman", {
        worker: w.name, attemptId, customerId: c.id, name: c.name, reason: sel.reason, probation: sel.probation, source: sel.source,
        price: w.price, attemptNo,
      }, contractId);

      const req: CallRequest = {
        attemptId, to: c.phone, business: contract.business.name, customerName: c.name, missed: c.missedAt, offers,
        timeZone: contract.business.timeZone, maxSeconds: contract.callPolicy.maxCallSeconds, callbackUrl: this.d.callbackUrl,
      };
      const waiter = this.waitFor(attemptId);
      this.d.idem.begin(callKey, "call");
      const paid = await this.d.payments.payOut({ contractId, url: w.callUrl, body: req, counterparty: w.name, payTo: w.payTo, purpose: "call", refId: attemptId, customerId: c.id });
      if (!paid.ok) {
        this.d.idem.fail(callKey);
        this.waiting.delete(attemptId);
        store.updateAttempt(attemptId, { status: "failed" });
        if (["kill_switch_engaged", "over_budget", "contract_not_running", "contract_expired"].includes(paid.code)) return;
        tried = [...tried, w.name];
        continue; // carrier/seller error: try the next worker
      }
      this.d.idem.done(callKey, paid.json.callSid);
      if (sel.probation) store.useProbation(w.name);
      store.updateAttempt(attemptId, { callSid: paid.json.callSid, status: "dialing" });
      log.emit("call_started", w.name, { attemptId, customerId: c.id, name: c.name, callSid: paid.json.callSid, to: mask.phone(c.phone), offers }, contractId);
      this.setCustomer(contractId, c, "calling");

      const result = await waiter;
      const handled = await this.handleResult(contractId, c, w, attemptId, createdAt, offers, result);
      if (handled === "retry") { tried = []; continue; }
      return;
    }
    const c = store.customer(contractId, c0.id)!;
    if (!TERMINAL.includes(c.state)) {
      log.refuse(contractId, "max_attempts_reached", "foreman", "place_call", "spend.perCustomerMaxAttempts", { customerId: c.id, max: contract.spend.perCustomerMaxAttempts });
      this.setCustomer(contractId, c, "failed", { refusal: "max_attempts_reached" });
    }
  }

  private waitFor(attemptId: string): Promise<CallResult> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.waiting.delete(attemptId);
        resolve({ attemptId, callSid: "", outcome: "failed", requested: [], transcript: [], durationSec: 0 });
      }, this.d.resultTimeoutMs ?? 300_000);
      this.waiting.set(attemptId, (r) => { clearTimeout(t); resolve(r); });
    });
  }

  /** Called by POST /api/worker-result after the HMAC check. Returns false for unknown or duplicate results. */
  acceptResult(worker: string, r: CallResult): boolean {
    const a = this.d.store.attempt(r.attemptId);
    if (!a || a.worker !== worker || a.result) return false;
    this.d.store.updateAttempt(a.id, { result: r, status: "reported" });
    const resolve = this.waiting.get(r.attemptId);
    this.waiting.delete(r.attemptId);
    resolve?.(r);
    return true;
  }

  private async handleResult(contractId: string, c: Customer, w: Worker, attemptId: string, createdAt: string, offers: string[], r: CallResult): Promise<"done" | "retry"> {
    const { store, log } = this.d;
    const { contract } = store.contract(contractId)!;
    log.emit("call_reported", w.name, {
      attemptId, customerId: c.id, name: c.name, callSid: r.callSid, outcome: r.outcome, slotIndex: r.slotIndex,
      slot: r.slotIndex !== undefined ? offers[r.slotIndex] : undefined, durationSec: r.durationSec, transcript: r.transcript,
      requested: r.requested, injection: !!r.injection, claim: true,
    }, contractId);
    for (const dec of r.decisions ?? [])
      log.emit("serv_decision", w.name, { purpose: dec.purpose, model: dec.model, source: dec.source, ms: dec.ms, guards: dec.guards, decision: { intent: dec.intent, injection: dec.injection, requested: dec.requested }, error: dec.error, blocked: dec.blocked, attemptId, customerId: c.id }, contractId);

    // Whatever the caller asked for outside the contract is checked action by action and refused.
    const excerpt = r.transcript.find((t) => t.who === "caller" && t.text && !t.text.startsWith("["))?.text;
    if (r.injection) log.refuse(contractId, "injection_detected", w.name, "parse_turn", "serv_prompt_guard + intent schema", { customerId: c.id, excerpt });
    for (const req of r.requested) this.guard(contractId, { kind: req }, { customerId: c.id, requestedBy: "caller", excerpt });

    if (r.outcome === "no_answer" || r.outcome === "failed" || !r.callSid) {
      store.updateAttempt(attemptId, { status: "unverified" });
      // No answer costs Foreman the attempt, not the business. We don't redial immediately.
      this.setCustomer(contractId, c, r.outcome === "failed" ? "failed" : "no_answer");
      return "done";
    }

    // Hard key: the oracle reads the carrier's record. Paid with x402 like everything else.
    const v = await this.d.payments.payOut({
      contractId, url: `${this.d.oracleUrl}/v1/verify/call`, counterparty: "Oracle", payTo: this.oraclePayTo(contract), purpose: "verify_call", refId: attemptId, customerId: c.id,
      body: { attemptId, callSid: r.callSid, to: c.phone, claimedStatus: r.outcome, minSeconds: 20, attemptCreatedAt: createdAt },
    });
    if (!v.ok) { this.setCustomer(contractId, c, "failed", { refusal: v.code }); return "done"; }
    const verdict = v.json as Verdict;
    const signed = await verdictTrusted(verdict, await this.d.oracleSigner(), "call", attemptId);
    store.updateAttempt(attemptId, { verdict });
    log.emit("oracle_verdict", "oracle", { kind: "call", attemptId, customerId: c.id, worker: w.name, verdict: verdict.verdict, code: verdict.code, checks: verdict.checks, signature: verdict.signature, signatureValid: signed }, contractId);

    if (verdict.verdict !== "PASS" || !signed) {
      store.updateAttempt(attemptId, { status: "failed" });
      log.refuse(contractId, "proof_failed", "oracle", "apply_worker_result", "two-key release: oracle PASS required", {
        customerId: c.id, worker: w.name, subCode: signed ? verdict.code : "verdict_signature_invalid", claimed: r.outcome,
      });
      this.reputation(contractId, w, -40, `proof_failed:${verdict.code ?? "bad_signature"}`);
      return "retry";
    }
    store.updateAttempt(attemptId, { status: "verified" });
    this.setCustomer(contractId, c, "call_verified");

    // Proven-call bonus. Paying the bonus route *is* the bonus.
    await this.d.payments.payOut({ contractId, url: w.bonusUrl.replace(":attemptId", attemptId), body: {}, counterparty: w.name, payTo: w.payTo, purpose: "bonus", refId: attemptId, customerId: c.id });

    // Soft key: quality only moves reputation.
    const audit = await auditTranscript(r.transcript, contract.permittedActions, DISCLOSURE(contract.business.name));
    this.serv(contractId, audit, "serv", { attemptId, customerId: c.id, worker: w.name });
    store.updateAttempt(attemptId, { quality: audit.data.quality });
    log.emit("transcript_audited", "serv", { attemptId, worker: w.name, customerId: c.id, ...audit.data, flagged: audit.data.unauthorisedPromises.length > 0 }, contractId);
    this.reputation(contractId, w, audit.data.quality >= 0.7 ? 5 : -15, audit.data.quality >= 0.7 ? "proven call, good quality" : "proven call, low quality");

    switch (r.outcome) {
      case "accepted":
        await this.book(contractId, c, attemptId, offers, r.slotIndex);
        return "done";
      case "opted_out":
        this.setCustomer(contractId, c, "opted_out", { optedOut: true });
        return "done";
      default:
        this.setCustomer(contractId, c, "declined");
        return "done";
    }
  }

  private oraclePayTo(c: OutcomeContract): Hex {
    return (process.env.ORACLE_PAYTO ?? c.spend.payeeAllowlist[c.spend.payeeAllowlist.length - 1]) as Hex;
  }

  reputation(contractId: string, w: Worker, delta: number, reason: string) {
    const cur = this.d.store.worker(w.name)!;
    const next = Math.max(0, Math.min(100, cur.reputation + delta));
    this.d.store.setReputation(w.name, next);
    this.d.log.emit("reputation_changed", "foreman", { worker: w.name, from: cur.reputation, to: next, delta, reason }, contractId);
    const { contract } = this.d.store.contract(contractId)!;
    const floor = contract.workerPolicy.reputationFloor;
    if (cur.reputation >= floor && next < floor)
      this.d.log.refuse(contractId, "worker_below_reputation_floor", "foreman", "hire", "workerPolicy.reputationFloor", { worker: w.name, reputation: next, floor, note: "will not be hired again" });
  }

  // ─────────────────────────── booking + confirmation ───────────────────────────

  private async book(contractId: string, c: Customer, attemptId: string, offers: string[], slotIndex: number | undefined) {
    const { store, log, idem } = this.d;
    const { contract } = store.contract(contractId)!;
    const slot = slotIndex !== undefined ? offers[slotIndex] : undefined;
    const bookingKey = keys.booking(contractId, c.id);
    if (!slot || !this.guard(contractId, { kind: "create_booking", idemKey: bookingKey, callVerified: true, slot, offered: offers }, { customerId: c.id })) return;
    const outcomeId = newId("out");
    idem.begin(bookingKey, "booking", { contractId, customerId: c.id, email: c.email, outcomeId, attemptId, slot });
    let uid: string;
    try {
      const b = await createBooking(calClient(), {
        eventTypeId: contract.outcome.calendar.eventTypeId, start: slot,
        attendee: { name: c.name, email: c.email, timeZone: contract.business.timeZone, phoneNumber: c.phone },
        metadata: { idemKey: bookingKey, contractId, customerId: c.id, outcomeId },
      });
      uid = b.uid;
    } catch (e) {
      idem.fail(bookingKey);
      log.emit("booking_cancelled", "foreman", { customerId: c.id, error: String((e as Error).message), slot }, contractId);
      return this.setCustomer(contractId, c, "failed", { refusal: "booking_failed" });
    }
    idem.done(bookingKey, uid);
    store.addOutcome({ id: outcomeId, contractId, customerId: c.id, attemptId, bookingUid: uid, slotStart: slot, createdAt: nowIso(), state: "booked" });
    log.emit("booking_created", "foreman", { outcomeId, customerId: c.id, name: c.name, bookingUid: uid, slot }, contractId);
    this.setCustomer(contractId, c, "booked");

    const emailKey = keys.email(contractId, outcomeId);
    if (!this.guard(contractId, { kind: "send_email", idemKey: emailKey }, { customerId: c.id })) return;
    idem.begin(emailKey, "email");
    const t = newToken();
    store.updateOutcome(outcomeId, { confirmTokenHash: t.hash, confirmExpiresAt: t.expiresAt });
    const link = `${this.d.publicUrl}/c/${t.token}`;
    const mail = confirmEmail({ business: contract.business.name, name: c.name, slot, tz: contract.business.timeZone, link });
    try {
      const sent = await sendMail({ to: c.email, ...mail, links: { page: link, confirm: `${link}/confirm`, decline: `${link}/decline` } });
      idem.done(emailKey, sent.id);
      store.updateOutcome(outcomeId, { state: "confirmation_sent" });
      log.emit("confirmation_sent", "foreman", { outcomeId, customerId: c.id, name: c.name, to: mask.email(c.email), via: sent.via, expiresAt: t.expiresAt, slot }, contractId);
      this.setCustomer(contractId, c, "confirmation_sent");
    } catch (e) {
      idem.fail(emailKey);
      log.emit("booking_cancelled", "foreman", { outcomeId, error: `email failed: ${(e as Error).message}` }, contractId);
      await this.releaseHold(outcomeId, "confirmation email could not be sent");
    }
  }

  /** Customer clicked Confirm. Single-use: a double click returns the same result without a second event. */
  confirm(outcomeId: string): boolean {
    const o = this.d.store.outcome(outcomeId)!;
    if (!this.d.store.transitionOutcome(outcomeId, "confirmation_sent", "confirmed_by_customer", { confirmedAt: nowIso() })) return false;
    const c = this.d.store.customer(o.contractId, o.customerId)!;
    this.d.log.emit("customer_confirmed", "customer", { outcomeId, customerId: c.id, name: c.name, slot: o.slotStart }, o.contractId);
    this.setCustomer(o.contractId, c, "confirmed");
    return true;
  }

  async decline(outcomeId: string): Promise<boolean> {
    const o = this.d.store.outcome(outcomeId)!;
    if (o.state !== "confirmation_sent") return false;
    const c = this.d.store.customer(o.contractId, o.customerId)!;
    this.d.log.emit("customer_declined", "customer", { outcomeId, customerId: c.id, name: c.name }, o.contractId);
    await this.releaseHold(outcomeId, "customer declined from the confirmation link");
    return true;
  }

  /** Cancel Foreman's own unconfirmed hold (firewall: cancel_own_unconfirmed_booking). */
  async releaseHold(outcomeId: string, reason: string) {
    const o = this.d.store.outcome(outcomeId)!;
    const own = (o.state === "booked" || o.state === "confirmation_sent") && !!o.bookingUid;
    if (!this.guard(o.contractId, { kind: "cancel_booking", idemKey: `cancel:${outcomeId}`, bookingUid: o.bookingUid ?? "", ownUnconfirmedHold: own }, { outcomeId })) return;
    await cancelBooking(calClient(), o.bookingUid!, reason).catch(() => {});
    this.d.store.updateOutcome(outcomeId, { state: "cancelled" });
    const c = this.d.store.customer(o.contractId, o.customerId)!;
    this.d.log.emit("booking_cancelled", "foreman", { outcomeId, customerId: c.id, bookingUid: o.bookingUid, reason }, o.contractId);
    this.setCustomer(o.contractId, c, "cancelled");
  }

  /** No click before expiry → release the hold; Foreman earns nothing. */
  async sweepExpired() {
    for (const o of this.d.store.outcomesInState("confirmation_sent"))
      if (o.confirmExpiresAt && new Date(o.confirmExpiresAt) < this.now()) await this.releaseHold(o.id, "not confirmed within 2 hours");
    // Lifecycle: a contract past spend.expiresAt stops spending; its outstanding unconfirmed holds are released.
    const rows = this.d.db.query("SELECT id FROM contracts WHERE status IN ('approved','running','paused')").all() as { id: string }[];
    for (const { id } of rows) {
      const k = this.d.store.contract(id)!;
      if (new Date(k.contract.spend.expiresAt) >= this.now()) continue;
      this.d.store.setStatus(id, "expired");
      this.d.log.emit("contract_completed", "foreman", { expired: true, expiresAt: k.contract.spend.expiresAt, spent: this.d.store.spent(id), earned: this.d.store.earned(id) }, id);
      for (const o of this.d.store.outcomes(id)) if (o.state === "booked" || o.state === "confirmation_sent") await this.releaseHold(o.id, "contract expired");
    }
  }

  /** Kill switch: end calls that are still ringing or talking. */
  async endInFlight() {
    const rows = this.d.db.query("SELECT call_sid FROM attempts WHERE status = 'dialing' AND call_sid IS NOT NULL").all() as { call_sid: string }[];
    for (const r of rows) await endCall(twilioCreds("worker"), r.call_sid).catch(() => {});
    return rows.length;
  }

  totals(contractId: string) {
    const payments = this.d.store.payments(contractId);
    const outs = payments.filter((p) => p.direction === "out");
    const ins = payments.filter((p) => p.direction === "in");
    const spent = addUsd("0.00", ...outs.map((p) => p.amount));
    const earned = addUsd("0.00", ...ins.map((p) => p.amount));
    const m = cents(earned) - cents(spent);
    return { spent, earned, margin: `${m < 0 ? "-" : ""}${usd(Math.abs(m))}` };
  }
}
