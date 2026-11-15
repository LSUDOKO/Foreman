import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { HttpFacilitator } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import type { Hex } from "@foreman/shared/types";
import { payAndFetch, signPayment } from "@foreman/shared/x402-buyer";
import { unb64 } from "@foreman/shared/x402";
import type { PaymentPayload, PaymentRequirements } from "@foreman/shared/x402";
import { paywall } from "@foreman/shared/x402-seller";
import { createFacilitator } from "./app";
import type { Chainish } from "./app";

const net = kite("testnet");
const payer = generatePrivateKey();
const payTo = privateKeyToAccount(generatePrivateKey()).address;

function fakeChain(balance: bigint) {
  const used = new Set<string>();
  const submitted: string[] = [];
  const chain: Chainish = {
    async read(fn, args) {
      if (fn === "balanceOf") return balance;
      return used.has(`${String(args[0]).toLowerCase()}:${args[1]}`);
    },
    async submit(p) {
      const a = p.payload.authorization;
      used.add(`${a.from.toLowerCase()}:${a.nonce}`);
      submitted.push(a.nonce);
      return { hash: `0x${submitted.length.toString(16).padStart(64, "0")}` as Hex, ok: true };
    },
  };
  return { chain, submitted };
}

function stack(balance = 10n ** 18n, payees?: string[]) {
  const { chain, submitted } = fakeChain(balance);
  const fac = createFacilitator({ net, chain, payees });
  const facFetch = ((u: string, i?: RequestInit) => fac.app.request(new URL(u).pathname, i)) as unknown as typeof fetch;
  const seller = new Hono();
  seller.post("/thing", paywall({ usd: "0.50", payTo, network: net, facilitator: new HttpFacilitator("http://fac", facFetch), description: "thing" }), (c) => c.json({ ok: true }));
  const f = ((u: string, i?: RequestInit) => seller.request(u, i)) as unknown as typeof fetch;
  return { f, fac, submitted };
}

describe("self-hosted Kite facilitator", () => {
  test("a paid request settles on chain once and returns the transaction hash", async () => {
    const { f, submitted } = stack();
    const r = await payAndFetch("http://x/thing", { method: "POST" }, { pk: payer, network: net.caip2, fetchImpl: f, guard: () => {} });
    expect(r.res.status).toBe(200);
    expect(r.receipt?.success).toBe(true);
    expect(r.receipt?.transaction).toMatch(/^0x[0-9a-f]{64}$/);
    expect(submitted.length).toBe(1);
  });

  test("an unfunded payer is refused before anything is submitted", async () => {
    const { f, submitted } = stack(0n);
    const r = await payAndFetch("http://x/thing", { method: "POST" }, { pk: payer, network: net.caip2, fetchImpl: f, guard: () => {} });
    expect(r.res.status).toBe(402);
    expect(submitted.length).toBe(0);
  });

  test("settling the same authorization twice submits once and returns the same receipt", async () => {
    const { fac, submitted } = stack();
    let captured: any;
    const seller = new Hono();
    seller.post("/thing", paywall({ usd: "0.50", payTo, network: net, facilitator: { mode: "remote", verify: fac.verify, settle: async (p, r) => { captured = { p, r }; return fac.settle(p, r); } }, description: "thing" }), (c) => c.json({ ok: true }));
    const f = ((u: string, i?: RequestInit) => seller.request(u, i)) as unknown as typeof fetch;
    await payAndFetch("http://x/thing", { method: "POST" }, { pk: payer, network: net.caip2, fetchImpl: f, guard: () => {} });
    const [a, b] = await Promise.all([fac.settle(captured.p, captured.r), fac.settle(captured.p, captured.r)]);
    expect(a.transaction).toBe(b.transaction);
    expect(submitted.length).toBe(1);
  });

  test("a payment in another token is refused", async () => {
    const { fac } = stack();
    const r = await fac.verify({ payload: {} } as any, { scheme: "exact", network: net.caip2, asset: payTo, amount: "1", payTo, maxTimeoutSeconds: 60, extra: { name: "x", version: "1" } });
    expect(r).toEqual({ isValid: false, invalidReason: "unsupported_asset" });
  });

  const req = (o: Partial<PaymentRequirements> = {}): PaymentRequirements => ({
    scheme: "exact", network: net.caip2, asset: net.token.address, amount: "500", payTo, maxTimeoutSeconds: 300,
    extra: { name: net.token.eip712Name, version: net.token.eip712Version }, ...o,
  });
  const signed = async (r: PaymentRequirements, key = payer) =>
    unb64<PaymentPayload>(await signPayment(key, { x402Version: 2, resource: { url: "u", description: "d", mimeType: "application/json" }, accepts: [r] }, r));

  test("a different payload reusing a settled from+nonce does not inherit the cached success receipt", async () => {
    const { fac, submitted } = stack();
    const r = req();
    const p = await signed(r);
    expect((await fac.settle(p, r)).success).toBe(true);
    const forged = structuredClone(p);
    forged.payload.authorization.value = "1000000"; // unsigned change
    const s = await fac.settle(forged, r);
    expect(s.success).toBe(false);
    expect(s.transaction).toBe("");
    expect(submitted.length).toBe(1);
  });

  test("an already-used nonce is refused at verify (no second delivery for one payment)", async () => {
    const { fac } = stack();
    const r = req();
    const p = await signed(r);
    await fac.settle(p, r);
    expect(await fac.verify(p, r)).toEqual({ isValid: false, invalidReason: "nonce_already_used" });
  });

  test("zero-value authorizations are refused so nobody can burn the gas wallet for free", async () => {
    const { fac, submitted } = stack();
    const r = req({ amount: "0" });
    const p = await signed(r);
    expect(await fac.verify(p, r)).toEqual({ isValid: false, invalidReason: "zero_amount" });
    expect((await fac.settle(p, r)).success).toBe(false);
    expect(submitted.length).toBe(0);
  });

  test("with a payee allowlist, settlement to any other address is refused", async () => {
    const { fac, submitted } = stack(10n ** 18n, [payTo]);
    const stranger = privateKeyToAccount(generatePrivateKey()).address;
    const r = req({ payTo: stranger });
    const p = await signed(r);
    expect((await fac.verify(p, r)).invalidReason).toBe("payee_not_served");
    expect((await fac.settle(p, r)).success).toBe(false);
    expect(submitted.length).toBe(0);
    const ok = req();
    expect((await fac.settle(await signed(ok), ok)).success).toBe(true);
  });

  test("wrong network and malformed bodies are refused", async () => {
    const { fac } = stack();
    const r = req();
    const p = await signed(r);
    expect((await fac.verify(p, { ...r, network: "eip155:2366" })).invalidReason).toBe("unsupported_asset");
    const bad = await fac.app.request("/settle", { method: "POST", body: "not json" });
    expect(bad.status).toBe(400);
  });
});
