import type { Context, MiddlewareHandler } from "hono";
import { H_REQUIRED, H_RESPONSE, H_SIGNATURE, b64, unb64 } from "./x402";
import type { PaymentPayload, PaymentRequired, PaymentRequirements, SettleResponse } from "./x402";
import type { Facilitator } from "./facilitator";
import type { KiteNetwork } from "./kite";
import { toUnits } from "./money";
import type { Hex } from "./types";

export interface PaywallOptions {
  usd: string | ((c: Context) => string);
  payTo: Hex;
  network: KiteNetwork;
  facilitator: Facilitator;
  description: string;
  /** Runs before any 402 or settlement; return a Response (e.g. 409) to refuse so nobody pays for an invalid request. */
  precheck?: (c: Context) => Promise<Response | void> | Response | void;
  onSettled?: (c: Context, s: SettleResponse, p: PaymentPayload) => void | Promise<void>;
}

export function requirementFor(o: PaywallOptions, c: Context): PaymentRequirements {
  const usd = typeof o.usd === "function" ? o.usd(c) : o.usd;
  return {
    scheme: "exact",
    network: o.network.caip2,
    asset: o.network.token.address,
    amount: toUnits(usd, o.network.token.decimals).toString(),
    payTo: o.payTo,
    maxTimeoutSeconds: 300,
    extra: { name: o.network.token.eip712Name, version: o.network.token.eip712Version },
  };
}

/**
 * x402 v2 "exact" paywall. Order: precheck → 402 or verify → handler → settle (only if the handler
 * succeeded) → PAYMENT-RESPONSE. A handler error means the buyer's authorization is never submitted.
 */
export function paywall(o: PaywallOptions): MiddlewareHandler {
  return async (c, next) => {
    const refused = await o.precheck?.(c);
    if (refused) return refused;

    const req = requirementFor(o, c);
    const required: PaymentRequired = { x402Version: 2, resource: { url: c.req.url, description: o.description, mimeType: "application/json" }, accepts: [req] };
    const header = c.req.header(H_SIGNATURE) ?? c.req.header("x-payment");
    if (!header) {
      c.header(H_REQUIRED, b64(required));
      return c.json({ error: "payment_required", accepts: required.accepts }, 402);
    }

    let payment: PaymentPayload;
    try {
      payment = unb64<PaymentPayload>(header);
    } catch {
      c.header(H_REQUIRED, b64({ ...required, error: "invalid_payment_header" }));
      return c.json({ error: "invalid_payment_header" }, 402);
    }
    const v = await o.facilitator.verify(payment, req);
    if (!v.isValid) {
      c.header(H_REQUIRED, b64({ ...required, error: v.invalidReason }));
      return c.json({ error: "payment_invalid", reason: v.invalidReason }, 402);
    }

    c.set("x402Payer" as never, v.payer as never);
    await next();
    if (c.res.status >= 400) return;

    const s = await o.facilitator.settle(payment, req);
    if (!s.success) {
      c.res = c.json({ error: "settlement_failed", reason: s.errorReason }, 402);
      return;
    }
    await o.onSettled?.(c, s, payment);
    const res = new Response(c.res.body, c.res);
    res.headers.set(H_RESPONSE, b64(s));
    c.res = res;
  };
}
