# Changelog

All notable changes to Foreman. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/). Built from `git log` (151 commits, 14–15 Nov 2026).

## [Unreleased]

### Docs
- Submission docs: redesigned README, JUDGES, ARCHITECTURE, INTEGRATIONS, API, DEPLOYMENT, BUSINESS, ROADMAP, CONTRIBUTING and this changelog; screenshots from the 15 Nov live run.

## [0.1.0] - 2026-11-15

First version, built during SERV Hackathon Edition 02 (Kite track).

### Added

**Shared foundations** (`packages/shared`)
- Kite network constants verified against the live testnet (chain 2368), with mainnet (2366) configured.
- Cent-exact USD money helpers, canonical JSON and sha256 hashing, hash-chained audit-log helpers.
- EIP-191 JSON signatures, HMAC and Twilio webhook signatures.
- x402 v2 wire types and EIP-3009 typed data; a buyer with a pre-signing guard and idempotent retry; a Hono paywall that settles only after the handler succeeds; Pieverse HTTP and signature-checking local facilitators.
- `OutcomeContract` zod schema, hash and plain-English summary.
- SERV Reasoning client with prompt guard, shadow agent and labelled fallback; `content_filter` treated as a guard block.
- Twilio Voice REST client and TwiML helpers; Cal.com v2 client with pinned API versions and list-by-attendee.
- Live-or-sandbox adapter selection from available credentials; ports, service URLs and adapter mode detection.

**Foreman** (`services/foreman`)
- Deterministic firewall with typed refusals and contract clauses; cleanup of its own unconfirmed holds after a job stops.
- SERV contract compiler with shadow-agent validation and regex fallback; contract assembly where addresses come only from the registry.
- SQLite schema; hash-chained event log with live subscribers and refusal records; pending/done idempotency keys for calls, bookings, emails and payments.
- SERV call planner with server-side slot validation; worker selection with reputation floor and probation rule; SERV transcript auditor feeding reputation only.
- Job runner: plan, hire, verify, bonus, audit, book, confirm, re-hire on proof failure.
- Outbound x402 payments with the firewall inside the pre-signing guard.
- Single-use confirmation tokens, mobile confirm page and email; Gmail SMTP mailer with sandbox inbox fallback.
- Console API, SSE feed, HMAC worker callbacks, claims and x402 invoices; contract expiry sweeper.
- Crash reconciler that resolves pending booking keys against the calendar on boot.
- Phone and email masking in the exported event log.

**Phone worker** (`services/phone-worker`)
- Paid call and bonus routes with a Twilio voice loop and keypad fallback; fixed call script with AI disclosure.
- SERV turn parser with prompt guard, output normalisation and a safe fallback; 9 s turn budget under Twilio's webhook limit.
- ClearCall (honest) and QuickDial (faulty, scripted to lie) instances; opt-in call recording.

**Proof oracle** (`services/proof-oracle`)
- Deterministic call and outcome checks with typed fail codes; x402-paid verify endpoints with EIP-191-signed verdicts.

**Business payer** (`services/business-payer`)
- The clinic's payment agent: verifies through the oracle before paying invoices; polling loop and attendance attestation signing.

**Kite settlement**
- fUSD test stablecoin with EIP-3009 `transferWithAuthorization`, compiled with solc-js, and a deploy script that mints test funds and funds the facilitator's gas wallet.
- Self-hosted x402 facilitator that settles on Kite testnet; `dev:all`, `e2e` and `pay-test` start it when configured.
- Audit-chain anchoring on Kite testnet.

**Sandbox** (`services/sandbox`)
- Twilio Calls API emulator that plays the customer side via signed webhooks; Cal.com v2 slots and bookings emulator with version checks; inbox where scripted customers click confirmation links.

**Console** (`apps/console`)
- Vite + React + Tailwind v4; every view is a pure function of the event log, from live SSE or a recorded replay.
- Overview, Job, Ledger (with CSV export), Workers, Safety, Decisions, Contract and Business view pages; kill switch and replay scrubber.
- Landing page at `/` with a scroll-driven story; dashboard at `/app`; Cloudflare Pages build.
- Collage brand system (yellow/pink/black, Anton + Barlow + marker type, drawn stickers), GSAP hero and page transitions.

**MCP** (`services/mcp`)
- MCP server with ten tools over stdio and a Cloudflare Worker; no approve or unkill tool.

**Scripts and CI**
- `setup`, `dev:all`, `e2e`, `reset`, `pay-test` (with `--verify` against Pieverse), `serv-test`, `call-test`, `deploy-token`, `anchor`, `record`, `recordings`.
- CI: typecheck, unit tests, sandbox e2e and console build on every push.

**Demo**
- Five-customer no-show CSV and scripted sandbox personas; recorded run with all nine SERV decisions live and all 16 payments settled on Kite testnet (14 Nov).

### Fixed
- x402 resource must carry `description` and `mimeType` (Pieverse rejects without them); facilitator validation issues are surfaced instead of a bare HTTP status.
- EIP-3009 authorizations are valid from now − 600 s, because Kite block time lags the local clock.
- One deadline per SERV call including the retry; low reasoning effort plus shadow agent for the compiler (medium measured > 100 s).
- Planner and turn-parser output drift from the live model is normalised; requested actions are backfilled when SERV flags out-of-scope without listing them; SERV fallback reasons reach the Decisions log.
- The business payer remembers FAIL verdicts so a bad claim isn't re-verified and re-paid every tick.
- Goal constraints such as consent are contract fields, not rejected requests; payee objects normalised; exactly the five actions a provable rebooking needs are granted.
- Setup always generates a console token and fills blank keys in place; the console token is passed to the console and API scripts.
- The oracle falls back to `CALCOM_API_KEY` when `CALCOM_READ_KEY` is empty, not only when unset.
- Callers get 10 seconds to answer the slot offer.
- Console: stacked story on phones, smaller hero art, readable hero text; approval stamp shown in the contract JSON.

### Tests
- Firewall covers every refusal code in the acceptance list; compiler rejects refunds and discards model addresses.
- Oracle fail codes and paid verification end to end; worker signed webhooks, attack handling, no-answer and the faulty worker's lie.
- x402 roundtrip, guard refusal, retry, tamper and precheck; audit-chain tamper detection; idempotency semantics.
- Confirm double-click, invoice state precheck and single settlement, HMAC callbacks, kill switch, decline; console API bearer auth.
- A crash between booking and done never yields a second booking; calendar emulator tested against the real Cal.com client.
- Five-customer e2e with ledger, refusal and audit assertions.

[Unreleased]: https://github.com/LSUDOKO/Foreman/compare/4edcb2f...HEAD
[0.1.0]: https://github.com/LSUDOKO/Foreman/commits/4edcb2f
