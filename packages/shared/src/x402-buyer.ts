import { privateKeyToAccount } from "viem/accounts";
import { H_REQUIRED, H_RESPONSE, H_SIGNATURE, b64, typedData, unb64 } from "./x402";
import type { Authorization, PaymentPayload, PaymentRequired, PaymentRequirements, SettleResponse } from "./x402";
import type { Hex } from "./types";

export class PaymentRefused extends Error {
  constructor(public code: string, public details: Record<string, unknown> = {}) {
    super(code);
  }
}

export interface PaidResponse {
  res: Response;
  receipt: SettleResponse | null;
  requirement: PaymentRequirements | null;
  /** The signed header, kept so a retry reuses the same authorization (idempotent settlement). */
  paymentHeader: string | null;
}

const randomNonce = (): Hex =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

export async function signPayment(pk: Hex, required: PaymentRequired, req: PaymentRequirements): Promise<string> {
  const account = privateKeyToAccount(pk);
  const now = Math.floor(Date.now() / 1000);
  const authorization: Authorization = {
    from: account.address,
    to: req.payTo,
    value: req.amount,
    validAfter: String(now - 5),
    validBefore: String(now + (req.maxTimeoutSeconds ?? 300)),
    nonce: randomNonce(),
  };
  const signature = await account.signTypedData(typedData(req, authorization));
  const payment: PaymentPayload = { x402Version: 2, resource: required.resource, accepted: req, payload: { signature, authorization } };
  return b64(payment);
}

/**
 * Request a paid resource. On 402, picks the requirement for `network`, runs `guard` (the firewall —
 * throws PaymentRefused to stop *before* any signature), signs EIP-3009, and retries once.
 * Pass `reuseHeader` to retry with a previously signed authorization.
 */
export async function payAndFetch(
  url: string,
  init: RequestInit,
  opts: { pk: Hex; network: string; guard: (req: PaymentRequirements) => void | Promise<void>; reuseHeader?: string; fetchImpl?: typeof fetch },
): Promise<PaidResponse> {
  const f = opts.fetchImpl ?? fetch;
  if (opts.reuseHeader) {
    const res = await f(url, withHeader(init, H_SIGNATURE, opts.reuseHeader));
    return { res, receipt: readReceipt(res), requirement: unb64<PaymentPayload>(opts.reuseHeader).accepted, paymentHeader: opts.reuseHeader };
  }
  const first = await f(url, init);
  if (first.status !== 402) return { res: first, receipt: null, requirement: null, paymentHeader: null };
  const raw = first.headers.get(H_REQUIRED);
  if (!raw) throw new PaymentRefused("malformed_402", { url });
  const required = unb64<PaymentRequired>(raw);
  const req = required.accepts.find((a) => a.network === opts.network && a.scheme === "exact");
  if (!req) throw new PaymentRefused("network_not_offered", { url, network: opts.network });
  await opts.guard(req);
  const header = await signPayment(opts.pk, required, req);
  const res = await f(url, withHeader(init, H_SIGNATURE, header));
  return { res, receipt: readReceipt(res), requirement: req, paymentHeader: header };
}

function withHeader(init: RequestInit, k: string, v: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set(k, v);
  return { ...init, headers };
}

function readReceipt(res: Response): SettleResponse | null {
  const h = res.headers.get(H_RESPONSE);
  return h ? unb64<SettleResponse>(h) : null;
}
