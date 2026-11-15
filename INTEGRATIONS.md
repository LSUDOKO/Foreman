# Integrations

Every external dependency, what Foreman uses it for, where the code lives, which environment variables turn it on,
and what runs instead when it's off. Leave a section of `.env` blank and that piece runs against the local sandbox
(`services/sandbox`, :4400); the console labels every adapter `live` or `sandbox` / `sim` from
`adapterModes()` in [`packages/shared/src/env.ts`](packages/shared/src/env.ts).

| Integration | Used for | Live when | Otherwise |
|---|---|---|---|
| [SERV Reasoning](#serv-reasoning-openserv) | 5 decision types | `SERV_API_KEY` set | deterministic fallback, labelled `fallback` |
| [Kite testnet](#kite-testnet) | settlement chain | `PAYMENTS_MODE=live` | local signature-checking facilitator, `sim:` ids |
| [x402 + facilitator](#x402-and-the-facilitator) | every payment | `PAYMENTS_MODE=live` + `FACILITATOR_URL` | `LocalFacilitator` in-process |
| [Twilio Voice](#twilio-voice) | outbound calls, call records | `TWILIO_AUTH_TOKEN` set | sandbox carrier with scripted customers |
| [Cal.com](#calcom-api-v2) | free slots, bookings | `CALCOM_API_KEY` set | sandbox calendar |
| [Gmail SMTP](#gmail-smtp) | confirmation emails | `SMTP_USER` set | sandbox inbox whose customers click |
| [Cloudflare](#cloudflare-pages-and-workers) | public site, MCP Worker, tunnels | deployed | `bun run dev:all` locally |
| [MCP](#mcp) | drive Foreman from Claude | stdio or Worker | none |

---

## SERV Reasoning (OpenServ)

**What it does.** SERV is the reasoning layer for every judgment call. Foreman talks to OpenServ's OpenAI-compatible
inference API with the `openai` SDK: `POST {SERV_BASE_URL}/chat/completions`, `model: gpt-5.4-mini`,
`reasoning_effort: low`, and SERV's guard tools passed in `tools`.

**Code.** Client: [`packages/shared/src/serv.ts`](packages/shared/src/serv.ts) (`servJson`). Callers:

| Purpose | File | Guard tool | Timeout |
|---|---|---|---|
| `compile_contract` | [`services/foreman/src/contract/compiler.ts`](services/foreman/src/contract/compiler.ts) | `serv_shadow_agent` | 90 s |
| `plan_calls` | [`services/foreman/src/planner/plan.ts`](services/foreman/src/planner/plan.ts) | none | 30 s |
| `select_worker` | [`services/foreman/src/planner/select.ts`](services/foreman/src/planner/select.ts) | none | 20 s |
| `parse_turn` | [`services/phone-worker/src/turn.ts`](services/phone-worker/src/turn.ts) | `serv_prompt_guard` | 9 s (under Twilio's 15 s webhook limit) |
| `audit_transcript` | [`services/foreman/src/planner/audit.ts`](services/foreman/src/planner/audit.ts) | `serv_shadow_agent` | 45 s |

**How the guards are used.**

- `serv_prompt_guard` is attached to the turn parser, the only place untrusted human speech reaches the model. Speech is wrapped as data, the output is parsed into a 7-value intent enum (`accept_slot`, `decline`, `ask_other_time`, `opt_out`, `wrong_person`, `unclear`, `out_of_scope_request`), and if SERV returns `finish_reason=content_filter` the turn becomes `out_of_scope_request` with `injection: true` (`onBlocked`).
- `serv_shadow_agent` validates the contract draft and the transcript audit. SERV reads tool options from schema defaults, so the hint lives in `default` (`shadowAgent()` in `serv.ts`).

**Every decision is logged** through `onServDecision` as a `serv_decision` event with `purpose`, `model`, `effort`,
`source` (`live` / `fallback`), `ms`, token `usage`, `guards`, the parsed `data`, and `error` / `blocked` when relevant.
One deadline covers the call and its single retry; output that fails the zod schema is retried once with the error.

**Env.** `SERV_API_KEY`, `SERV_MODEL` (default `gpt-5.4-mini`), `SERV_BASE_URL` (default
`https://inference-api.openserv.ai/v1`), `SERV_TURN_TIMEOUT_MS`.

**Without a key**, every decision uses its deterministic fallback (regex contract compiler, rule-based planner and
selection, keyword turn classifier, fallback audit) and is labelled `fallback`. CI runs this way.

**Verify.** `bun run serv-test` runs 20 turn fixtures (5 are manipulation attempts) with and without SERV. Measured
2026-11-14: SERV 20/20 at 3.2 s average, keyword baseline 13/20.

---

## Kite testnet

**What it does.** Kite is the settlement chain for every agent-to-agent payment.

| | Testnet (used) | Mainnet (configured, not used yet) |
|---|---|---|
| Chain ID / CAIP-2 | 2368 / `eip155:2368` | 2366 / `eip155:2366` |
| RPC | `https://rpc-testnet.gokite.ai/` | `https://rpc.gokite.ai/` |
| Explorer | `https://testnet.kitescan.ai` | `https://kitescan.ai` |
| Default token | pieUSD `0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A`, 18 decimals | USDC.e `0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e`, 6 decimals |
| Token used in our runs | **fUSD `0xef5765044D85C6A27C66A6e322063E8A67bAB4bB`**, 18 decimals, EIP-712 `{name: "Foreman Test USD", version: "1"}` | |

**Code.** Network constants: [`packages/shared/src/kite.ts`](packages/shared/src/kite.ts) (following kite-x402-hono,
Apache-2.0). `txLink()` returns a Kitescan link or `null` for `sim:` settlements, so a simulated payment can never look
real. Token: [`contracts/src/ForemanTestUSD.sol`](contracts/src/ForemanTestUSD.sol), compiled by
[`scripts/compile-token.ts`](scripts/compile-token.ts) into [`contracts/ForemanTestUSD.json`](contracts/ForemanTestUSD.json),
deployed by [`scripts/deploy-token.ts`](scripts/deploy-token.ts) (checks the on-chain `DOMAIN_SEPARATOR` against our
EIP-712 domain before minting). Audit anchoring: [`scripts/anchor.ts`](scripts/anchor.ts).

**Why fUSD and not pieUSD.** Testnet pieUSD isn't on the public faucet, which gives KITE and a USDT without EIP-3009;
x402 "exact" needs `transferWithAuthorization`. fUSD has the same EIP-3009/EIP-712 shape as pieUSD and USDC. With pieUSD
in the wallets, unset `KITE_TOKEN_ADDRESS` and set `FACILITATOR_URL=https://facilitator.pieverse.io/v2`; nothing else changes.

**Env.** `KITE_NETWORK` (`testnet` / `mainnet`), `KITE_RPC`, `KITE_EXPLORER`, `KITE_TOKEN_ADDRESS` and optional
`KITE_TOKEN_SYMBOL` / `_DECIMALS` / `_NAME` / `_VERSION`, wallet keys `BUSINESS_PK`, `FOREMAN_PK`, `FACILITATOR_PK`.

**Evidence.**
- 14 Nov run: 16 payments, blocks 22,044,661–22,044,680, all `status: success`, `transferWithAuthorization` on fUSD, about 66k gas each ([`video/film/public/kite/txs.json`](video/film/public/kite/txs.json), read back from the Kite RPC; hashes also in [`demo/recorded-run.json`](demo/recorded-run.json)).
- First x402 payment (`pay-test`): [`0xbf4f2bac…dfb11`](https://testnet.kitescan.ai/tx/0xbf4f2bac65d3fe70ccd37ff9684512d15e454efdd542a254969ee844faddfb11), block 22,044,640, to the fUSD contract, `status: 0x1`.
- 15 Nov run: Kite testnet had stalled, so payments ran in local mode (`SIM` in the UI).

---

## x402 and the facilitator

**What it does.** x402 v2, scheme `exact`: an HTTP 402 tells the buyer what to pay; the buyer signs an EIP-3009
`TransferWithAuthorization` (EIP-712) and retries; a facilitator verifies and submits it on chain.

**Wire format** ([`packages/shared/src/x402.ts`](packages/shared/src/x402.ts), field names checked against
`@x402/core@2.31.0`): headers `PAYMENT-REQUIRED` (on the 402), `PAYMENT-SIGNATURE` (on the retry, `X-PAYMENT` also
accepted), `PAYMENT-RESPONSE` (on success, base64 JSON `SettleResponse` with the tx hash). The resource carries
`description` and `mimeType` because Pieverse rejects a payload without them.

**Seller** ([`x402-seller.ts`](packages/shared/src/x402-seller.ts), Hono middleware `paywall`):
`precheck → 402 or verify → handler → settle only if the handler returned < 400 → PAYMENT-RESPONSE`. A failing handler
means the buyer's authorization is never submitted, so nobody pays for a call that couldn't start.

**Buyer** ([`x402-buyer.ts`](packages/shared/src/x402-buyer.ts), `payAndFetch`): on 402, picks the requirement for
our network, runs `guard` (Foreman's firewall or the payer's checks; throws `PaymentRefused` *before* signing), signs
with `validAfter = now - 600 s` (Kite block time lags local clocks) and retries once. A retry can reuse the same signed
header, and the facilitator returns the same receipt for it.

**Facilitators** ([`facilitator.ts`](packages/shared/src/facilitator.ts)):

| Mode | Class | What it does |
|---|---|---|
| `PAYMENTS_MODE=sim` | `LocalFacilitator` | Really verifies signature, amount, payee, asset, network, validity window and nonce reuse; does not submit. Settlement ids start `sim:`. |
| `PAYMENTS_MODE=live` | `HttpFacilitator` → `FACILITATOR_URL` | Calls `/verify` and `/settle` on a remote facilitator. |
| our facilitator | [`services/facilitator`](services/facilitator/src/app.ts) on :4500 | Same API as Pieverse. Verify = local checks + on-chain `authorizationState` (nonce) + `balanceOf`; settle = `transferWithAuthorization` from one gas wallet, queued one at a time. |
| Pieverse | `https://facilitator.pieverse.io/v2` | Hosted facilitator for pieUSD. `bun run pay-test -- --verify` checks our payload against it live. |

**Env.** `PAYMENTS_MODE`, `FACILITATOR_URL`, `FACILITATOR_PK`, prices `CLEARCALL_PRICE`, `QUICKDIAL_PRICE`,
`BONUS_PRICE`, `ORACLE_PRICE`, `INVOICE_CONFIRMED`, `INVOICE_ATTENDED`, `BUSINESS_MAX_PER_OUTCOME`.

**Tests.** [`x402.test.ts`](packages/shared/src/x402.test.ts) (roundtrip, guard refusal, retry, tamper, precheck),
[`facilitator/app.test.ts`](services/facilitator/src/app.test.ts).

---

## Twilio Voice

**What it does.** The phone workers place real outbound calls; Twilio fetches TwiML from the worker's webhooks, which
speak the AI disclosure and offer, gather speech or keypad input, and post the call status. The oracle reads the
carrier's call record independently.

**Code.** REST client and TwiML helpers: [`packages/shared/src/twilio.ts`](packages/shared/src/twilio.ts). Voice loop:
[`services/phone-worker/src/app.ts`](services/phone-worker/src/app.ts) (`/twilio/voice`, `/twilio/turn`,
`/twilio/status`). Call script: [`script.ts`](services/phone-worker/src/script.ts). Oracle check:
[`services/proof-oracle/src/checks.ts`](services/proof-oracle/src/checks.ts) (`call_exists`, `right_number`,
`connected`, `real_conversation` ≥ 20 s, `fresh`).

- Every webhook is checked against `X-Twilio-Signature`.
- The oracle uses its **own API key** (`TWILIO_API_KEY_SID` / `_SECRET`), not the worker's auth token.
- Voice `Polly.Aditi` (override with `TWILIO_VOICE`), speech recognition `en-IN`.
- `TWILIO_RECORD=1` records both sides of every call (only for consenting numbers); `bun run recordings` downloads them.

**Env.** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`,
`CLEARCALL_PUBLIC_URL`, `QUICKDIAL_PUBLIC_URL` (tunnels to :4110 / :4111), `WORKER_HMAC_SECRET`, `TWILIO_VOICE`,
`TWILIO_RECORD`, `TWILIO_API_BASE` (override).

**Sandbox.** [`services/sandbox/src/carrier.ts`](services/sandbox/src/carrier.ts) emulates `Calls.json` create/get/update
and drives the worker's webhooks with valid signatures, playing customers from `demo/personas.json`.

**Live evidence.** 15 Nov: real calls on a Twilio trial account to verified, consenting numbers. Call audio (both sides)
is in the [release](https://github.com/LSUDOKO/Foreman/releases/tag/demo-recordings-2026-11-15). Smoke test:
`bun run call-test +91…` rings a phone through ClearCall over x402.

---

## Cal.com (API v2)

**What it does.** Free slots for the planner, bookings for confirmed calls, cancellation of Foreman's own unconfirmed
holds, and the booking record the oracle checks.

**Code.** [`packages/shared/src/calcom.ts`](packages/shared/src/calcom.ts), API versions pinned per endpoint:
`cal-api-version: 2024-09-04` for `/v2/slots`, `2024-08-13` for `/v2/bookings` (create, get, list by attendee, cancel).
Bookings carry `metadata.idemKey` for the crash reconciler ([`reconcile.ts`](services/foreman/src/reconcile.ts)).

**Env.** `CALCOM_API_KEY`, `CALCOM_EVENT_TYPE_ID` (a 30-minute "Dental check-up" event type), `CALCOM_READ_KEY`
(the oracle's key; falls back to `CALCOM_API_KEY` when empty), `CALCOM_API_BASE` (override).

**Sandbox.** [`services/sandbox/src/calendar.ts`](services/sandbox/src/calendar.ts), tested against the real client
([`calendar.test.ts`](services/sandbox/src/calendar.test.ts)), including version checks.

**Live evidence.** 15 Nov: bookings for Mon 16 Nov at 9:00 (Asha), 10:30 (Meera) and 12:00 (Rahul).

---

## Gmail SMTP

**What it does.** Sends the confirmation email with **Confirm** and **Decline** links to single-use, expiring tokens
(`CONFIRM_TTL_MIN`, default 120). The click is part of the oracle's proof.

**Code.** [`services/foreman/src/mailer.ts`](services/foreman/src/mailer.ts) (nodemailer), confirm pages
[`confirm.ts`](services/foreman/src/confirm.ts). Tokens are stored hashed.

**Env.** `SMTP_HOST` (`smtp.gmail.com`), `SMTP_PORT` (465), `SMTP_USER`, `SMTP_PASS` (a Gmail app password),
`FOREMAN_PUBLIC_URL` (tunnel to :4000 for the links), `BUSINESS_NAME`.

**Sandbox.** [`services/sandbox/src/inbox.ts`](services/sandbox/src/inbox.ts): scripted customers open the mail and
click their links.

---

## Cloudflare Pages and Workers

| Piece | Project | Code | Notes |
|---|---|---|---|
| Landing page + dashboard (replay) | Pages `foreman-agent` → https://foreman-agent.pages.dev | [`apps/console`](apps/console) `build:replay` | static; plays `recorded-run.json`; no keys |
| MCP server | Worker `foreman-mcp` → https://foreman-mcp.adoranto737.workers.dev | [`services/mcp/src/worker.ts`](services/mcp/src/worker.ts), [`wrangler.jsonc`](services/mcp/wrangler.jsonc) | var `FOREMAN_URL`; secrets `CONSOLE_TOKEN`, `MCP_TOKEN` |
| Tunnels | `cloudflared tunnel --url …` | none | public HTTPS for Twilio webhooks (:4110, :4111) and confirmation links (:4000) |

Deploy steps: [DEPLOYMENT.md](DEPLOYMENT.md).

---

## MCP

**What it does.** Lets Claude (or any MCP client) operate Foreman through the console API.

**Code.** [`services/mcp/src/server.ts`](services/mcp/src/server.ts) (tools), [`stdio.ts`](services/mcp/src/stdio.ts)
(local), [`worker.ts`](services/mcp/src/worker.ts) (Cloudflare Worker, Streamable HTTP at `/mcp`, stateless).

**Tools.** `foreman_status`, `foreman_compile_goal`, `foreman_start`, `foreman_job`, `foreman_ledger`,
`foreman_workers`, `foreman_refusals`, `foreman_decisions`, `foreman_audit_verify`, `foreman_kill`. Read tools carry
`readOnlyHint: true`. There is no approve and no unkill tool, and `foreman_start` refuses any contract that isn't
`approved`. Details per tool: [API.md](API.md#mcp-tools).

**Env.** stdio: `FOREMAN_URL`, `CONSOLE_TOKEN`. Worker: `FOREMAN_URL` (var), `CONSOLE_TOKEN` and `MCP_TOKEN` (secrets).
The Worker fails closed with no `MCP_TOKEN` and compares the bearer token in constant time.

**Tests.** [`server.test.ts`](services/mcp/src/server.test.ts).
