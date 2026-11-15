import { recoverTypedDataAddress } from "viem";
import { typedData } from "./x402";
import type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from "./x402";
import { hashOf, sha256 } from "./canonical";

const HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n; // secp256k1n / 2

export interface Facilitator {
  readonly mode: "remote" | "sim";
  verify(p: PaymentPayload, r: PaymentRequirements): Promise<VerifyResponse>;
  settle(p: PaymentPayload, r: PaymentRequirements): Promise<SettleResponse>;
}

/** Real facilitator (Pieverse). Submits the EIP-3009 transfer on Kite; the payer needs no gas. */
export class HttpFacilitator implements Facilitator {
  readonly mode = "remote" as const;
  constructor(private url: string, private fetchImpl: typeof fetch = fetch) {}
  private async post<T>(path: string, p: PaymentPayload, r: PaymentRequirements): Promise<T> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ x402Version: 2, paymentPayload: p, paymentRequirements: r }),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok && path === "verify")
      return { isValid: false, invalidReason: `facilitator_http_${res.status}${body?.issues ? `: ${JSON.stringify(body.issues).slice(0, 300)}` : ""}` } as T;
    if (!res.ok && path === "settle")
      return { success: false, errorReason: `facilitator_http_${res.status}: ${JSON.stringify(body).slice(0, 300)}`, transaction: "", network: r.network } as T;
    return body as T;
  }
  verify(p: PaymentPayload, r: PaymentRequirements) { return this.post<VerifyResponse>("verify", p, r); }
  settle(p: PaymentPayload, r: PaymentRequirements) { return this.post<SettleResponse>("settle", p, r); }
}

/**
 * Local facilitator for running without funded wallets. The cryptography is real: it recovers the
 * EIP-712 signer and enforces amount, payee, asset, network, validity window and nonce reuse.
 * Only the on-chain submission is skipped — settlements carry a `sim:` transaction id that the
 * console never renders as a Kitescan link.
 */
export class LocalFacilitator implements Facilitator {
  readonly mode = "sim" as const;
  /** from:nonce pairs already settled — the in-memory stand-in for the token's authorizationState. */
  private usedNonces = new Set<string>();
  /** Receipts keyed by the exact payload + requirements, so only a byte-identical retry gets a cached receipt. */
  private receipts = new Map<string, SettleResponse>();

  async verify(p: PaymentPayload, r: PaymentRequirements): Promise<VerifyResponse> {
    const a = p.payload?.authorization;
    if (!a || !p.payload.signature) return { isValid: false, invalidReason: "invalid_payload" };
    if (p.accepted.network !== r.network || p.accepted.asset.toLowerCase() !== r.asset.toLowerCase())
      return { isValid: false, invalidReason: "requirements_mismatch" };
    if (a.to.toLowerCase() !== r.payTo.toLowerCase()) return { isValid: false, invalidReason: "invalid_payee" };
    if (BigInt(a.value) < BigInt(r.amount)) return { isValid: false, invalidReason: "insufficient_amount" };
    // Same bounds as EIP-3009 on chain: block.timestamp > validAfter && block.timestamp < validBefore.
    const now = Math.floor(Date.now() / 1000);
    if (now <= Number(a.validAfter) || now >= Number(a.validBefore)) return { isValid: false, invalidReason: "authorization_expired" };
    // Like the chain: a settled authorization can't pay for a second request (stops replaying a PAYMENT-SIGNATURE).
    if (this.usedNonces.has(`${a.from.toLowerCase()}:${a.nonce}`)) return { isValid: false, invalidReason: "nonce_already_used" };
    // The token (like USDC) rejects high-s signatures; viem's recover accepts them, so check here to match the chain.
    const sig = p.payload.signature;
    if (!/^0x[0-9a-fA-F]{130}$/.test(sig) || BigInt(`0x${sig.slice(66, 130)}`) > HALF_N) return { isValid: false, invalidReason: "invalid_signature" };
    let signer: string;
    try {
      signer = await recoverTypedDataAddress({ ...typedData(r, a), signature: p.payload.signature });
    } catch {
      return { isValid: false, invalidReason: "invalid_signature" };
    }
    if (signer.toLowerCase() !== a.from.toLowerCase()) return { isValid: false, invalidReason: "invalid_signature" };
    return { isValid: true, payer: a.from };
  }

  async settle(p: PaymentPayload, r: PaymentRequirements): Promise<SettleResponse> {
    const exact = hashOf({ payload: p.payload, r });
    const prior = this.receipts.get(exact);
    if (prior) return prior; // a byte-identical settle retry gets the same receipt; anything else is verified afresh
    const v = await this.verify(p, r);
    if (!v.isValid) return { success: false, errorReason: v.invalidReason, transaction: "", network: r.network };
    const key = `${p.payload.authorization.from.toLowerCase()}:${p.payload.authorization.nonce}`;
    const out: SettleResponse = { success: true, payer: v.payer, network: r.network, transaction: `sim:0x${sha256(key)}` };
    this.usedNonces.add(key);
    this.receipts.set(exact, out);
    return out;
  }
}

export function facilitatorFromEnv(): Facilitator {
  const mode = process.env.PAYMENTS_MODE ?? "sim";
  if (mode === "live") return new HttpFacilitator(process.env.FACILITATOR_URL ?? "https://facilitator.pieverse.io/v2");
  return new LocalFacilitator();
}
