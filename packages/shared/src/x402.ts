// x402 v2 wire format, field names checked against @x402/core@2.31.0 types:
// PaymentRequired { x402Version, error?, resource, accepts: PaymentRequirements[] }
// PaymentRequirements { scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra }
// PaymentPayload { x402Version, resource?, accepted, payload }
// SettleResponse { success, errorReason?, payer?, transaction, network }
// Headers: PAYMENT-REQUIRED (402), PAYMENT-SIGNATURE (retry), PAYMENT-RESPONSE (200).
import type { Hex } from "./types";

export interface ResourceInfo { url: string; description?: string; mimeType?: string }
export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  asset: Hex;
  amount: string;
  payTo: Hex;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string } & Record<string, unknown>;
}
export interface PaymentRequired { x402Version: 2; error?: string; resource: ResourceInfo; accepts: PaymentRequirements[] }
export interface Authorization { from: Hex; to: Hex; value: string; validAfter: string; validBefore: string; nonce: Hex }
export interface ExactPayload { signature: Hex; authorization: Authorization }
export interface PaymentPayload { x402Version: 2; resource?: ResourceInfo; accepted: PaymentRequirements; payload: ExactPayload }
export interface VerifyResponse { isValid: boolean; invalidReason?: string; payer?: string }
export interface SettleResponse { success: boolean; errorReason?: string; payer?: string; transaction: string; network: string }

export const H_REQUIRED = "PAYMENT-REQUIRED";
export const H_SIGNATURE = "PAYMENT-SIGNATURE";
export const H_RESPONSE = "PAYMENT-RESPONSE";

export const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
export const unb64 = <T>(s: string): T => JSON.parse(Buffer.from(s, "base64").toString());

export const TRANSFER_WITH_AUTHORIZATION = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function chainIdOf(network: string): number {
  const m = /^eip155:(\d+)$/.exec(network);
  if (!m) throw new Error(`unsupported network ${network}`);
  return Number(m[1]);
}

export function typedData(req: PaymentRequirements, a: Authorization) {
  return {
    domain: { name: req.extra.name, version: req.extra.version, chainId: chainIdOf(req.network), verifyingContract: req.asset },
    types: TRANSFER_WITH_AUTHORIZATION,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: a.from, to: a.to, value: BigInt(a.value),
      validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce,
    },
  };
}
