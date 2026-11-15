// The clinic's payment agent. It trusts nobody's word: before paying an invoice it pays the oracle to check the
// calendar and the customer's click, verifies the oracle's signature, and enforces its own ceiling.
import { Hono } from "hono";
import type { KiteNetwork } from "@foreman/shared/kite";
import { txLink } from "@foreman/shared/kite";
import { addUsd, cents, fromUnits, gtUsd } from "@foreman/shared/money";
import { signJson, verdictTrusted } from "@foreman/shared/sign";
import type { Hex, Verdict } from "@foreman/shared/types";
import { PaymentRefused, payAndFetch } from "@foreman/shared/x402-buyer";

export interface Claim {
  outcomeId: string; contractId: string; milestone: "confirmed" | "attended"; customer: string; bookingUid: string;
  contractHash: string; price: string; expected: { attendeeEmail: string; start: string };
}

export interface PayerDeps {
  pk: Hex;
  address: Hex;
  network: KiteNetwork;
  foremanUrl: string;
  oracleUrl: string;
  foremanPayTo: Hex;
  oraclePayTo: Hex;
  oracleSigner: Hex;
  maxPerOutcome: string;
  maxOraclePrice: string;
  /** Bearer for Foreman's /v1/claims (CONSOLE_TOKEN); claims contain customer PII. */
  foremanToken?: string;
  fetchImpl?: typeof fetch;
}

interface Entry { at: string; outcomeId: string; milestone: string; customer: string; kind: "invoice" | "verify" | "refusal"; amount?: string; txHash?: string; link?: string | null; code?: string; verdict?: string }

export function createPayer(d: PayerDeps) {
  const f = d.fetchImpl ?? fetch;
  const paid = new Map<string, string>(); // `${outcomeId}:${milestone}` → tx
  const failed = new Set<string>(); // oracle said FAIL once: never re-buy that verification (it would drain fees every tick)
  const perOutcome = new Map<string, string>();
  const journal: Entry[] = [];
  let busy = false;

  const note = (e: Omit<Entry, "at">) => journal.push({ at: new Date().toISOString(), ...e });

  async function pay(url: string, body: unknown, expect: { payTo: Hex; max: string }) {
    let amount = "0.00";
    const r = await payAndFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, {
      pk: d.pk, network: d.network.caip2, fetchImpl: f,
      guard: (req) => {
        if (req.payTo.toLowerCase() !== expect.payTo.toLowerCase()) throw new PaymentRefused("payee_not_allowlisted", { asked: req.payTo });
        // The amount is read with our token's decimals, so a 402 naming another asset must never be signed.
        if (req.asset.toLowerCase() !== d.network.token.address.toLowerCase()) throw new PaymentRefused("asset_not_allowed", { asked: req.asset });
        amount = fromUnits(req.amount, d.network.token.decimals);
        if (gtUsd(amount, expect.max)) throw new PaymentRefused("over_budget", { amount, max: expect.max });
      },
    });
    return { ...r, amount };
  }

  async function settle(claim: Claim) {
    const key = `${claim.outcomeId}:${claim.milestone}`;
    if (paid.has(key) || failed.has(key)) return;
    const already = perOutcome.get(claim.outcomeId) ?? "0.00";
    if (cents(addUsd(already, claim.price)) > cents(d.maxPerOutcome))
      return note({ kind: "refusal", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, code: "over_budget" });

    // 1. Pay the oracle to check the facts. 2. Check the oracle's signature. 3. Only then pay the invoice.
    const v = await pay(`${d.oracleUrl}/v1/verify/outcome`, {
      outcomeId: claim.outcomeId, milestone: claim.milestone, bookingUid: claim.bookingUid, expected: claim.expected, contractHash: claim.contractHash,
    }, { payTo: d.oraclePayTo, max: d.maxOraclePrice });
    if (!v.res.ok) return note({ kind: "refusal", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, code: `oracle_http_${v.res.status}` });
    const verdict = (await v.res.json()) as Verdict;
    note({ kind: "verify", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, amount: v.amount, txHash: v.receipt?.transaction, link: txLink(v.receipt?.transaction, d.network), verdict: verdict.verdict, code: verdict.code });
    const signed = await verdictTrusted(verdict, d.oracleSigner, "outcome", key);
    if (verdict.verdict !== "PASS" || !signed) {
      failed.add(key);
      return note({ kind: "refusal", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, code: signed ? `proof_failed:${verdict.code}` : "proof_failed:bad_signature" });
    }

    const inv = await pay(`${d.foremanUrl}/v1/invoice/${encodeURIComponent(claim.outcomeId)}/${claim.milestone}`, {}, {
      payTo: d.foremanPayTo, max: claim.price,
    });
    if (!inv.res.ok || !inv.receipt?.success)
      return note({ kind: "refusal", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, code: `invoice_http_${inv.res.status}` });
    paid.set(key, inv.receipt.transaction);
    perOutcome.set(claim.outcomeId, addUsd(already, inv.amount));
    note({ kind: "invoice", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, amount: inv.amount, txHash: inv.receipt.transaction, link: txLink(inv.receipt.transaction, d.network) });
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const r = await f(`${d.foremanUrl}/v1/claims`, d.foremanToken ? { headers: { authorization: `Bearer ${d.foremanToken}` } } : undefined);
      if (!r.ok) return;
      for (const claim of (await r.json()) as Claim[]) {
        try { await settle(claim); } catch (e) {
          if (e instanceof PaymentRefused) note({ kind: "refusal", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, code: e.code });
          else note({ kind: "refusal", outcomeId: claim.outcomeId, milestone: claim.milestone, customer: claim.customer, code: "network_error" });
        }
      }
    } catch {
      // Foreman offline: try again next tick.
    } finally {
      busy = false;
    }
  }

  const app = new Hono();
  app.get("/healthz", (c) => c.json({ ok: true, name: "business-payer", address: d.address }));
  app.get("/status", (c) => {
    const spentInvoices = addUsd("0.00", ...journal.filter((j) => j.kind === "invoice").map((j) => j.amount!));
    const spentOracle = addUsd("0.00", ...journal.filter((j) => j.kind === "verify").map((j) => j.amount!));
    return c.json({ address: d.address, maxPerOutcome: d.maxPerOutcome, spentInvoices, spentOracle, total: addUsd(spentInvoices, spentOracle), journal });
  });
  // The business clicked "Mark attended" in its view: sign the attestation with the business key.
  app.post("/attest/:outcomeId", async (c) => {
    const payload = { outcomeId: c.req.param("outcomeId"), attended: true };
    return c.json({ payload, signature: await signJson(d.pk, payload), signer: d.address });
  });
  app.post("/tick", async (c) => { await tick(); return c.json({ ok: true }); });

  return { app, tick, journal };
}
