// The firewall. Plain TypeScript, no model inside. Every action passes through check() and gets
// ALLOW or a typed refusal — whatever SERV was talked into, nothing outside the contract happens.
import type { ContractStatus, OutcomeContract, PermittedAction } from "@foreman/shared/contract";
import { addUsd, cents, gtUsd } from "@foreman/shared/money";
import type { RefusalCode } from "@foreman/shared/types";

export type Action =
  | { kind: "place_call"; idemKey: string; customer: { id: string; consentSource: string | null; optedOut: boolean; attempts: number }; worker: { name: string; reputation: number; probationLeft: number } }
  | { kind: "pay"; idemKey: string; payTo: string; amount: string; purpose: string; humanApproved?: boolean }
  | { kind: "create_booking"; idemKey: string; callVerified: boolean; slot: string; offered: string[] }
  | { kind: "cancel_booking"; idemKey: string; bookingUid: string; ownUnconfirmedHold: boolean }
  | { kind: "send_email"; idemKey: string }
  | { kind: "apply_worker_result"; idemKey: string }
  | { kind: string; idemKey?: string; [k: string]: unknown };

export interface Ctx {
  contract: OutcomeContract;
  status: ContractStatus;
  killSwitch: boolean;
  now: Date;
  spent: string;
  seen: (idemKey: string) => boolean;
}

export type Decision = { ok: true } | { ok: false; code: RefusalCode; clause: string; details: Record<string, unknown> };

const allow = (): Decision => ({ ok: true });
const refuse = (code: RefusalCode, clause: string, details: Record<string, unknown> = {}): Decision => ({ ok: false, code, clause, details });

/** Firewall action → the contract permission it needs. Payments are governed by `spend`, not by an action. */
const NEEDS: Record<string, PermittedAction | "spend" | "internal"> = {
  place_call: "place_call",
  create_booking: "create_booking",
  cancel_booking: "cancel_own_unconfirmed_booking",
  send_email: "send_confirmation_email",
  pay: "spend",
  apply_worker_result: "internal",
};

export function localHHMM(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);
}

export function withinHours(c: OutcomeContract, now: Date): boolean {
  const t = localHHMM(now, c.business.timeZone);
  const { start, end } = c.callPolicy.allowedHours;
  return start <= end ? t >= start && t < end : t >= start || t < end;
}

export function check(a: Action, ctx: Ctx): Decision {
  const c = ctx.contract;
  if (ctx.killSwitch) return refuse("kill_switch_engaged", "operator kill switch");
  if (ctx.status !== "running") return refuse("contract_not_running", "lifecycle: only running contracts act", { status: ctx.status });
  if (ctx.now > new Date(c.spend.expiresAt)) return refuse("contract_expired", "spend.expiresAt", { expiresAt: c.spend.expiresAt });

  const need = NEEDS[a.kind];
  if (!need || (need !== "spend" && need !== "internal" && !c.permittedActions.includes(need)))
    return refuse("action_not_permitted", "permittedActions", { requested: a.kind, permitted: c.permittedActions });
  if (a.idemKey && ctx.seen(a.idemKey)) return refuse("duplicate_action", "idempotency", { key: a.idemKey });

  switch (a.kind) {
    case "place_call": {
      const x = a as Extract<Action, { kind: "place_call" }>;
      if (!x.customer.consentSource?.trim()) return refuse("no_consent", "consent.required", { customer: x.customer.id });
      if (x.customer.optedOut) return refuse("opted_out", "callPolicy.honourOptOut", { customer: x.customer.id });
      if (!withinHours(c, ctx.now))
        return refuse("quiet_hours", "callPolicy.allowedHours", { local: localHHMM(ctx.now, c.business.timeZone), allowed: c.callPolicy.allowedHours });
      if (x.customer.attempts >= c.spend.perCustomerMaxAttempts)
        return refuse("max_attempts_reached", "spend.perCustomerMaxAttempts", { attempts: x.customer.attempts, max: c.spend.perCustomerMaxAttempts });
      if (x.worker.reputation < c.workerPolicy.reputationFloor && x.worker.probationLeft <= 0)
        return refuse("worker_below_reputation_floor", "workerPolicy.reputationFloor", { worker: x.worker.name, reputation: x.worker.reputation, floor: c.workerPolicy.reputationFloor });
      return allow();
    }
    case "pay": {
      const x = a as Extract<Action, { kind: "pay" }>;
      if (!c.spend.payeeAllowlist.some((p) => p.toLowerCase() === x.payTo.toLowerCase()))
        return refuse("payee_not_allowlisted", "spend.payeeAllowlist", { payTo: x.payTo });
      if (gtUsd(x.amount, c.spend.perCallCap)) return refuse("per_call_cap_exceeded", "spend.perCallCap", { amount: x.amount, cap: c.spend.perCallCap });
      if (cents(addUsd(ctx.spent, x.amount)) > cents(c.spend.totalBudget))
        return refuse("over_budget", "spend.totalBudget", { spent: ctx.spent, amount: x.amount, budget: c.spend.totalBudget });
      if (gtUsd(x.amount, c.approval.humanApprovalAbove) && !x.humanApproved)
        return refuse("needs_human_approval", "approval.humanApprovalAbove", { amount: x.amount, threshold: c.approval.humanApprovalAbove });
      return allow();
    }
    case "create_booking": {
      const x = a as Extract<Action, { kind: "create_booking" }>;
      if (!x.callVerified) return refuse("proof_missing", "never book on an unverified call");
      if (!x.offered.some((o) => new Date(o).getTime() === new Date(x.slot).getTime()))
        return refuse("slot_not_offered", "offer_slot", { slot: x.slot, offered: x.offered });
      return allow();
    }
    case "cancel_booking": {
      const x = a as Extract<Action, { kind: "cancel_booking" }>;
      if (!x.ownUnconfirmedHold) return refuse("action_not_permitted", "cancel_own_unconfirmed_booking", { bookingUid: x.bookingUid });
      return allow();
    }
    default:
      return allow();
  }
}
