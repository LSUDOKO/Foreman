import { describe, expect, setSystemTime, test } from "bun:test";
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

function app(opts: { fail?: boolean; precheckFail?: boolean; slowMs?: number } = {}) {
  const fac = new LocalFacilitator();
  const settled: string[] = [];
  let handled = 0;
  const a = new Hono();
  a.post(
    "/v1/thing",
    paywall({
      usd: "0.50", payTo, network: net, facilitator: fac, description: "thing",
      precheck: (c) => (opts.precheckFail ? c.json({ error: "not_ready" }, 409) : undefined),
      onSettled: (_c, s) => { settled.push(s.transaction); },
    }),
    async (c) => {
      handled++;
      if (opts.slowMs) await Bun.sleep(opts.slowMs);
      return opts.fail ? c.json({ error: "boom" }, 500) : c.json({ ok: true });
    },
  );
  const f = ((u: string, i?: RequestInit) => a.request(u, i)) as unknown as typeof fetch;
  return { f, settled, fac, handled: () => handled };
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

  test("replaying a settled PAYMENT-SIGNATURE is refused and buys nothing (same as the chain's nonce check)", async () => {
    const { f, settled, handled } = app();
    const first = await payAndFetch("http://x/v1/thing", { method: "POST" }, { pk, network: net.caip2, fetchImpl: f, guard: () => {} });
    expect(first.res.status).toBe(200);
    const again = await payAndFetch("http://x/v1/thing", { method: "POST" }, {
      pk, network: net.caip2, fetchImpl: f, guard: () => {}, reuseHeader: first.paymentHeader!,
    });
    expect(again.res.status).toBe(402);
    expect(((await again.res.json()) as any).reason).toBe("nonce_already_used");
    expect(handled()).toBe(1);
    expect(settled.length).toBe(1);
  });

  test("the same header presented concurrently runs the handler once", async () => {
    const { f, settled, handled } = app({ slowMs: 30 });
    const first = await f("http://x/v1/thing", { method: "POST" });
    expect(first.status).toBe(402);
    let header = "";
    await payAndFetch("http://x/v1/thing", { method: "POST" }, {
      pk, network: net.caip2, guard: () => {},
      // capture the signed header without delivering it
      fetchImpl: (async (u: string, i?: RequestInit) => {
        const h = new Headers(i?.headers).get("PAYMENT-SIGNATURE");
        if (h) { header = h; return new Response("{}", { status: 599 }); }
        return f(u, i);
      }) as unknown as typeof fetch,
    });
    const send = () => f("http://x/v1/thing", { method: "POST", headers: { "PAYMENT-SIGNATURE": header } });
    const rs = await Promise.all([send(), send(), send()]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 402, 402]);
    expect(handled()).toBe(1);
    expect(settled.length).toBe(1);
  });

  test("a failed handler leaves the authorization unused, so an honest retry still works", async () => {
    let fail = true;
    const fac = new LocalFacilitator();
    const a = new Hono();
    a.post("/t", paywall({ usd: "0.50", payTo, network: net, facilitator: fac, description: "t" }), (c) => (fail ? c.json({ e: 1 }, 503) : c.json({ ok: true })));
    const f = ((u: string, i?: RequestInit) => a.request(u, i)) as unknown as typeof fetch;
    const r1 = await payAndFetch("http://x/t", { method: "POST" }, { pk, network: net.caip2, fetchImpl: f, guard: () => {} });
    expect(r1.res.status).toBe(503);
    fail = false;
    const r2 = await payAndFetch("http://x/t", { method: "POST" }, { pk, network: net.caip2, fetchImpl: f, guard: () => {}, reuseHeader: r1.paymentHeader! });
    expect(r2.res.status).toBe(200);
    expect(r2.receipt?.success).toBe(true);
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

  test("a signature by someone other than `from` is rejected", async () => {
    const { f } = app();
    const ok = await payAndFetch("http://x/v1/thing", { method: "POST" }, { pk, network: net.caip2, fetchImpl: (async (u: string, i?: RequestInit) => {
      const h = new Headers(i?.headers).get("PAYMENT-SIGNATURE");
      return h ? new Response("{}", { status: 599 }) : f(u, i);
    }) as unknown as typeof fetch, guard: () => {} });
    const p = unb64<PaymentPayload>(ok.paymentHeader!);
    p.payload.authorization.from = privateKeyToAccount(generatePrivateKey()).address; // claim to spend someone else's funds
    const r = await f("http://x/v1/thing", { method: "POST", headers: { "PAYMENT-SIGNATURE": b64(p) } });
    expect(r.status).toBe(402);
    expect(((await r.json()) as any).reason).toBe("invalid_signature");
  });

  test("local facilitator: wrong payee, expired window and requirement mismatch are refused", async () => {
    const fac = new LocalFacilitator();
    const req = { scheme: "exact" as const, network: net.caip2, asset: net.token.address, amount: "100", payTo, maxTimeoutSeconds: 300, extra: { name: net.token.eip712Name, version: net.token.eip712Version } };
    const { signPayment } = await import("./x402-buyer");
    const p = unb64<PaymentPayload>(await signPayment(pk, { x402Version: 2, resource: { url: "u", description: "d", mimeType: "application/json" }, accepts: [req] }, req));
    expect((await fac.verify(p, req)).isValid).toBe(true);
    expect((await fac.verify(p, { ...req, payTo: privateKeyToAccount(generatePrivateKey()).address })).invalidReason).toBe("invalid_payee");
    expect((await fac.verify(p, { ...req, amount: "101" })).invalidReason).toBe("insufficient_amount");
    expect((await fac.verify(p, { ...req, network: "eip155:1" })).invalidReason).toBe("requirements_mismatch");
    const late = structuredClone(p);
    late.payload.authorization.validBefore = String(Math.floor(Date.now() / 1000) - 1);
    expect((await fac.verify(late, req)).invalidReason).toBe("authorization_expired");
    // window bounds are exclusive, like EIP-3009 on chain (checked before the signature, so edited copies suffice)
    const T = Number(p.payload.authorization.validAfter) + 100;
    setSystemTime(new Date(T * 1000));
    try {
      const at = (o: object) => fac.verify({ ...p, payload: { ...p.payload, authorization: { ...p.payload.authorization, ...o } } }, req);
      expect((await at({ validBefore: String(T) })).invalidReason).toBe("authorization_expired");
      expect((await at({ validAfter: String(T) })).invalidReason).toBe("authorization_expired");
      expect((await at({ validAfter: String(T - 1) })).invalidReason).toBe("invalid_signature"); // inside the window: on to the signature check
    } finally { setSystemTime(); }
    // a byte-identical settle retry shares the receipt; a different payload reusing from+nonce does not inherit it
    const s1 = await fac.settle(p, req);
    expect(s1.success).toBe(true);
    expect(await fac.settle(p, req)).toEqual(s1);
    const forged = structuredClone(p);
    forged.payload.authorization.to = privateKeyToAccount(generatePrivateKey()).address;
    expect((await fac.settle(forged, { ...req, payTo: forged.payload.authorization.to })).success).toBe(false);
  });
});
