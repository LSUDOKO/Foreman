import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { LocalFacilitator } from "./facilitator";
import { kite } from "./kite";
import { PaymentRefused, payAndFetch } from "./x402-buyer";
import { paywall } from "./x402-seller";
import { b64, unb64 } from "./x402";
import type { PaymentPayload } from "./x402";

const net = kite("testnet");
const payTo = privateKeyToAccount(generatePrivateKey()).address;
const pk = generatePrivateKey();

function app(opts: { fail?: boolean; precheckFail?: boolean } = {}) {
  const fac = new LocalFacilitator();
  const settled: string[] = [];
  const a = new Hono();
  a.post(
    "/v1/thing",
    paywall({
      usd: "0.50", payTo, network: net, facilitator: fac, description: "thing",
      precheck: (c) => (opts.precheckFail ? c.json({ error: "not_ready" }, 409) : undefined),
      onSettled: (_c, s) => { settled.push(s.transaction); },
    }),
    (c) => (opts.fail ? c.json({ error: "boom" }, 500) : c.json({ ok: true })),
  );
  const f = ((u: string, i?: RequestInit) => a.request(u, i)) as unknown as typeof fetch;
  return { f, settled };
}

describe("x402 v2 exact on Kite testnet (local facilitator)", () => {
  test("402 → sign → 200 with receipt", async () => {
    const { f, settled } = app();
    const seen: string[] = [];
    const r = await payAndFetch("http://x/v1/thing", { method: "POST" }, {
      pk, network: net.caip2, fetchImpl: f, guard: (req) => { seen.push(req.amount); },
    });
    expect(r.res.status).toBe(200);
    expect(seen).toEqual(["500000000000000000"]);
    expect(r.receipt?.success).toBe(true);
    expect(r.receipt?.transaction.startsWith("sim:0x")).toBe(true);
    expect(r.receipt?.payer).toBe(privateKeyToAccount(pk).address);
    expect(settled.length).toBe(1);
  });

  test("guard refusal stops before signing", async () => {
    const { f, settled } = app();
    await expect(payAndFetch("http://x/v1/thing", { method: "POST" }, {
      pk, network: net.caip2, fetchImpl: f, guard: () => { throw new PaymentRefused("over_budget"); },
    })).rejects.toThrow("over_budget");
    expect(settled.length).toBe(0);
  });

  test("retry with the same authorization settles once", async () => {
    const { f, settled } = app();
    const first = await payAndFetch("http://x/v1/thing", { method: "POST" }, { pk, network: net.caip2, fetchImpl: f, guard: () => {} });
    const again = await payAndFetch("http://x/v1/thing", { method: "POST" }, {
      pk, network: net.caip2, fetchImpl: f, guard: () => {}, reuseHeader: first.paymentHeader!,
    });
    expect(again.receipt?.transaction).toBe(first.receipt?.transaction);
    expect(new Set(settled).size).toBe(1);
  });

  test("handler failure means no settlement", async () => {
    const { f, settled } = app({ fail: true });
    const r = await payAndFetch("http://x/v1/thing", { method: "POST" }, { pk, network: net.caip2, fetchImpl: f, guard: () => {} });
    expect(r.res.status).toBe(500);
    expect(r.receipt).toBeNull();
    expect(settled.length).toBe(0);
  });

  test("precheck refuses before any 402", async () => {
    const { f } = app({ precheckFail: true });
    const r = await payAndFetch("http://x/v1/thing", { method: "POST" }, { pk, network: net.caip2, fetchImpl: f, guard: () => { throw new Error("should not reach"); } });
    expect(r.res.status).toBe(409);
  });

  test("tampered amount is rejected", async () => {
    const { f } = app();
    const first = await f("http://x/v1/thing", { method: "POST" });
    expect(first.status).toBe(402);
    const ok = await payAndFetch("http://x/v1/thing", { method: "POST" }, { pk, network: net.caip2, fetchImpl: f, guard: () => {} });
    const p = unb64<PaymentPayload>(ok.paymentHeader!);
    p.payload.authorization.value = "1";
    const r = await f("http://x/v1/thing", { method: "POST", headers: { "PAYMENT-SIGNATURE": b64(p) } });
    expect(r.status).toBe(402);
  });
});
