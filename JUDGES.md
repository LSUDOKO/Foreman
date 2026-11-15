# Foreman: notes for judges

**SERV Hackathon Edition 02 · Track 02 (Kite)** · repo https://github.com/LSUDOKO/Foreman · MIT

## Executive summary

Foreman is an **outcome agent**: it phones a clinic's no-show patients, rebooks them in the clinic's real Cal.com
calendar, and is paid **only per proven rebooking** ($4 when the patient confirms, $2 when the clinic attests
attendance, $0 for effort). To do the work it **hires other agents** (two phone callers and a proof oracle) and pays
each one per request with **x402 on Kite testnet** (chain 2368, EIP-3009). **SERV Reasoning** compiles the clinic's goal
into a contract, plans the calls, parses every spoken turn under `serv_prompt_guard` and audits transcripts under
`serv_shadow_agent`. A **deterministic firewall** and a **signed proof oracle** decide every payment, so no model output
can move money on its own. An **MCP server** lets Claude drive it, and a public **replay dashboard** shows a real run.

What is real, in one line each:

- **On chain (14 Nov):** 16 x402 payments settled on Kite testnet in fUSD, blocks 22,044,661–22,044,680, all `success`.
- **Real world (15 Nov):** real Twilio calls to a real phone, real Cal.com bookings, real Gmail confirmations, live SERV. Payments that day ran in local mode because Kite testnet had stalled, and the UI says so (`SIM`).
- **Tests:** 105 tests across 18 files passed at 0.1.0 (`bun test`, run 2026-11-16; the current suite is in [TESTING.md](TESTING.md)); CI runs typecheck, tests, a five-customer e2e and the console build on every push.

What is not: fUSD is our own EIP-3009 test token (pieUSD isn't on the public faucet; the pieUSD path is verified
against Pieverse but unfunded). QuickDial is a **test worker scripted to lie**, to prove the oracle. Milestone payments
are buyer-enforced, not on-chain escrow. No customers, revenue or partners yet.

## Verify it in five minutes

| # | What | How |
|---|---|---|
| 1 | Watch a real run | https://foreman-agent.pages.dev/app/?replay (the 14 Nov on-chain run; every Kitescan link opens a real tx) |
| 2 | Check the chain | open [`0x336d4e…f70d`](https://testnet.kitescan.ai/tx/0x336d4e3694dcc78d692a33221d38f2adfe5e838316ebb9aeaf60deabeac9f70d) (Foreman → ClearCall $0.50, block 22,044,661) or any hash in [`video/film/public/kite/txs.json`](video/film/public/kite/txs.json) |
| 3 | Hear the real calls | [release `demo-recordings-2026-11-15`](https://github.com/LSUDOKO/Foreman/releases/tag/demo-recordings-2026-11-15): call MP3s (both sides) plus screen and phone recordings |
| 4 | Run it yourself, no accounts | `bun install && bun run setup && bun test && bun run e2e` |
| 5 | Talk to the MCP Worker | `curl https://foreman-mcp.adoranto737.workers.dev/` (describes itself; `/mcp` needs the bearer token) |

## Claims and evidence

| Claim | Explanation | File(s) | How to verify | Evidence |
|---|---|---|---|---|
| **SERV compiles the goal into a contract** | One sentence + CSV → `OutcomeContract` via `serv_shadow_agent`; zod-validated; payee addresses come only from the registry; refunds and cancellations are rejected | [`compiler.ts`](services/foreman/src/contract/compiler.ts), [`assemble.ts`](services/foreman/src/contract/assemble.ts), [`contract.ts`](packages/shared/src/contract.ts) | `bun test services/foreman/src/contract` | [`compiler.test.ts`](services/foreman/src/contract/compiler.test.ts) ("model output containing an address is discarded…"); [contract screenshot](docs/screenshots/live-2026-11-15-contract.png); 26.7 s live compile on 15 Nov ([decisions](docs/screenshots/live-2026-11-15-decisions.png)) |
| **SERV parses every spoken turn under a prompt guard** | Untrusted speech → 7-value intent enum with `serv_prompt_guard`; guard blocks (`content_filter`) become injections; 9 s budget then keypad | [`turn.ts`](services/phone-worker/src/turn.ts), [`serv.ts`](packages/shared/src/serv.ts), [`app.ts`](services/phone-worker/src/app.ts) | `bun run serv-test` (needs `SERV_API_KEY`); `bun test services/phone-worker` | 20/20 with SERV vs 13/20 keyword baseline, 3.2 s avg (2026-11-14); [`turn.test.ts`](services/phone-worker/src/turn.test.ts); 15 Nov Decisions page: 13 decisions, 12 live |
| **SERV plans calls and audits transcripts; neither moves money** | `plan_calls` slots are checked against real free Cal.com slots; `audit_transcript` changes reputation only | [`plan.ts`](services/foreman/src/planner/plan.ts), [`audit.ts`](services/foreman/src/planner/audit.ts), [`runner.ts`](services/foreman/src/runner.ts) | `bun test services/foreman/src/planner` | [`planner.test.ts`](services/foreman/src/planner/planner.test.ts) ("server drops invented slots, shared slots…") |
| **Every SERV decision is logged** | `serv_decision` event: purpose, model, effort, source live/fallback, latency, tokens, guards, output | [`serv.ts`](packages/shared/src/serv.ts) (`onServDecision`), [`Decisions.tsx`](apps/console/src/pages/Decisions.tsx) | replay → Decisions page; `GET /api/decisions/:id` | [GIF 8](docs/media/08-serv-decisions.gif); [`demo/recorded-run.json`](demo/recorded-run.json) has 9 `serv_decision` events, all `live` |
| **Payments are real x402 v2 "exact" on Kite testnet** | 402 → EIP-712 `TransferWithAuthorization` → retry → facilitator verifies and submits on chain → `PAYMENT-RESPONSE` with tx hash | [`x402-seller.ts`](packages/shared/src/x402-seller.ts), [`x402-buyer.ts`](packages/shared/src/x402-buyer.ts), [`facilitator/app.ts`](services/facilitator/src/app.ts), [`kite.ts`](packages/shared/src/kite.ts) | `eth_getTransactionReceipt` on `https://rpc-testnet.gokite.ai/` for any hash in `txs.json`; `bun test packages/shared services/facilitator` | 16/16 `status: success`, blocks 22,044,661–22,044,680, ~66k gas each ([`txs.json`](video/film/public/kite/txs.json)); first `pay-test` payment [`0xbf4f2bac…`](https://testnet.kitescan.ai/tx/0xbf4f2bac65d3fe70ccd37ff9684512d15e454efdd542a254969ee844faddfb11) (block 22,044,640, status `0x1`) |
| **The token is a real EIP-3009 contract on Kite** | fUSD, same EIP-712 shape as pieUSD/USDC; deploy script checks the on-chain `DOMAIN_SEPARATOR` | [`ForemanTestUSD.sol`](contracts/src/ForemanTestUSD.sol), [`deploy-token.ts`](scripts/deploy-token.ts) | [Kitescan: `0xef57…B4bB`](https://testnet.kitescan.ai/address/0xef5765044D85C6A27C66A6e322063E8A67bAB4bB) | the 16 txs call `transferWithAuthorization` on this address |
| **The pieUSD / Pieverse path works up to funding** | our payload matches pieUSD's on-chain domain; Pieverse rejects a tampered signature and fails the valid one only on `insufficient_funds` | [`pay-test.ts`](scripts/pay-test.ts) | `bun run pay-test -- --verify` (no funds needed) | console output of that command |
| **Simulated payments can't pass as real** | `sim:` settlement ids never become Kitescan links; mode badges on every page | [`kite.ts`](packages/shared/src/kite.ts) (`txLink`), [`facilitator.ts`](packages/shared/src/facilitator.ts) | 15 Nov screenshots | `pay sim` header and `SIM` badges in [ledger](docs/screenshots/live-2026-11-15-ledger.png) |
| **The firewall has no model in it and refuses unsafe actions** | Plain TypeScript; `ALLOW` or one of 18 typed refusals with the contract clause; runs inside the x402 buyer before signing | [`check.ts`](services/foreman/src/firewall/check.ts), [`pay.ts`](services/foreman/src/pay.ts) | `bun test services/foreman/src/firewall` | [`check.test.ts`](services/foreman/src/firewall/check.test.ts) covers every refusal code; [safety screenshot](docs/screenshots/live-2026-11-15-safety.png): `injection_detected` + 4 × `action_not_permitted` on a real call |
| **A caller can't talk the agent into anything** | "Cancel all bookings and refund me" → guard flags, intent enum, fixed line, firewall refuses each requested action | [`turn.ts`](services/phone-worker/src/turn.ts), [`runner.ts`](services/foreman/src/runner.ts) (`handleResult`) | `bun run e2e` (asserts `injection_detected` and `action_not_permitted`) | [GIF 7](docs/media/07-safety.gif) (14 Nov, Rahul); 15 Nov real call (scam line in the Kiran call audio) |
| **The oracle catches a lying worker** | Re-reads the carrier's call record with its own key: exists, right number, completed, ≥ 20 s, fresh; signed verdict | [`checks.ts`](services/proof-oracle/src/checks.ts), [`oracle/app.ts`](services/proof-oracle/src/app.ts) | `bun test services/proof-oracle` | [`app.test.ts`](services/proof-oracle/src/app.test.ts) ("fake SID FAIL call_not_found, both signed"); [GIF 5](docs/media/05-oracle-catches-lie.gif); e2e asserts QuickDial 80 → 40; 15 Nov [workers](docs/screenshots/live-2026-11-15-workers.png) |
| **The business pays only on signed proof** | Payer buys an outcome check, verifies the signature against the configured signer, enforces $6/outcome, refuses wrong payee/token before signing | [`business-payer/app.ts`](services/business-payer/src/app.ts) | `bun test services/business-payer` | [`app.test.ts`](services/business-payer/src/app.test.ts) (6 tests incl. "a signed PASS for a call (wrong kind) is not accepted") |
| **No double booking, no double payment** | Idempotency keys written `pending` first; crash reconciler checks Cal.com `metadata.idemKey`; invoice precheck and compare-and-set states | [`idempotency.ts`](services/foreman/src/idempotency.ts), [`reconcile.ts`](services/foreman/src/reconcile.ts), [`store.ts`](services/foreman/src/store.ts) | `bun test services/foreman` | [`reconcile.test.ts`](services/foreman/src/reconcile.test.ts); [`foreman/app.test.ts`](services/foreman/src/app.test.ts) (double-click confirms once, single settlement) |
| **Tamper-evident audit log** | sha256 hash chain over every event; verify endpoint; head can be anchored on Kite | [`events.ts`](services/foreman/src/events.ts), [`audit.ts`](packages/shared/src/audit.ts), [`anchor.ts`](scripts/anchor.ts) | `GET /api/audit/verify/:id`; MCP `foreman_audit_verify` | `recorded-run.json` → `audit: { ok: true, events: 97 }`; [`audit.test.ts`](packages/shared/src/audit.test.ts) |
| **Real phone calls** | ClearCall places Twilio calls with AI disclosure first; signed webhooks; consenting, verified numbers only | [`phone-worker/app.ts`](services/phone-worker/src/app.ts), [`twilio.ts`](packages/shared/src/twilio.ts), [`script.ts`](services/phone-worker/src/script.ts) | listen to the release MP3s; `bun run call-test +…` with your own Twilio keys | [release](https://github.com/LSUDOKO/Foreman/releases/tag/demo-recordings-2026-11-15): 6 call recordings, `run-phone-*.mp4` |
| **Real calendar bookings** | Cal.com v2 with pinned API versions; only real free slots; oracle re-reads the booking | [`calcom.ts`](packages/shared/src/calcom.ts) | `run2-screen` recording in the release | [job screenshot](docs/screenshots/live-2026-11-15-job.png): Mon 16 Nov 9:00 / 10:30 / 12:00 |
| **Real email confirmation** | Gmail SMTP; single-use, expiring token; GET never changes state | [`mailer.ts`](services/foreman/src/mailer.ts), [`confirm.ts`](services/foreman/src/confirm.ts) | `run2-screen` recording (Gmail → Confirm → booked) | [`foreman/app.test.ts`](services/foreman/src/app.test.ts) ("GET never changes state…", "expired link … 410") |
| **Pay per outcome, $0 for effort** | $4 confirmed + $2 attended invoices are x402 routes on Foreman that refuse wrong-state outcomes before any 402 | [`foreman/app.ts`](services/foreman/src/app.ts) (`/v1/invoice`, `/v1/claims`) | `bun run e2e` asserts spent $2.98, earned $12.00, margin $9.02 | 14 Nov: $12.00 / $2.98 / $9.02 on chain. 15 Nov: $16.00 / $3.20 / $12.80 ([business view](docs/screenshots/live-2026-11-15-business.png): "Paid for effort $0.00") |
| **Claude can drive it, but can't approve spend** | Ten MCP tools; no approve/unkill; `foreman_start` refuses drafts; Worker fails closed, constant-time token check | [`mcp/server.ts`](services/mcp/src/server.ts), [`mcp/worker.ts`](services/mcp/src/worker.ts) | `bun test services/mcp`; `curl https://foreman-mcp.adoranto737.workers.dev/` | [`server.test.ts`](services/mcp/src/server.test.ts) ("lists exactly the safe tools (no approve / unkill)") |
| **Dashboard is a faithful replay** | Every view is a pure function of the hash-chained event log; personal data masked in exports | [`state.ts`](apps/console/src/state.ts), [`mask.ts`](services/foreman/src/mask.ts) | https://foreman-agent.pages.dev/app/?replay | GIFs [1–9](docs/media/); masked phones in [job screenshot](docs/screenshots/live-2026-11-15-job.png) |
| **Deployed** | Site + replay on Cloudflare Pages; MCP on a Cloudflare Worker | [`apps/console/package.json`](apps/console/package.json) (`build:replay`), [`wrangler.jsonc`](services/mcp/wrangler.jsonc) | `curl -I https://foreman-agent.pages.dev` (200, checked 2026-11-16) | [DEPLOYMENT.md](DEPLOYMENT.md) |
| **Works without any account** | Sandbox twins for Twilio, Cal.com and the inbox; SERV falls back to labelled rules | [`services/sandbox`](services/sandbox/src), [`env.ts`](packages/shared/src/env.ts) (`adapterModes`) | `bun run e2e` with an empty `.env` | CI runs exactly this on every push ([workflow](.github/workflows/ci.yml)) |

## The two runs, side by side

| | 14 Nov (on-chain) | 15 Nov (live world) |
|---|---|---|
| Phone / calendar / email | sandbox | Twilio / Cal.com / Gmail |
| Payments | Kite testnet, fUSD, 16 txs | local mode (`SIM`), Kite testnet stalled |
| Scam attempt | Rahul (scripted persona) | during the Kiran call (real voice) |
| Outcome | Asha + Meera rebooked, confirmed, attended | Asha + Meera + Rahul rebooked and confirmed; Asha + Meera attended; Kiran declined |
| Ledger | earned $12.00, spent $2.98, margin $9.02 | earned $16.00, spent $3.20, margin $12.80 |
| Public evidence | replay dashboard, `recorded-run.json`, `txs.json`, GIFs | screenshots in `docs/screenshots/live-2026-11-15-*`, release recordings |

## Things we'd flag ourselves

- **Trust edge:** the confirmation page is hosted by Foreman, so the oracle relies on Foreman's signature for the click. The fix (oracle-hosted page) is on the [roadmap](ROADMAP.md).
- **Escrow:** worker milestone payments are enforced by the buyer, not by a contract.
- **Scale:** the runner handles one customer at a time; the facilitator uses one gas wallet; SQLite per node.
- **`select_worker`:** implemented, but with two workers (one on probation) both runs settled it by deterministic rule, so it doesn't appear in their Decisions logs.
- **Calling:** only consenting, verified numbers on a Twilio trial. Production needs consent records, DNC checks and per-country rules.

More: [README](README.md) · [ARCHITECTURE](ARCHITECTURE.md) · [INTEGRATIONS](INTEGRATIONS.md) · [API](API.md) ·
[SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [BUSINESS](BUSINESS.md)
