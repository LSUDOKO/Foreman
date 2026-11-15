import { expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { LocalFacilitator } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import { createOracle } from "../../proof-oracle/src/app";
import { createPayer } from "./app";

const net = kite("testnet");
const signerPk = generatePrivateKey();
const oraclePayTo = privateKeyToAccount(generatePrivateKey()).address;
const foremanAddr = privateKeyToAccount(generatePrivateKey()).address;

test("a FAILed outcome is verified once, never re-bought every tick, and never invoiced", async () => {
  const claim = { outcomeId: "out_1", contractId: "ctr", milestone: "confirmed", customer: "Asha", bookingUid: "bk_gone", contractHash: "sha256:x", price: "4.00", expected: { attendeeEmail: "a@b.c", start: "2026-11-16T04:30:00Z" } };
  const oracle = createOracle({
    network: net, facilitator: new LocalFacilitator(), payTo: oraclePayTo, price: "0.02", signerPk, foremanUrl: "http://foreman",
    foremanAddress: foremanAddr, businessAddress: foremanAddr,
    fetchImpl: (async () => new Response("{}", { status: 404 })) as any, // booking was cancelled in the calendar
  });
  let invoices = 0;
  const f = (async (u: string, i?: RequestInit) => {
    const url = new URL(u);
    if (url.host === "oracle") return oracle.request(url.pathname, i);
    if (url.pathname === "/v1/claims") return Response.json([claim]);
    if (url.pathname.startsWith("/v1/invoice")) { invoices++; return new Response("{}", { status: 500 }); }
    return new Response("nf", { status: 404 });
  }) as unknown as typeof fetch;
  const pk = generatePrivateKey();
  const payer = createPayer({
    pk, address: privateKeyToAccount(pk).address, network: net, foremanUrl: "http://foreman", oracleUrl: "http://oracle",
    foremanPayTo: foremanAddr, oraclePayTo, oracleSigner: privateKeyToAccount(signerPk).address, maxPerOutcome: "6.00", maxOraclePrice: "0.02", fetchImpl: f,
  });
  for (let i = 0; i < 4; i++) await payer.tick();
  expect(payer.journal.filter((j) => j.kind === "verify").length).toBe(1);
  expect(payer.journal.find((j) => j.kind === "refusal")?.code).toBe("proof_failed:booking_not_found");
  expect(invoices).toBe(0);
});

// A fake oracle that is genuinely signed by the trusted key but answers with whatever verdict we hand it.
async function payerWith(verdictFor: (claim: any) => Promise<unknown>, oracle402?: Partial<import("@foreman/shared/x402").PaymentRequirements>) {
  const { signVerdict } = await import("../../proof-oracle/src/app");
  const { paywall } = await import("@foreman/shared/x402-seller");
  const { b64 } = await import("@foreman/shared/x402");
  const { Hono } = await import("hono");
  const claim = { outcomeId: "out_1", contractId: "ctr", milestone: "confirmed", customer: "Asha", bookingUid: "bk_1", contractHash: "sha256:x", price: "4.00", expected: { attendeeEmail: "a@b.c", start: "2026-11-16T04:30:00Z" } };
  const o = new Hono();
  o.post("/v1/verify/outcome", paywall({ usd: "0.02", payTo: oraclePayTo, network: net, facilitator: new LocalFacilitator(), description: "o" }),
    async (c) => c.json(await signVerdict(signerPk, (await verdictFor(claim)) as any)));
  let invoices = 0, oracleSigned = 0;
  const f = (async (u: string, i?: RequestInit) => {
    const url = new URL(u);
    if (url.host === "oracle") {
      if (new Headers(i?.headers).get("PAYMENT-SIGNATURE")) oracleSigned++;
      if (oracle402) {
        const req = { scheme: "exact", network: net.caip2, asset: net.token.address, amount: "20000000000000000", payTo: oraclePayTo, maxTimeoutSeconds: 300, extra: { name: "x", version: "1" }, ...oracle402 };
        return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": b64({ x402Version: 2, resource: { url: u, description: "d", mimeType: "application/json" }, accepts: [req] }) } });
      }
      return o.request(url.pathname, i);
    }
    if (url.pathname === "/v1/claims") return Response.json([claim]);
    if (url.pathname.startsWith("/v1/invoice")) { invoices++; return new Response("{}", { status: 500 }); }
    return new Response("nf", { status: 404 });
  }) as unknown as typeof fetch;
  const pk = generatePrivateKey();
  const payer = createPayer({
    pk, address: privateKeyToAccount(pk).address, network: net, foremanUrl: "http://foreman", oracleUrl: "http://oracle",
    foremanPayTo: foremanAddr, oraclePayTo, oracleSigner: privateKeyToAccount(signerPk).address, maxPerOutcome: "6.00", maxOraclePrice: "0.02", fetchImpl: f,
  });
  await payer.tick();
  return { payer, invoices: () => invoices, oracleSigned: () => oracleSigned };
}

test("a genuinely signed PASS about a different outcome is not accepted as proof", async () => {
  const w = await payerWith(async () => ({ kind: "outcome", subject: "out_OTHER:confirmed", verdict: "PASS", checks: [], checkedAt: new Date().toISOString() }));
  expect(w.payer.journal.find((j) => j.kind === "refusal")?.code).toBe("proof_failed:bad_signature");
  expect(w.invoices()).toBe(0);
});

test("a signed PASS for a call (wrong kind) is not accepted as outcome proof", async () => {
  const w = await payerWith(async (c) => ({ kind: "call", subject: `${c.outcomeId}:${c.milestone}`, verdict: "PASS", checks: [], checkedAt: new Date().toISOString() }));
  expect(w.payer.journal.find((j) => j.kind === "refusal")?.code).toBe("proof_failed:bad_signature");
  expect(w.invoices()).toBe(0);
});

test("a matching signed PASS does lead to the invoice being attempted", async () => {
  const w = await payerWith(async (c) => ({ kind: "outcome", subject: `${c.outcomeId}:${c.milestone}`, verdict: "PASS", checks: [], checkedAt: new Date().toISOString() }));
  expect(w.invoices()).toBe(1);
});

test("an oracle 402 asking for a different token is refused before signing", async () => {
  const w = await payerWith(async () => ({}), { asset: "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e" });
  expect(w.payer.journal.find((j) => j.kind === "refusal")?.code).toBe("asset_not_allowed");
  expect(w.oracleSigned()).toBe(0);
  expect(w.invoices()).toBe(0);
});

test("an oracle 402 over the business's oracle price ceiling is refused before signing", async () => {
  const w = await payerWith(async () => ({}), { amount: "30000000000000000" }); // 0.03 > 0.02
  expect(w.payer.journal.find((j) => j.kind === "refusal")?.code).toBe("over_budget");
  expect(w.oracleSigned()).toBe(0);
});

test("the payer reads Foreman's claims with the bearer token, and an unauthorised read pays nothing", async () => {
  const seen: (string | null)[] = [];
  const f = (async (_u: string, i?: RequestInit) => {
    const h = new Headers(i?.headers).get("authorization");
    seen.push(h);
    return h === "Bearer t0ken" ? Response.json([]) : Response.json({ error: "unauthorized" }, { status: 401 });
  }) as unknown as typeof fetch;
  const pk = generatePrivateKey();
  const mk = (foremanToken?: string) => createPayer({
    pk, address: privateKeyToAccount(pk).address, network: net, foremanUrl: "http://foreman", oracleUrl: "http://oracle",
    foremanPayTo: foremanAddr, oraclePayTo, oracleSigner: privateKeyToAccount(signerPk).address, maxPerOutcome: "6.00", maxOraclePrice: "0.02", fetchImpl: f, foremanToken,
  });
  await mk("t0ken").tick();
  const anon = mk();
  await anon.tick();
  expect(seen).toEqual(["Bearer t0ken", null]);
  expect(anon.journal.length).toBe(0);
});
