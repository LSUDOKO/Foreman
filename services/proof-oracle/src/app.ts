import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import { calClient, getBooking } from "@foreman/shared/calcom";
import type { Facilitator } from "@foreman/shared/facilitator";
import type { KiteNetwork } from "@foreman/shared/kite";
import { signJson, verifyJson } from "@foreman/shared/sign";
import { getCall, twilioCreds } from "@foreman/shared/twilio";
import type { Hex, Verdict } from "@foreman/shared/types";
import { paywall } from "@foreman/shared/x402-seller";
import { checkAttended, checkCall, checkConfirmed } from "./checks";
import type { CallClaim, Confirmation, OutcomeClaim } from "./checks";

export interface OracleDeps {
  network: KiteNetwork;
  facilitator: Facilitator;
  payTo: Hex;
  price: string;
  signerPk: Hex;
  foremanUrl: string;
  foremanAddress: Hex;
  businessAddress: Hex;
  fetchImpl?: typeof fetch;
}

export async function signVerdict(pk: Hex, v: Omit<Verdict, "signature" | "oracle">): Promise<Verdict> {
  const oracle = privateKeyToAccount(pk).address;
  const body = { ...v, oracle };
  return { ...body, signature: await signJson(pk, body) };
}

export async function verdictValid(v: Verdict, signer: string): Promise<boolean> {
  const { signature, ...body } = v;
  return verifyJson(body, signature, signer);
}

export function createOracle(d: OracleDeps) {
  const f = d.fetchImpl ?? fetch;
  const app = new Hono();
  const signer = privateKeyToAccount(d.signerPk).address;
  const paid = (route: string) =>
    paywall({ usd: d.price, payTo: d.payTo, network: d.network, facilitator: d.facilitator, description: `Foreman proof oracle ${route}` });

  app.get("/healthz", (c) => c.json({ ok: true, name: "proof-oracle", mode: d.facilitator.mode }));
  app.get("/v1/pubkey", (c) => c.json({ signer, payTo: d.payTo }));

  app.post("/v1/verify/call", paid("/v1/verify/call"), async (c) => {
    const claim = (await c.req.json()) as CallClaim;
    // Re-read the carrier every time with the oracle's own credentials. Nothing is cached.
    const rec = await getCall(twilioCreds("oracle"), claim.callSid, f);
    const { checks, code } = checkCall(claim, rec);
    return c.json(await signVerdict(d.signerPk, {
      kind: "call", subject: claim.attemptId, verdict: code ? "FAIL" : "PASS", code, checks, checkedAt: new Date().toISOString(),
    }));
  });

  app.post("/v1/verify/outcome", paid("/v1/verify/outcome"), async (c) => {
    const claim = (await c.req.json()) as OutcomeClaim;
    let result;
    if (claim.milestone === "confirmed") {
      const booking = await getBooking(calClient(process.env.CALCOM_READ_KEY || process.env.CALCOM_API_KEY || "sandbox", f), claim.bookingUid);
      const conf = await readConfirmation(claim.outcomeId);
      result = checkConfirmed(claim, booking, conf);
    } else {
      const r = await f(`${d.foremanUrl}/internal/attestations/${encodeURIComponent(claim.outcomeId)}`);
      const j = r.ok ? ((await r.json()) as { payload: { outcomeId: string; attended: boolean }; signature: Hex }) : null;
      const ok = !!j && j.payload.outcomeId === claim.outcomeId && j.payload.attended === true
        && (await verifyJson(j.payload, j.signature, d.businessAddress));
      result = checkAttended(ok, j ? `attestation signed by ${ok ? d.businessAddress : "unknown key"}` : "no attestation on record");
    }
    return c.json(await signVerdict(d.signerPk, {
      kind: "outcome", subject: `${claim.outcomeId}:${claim.milestone}`, verdict: result.code ? "FAIL" : "PASS",
      code: result.code, checks: result.checks, checkedAt: new Date().toISOString(),
    }));
  });

  async function readConfirmation(outcomeId: string): Promise<Confirmation | null> {
    const r = await f(`${d.foremanUrl}/internal/confirmations/${encodeURIComponent(outcomeId)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { record: Omit<Confirmation, "signatureValid">; signature: Hex };
    // Trust edge, documented: the confirmation page is hosted by Foreman, so the oracle requires
    // Foreman's signature on the record. Production moves the page to the oracle/business.
    const signatureValid = j.record.outcomeId === outcomeId && (await verifyJson(j.record, j.signature, d.foremanAddress));
    return { ...j.record, signatureValid };
  }

  return app;
}
