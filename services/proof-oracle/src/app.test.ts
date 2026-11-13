import { expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { LocalFacilitator } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import { signJson } from "@foreman/shared/sign";
import type { Verdict } from "@foreman/shared/types";
import { payAndFetch } from "@foreman/shared/x402-buyer";
import { createOracle, verdictValid } from "./app";

const net = kite("testnet");
const signerPk = generatePrivateKey();
const foremanPk = generatePrivateKey();
const businessPk = generatePrivateKey();
const buyer = generatePrivateKey();
const realSid = "CA" + "1".repeat(32);

// One fake world: carrier, calendar and Foreman's confirmation store, routed by URL.
const world: typeof fetch = (async (input: any) => {
  const u = new URL(typeof input === "string" ? input : input.url);
  if (u.pathname.endsWith(`/Calls/${realSid}.json`))
    return Response.json({ sid: realSid, to: "+919800000001", from: "+1555", status: "completed", duration: "64", start_time: new Date().toUTCString(), end_time: null });
  if (u.pathname.includes("/Calls/")) return new Response("{}", { status: 404 });
  if (u.pathname.endsWith("/v2/bookings/bk_1"))
    return Response.json({ status: "success", data: { uid: "bk_1", status: "accepted", start: "2026-11-16T10:30:00Z", end: "2026-11-16T11:00:00Z", eventTypeId: 1, attendees: [{ name: "Asha", email: "asha@example.com", timeZone: "Asia/Kolkata" }] } });
  if (u.pathname === "/internal/confirmations/out_1") {
    const record = { outcomeId: "out_1", redeemed: true, redeemedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600e3).toISOString() };
    return Response.json({ record, signature: await signJson(foremanPk, record) });
  }
  if (u.pathname === "/internal/attestations/out_1") {
    const payload = { outcomeId: "out_1", attended: true };
    return Response.json({ payload, signature: await signJson(businessPk, payload) });
  }
  return new Response("not found", { status: 404 });
}) as any;

const app = createOracle({
  network: net, facilitator: new LocalFacilitator(), payTo: privateKeyToAccount(generatePrivateKey()).address, price: "0.02",
  signerPk, foremanUrl: "http://foreman", foremanAddress: privateKeyToAccount(foremanPk).address,
  businessAddress: privateKeyToAccount(businessPk).address, fetchImpl: world,
});
const viaApp = ((u: string, i?: RequestInit) => app.request(u, i)) as unknown as typeof fetch;
const signer = privateKeyToAccount(signerPk).address;

async function verify(path: string, body: unknown) {
  const r = await payAndFetch(`http://oracle${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, {
    pk: buyer, network: net.caip2, fetchImpl: viaApp, guard: (req) => expect(req.amount).toBe("20000000000000000"),
  });
  expect(r.res.status).toBe(200);
  expect(r.receipt?.success).toBe(true);
  return (await r.res.json()) as Verdict;
}

test("paid call verification: real call PASS, fake SID FAIL call_not_found, both signed", async () => {
  const base = { attemptId: "att_1", to: "+919800000001", claimedStatus: "accepted", minSeconds: 20, attemptCreatedAt: new Date(Date.now() - 60e3).toISOString() };
  const pass = await verify("/v1/verify/call", { ...base, callSid: realSid });
  expect(pass.verdict).toBe("PASS");
  expect(await verdictValid(pass, signer)).toBe(true);
  const fail = await verify("/v1/verify/call", { ...base, callSid: "CA" + "f".repeat(32) });
  expect(fail).toMatchObject({ verdict: "FAIL", code: "call_not_found" });
  expect(await verdictValid(fail, signer)).toBe(true);
  expect(await verdictValid({ ...fail, verdict: "PASS" }, signer)).toBe(false);
});

test("outcome verification: confirmed and attended", async () => {
  const claim = { outcomeId: "out_1", bookingUid: "bk_1", expected: { attendeeEmail: "asha@example.com", start: "2026-11-16T10:30:00Z" }, contractHash: "sha256:x" };
  expect((await verify("/v1/verify/outcome", { ...claim, milestone: "confirmed" })).verdict).toBe("PASS");
  expect((await verify("/v1/verify/outcome", { ...claim, milestone: "attended" })).verdict).toBe("PASS");
  const missing = await verify("/v1/verify/outcome", { ...claim, bookingUid: "bk_nope", milestone: "confirmed" });
  expect(missing).toMatchObject({ verdict: "FAIL", code: "booking_not_found" });
});

test("pubkey endpoint exposes the verdict signer", async () => {
  expect(((await (await app.request("/v1/pubkey")).json()) as any).signer).toBe(signer);
});
