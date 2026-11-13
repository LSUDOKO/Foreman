# 07 · Kite and x402 payments

## Network (free mode = testnet)

| | Kite testnet | Kite mainnet (later) |
|---|---|---|
| Chain ID / CAIP-2 | `2368` / `eip155:2368` | `2366` / `eip155:2366` |
| RPC | `https://rpc-testnet.gokite.ai/` | `https://rpc.gokite.ai/` |
| Explorer | `https://testnet.kitescan.ai/` | `https://kitescan.ai/` |
| Faucet | `https://faucet.gokite.ai` | — |
| Native gas token | KITE | KITE |
| x402 payment token | **pieUSD** `0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A`, 18 decimals, EIP-712 domain `{ name: "pieUSD", version: "1" }` | **USDC.e** `0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e`, 6 decimals, domain `{ name: "Bridged USDC (Kite AI)", version: "2" }` |
| Facilitator | `https://facilitator.pieverse.io/v2` (keep the `/v2`) | same |

Source: the `src/networks.ts` constants in the **kite-x402-hono** priority repo and the kite-x402-explorer README. Kite's older service-provider guide lists a different testnet token (`0x0fF5…7e63`); **use pieUSD** because that's what the current facilitator settles. Verify both on testnet Kitescan before you start (see `16-risks-and-fallbacks.md`).

### First thing tomorrow (15 minutes)

1. Create 3 wallets with viem (`generatePrivateKey()`): **business**, **foreman**, **oracle-signer**. Create 3 receive-only addresses: **clearcall**, **quickdial**, **oracle**.
2. Add Kite testnet to MetaMask (ChainList 2368) for eyeballing balances.
3. Faucet → get KITE and **pieUSD** into **business** and **foreman**. If the faucet only gives KITE, ask in Kite's Discord where to get testnet pieUSD (fallback C below).
4. Paste all addresses into `.env` (`SETUP.md`).

## Sellers: the x402 paywall on our services

We have four paid surfaces:

| Seller | Route | Price | Pays |
|---|---|---|---|
| ClearCall | `POST /v1/call` | $0.50 | Foreman |
| ClearCall | `POST /v1/bonus/:attemptId` | $0.20 | Foreman (only after oracle PASS) |
| QuickDial | `POST /v1/call` | $0.30 | Foreman |
| QuickDial | `POST /v1/bonus/:attemptId` | $0.20 | Foreman |
| Oracle | `POST /v1/verify/call` | $0.02 | Foreman |
| Oracle | `POST /v1/verify/outcome` | $0.02 | Business payer |
| Foreman | `POST /v1/invoice/:outcomeId/confirmed` | $4.00 | Business payer |
| Foreman | `POST /v1/invoice/:outcomeId/attended` | $2.00 | Business payer |

> The "bonus" route is a tiny paid endpoint that just records "bonus received for attempt X". Paying it *is* the bonus. This keeps every money movement an x402 payment with a receipt.

### Two ways to build the paywall

**Option A — kite-x402-hono as a reverse proxy (fastest, zero payment code).** Run our service on a private port and put one kite-x402-hono instance in front of each fixed price:

```bash
# one wrapper per (service, price). Example: ClearCall /v1/call at $0.50
PAY_TO=0xCLEARCALL... UPSTREAM_URL=http://localhost:4110 KITE_NETWORK=testnet PRICE_USD=0.50 PORT=4100 bunx kite-x402-hono
# /v1/* on :4100 → 402 until paid → proxied to http://localhost:4110/*
```
It verifies with the official `@x402/hono` middleware, proxies to the fixed upstream, and only returns the upstream response after settlement succeeds. Good for the two phone workers and the oracle; you run one wrapper per price:

| Wrapper port | Price | Upstream |
|---|---|---|
| 4100 | $0.50 | ClearCall `:4110` (`/v1/call`) |
| 4102 | $0.20 | ClearCall `:4110` (`/v1/bonus/:id`) |
| 4101 | $0.30 | QuickDial `:4111` (`/v1/call`) |
| 4103 | $0.20 | QuickDial `:4111` (`/v1/bonus/:id`) |
| 4200 | $0.02 | Oracle `:4210` (both verify routes) |
| 4001 | $4.00 | Foreman `:4000` (`/v1/invoice/:id/confirmed`) |
| 4002 | $2.00 | Foreman `:4000` (`/v1/invoice/:id/attended`) |

Only `/v1/*` goes through the paywall. Twilio webhooks (`/twilio/*`) and Foreman's console API hit the upstream ports directly through the tunnel. Check whether the wrapper still settles when the upstream returns a non-2xx; if it does, the business payer must check `/v1/claims` (free) right before paying, which it already does.

**Option B — `@x402/hono` middleware in-process with per-route prices (cleaner, recommended once A works).** Import the network constants from kite-x402-hono (or copy them, with attribution) and register routes:

```ts
// packages/shared/src/x402-seller.ts (shape — verify names against the @x402 packages you install)
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { KITE } from "./kite";            // chain, token, decimals, eip712 {name,version}

export function paywall(routes: Record<string, { usd: string; payTo: `0x${string}` }>) {
  const facilitator = new HTTPFacilitatorClient({ url: KITE.facilitatorUrl });
  const server = new x402ResourceServer(facilitator).register(KITE.caip2, new ExactEvmScheme());
  const config = Object.fromEntries(Object.entries(routes).map(([route, r]) => [route, {
    accepts: {
      scheme: "exact",
      network: KITE.caip2,                               // "eip155:2368"
      payTo: r.payTo,
      price: { amount: toUnits(r.usd, KITE.token.decimals), asset: KITE.token.address,
               extra: { name: KITE.token.eip712Name, version: KITE.token.eip712Version } },
    },
    description: route,
  }]));
  return paymentMiddleware(config, server);
}
```

Start with A on Saturday morning to get a 402 → pay → 200 loop working within an hour; switch to B only if time allows.

## Buyer: Foreman and the business payer paying over x402

Flow (x402 v2, "exact" scheme on EVM):

1. `POST` the paid route with no payment → **402** with a `PAYMENT-REQUIRED` header (base64 JSON: the accepted payment requirements — network, asset, amount, payTo, timeout, extra).
2. **Firewall check** (payee allowlisted, amount ≤ cap, budget, idempotency) — *before* signing anything.
3. Sign an **EIP-3009 `TransferWithAuthorization`** typed-data message with the payer key: domain `{ name, version, chainId: 2368, verifyingContract: asset }`, message `{ from, to: payTo, value: amount, validAfter, validBefore, nonce }` (random 32-byte nonce).
4. Retry the request with the `PAYMENT-SIGNATURE` header (base64 JSON payment payload carrying the accepted requirement and the signature + authorization).
5. Server verifies with the facilitator, does the work, settles, and returns **200** plus a `PAYMENT-RESPONSE` header (settlement receipt incl. **tx hash**).
6. Write the payment to the ledger with the tx hash → Kitescan link.

```ts
// packages/shared/src/x402-buyer.ts (shape)
import { privateKeyToAccount } from "viem/accounts";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const unb64 = (s: string) => JSON.parse(Buffer.from(s, "base64").toString());

export async function payAndFetch(url: string, init: RequestInit, pk: `0x${string}`, guard: (req: any) => void) {
  const first = await fetch(url, init);
  if (first.status !== 402) return { res: first, receipt: null };
  const required = unb64(first.headers.get("PAYMENT-REQUIRED")!);
  const req = required.accepts[0];                       // pick the eip155:2368 entry
  guard(req);                                            // firewall: throws a typed refusal
  const account = privateKeyToAccount(pk);
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address, to: req.payTo, value: req.amount,
    validAfter: String(now - 5), validBefore: String(now + (req.maxTimeoutSeconds ?? 300)),
    nonce: `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`,
  };
  const signature = await account.signTypedData({
    domain: { name: req.extra.name, version: req.extra.version, chainId: 2368, verifyingContract: req.asset },
    types: { TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" } ] },
    primaryType: "TransferWithAuthorization",
    message: { ...authorization, value: BigInt(authorization.value), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) },
  });
  const payment = { x402Version: 2, resource: required.resource, accepted: req, payload: { signature, authorization } };
  const res = await fetch(url, { ...init, headers: { ...(init.headers as any), "PAYMENT-SIGNATURE": b64(payment) } });
  const receipt = res.headers.get("PAYMENT-RESPONSE") ? unb64(res.headers.get("PAYMENT-RESPONSE")!) : null;
  return { res, receipt };                               // receipt.transaction → Kitescan
}
```

> **Verify the exact v2 payload field names** against the `@x402/core` types (or `@x402/fetch`, which may do all of this for you if it supports a custom asset on `eip155:2368`). The structure above follows x402 v2; the header names come from kite-x402-hono's README. Write one integration test that pays $0.01 to a local kite-x402-hono echo before building anything else.

## Spending limits: where they live

| Limit | Enforced by | When |
|---|---|---|
| Payee allowlist, per-call cap, total budget, approval threshold | Foreman firewall | Before signing |
| Contract expiry | Firewall + `validBefore` on each authorization | Before signing + on-chain |
| Business auto-pay ceiling (max $6 per outcome, max N outcomes per contract) | business-payer's own config | Before signing |
| Wallet balance | The wallet only holds what you fund it with | Always |

In production these limits move into **Kite Passport spending sessions** (total budget, per-transaction limit, time window, approved with a passkey). In the README, show the mapping: our `spend.totalBudget` → session budget, `perCallCap` → per-transaction limit, `expiresAt` → session window.

## Agent identities

Each agent has a stable identity shown in the console:

```
Foreman          0x… (wallet)   reputation n/a   role: outcome agent
ClearCall        0x… (payTo)    reputation 90    role: phone worker
QuickDial        0x… (payTo)    reputation 80    role: phone worker (new)
Proof Oracle     0x… (payTo)    signer 0x…       role: verifier
Smile Dental     0x… (wallet)   —                role: buyer
```

Each address links to `https://testnet.kitescan.ai/address/<addr>`.

## Mainnet upgrade path (for the write-up, not for this weekend)

- Set `KITE_NETWORK=mainnet` → chain 2366, USDC.e, same facilitator.
- Replace our Twilio phone worker with **StablePhone** from the Kite Passport catalog (`ksearch services list --query phone --output json`), paid through a Passport spending session.
- Foreman's core doesn't change: workers are x402 endpoints in a registry with a price and a payTo. You add one small adapter that maps StablePhone's request/response format (instructions in, transcript/status out) to our `CallResult` type, and point the call oracle at StablePhone's call-status data instead of Twilio.
