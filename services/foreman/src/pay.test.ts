// Foreman's outbound x402 guard: the seller's 402 is untrusted. Nothing may be signed unless the payee, the asset and
// the amount match what the contract allows. Every case asserts the seller never received a PAYMENT-SIGNATURE.
import { describe, expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { LocalFacilitator } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import { b64 } from "@foreman/shared/x402";
import type { PaymentRequirements } from "@foreman/shared/x402";
import { paywall } from "@foreman/shared/x402-seller";
import { Hono } from "hono";
import { openDb } from "./db";
import { EventLog } from "./events";
import { Idempotency } from "./idempotency";
import { Payments } from "./pay";
import { Store } from "./store";
import { ADDR, contract, FACTS } from "./test/fixtures";

const net = kite("testnet");
const pk = generatePrivateKey();

function world(seller: (signed: string[]) => (u: string, i?: RequestInit) => Promise<Response>) {
  const db = openDb(":memory:");
  const store = new Store(db);
  const log = new EventLog(db);
  const idem = new Idempotency(db);
  const c = contract();
  store.saveContract(c, "running");
  const signed: string[] = [];
  const f = seller(signed);
  const fetchImpl = (async (u: string, i?: RequestInit) => {
    const h = new Headers(i?.headers).get("PAYMENT-SIGNATURE");
    if (h) signed.push(h);
    return f(u, i);
  }) as unknown as typeof fetch;
  const payments = new Payments(store, log, idem, {
    pk, from: privateKeyToAccount(pk).address, network: net, fetchImpl,
    ctx: () => ({ contract: store.contract(c.id)!.contract, status: "running", killSwitch: false, now: FACTS.now, spent: store.spent(c.id), seen: idem.seen }),
  });
  const pay = (o: { payTo?: `0x${string}`; refId?: string } = {}) =>
    payments.payOut({ contractId: c.id, url: "http://seller/v1/call", body: {}, counterparty: "ClearCall", payTo: o.payTo ?? ADDR.clearcall, purpose: "call", refId: o.refId ?? "att_1" });
  return { pay, signed, store, refusals: () => store.refusals(c.id).map((r) => r.code) };
}

/** A seller that answers with a crafted 402 (never accepts a payment). */
const crafted = (o: Partial<PaymentRequirements>) => () => async () => {
  const req: PaymentRequirements = {
    scheme: "exact", network: net.caip2, asset: net.token.address, amount: "500000000000000000", payTo: ADDR.clearcall,
    maxTimeoutSeconds: 300, extra: { name: net.token.eip712Name, version: net.token.eip712Version }, ...o,
  };
  return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": b64({ x402Version: 2, resource: { url: "u", description: "d", mimeType: "application/json" }, accepts: [req] }) } });
};

describe("x402 buyer guard (Foreman → workers/oracle)", () => {
  test("a 402 redirecting funds to another address is refused before signing", async () => {
    const w = world(crafted({ payTo: "0x9999999999999999999999999999999999999999" }));
    const r = await w.pay();
    expect(r).toMatchObject({ ok: false, code: "payee_not_allowlisted" });
    expect(w.signed.length).toBe(0);
  });

  test("a 402 asking for another token is refused before signing", async () => {
    const w = world(crafted({ asset: "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e" }));
    expect(await w.pay()).toMatchObject({ ok: false, code: "payee_not_allowlisted" });
    expect(w.signed.length).toBe(0);
  });

  test("a 402 asking more than the per-call cap is refused before signing", async () => {
    const w = world(crafted({ amount: "610000000000000000" })); // 0.61 > cap 0.60
    expect(await w.pay()).toMatchObject({ ok: false, code: "per_call_cap_exceeded" });
    expect(w.signed.length).toBe(0);
    expect(w.refusals()).toContain("per_call_cap_exceeded");
  });

  test("a payee the contract never allowlisted is refused even if the 402 matches it", async () => {
    const stranger = "0x9999999999999999999999999999999999999999" as const;
    const w = world(crafted({ payTo: stranger }));
    expect(await w.pay({ payTo: stranger })).toMatchObject({ ok: false, code: "payee_not_allowlisted" });
    expect(w.signed.length).toBe(0);
  });

  test("an honest 402 is paid once; the same payment purpose+ref is never paid twice", async () => {
    const w = world(() => {
      const a = new Hono();
      a.post("/v1/call", paywall({ usd: "0.50", payTo: ADDR.clearcall, network: net, facilitator: new LocalFacilitator(), description: "call" }), (c) => c.json({ ok: true }));
      return async (u, i) => a.request(new URL(u).pathname, i);
    });
    const first = await w.pay();
    expect(first.ok).toBe(true);
    expect(w.signed.length).toBe(1);
    expect(await w.pay()).toMatchObject({ ok: false, code: "duplicate_action" });
    expect(w.signed.length).toBe(1);
    expect(w.store.payments(w.store.latestContractId()!).length).toBe(1);
  });
});
