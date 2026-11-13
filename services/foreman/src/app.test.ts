import { beforeAll, describe, expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { LocalFacilitator } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import { hmac } from "@foreman/shared/sign";
import { payAndFetch } from "@foreman/shared/x402-buyer";
import { createApp } from "./app";
import { newToken } from "./confirm";
import { openDb, setSetting } from "./db";
import { EventLog } from "./events";
import { Idempotency } from "./idempotency";
import { Payments } from "./pay";
import { Runner } from "./runner";
import { Store } from "./store";
import { ADDR, contract, FACTS } from "./test/fixtures";

beforeAll(() => { delete process.env.SERV_API_KEY; });

const net = kite("testnet");
const foremanPk = generatePrivateKey();
const businessPk = generatePrivateKey();

function world() {
  const db = openDb(":memory:");
  const store = new Store(db);
  const log = new EventLog(db);
  const idem = new Idempotency(db);
  let runner: Runner;
  const payments = new Payments(store, log, idem, { pk: foremanPk, from: privateKeyToAccount(foremanPk).address, network: net, ctx: (id) => runner.ctx(id) });
  runner = new Runner({ db, store, log, idem, payments, oracleUrl: "http://oracle", oracleSigner: async () => ADDR.oracle, publicUrl: "http://foreman", callbackUrl: "http://foreman/api/worker-result", eventTypeId: 1 });
  const app = createApp({
    db, store, log, runner, network: net, facilitator: new LocalFacilitator(), foremanPk, foremanAddress: privateKeyToAccount(foremanPk).address,
    businessAddress: privateKeyToAccount(businessPk).address, oracleSigner: async () => ADDR.oracle, identities: async () => ({}),
    facts: () => ({ ...FACTS }), payerUrl: "http://payer", hmacSecret: "s",
  });
  const c = contract();
  store.saveContract(c, "running");
  store.addCustomers(c.id, [{ id: "c1", name: "Asha", phone: "+919800000001", email: "asha@example.com", missedAt: "2026-11-13T09:30:00+05:30", consentSource: "opt-in" }]);
  const t = newToken();
  store.addOutcome({ id: "out_1", contractId: c.id, customerId: "c1", attemptId: null, bookingUid: "bk_1", slotStart: "2026-11-16T04:30:00.000Z", createdAt: new Date().toISOString(), state: "confirmation_sent" });
  store.updateOutcome("out_1", { confirmTokenHash: t.hash, confirmExpiresAt: t.expiresAt });
  const viaApp = ((u: string, i?: RequestInit) => app.request(u.replace("http://foreman", ""), i)) as unknown as typeof fetch;
  return { db, store, log, runner, app, token: t.token, contractId: c.id, viaApp };
}

describe("confirmation link", () => {
  test("double-click confirms once; page shows booked", async () => {
    const w = world();
    expect((await w.app.request(`/c/${w.token}`)).status).toBe(200);
    const a = await w.app.request(`/c/${w.token}/confirm`, { method: "POST" });
    const b = await w.app.request(`/c/${w.token}/confirm`, { method: "POST" });
    expect(await a.text()).toContain("You're booked.");
    expect(b.status).toBe(200);
    expect(w.log.since(0).filter((e) => e.type === "customer_confirmed").length).toBe(1);
    expect(w.store.outcome("out_1")!.state).toBe("confirmed_by_customer");
  });
  test("unknown token → 404 page", async () => {
    expect((await world().app.request("/c/nope")).status).toBe(404);
  });
  test("signed confirmation record for the oracle", async () => {
    const w = world();
    await w.app.request(`/c/${w.token}/confirm`, { method: "POST" });
    const r = (await (await w.app.request("/internal/confirmations/out_1")).json()) as any;
    expect(r.record.redeemed).toBe(true);
    const { verifyJson } = await import("@foreman/shared/sign");
    expect(await verifyJson(r.record, r.signature, privateKeyToAccount(foremanPk).address)).toBe(true);
  });
});

describe("x402 invoices", () => {
  const pay = (w: ReturnType<typeof world>, milestone = "confirmed") =>
    payAndFetch(`http://foreman/v1/invoice/out_1/${milestone}`, { method: "POST" }, { pk: businessPk, network: net.caip2, fetchImpl: w.viaApp, guard: () => {} });

  test("wrong state → 409 before any 402, so the business never pays for an invalid invoice", async () => {
    const w = world();
    const r = await w.app.request("/v1/invoice/out_1/confirmed", { method: "POST" });
    expect(r.status).toBe(409);
    expect((await w.app.request("/v1/claims")).ok).toBe(true);
  });

  test("confirmed outcome → claim → $4.00 paid → money in → second invoice refused", async () => {
    const w = world();
    await w.app.request(`/c/${w.token}/confirm`, { method: "POST" });
    const claims = (await (await w.app.request(`/v1/claims?contractId=${w.contractId}`)).json()) as any[];
    expect(claims).toMatchObject([{ outcomeId: "out_1", milestone: "confirmed", price: "4.00" }]);
    const r = await pay(w);
    expect(r.res.status).toBe(200);
    expect(r.requirement?.amount).toBe("4000000000000000000");
    expect(w.store.outcome("out_1")!.state).toBe("paid_confirmed");
    expect(w.store.earned(w.contractId)).toBe("4.00");
    expect(w.log.since(0).some((e) => e.type === "payment_in")).toBe(true);
    expect((await pay(w)).res.status).toBe(409);
    expect(w.store.earned(w.contractId)).toBe("4.00");
  });
});

describe("worker callbacks", () => {
  test("bad HMAC rejected; unknown attempt and duplicates are 409", async () => {
    const w = world();
    const body = JSON.stringify({ attemptId: "att_x", callSid: "CA1", outcome: "accepted", requested: [], transcript: [], durationSec: 30 });
    expect((await w.app.request("/api/worker-result", { method: "POST", body, headers: { "x-worker-signature": "bad" } })).status).toBe(401);
    expect((await w.app.request("/api/worker-result", { method: "POST", body, headers: { "x-worker-signature": hmac("s", body), "x-worker": "ClearCall" } })).status).toBe(409);
    w.store.addAttempt({ id: "att_x", contractId: w.contractId, customerId: "c1", worker: "ClearCall", attemptNo: 1, offers: [], createdAt: new Date().toISOString(), status: "dialing" });
    const ok = await w.app.request("/api/worker-result", { method: "POST", body, headers: { "x-worker-signature": hmac("s", body), "x-worker": "ClearCall" } });
    expect(ok.status).toBe(200);
    const again = await w.app.request("/api/worker-result", { method: "POST", body, headers: { "x-worker-signature": hmac("s", body), "x-worker": "ClearCall" } });
    expect(again.status).toBe(409);
  });
});

describe("kill switch", () => {
  test("engaging refuses the next action; releasing needs the business name", async () => {
    const w = world();
    expect((await w.app.request("/api/kill", { method: "POST" })).status).toBe(200);
    expect(w.runner.guard(w.contractId, { kind: "send_email", idemKey: "e1" })).toBe(false);
    expect(w.store.refusals(w.contractId).at(-1)!.code).toBe("kill_switch_engaged");
    expect((await w.app.request("/api/unkill", { method: "POST", body: JSON.stringify({ confirm: "nope" }) })).status).toBe(400);
    expect((await w.app.request("/api/unkill", { method: "POST", body: JSON.stringify({ confirm: "smile dental" }) })).status).toBe(200);
    expect(w.runner.guard(w.contractId, { kind: "send_email", idemKey: "e2" })).toBe(true);
    setSetting(w.db, "kill_switch", "1");
    expect(w.runner.guard(w.contractId, { kind: "place_call" } as any)).toBe(false);
  });
});

test("customer decline releases Foreman's own hold", async () => {
  const w = world();
  const cal = Bun.serve({ port: 0, fetch: () => Response.json({ status: "success" }) });
  process.env.CALCOM_API_BASE = `http://localhost:${cal.port}`;
  const r = await w.app.request(`/c/${w.token}/decline`, { method: "POST" });
  expect(await r.text()).toContain("No problem.");
  expect(w.store.outcome("out_1")!.state).toBe("cancelled");
  expect(w.log.since(0).some((e) => e.type === "booking_cancelled")).toBe(true);
  delete process.env.CALCOM_API_BASE;
  cal.stop();
});

test("expired contract moves to expired and releases its unconfirmed holds", async () => {
  const w = world();
  const cal = Bun.serve({ port: 0, fetch: () => Response.json({ status: "success" }) });
  process.env.CALCOM_API_BASE = `http://localhost:${cal.port}`;
  const k = w.store.contract(w.contractId)!;
  k.contract.spend.expiresAt = new Date(Date.now() - 60_000).toISOString();
  w.store.saveContract(k.contract, "running");
  await w.runner.sweepExpired();
  expect(w.store.contract(w.contractId)!.status).toBe("expired");
  expect(w.store.outcome("out_1")!.state).toBe("cancelled");
  delete process.env.CALCOM_API_BASE;
  cal.stop();
});
