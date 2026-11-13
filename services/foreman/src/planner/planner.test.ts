import { beforeAll, expect, test } from "bun:test";
import { fallbackAudit } from "./audit";
import { fallbackPlan, validatePlan } from "./plan";
import { selectWorker } from "./select";
import type { Customer, Worker } from "../store";

beforeAll(() => { delete process.env.SERV_API_KEY; });

const cust = (id: string, missedAt: string): Customer => ({
  id, contractId: "ctr", name: id, phone: "+919800000000", email: `${id}@x.y`, missedAt, consentSource: "x",
  optedOut: false, state: "eligible", refusal: null, offers: [], planReason: null, steps: {},
});
const free = ["2026-11-16T04:30:00.000Z", "2026-11-16T05:00:00.000Z", "2026-11-16T08:00:00.000Z", "2026-11-16T10:30:00.000Z", "2026-11-16T11:00:00.000Z"];
const cs = [cust("c1", "2026-11-13T09:30:00+05:30"), cust("c2", "2026-11-13T16:30:00+05:30")];

test("fallback plan offers two distinct free slots near the original time of day", () => {
  const p = fallbackPlan(cs, free, "Asia/Kolkata");
  expect(p.order[0]!.offer).toEqual(["2026-11-16T04:30:00.000Z", "2026-11-16T05:00:00.000Z"]);
  expect(p.order[1]!.offer).toEqual(["2026-11-16T10:30:00.000Z", "2026-11-16T11:00:00.000Z"]);
});

test("server drops invented slots, shared slots and unknown customers; adds omitted customers", () => {
  const p = validatePlan({
    order: [
      { customerId: "c1", offer: ["2026-11-16T04:30:00Z", "2030-01-01T00:00:00Z"], reason: "" },
      { customerId: "ghost", offer: [free[0]!], reason: "" },
    ],
    skip: [],
  }, cs, free, "Asia/Kolkata");
  expect(p.order.map((o) => o.customerId)).toEqual(["c1", "c2"]);
  expect(p.order[0]!.offer).toContain("2026-11-16T04:30:00.000Z");
  expect(p.order[0]!.offer).not.toContain("2030-01-01T00:00:00Z");
  const all = p.order.flatMap((o) => o.offer);
  expect(new Set(all).size).toBe(all.length);
  expect(all.every((s) => free.includes(s))).toBe(true);
});

const w = (name: string, reputation: number, o: Partial<Worker> = {}): Worker => ({
  name, payTo: "0x1111111111111111111111111111111111111111", callUrl: "", bonusUrl: "", price: "0.50", bonus: "0.20",
  reputation, probationLeft: 0, isNew: false, badge: null, ...o,
});

test("probation worker gets one call only after a verified call exists; floor is enforced", async () => {
  const ws = [w("ClearCall", 90), w("QuickDial", 80, { isNew: true, probationLeft: 1, price: "0.30" })];
  expect((await selectWorker(ws, { floor: 50, verifiedCalls: 0, remainingBudget: "5.00" })).sel?.worker.name).toBe("ClearCall");
  const p = await selectWorker(ws, { floor: 50, verifiedCalls: 1, remainingBudget: "4.30" });
  expect(p.sel).toMatchObject({ probation: true, source: "rule" });
  expect(p.sel!.worker.name).toBe("QuickDial");
  const after = [w("ClearCall", 95), w("QuickDial", 40, { isNew: true, probationLeft: 0 })];
  expect((await selectWorker(after, { floor: 50, verifiedCalls: 2, remainingBudget: "3.00" })).sel?.worker.name).toBe("ClearCall");
  expect((await selectWorker([w("Q", 40)], { floor: 50, verifiedCalls: 0, remainingBudget: "3.00" })).sel).toBeNull();
});

test("fallback audit flags missing disclosure and unauthorised promises", () => {
  const D = "Hi, this is an AI assistant calling on behalf of Smile Dental.";
  expect(fallbackAudit([{ who: "agent", text: `${D} Offer...` }], D).quality).toBeGreaterThanOrEqual(0.7);
  const bad = fallbackAudit([{ who: "agent", text: "Hello!" }, { who: "agent", text: "Sure, I'll refund you." }], D);
  expect(bad.disclosed).toBe(false);
  expect(bad.unauthorisedPromises.length).toBe(1);
  expect(bad.quality).toBeLessThan(0.7);
});
