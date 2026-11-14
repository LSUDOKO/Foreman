// Self-hosted x402 facilitator for Kite testnet. Same /verify and /settle API as Pieverse, so every service talks
// to it through HttpFacilitator unchanged. Verify = the local signature checks plus on-chain nonce and balance;
// settle = submit the payer's EIP-3009 transferWithAuthorization on Kite and return the real transaction hash.
// One process, one gas wallet, settlements queued one at a time so the gas wallet's nonce never collides.
import { Hono } from "hono";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from "viem";
import type { Account, Chain, PublicClient, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LocalFacilitator } from "@foreman/shared/facilitator";
import type { KiteNetwork } from "@foreman/shared/kite";
import type { Hex } from "@foreman/shared/types";
import type { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from "@foreman/shared/x402";

export const EIP3009_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function authorizationState(address, bytes32) view returns (bool)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)",
]);

export interface Chainish {
  read(fn: "balanceOf" | "authorizationState", args: readonly unknown[]): Promise<unknown>;
  submit(p: PaymentPayload): Promise<{ hash: Hex; ok: boolean }>;
}

export function kiteChain(net: KiteNetwork, pk: Hex): Chainish {
  const chain: Chain = defineChain({ id: net.chainId, name: `Kite ${net.name}`, nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 }, rpcUrls: { default: { http: [net.rpc] } } });
  const account: Account = privateKeyToAccount(pk);
  const pub = createPublicClient({ chain, transport: http() }) as PublicClient;
  const wallet = createWalletClient({ account, chain, transport: http() }) as WalletClient;
  return {
    read: (fn, args) => pub.readContract({ address: net.token.address, abi: EIP3009_ABI, functionName: fn, args: args as any }),
    async submit(p) {
      const a = p.payload.authorization;
      const hash = await wallet.writeContract({
        account, chain, address: net.token.address, abi: EIP3009_ABI, functionName: "transferWithAuthorization",
        args: [a.from, a.to, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce, p.payload.signature],
      });
      const r = await pub.waitForTransactionReceipt({ hash });
      return { hash, ok: r.status === "success" };
    },
  };
}

export function createFacilitator(d: { net: KiteNetwork; chain: Chainish; gasAddress?: string }) {
  const local = new LocalFacilitator();
  const settled = new Map<string, Promise<SettleResponse>>();
  let queue: Promise<unknown> = Promise.resolve();

  async function verify(p: PaymentPayload, r: PaymentRequirements): Promise<VerifyResponse> {
    if (r.network !== d.net.caip2 || r.asset.toLowerCase() !== d.net.token.address.toLowerCase())
      return { isValid: false, invalidReason: "unsupported_asset" };
    const v = await local.verify(p, r);
    if (!v.isValid) return v;
    const a = p.payload.authorization;
    if (await d.chain.read("authorizationState", [a.from, a.nonce])) return { isValid: false, invalidReason: "nonce_already_used" };
    if ((await d.chain.read("balanceOf", [a.from])) as bigint < BigInt(a.value)) return { isValid: false, invalidReason: "insufficient_funds" };
    return v;
  }

  function settle(p: PaymentPayload, r: PaymentRequirements): Promise<SettleResponse> {
    const key = `${p.payload?.authorization?.from?.toLowerCase()}:${p.payload?.authorization?.nonce}`;
    const prior = settled.get(key);
    if (prior) return prior; // a retried settle of the same authorization gets the same receipt
    const job = queue.then(async (): Promise<SettleResponse> => {
      const v = await verify(p, r);
      if (!v.isValid) return { success: false, errorReason: v.invalidReason, transaction: "", network: r.network };
      try {
        const { hash, ok } = await d.chain.submit(p);
        return ok
          ? { success: true, payer: v.payer, transaction: hash, network: r.network }
          : { success: false, errorReason: "transaction_reverted", transaction: hash, network: r.network };
      } catch (e) {
        return { success: false, errorReason: `submit_failed: ${String((e as Error).message).slice(0, 200)}`, transaction: "", network: r.network };
      }
    });
    queue = job.catch(() => {});
    settled.set(key, job);
    job.then((s) => { if (!s.success) settled.delete(key); }); // failures may be retried with the same authorization
    return job;
  }

  const app = new Hono();
  app.get("/healthz", (c) => c.json({ ok: true, name: "facilitator", network: d.net.caip2, asset: d.net.token.address, gas: d.gasAddress }));
  app.get("/supported", (c) => c.json({ kinds: [{ x402Version: 2, scheme: "exact", network: d.net.caip2 }], extensions: [], signers: { [d.net.caip2]: d.gasAddress ? [d.gasAddress] : [] } }));
  const body = async (c: any) => (await c.req.json().catch(() => ({}))) as { paymentPayload?: PaymentPayload; paymentRequirements?: PaymentRequirements };
  app.post("/verify", async (c) => {
    const b = await body(c);
    if (!b.paymentPayload || !b.paymentRequirements) return c.json({ isValid: false, invalidReason: "invalid_request" }, 400);
    return c.json(await verify(b.paymentPayload, b.paymentRequirements));
  });
  app.post("/settle", async (c) => {
    const b = await body(c);
    if (!b.paymentPayload || !b.paymentRequirements) return c.json({ success: false, errorReason: "invalid_request", transaction: "", network: "" }, 400);
    return c.json(await settle(b.paymentPayload, b.paymentRequirements));
  });
  return { app, verify, settle };
}
