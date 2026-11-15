# API reference

Every HTTP endpoint in the repo, read from the Hono routes, plus the MCP tools. All services speak JSON unless noted.
Base URLs are the local defaults from [`packages/shared/src/env.ts`](packages/shared/src/env.ts).

**Auth legend**

| Tag | Meaning |
|---|---|
| `console` | `Authorization: Bearer <CONSOLE_TOKEN>` (or `?token=` for SSE, since `EventSource` can't set headers). Enforced only when `CONSOLE_TOKEN` is set. |
| `x402` | Paid route. Without a payment: `402` with a `PAYMENT-REQUIRED` header. Retry with `PAYMENT-SIGNATURE` (or `X-PAYMENT`); success carries `PAYMENT-RESPONSE`. |
| `hmac` | Body signed with `WORKER_HMAC_SECRET` in `x-worker-signature`, worker name in `x-worker`. |
| `twilio` | `X-Twilio-Signature` over the public URL and form params, checked with the Twilio auth token. |
| `token` | Possession of a single-use confirmation token in the URL. |
| `none` | No auth. Noted where that's a deliberate trust edge. |

**x402 paywall order** ([`x402-seller.ts`](packages/shared/src/x402-seller.ts)): `precheck` (may refuse with 4xx
before any 402) → `402` if no payment header → facilitator `/verify` (invalid → `402` with `reason`) → handler → if the
handler returned `< 400`, facilitator `/settle` (failure → `402 settlement_failed`) → `PAYMENT-RESPONSE` header with the
base64 `SettleResponse` (`{ success, payer, transaction, network }`). A handler error means the authorization is never
submitted.

---

## foreman (:4000)

Source: [`services/foreman/src/app.ts`](services/foreman/src/app.ts). CORS is open on `/api/*` and on `/v1/*` (which
also exposes `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE`).

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/healthz` | none | `{ ok, name: "foreman", modes: { serv, payments, carrier, calendar, email } }` |

### Console API

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/modes` | console | none | `{ modes, network, chainId, explorer, token: { symbol, address }, identities }` |
| POST | `/api/contracts/compile` | console | `{ goal: string (≥10 chars), csv: string }` (header `id,name,phone,email,missed_at,consent_source`) | `{ contract, hash, status: "draft", rejectedRequests, summary, customers }`. `400 goal_required` / `400 invalid_csv` |
| GET | `/api/contracts/latest` | console | none | `302` to `/api/contracts/:id`, or `404 no_contracts` |
| GET | `/api/contracts/:id` | console | none | `{ contract, hash, status, rejected, …, summary }`. `404 not_found` |
| POST | `/api/contracts/:id/approve` | console | `{ by?: string }` | `{ status: "approved", hash }`. `409 not_draft` |
| POST | `/api/contracts/:id/start` | console | none | `{ status: "running" }`; the runner starts in the background. `409 not_approved` |
| GET | `/api/jobs/:id` | console | none | customers (phone/email masked) with `state`, `refusal`, `offers`, `steps` and `attempts[]` (`worker`, `status`, `verdict`, `code`, `quality`) |
| GET | `/api/ledger/:id` | console | none | `{ in: Payment[], out: Payment[], totals: { earned, spent, margin } }`; each payment has `link` (Kitescan or `null` for `sim:`) |
| GET | `/api/workers` | console | none | workers with `price`, `bonus`, `reputation`, `probationLeft`, `badge`, `history[]` |
| GET | `/api/refusals/:id` | console | none | `[{ code, actor, action, clause, evidence, createdAt }]` |
| GET | `/api/decisions/:id` | console | none | `serv_decision` events for the contract |
| GET | `/api/audit/verify/:id` | console | none | `{ ok: true, events, head }` or `{ ok: false, brokenAt, reason }` (verifies the whole global chain) |
| GET | `/api/export/:id` | console | none | `{ exportedAt, contractId, hash, network, modes, audit, events }`: the replay file format of [`demo/recorded-run.json`](demo/recorded-run.json) |
| GET | `/api/feed?since=<id>&contractId=<id>` | console (`?token=`) | none | Server-sent events: `event: event` with a `FeedEvent` JSON (`id, ts, contractId, type, actor, data, prevHash, hash`); `event: ping` every 15 s |
| POST | `/api/kill` | console | none | `{ killSwitch: true, endedCalls }`; ends in-flight calls |
| POST | `/api/unkill` | console | `{ confirm: "<BUSINESS NAME>" }` | `{ killSwitch: false }`. `400 type_business_name` |
| GET | `/api/kill` | console | none | `{ killSwitch: boolean }` |
| POST | `/api/outcomes/:id/attended` | console | none | Asks the business-payer to sign an attendance attestation, verifies it against `BUSINESS_ADDRESS`, moves the outcome to `attended_attested`. `{ state }`. `409 invalid_state` (confirmed invoice must be paid first), `502 payer_unavailable`, `400 attestation_invalid` |
| POST | `/api/worker-result` | **hmac** (exempt from console auth) | `CallResult` (`attemptId, callSid, outcome, durationSec, slotIndex?, requested, injection, transcript, decisions`) | `{ ok: true }`. `401 bad_signature`, `409 unknown_or_duplicate` |

### Customer pages (HTML)

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/c/:token` | token | confirmation page: `open`, `confirmed`, `declined`, `expired` or `invalid` (404) |
| POST | `/c/:token/confirm` | token | marks the outcome confirmed if the link is still open; `410` once expired |
| POST | `/c/:token/decline` | token | declines and releases Foreman's hold |

### Proof sources for the oracle

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/internal/confirmations/:outcomeId` | none, payload signed | `{ record: { outcomeId, redeemed, redeemedAt, expiresAt }, signature }` (EIP-191 by Foreman's key) |
| GET | `/internal/attestations/:outcomeId` | none, payload signed | `{ payload: { outcomeId, attended: true }, signature }` (signed by the business key) |

These carry no auth middleware: the records are only useful with a valid signature, which the oracle checks against the
configured addresses. Keep `:4000` behind a tunnel you control; see [SECURITY.md](SECURITY.md).

### What the business-payer buys

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/v1/claims?contractId=<id>` | none | none | `[{ outcomeId, contractId, milestone: "confirmed" \| "attended", customer, bookingUid, contractHash, price, expected: { attendeeEmail, start } }]` (latest contract if omitted) |
| POST | `/v1/invoice/:outcomeId/:milestone` | **x402** ($4.00 `confirmed`, $2.00 `attended`, payTo Foreman) | none | `{ ok, outcomeId, milestone }`. Precheck before any 402: `404 unknown_milestone`, `404 not_found`, `409 invalid_state`; `409 invoice_in_progress` for a concurrent request |

---

## phone-worker (ClearCall :4110, QuickDial :4111)

Source: [`services/phone-worker/src/app.ts`](services/phone-worker/src/app.ts). QuickDial runs the same code with
`WORKER_MODE=faulty`: it accepts the fee, places no call and later reports a fabricated success.

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/healthz` | none | none | `{ ok, name, mode: "honest" \| "faulty", payments: "remote" \| "sim" }` |
| POST | `/v1/call` | **x402** ($0.50 ClearCall, $0.30 QuickDial) | `CallRequest`: `{ attemptId, to, business, customerName, missed, offers[], timeZone, maxSeconds, callbackUrl }` | `{ attemptId, callSid, status: "dialing" }`. Precheck: `400 invalid_call_request`, `409 duplicate_attempt`. `502 carrier_error` (not settled, so not charged) |
| POST | `/v1/bonus/:attemptId` | **x402** ($0.20) | none | `{ ok, attemptId }`. Paying this route *is* the bonus. `404 unknown_attempt`, `409 bonus_already_paid` |
| GET | `/calls/:attemptId` | none | none | the `CallResult`, or `{ attemptId, callSid, status: "in_progress" }`; `404 unknown_attempt` |
| POST | `/twilio/voice/:attemptId` | twilio | form | TwiML: AI disclosure + offer inside `<Gather>` |
| POST | `/twilio/turn/:attemptId` | twilio | form (`SpeechResult` or `Digits`) | TwiML for the next line; keypad: 1 = first slot, 2 = second, 9 = decline |
| POST | `/twilio/status/:attemptId` | twilio | form (`CallStatus`, `CallDuration`) | `ok`; posts the HMAC-signed `CallResult` to `callbackUrl` (3 tries) |

---

## proof-oracle (:4210)

Source: [`services/proof-oracle/src/app.ts`](services/proof-oracle/src/app.ts), checks in
[`checks.ts`](services/proof-oracle/src/checks.ts). Every verdict:
`{ kind, subject, verdict: "PASS" | "FAIL", code?, checks: [{ name, pass, evidence }], checkedAt, oracle, signature }`,
EIP-191-signed by `ORACLE_SIGNER_PK`.

| Method | Path | Auth | Body | Checks (first failure = `code`) |
|---|---|---|---|---|
| GET | `/healthz` | none | none | `{ ok, name, mode }` |
| GET | `/v1/pubkey` | none | none | `{ signer, payTo }` (informational; clients use the configured signer) |
| POST | `/v1/verify/call` | **x402** ($0.02) | `{ attemptId, callSid, to, claimedStatus, minSeconds, attemptCreatedAt }` | `call_exists` (`call_not_found`), `right_number` (`wrong_number`), `connected` (`call_not_completed`), `real_conversation` ≥ `minSeconds` (`call_too_short`), `fresh` (`stale_call`). Re-reads the carrier every time with the oracle's own key. |
| POST | `/v1/verify/outcome` | **x402** ($0.02) | `{ outcomeId, milestone: "confirmed" \| "attended", bookingUid, expected: { attendeeEmail, start }, contractHash }` | confirmed: `booking_exists`, `booking_status_accepted`, `attendee_matches`, `slot_matches`, `customer_confirmation_click` (Foreman-signed record, redeemed before expiry). attended: `business_attestation` (signed by `BUSINESS_ADDRESS`). |

---

## business-payer (:4300)

Source: [`services/business-payer/src/app.ts`](services/business-payer/src/app.ts). Runs `tick()` every
`PAYER_INTERVAL_MS` (10 s): for each claim, pay the oracle (payee must be `ORACLE_PAYTO`), verify the signature against
`ORACLE_SIGNER_ADDRESS`, enforce `BUSINESS_MAX_PER_OUTCOME`, then pay the invoice (payee must be Foreman, amount ≤ claim price).

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/healthz` | none | `{ ok, name, address }` |
| GET | `/status` | none | `{ address, maxPerOutcome, spentInvoices, spentOracle, total, journal[] }` |
| POST | `/attest/:outcomeId` | none (local only) | `{ payload: { outcomeId, attended: true }, signature, signer }`, signed with the business key |
| POST | `/tick` | none | `{ ok: true }` after one settlement pass |

`/attest` signs whatever outcome id it's given: it is the clinic's "Mark attended" button and must only be reachable from
Foreman on the same host. Don't expose `:4300` publicly.

---

## facilitator (:4500)

Source: [`services/facilitator/src/app.ts`](services/facilitator/src/app.ts). Same API as the Pieverse facilitator.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/healthz` | none | `{ ok, name, network, asset, gas }` |
| GET | `/supported` | none | `{ kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:2368" }], extensions: [], signers }` |
| POST | `/verify` | `{ paymentPayload, paymentRequirements }` | `{ isValid, invalidReason?, payer? }`. Reasons include `unsupported_asset`, `invalid_payee`, `insufficient_amount`, `authorization_expired`, `invalid_signature`, `nonce_already_used`, `insufficient_funds`; `400 invalid_request` |
| POST | `/settle` | same | `{ success, errorReason?, payer?, transaction, network }`. Queued one at a time; a retried authorization gets the same receipt; `transaction_reverted` / `submit_failed: …` on failure |

---

## sandbox (:4400)

Source: [`services/sandbox/src`](services/sandbox/src). Mounts three emulators.

| Method | Path | Emulates | Notes |
|---|---|---|---|
| GET | `/healthz` | none | `{ ok, name, emulates: ["twilio-voice", "calcom-v2", "inbox"] }` |
| GET | `/state` | none | `{ calls, bookings, mails }` |
| POST | `/twilio/2010-04-01/Accounts/:acct/Calls.json` | Twilio create call | requires Basic auth; plays the persona and drives the worker's webhooks with valid signatures |
| GET | `/twilio/2010-04-01/Accounts/:acct/Calls/:sid.json` | Twilio call record | `404` with Twilio's `20404` for unknown SIDs (what catches QuickDial) |
| POST | `/twilio/2010-04-01/Accounts/:acct/Calls/:sid.json` | Twilio update call | `Status=completed` ends the call |
| GET | `/cal/v2/slots?start&end` | Cal.com slots | requires `cal-api-version: 2024-09-04` |
| POST | `/cal/v2/bookings` | Cal.com create | requires `cal-api-version: 2024-08-13`; `409` if the slot is taken |
| GET | `/cal/v2/bookings?attendeeEmail=` | Cal.com list | used by the crash reconciler |
| GET | `/cal/v2/bookings/:uid` | Cal.com get | |
| POST | `/cal/v2/bookings/:uid/cancel` | Cal.com cancel | |
| POST | `/mail` | inbox | stores the mail; personas whose script says so click `confirm` or `decline` |
| GET | `/mail` | inbox | all mails |

---

## MCP Worker

Source: [`services/mcp/src/worker.ts`](services/mcp/src/worker.ts). Live at https://foreman-mcp.adoranto737.workers.dev.

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/` | none | `{ name: "foreman-mcp", description, endpoint: "/mcp", transport: "streamable-http", auth }` |
| any | `/mcp` | `Authorization: Bearer <MCP_TOKEN>` (constant-time compare; fails closed if unset) | MCP Streamable HTTP, stateless, JSON responses |
| any | other | none | `404 not_found` |

## MCP tools

Source: [`services/mcp/src/server.ts`](services/mcp/src/server.ts). Each tool returns a text summary plus
`structuredContent`; errors come back with `isError: true`. `contractId` defaults to the latest contract.

| Tool | Read-only | Input | Calls |
|---|---|---|---|
| `foreman_status` | yes | none | `/healthz`, `/api/modes`, `/api/kill`, `/api/contracts/latest` |
| `foreman_compile_goal` | no | `goal` (≥10 chars), `csv` | `POST /api/contracts/compile` (creates a **draft**; nothing is spent or called) |
| `foreman_start` | no | `contractId` | refuses unless the contract is `approved`, then `POST /api/contracts/:id/start` |
| `foreman_job` | yes | `contractId?` | `/api/jobs/:id` |
| `foreman_ledger` | yes | `contractId?` | `/api/ledger/:id` |
| `foreman_workers` | yes | none | `/api/workers` |
| `foreman_refusals` | yes | `contractId?` | `/api/refusals/:id` |
| `foreman_decisions` | yes | `contractId?` | `/api/decisions/:id` |
| `foreman_audit_verify` | yes | `contractId?` | `/api/audit/verify/:id` |
| `foreman_kill` | no | none | `POST /api/kill` |

There is no tool for `/approve` or `/unkill`: authorising spend and releasing the kill switch are human-only.

---

## Console data sources

The console ([`apps/console/src`](apps/console/src)) reads `/api/feed` (SSE) and `/api/modes`, and posts to the
compile, approve, start, kill, unkill and attended endpoints from the Business view and header. With `?replay` (or a
`VITE_REPLAY_ONLY=1` build) it loads `recorded-run.json` instead and never calls the API.
