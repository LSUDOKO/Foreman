import { createHmac, timingSafeEqual } from "node:crypto";
import { recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonical, sha256 } from "./canonical";
import type { Hex, Verdict } from "./types";

/** EIP-191 signature over sha256(canonical(payload)). Used for oracle verdicts, attestations, confirmations. */
export async function signJson(pk: Hex, payload: unknown): Promise<Hex> {
  return privateKeyToAccount(pk).signMessage({ message: sha256(canonical(payload)) });
}

export async function recoverJsonSigner(payload: unknown, signature: Hex): Promise<Hex> {
  return recoverMessageAddress({ message: sha256(canonical(payload)), signature });
}

export async function verifyJson(payload: unknown, signature: Hex, expected: string): Promise<boolean> {
  try {
    return (await recoverJsonSigner(payload, signature)).toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * A verdict is trusted only if the configured oracle signed it AND it is about the thing we asked for.
 * Without the kind/subject check a genuine PASS for one attempt or outcome could be replayed for another.
 */
export async function verdictTrusted(v: Verdict, signer: string, kind: Verdict["kind"], subject: string): Promise<boolean> {
  const { signature, ...body } = v;
  return body.kind === kind && body.subject === subject && body.oracle?.toLowerCase() === signer.toLowerCase()
    && verifyJson(body, signature, signer);
}

export const hmac = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");

export function hmacValid(secret: string, body: string, sig: string | undefined | null): boolean {
  if (!sig) return false;
  const a = Buffer.from(hmac(secret, body));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Twilio's X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted(key+value)…)). */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((s, k) => s + k + params[k], url);
  return createHmac("sha1", authToken).update(data).digest("base64");
}

export function twilioSignatureValid(authToken: string, url: string, params: Record<string, string>, sig?: string | null) {
  if (!sig) return false;
  const a = Buffer.from(twilioSignature(authToken, url, params));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
