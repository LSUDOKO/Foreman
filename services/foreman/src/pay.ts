// Foreman's outbound x402 payments. The firewall runs inside the buyer's guard, i.e. after the 402 tells us
// what is being asked and *before* anything is signed.
import type { KiteNetwork } from "@foreman/shared/kite";
import { txLink } from "@foreman/shared/kite";
import { fromUnits } from "@foreman/shared/money";
import type { Hex } from "@foreman/shared/types";
import { PaymentRefused, payAndFetch } from "@foreman/shared/x402-buyer";
import { newId, nowIso } from "./db";
import type { EventLog } from "./events";
import { check } from "./firewall/check";
import type { Ctx } from "./firewall/check";
import { keys } from "./idempotency";
import type { Idempotency } from "./idempotency";
import type { Store } from "./store";

export interface PayOut {
  contractId: string;
  url: string;
  body: unknown;
  counterparty: string;
  payTo: Hex;
  purpose: "call" | "bonus" | "verify_call";
  refId: string;
  customerId?: string;
}

export type PayResult =
  | { ok: true; json: any; amount: string; txHash: string }
  | { ok: false; code: string; details: Record<string, unknown>; status?: number };

export class Payments {
  constructor(
    private store: Store,
    private log: EventLog,
    private idem: Idempotency,
    private o: { pk: Hex; from: Hex; network: KiteNetwork; ctx: (contractId: string) => Ctx; fetchImpl?: typeof fetch },
  ) {}

  async payOut(p: PayOut): Promise<PayResult> {
    const key = keys.pay(p.contractId, p.payTo, p.purpose, p.refId);
    let amount = "0.00";
    try {
      const r = await payAndFetch(p.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p.body) }, {
        pk: this.o.pk,
        network: this.o.network.caip2,
        fetchImpl: this.o.fetchImpl,
        guard: (req) => {
          // A seller can't redirect funds: the 402 must name exactly the payee we meant to pay.
          if (req.payTo.toLowerCase() !== p.payTo.toLowerCase() || req.asset.toLowerCase() !== this.o.network.token.address.toLowerCase())
            throw new PaymentRefused("payee_not_allowlisted", { asked: req.payTo, expected: p.payTo });
          amount = fromUnits(req.amount, this.o.network.token.decimals);
          const d = check({ kind: "pay", idemKey: key, payTo: req.payTo, amount, purpose: p.purpose }, this.o.ctx(p.contractId));
          if (!d.ok) throw new PaymentRefused(d.code, { ...d.details, clause: d.clause });
          if (!this.idem.begin(key, "pay")) throw new PaymentRefused("duplicate_action", { key });
        },
      });
      if (!r.res.ok || !r.receipt?.success) {
        if (r.requirement) this.idem.fail(key);
        const body = await r.res.json().catch(() => ({}));
        return { ok: false, code: r.res.ok ? "settlement_failed" : "seller_error", status: r.res.status, details: body };
      }
      const txHash = r.receipt.transaction;
      this.idem.done(key, txHash);
      this.store.addPayment({
        id: newId("pay"), contractId: p.contractId, direction: "out", from: this.o.from, to: p.payTo, counterparty: p.counterparty,
        purpose: p.purpose, amount, txHash, refId: p.refId, createdAt: nowIso(),
      });
      this.log.emit("payment_out", "foreman", {
        to: p.counterparty, toAddr: p.payTo, from: this.o.from, amount, purpose: p.purpose, refId: p.refId, customerId: p.customerId,
        txHash, link: txLink(txHash, this.o.network), spent: this.store.spent(p.contractId),
      }, p.contractId);
      return { ok: true, json: await r.res.json(), amount, txHash };
    } catch (e) {
      if (e instanceof PaymentRefused) {
        this.log.refuse(p.contractId, e.code, "foreman", `pay:${p.purpose}`, String(e.details.clause ?? "spend"), { to: p.counterparty, amount, ...e.details, customerId: p.customerId });
        return { ok: false, code: e.code, details: e.details };
      }
      this.idem.fail(key);
      return { ok: false, code: "network_error", details: { message: String((e as Error).message) } };
    }
  }
}
