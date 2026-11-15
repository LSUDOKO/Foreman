import { describe, expect, test } from "bun:test";
import { check } from "./check";
import type { Action, Ctx } from "./check";
import { ADDR, contract } from "../test/fixtures";
import { REFUSAL_CODES } from "@foreman/shared/types";

const tenAmIST = new Date("2026-11-15T04:30:00Z");
const ctx = (o: Partial<Ctx> = {}): Ctx => ({ contract: contract(), status: "running", killSwitch: false, now: tenAmIST, spent: "0.00", seen: () => false, ...o });
const call = (o: any = {}): Action => ({
  kind: "place_call", idemKey: "k_call",
  customer: { id: "c1", consentSource: "booking form opt-in", optedOut: false, attempts: 0, ...o.customer },
  worker: { name: "ClearCall", reputation: 90, probationLeft: 0, ...o.worker },
});
const pay = (o: any = {}): Action => ({ kind: "pay", idemKey: "k_pay", payTo: ADDR.clearcall, amount: "0.50", purpose: "call", ...o });
const code = (a: Action, c?: Partial<Ctx>) => { const d = check(a, ctx(c)); return d.ok ? "ALLOW" : d.code; };

describe("firewall", () => {
  test("allows a normal call and payment", () => {
    expect(code(call())).toBe("ALLOW");
    expect(code(pay())).toBe("ALLOW");
  });
  test("no_consent when consent_source is empty", () => expect(code(call({ customer: { consentSource: "" } }))).toBe("no_consent"));
  test("opted_out", () => expect(code(call({ customer: { optedOut: true } }))).toBe("opted_out"));
  test("quiet_hours at 22:00 business time; allowed at 10:00", () => {
    expect(code(call(), { now: new Date("2026-11-15T16:30:00Z") })).toBe("quiet_hours");
    expect(code(call(), { now: tenAmIST })).toBe("ALLOW");
  });
  test("payee_not_allowlisted", () => expect(code(pay({ payTo: "0x9999999999999999999999999999999999999999" }))).toBe("payee_not_allowlisted"));
  test("per_call_cap_exceeded for 0.61 when cap is 0.60", () => expect(code(pay({ amount: "0.61" }))).toBe("per_call_cap_exceeded"));
  test("over_budget when spent 4.80 + 0.50 > 5.00", () => expect(code(pay(), { spent: "4.80" })).toBe("over_budget"));
  test("exactly at budget is allowed", () => expect(code(pay(), { spent: "4.50" })).toBe("ALLOW"));
  test("needs_human_approval above threshold", () => {
    const c = contract();
    c.spend.perCallCap = "2.00";
    expect(code(pay({ amount: "1.50" }), { contract: c })).toBe("needs_human_approval");
    expect(code(pay({ amount: "1.50", humanApproved: true }), { contract: c })).toBe("ALLOW");
  });
  test("action_not_permitted for issue_refund and for cancelling a booking Foreman didn't create", () => {
    expect(code({ kind: "issue_refund", idemKey: "x" })).toBe("action_not_permitted");
    expect(code({ kind: "cancel_bookings" })).toBe("action_not_permitted");
    expect(code({ kind: "cancel_booking", idemKey: "x", bookingUid: "bk", ownUnconfirmedHold: false })).toBe("action_not_permitted");
    expect(code({ kind: "cancel_booking", idemKey: "x", bookingUid: "bk", ownUnconfirmedHold: true })).toBe("ALLOW");
  });
  test("action_not_permitted when the contract narrowed permissions", () => {
    const c = contract();
    c.permittedActions = c.permittedActions.filter((a) => a !== "send_confirmation_email");
    expect(code({ kind: "send_email", idemKey: "e" }, { contract: c })).toBe("action_not_permitted");
  });
  test("duplicate_action for a repeated bookingKey", () => {
    const a: Action = { kind: "create_booking", idemKey: "bk1", callVerified: true, slot: "2026-11-16T10:30:00Z", offered: ["2026-11-16T10:30:00Z"] };
    expect(code(a)).toBe("ALLOW");
    expect(code(a, { seen: (k) => k === "bk1" })).toBe("duplicate_action");
  });
  test("worker_below_reputation_floor for 40 when probation is used up; probation allows once", () => {
    expect(code(call({ worker: { reputation: 40, probationLeft: 0 } }))).toBe("worker_below_reputation_floor");
    expect(code(call({ worker: { reputation: 40, probationLeft: 1 } }))).toBe("ALLOW");
  });
  test("max_attempts_reached", () => expect(code(call({ customer: { attempts: 2 } }))).toBe("max_attempts_reached"));
  test("proof_missing for create_booking without a verified call", () =>
    expect(code({ kind: "create_booking", idemKey: "b", callVerified: false, slot: "2026-11-16T10:30:00Z", offered: ["2026-11-16T10:30:00Z"] })).toBe("proof_missing"));
  test("slot_not_offered", () =>
    expect(code({ kind: "create_booking", idemKey: "b", callVerified: true, slot: "2026-11-16T11:00:00Z", offered: ["2026-11-16T10:30:00.000Z"] })).toBe("slot_not_offered"));
  test("contract lifecycle", () => {
    expect(code(call(), { status: "approved" })).toBe("contract_not_running");
    expect(code(call(), { now: new Date("2026-11-17T00:00:00Z") })).toBe("contract_expired");
  });
  test("cancelling own unconfirmed holds is allowed after the job stops, but not under the kill switch", () => {
    const own: Action = { kind: "cancel_booking", idemKey: "x", bookingUid: "bk", ownUnconfirmedHold: true };
    expect(code(own, { status: "completed" })).toBe("ALLOW");
    expect(code(own, { now: new Date("2026-11-17T00:00:00Z") })).toBe("ALLOW");
    expect(code(own, { killSwitch: true })).toBe("kill_switch_engaged");
  });
  test("kill_switch_engaged overrides everything", () => {
    expect(code(pay(), { killSwitch: true })).toBe("kill_switch_engaged");
    expect(code({ kind: "issue_refund" }, { killSwitch: true, status: "draft" })).toBe("kill_switch_engaged");
  });
  test("refusals name the contract clause", () => {
    const d = check(pay({ amount: "0.61" }), ctx());
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.clause).toBe("spend.perCallCap");
  });
});

// One row per refusal code check() can emit. If a code is added to REFUSAL_CODES, this test fails until it has a row
// here (or is listed as raised by the runner rather than the firewall).
describe("firewall refusal table", () => {
  const RUNNER_ONLY = ["proof_failed", "injection_detected"]; // raised in runner.ts from oracle verdicts / SERV turn flags
  const bigApproval = () => { const c = contract(); c.spend.perCallCap = "2.00"; return c; };
  const rows: [string, Action, Partial<Ctx>][] = [
    ["kill_switch_engaged", pay(), { killSwitch: true }],
    ["contract_not_running", call(), { status: "paused" as any }],
    ["contract_expired", pay(), { now: new Date("2026-11-17T00:00:00Z") }],
    ["action_not_permitted", { kind: "issue_refund", idemKey: "r" }, {}],
    ["duplicate_action", pay(), { seen: () => true }],
    ["no_consent", call({ customer: { consentSource: "   " } }), {}],
    ["opted_out", call({ customer: { optedOut: true } }), {}],
    ["quiet_hours", call(), { now: new Date("2026-11-15T01:00:00Z") }], // 06:30 IST
    ["max_attempts_reached", call({ customer: { attempts: 5 } }), {}],
    ["worker_below_reputation_floor", call({ worker: { reputation: 0, probationLeft: 0 } }), {}],
    ["payee_not_allowlisted", pay({ payTo: ADDR.business }), {}],
    ["per_call_cap_exceeded", pay({ amount: "0.61" }), {}],
    ["over_budget", pay({ amount: "0.01" }), { spent: "5.00" }],
    ["needs_human_approval", pay({ amount: "1.01" }), { contract: bigApproval() }],
    ["proof_missing", { kind: "create_booking", idemKey: "b", callVerified: false, slot: "2026-11-16T10:30:00Z", offered: ["2026-11-16T10:30:00Z"] }, {}],
    ["slot_not_offered", { kind: "create_booking", idemKey: "b", callVerified: true, slot: "2026-11-16T10:31:00Z", offered: ["2026-11-16T10:30:00Z"] }, {}],
  ];
  for (const [want, a, c] of rows) test(`${want}`, () => expect(code(a, c)).toBe(want));

  test("every refusal code is covered by a row or is runner-only", () => {
    expect(new Set([...rows.map((r) => r[0]), ...RUNNER_ONLY])).toEqual(new Set(REFUSAL_CODES));
  });

  test("payee comparison is case-insensitive but exact (no prefix / substring match)", () => {
    expect(code(pay({ payTo: ADDR.clearcall.toUpperCase().replace("0X", "0x") }))).toBe("ALLOW");
    expect(code(pay({ payTo: ADDR.clearcall.slice(0, 41) }))).toBe("payee_not_allowlisted");
  });

  test("unknown action kinds are refused even with no idempotency key", () => {
    for (const kind of ["share_data", "change_price", "free_booking", "cancel_bookings", "__proto__", "constructor", "toString"])
      expect(code({ kind } as Action)).toBe("action_not_permitted");
  });
});
