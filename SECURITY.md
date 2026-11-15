# Security

> **This is an internal review plus automated checks, not a third-party audit.** It was done by the project team (with
> an AI coding agent) on 2026-11-16 against commit `4edcb2f` plus the fixes listed below. Nobody independent has
> reviewed this code. Foreman runs on Kite **testnet** with a test token (fUSD). Don't put real money behind it.

## Reporting a vulnerability

Please don't open a public issue for anything touching payments, signatures, webhook auth or the firewall. Use GitHub's
private vulnerability reporting ("Report a vulnerability" under the repository's Security tab). Include the commit, the
service, and the request or transaction that shows the problem. If private reporting isn't enabled on the repository,
open an issue that only asks for a private contact, without details. Never send `.env` contents or private keys.

## What Foreman protects

| Asset | Where it lives | Why it matters |
|---|---|---|
| Wallet keys: `FOREMAN_PK`, `BUSINESS_PK`, `ORACLE_SIGNER_PK`, `FACILITATOR_PK` | `.env` (git-ignored) | They sign EIP-3009 payments, oracle verdicts, attestations and gas transactions on Kite (chain 2368) |
| fUSD balances | `ForemanTestUSD` on Kite testnet | Every x402 payment moves them |
| Outcome proof | oracle verdicts (EIP-191), Foreman-signed confirmation records, business-signed attestations | Decides whether the clinic pays an invoice |
| Contract limits | the approved outcome contract and the firewall | Budget, per-call cap, payee allowlist, consent, quiet hours, opt-outs |
| Customer data | SQLite (`.data/`, git-ignored), call transcripts, emails | Names, phone numbers, emails, what people said on the phone |
| Service credentials: Twilio, Cal.com, SERV, SMTP, `CONSOLE_TOKEN`, `MCP_TOKEN`, `WORKER_HMAC_SECRET` | `.env`, Cloudflare secrets | Placing calls, reading and writing bookings, sending email, driving the console |

## Trust model

| Party | Trusted for | Not trusted for |
|---|---|---|
| Business (clinic) operator | Approving contracts, the kill switch, "mark attended" | — |
| Foreman (outcome agent) | Running the contract inside the firewall | Its own success claims. The business pays only after a signed oracle PASS. |
| Phone workers (ClearCall, QuickDial) | Placing calls | Their reported outcomes. The oracle re-reads the carrier with its own Twilio key. QuickDial is scripted to lie. |
| Proof oracle | Signing verdicts with the configured key `ORACLE_SIGNER_ADDRESS` (configured, never fetched) | — |
| Callers on the phone | Nothing | Everything they say is untrusted input |
| SERV Reasoning (LLM) | Classifying a turn into a fixed intent enum, drafting plans and audits | Authorising anything. Model output passes through zod, `sanitize()` and the firewall. |
| x402 sellers (the 402 they return) | Nothing | Payee, asset and amount are checked before anything is signed |
| Facilitator (self-hosted or Pieverse) | Submitting the signed EIP-3009 transfer | Changing it. The token checks the signature on chain. |

**Known trust edges (by design, documented):**

- The confirmation page is hosted by Foreman, so the oracle relies on a Foreman-signed confirmation record.
- Foreman creates the Cal.com booking. The oracle reads it back with `CALCOM_READ_KEY`, but when that is unset it falls back to `CALCOM_API_KEY`, the same key Foreman writes with.
- The business-payer signs the "attended" attestation when Foreman asks it to (see S-10).

A Foreman operator who controls all three could fabricate a confirmed or attended outcome. Moving the confirmation page and attestation UI to the business or the oracle is roadmap work, not done here.

## Attack surfaces reviewed

| Surface | Code | Controls |
|---|---|---|
| fUSD token, EIP-3009 | `contracts/src/ForemanTestUSD.sol` | Strict `validAfter < block.timestamp < validBefore`, per-`from` nonces, low-s only, `ecrecover != 0 && == from`, per-call `DOMAIN_SEPARATOR` with `block.chainid`, owner-only mint, checked arithmetic, zero-address `to` refused |
| Self-hosted facilitator | `services/facilitator/src/app.ts` | Network and asset must be Kite plus the configured token. Signature, payee, amount and window are checked locally, then nonce and balance on chain. Settlements are serialised through one gas wallet. Dedupe is now on the exact payload. |
| x402 seller paywall | `packages/shared/src/x402-seller.ts` | precheck, then 402 or verify, then handler, then settle only if the handler succeeded. Now also refuses an authorization that is already in flight. |
| x402 buyer guard | `services/foreman/src/pay.ts`, `services/business-payer/src/app.ts` | The 402's payee and asset must match what we meant to pay. Amount goes through the firewall (cap, budget, approval threshold) or the business ceiling **before** signing. |
| Firewall | `services/foreman/src/firewall/check.ts` | No model inside. 16 typed refusal codes from `check()`, plus 2 raised by the runner. |
| Oracle verdicts | `services/proof-oracle/src/app.ts`, `packages/shared/src/sign.ts` | EIP-191 over `sha256(canonical(body))`. Verifiers now also require the right `kind` and `subject`. |
| Console API | `services/foreman/src/app.ts` | Bearer `CONSOLE_TOKEN` (constant-time compare). `?token=` is accepted because EventSource can't set headers. |
| Worker → Foreman results | `POST /api/worker-result` | HMAC-SHA256 with `WORKER_HMAC_SECRET`, timing-safe compare, attempt must exist and belong to the named worker, single use |
| Twilio webhooks | `services/phone-worker/src/app.ts` | `X-Twilio-Signature` (HMAC-SHA1) over the **configured** public URL plus sorted params, timing-safe compare |
| MCP server | `services/mcp/src/worker.ts`, `server.ts` | The Cloudflare Worker fails closed without `MCP_TOKEN` (constant-time compare). No approve or unkill tools. |
| Confirmation links `/c/:token` | `services/foreman/src/confirm.ts`, `app.ts` | 192-bit random token, only its SHA-256 stored. Single state transition, expiry enforced. GET never mutates. Output HTML-escaped. |
| Prompt injection on calls | `services/phone-worker/src/turn.ts`, `packages/shared/src/serv.ts` | Speech capped at 500 chars, wrapped in `<caller_speech>` (tag stripped from input). `serv_prompt_guard` tool on every call. Output parsed into a 7-value intent enum by zod. `sanitize()` forces injection to `out_of_scope_request`. Every requested action is run through the firewall and refused. Fixed TwiML lines, nothing the caller says is echoed. Keypad fallback when SERV is slow. |
| Secrets | `.gitignore`, git history | `.env`, `.env.*`, `.data/`, `recordings/`, `*.sqlite*`, `.mcp.json`, `.dev.vars` ignored |

## Methodology

1. Read every money and auth path end to end: buyer guard → 402 → sign → paywall → facilitator → token, and oracle → verdict → Foreman runner / business-payer.
2. Ran the tools listed below and recorded their real output.
3. Wrote a test for each claimed behaviour, including the attacks. Each fix was then **mutation-checked**: the guard was disabled in place and the relevant test file re-run. Every fix below makes at least one test fail when disabled, except S-07 (a constant-time compare can't be told apart from outside).
4. Fixed only issues with a small change that keeps existing behaviour. Design-level issues are listed as open.

## Tools actually run

| Tool | Version | Result |
|---|---|---|
| Slither | 0.11.6, solc 0.8.24 (via `solc-select`) | 102 detectors, **2 results**, both expected:<br>• `timestamp`: the validity checks use `block.timestamp`, which EIP-3009 requires.<br>• `naming-convention`: `DOMAIN_SEPARATOR()` is the standard EIP-2612/3009 name.<br>No other findings. |
| anvil (Foundry) | 1.4.2 | 15 contract tests against the committed bytecode on chain id 2368, all pass (see TESTING.md) |
| solc-js reproducibility | 0.8.24 | `bun scripts/compile-token.ts && git diff --exit-code contracts/ForemanTestUSD.json`: **no diff**. The committed artifact is exactly what the source compiles to. |
| `bun audit` | bun 1.3.5 | 22 advisories in 2 packages:<br>• `nodemailer@7.0.13`: 20 advisories, 4 high. Fixed only in versions > 9.0.0. See S-17.<br>• `tmp@0.0.33`, pulled in by `solc` and used only at build time: 2 advisories. |
| Git history secret check | git | `git log --all -- .env` is empty: `.env` was never committed. Every `.env` value of 12+ characters (34 values) was searched with `git log --all -p -S<value>` and `git grep -F` without printing the values. The only hits were public data: wallet addresses, the token address, the SERV model name and base URL, the facilitator URL, the business name and time zone, the DB path and the SMTP host. No private key, API key, auth token, HMAC secret or SMTP password appears anywhere in history or the tree. |
| `bun test`, `tsc --noEmit` | bun 1.3.5, TypeScript 5.9 | 168 pass, 0 fail. Typecheck clean. |
| Mutation checks (manual) | — | Each guard below disabled in turn, then the relevant tests re-run. Every case failed at least one test: S-01 (nonce check, in-flight lock), S-02 (self-hosted and local), S-03 (zero value, allowlist), S-04, S-05, S-06 (high-s, window bounds), S-18 (Foreman route and payer header). The files were restored after each run. |

**Not run:**
- gitleaks: downloading the binary was blocked in the review environment.
- trufflehog, semgrep, Mythril, Echidna and Foundry fuzzing: not run.
- Any check against the live Kite deployment: the deployed fUSD runtime bytecode was not compared on chain.

## Findings

Severity is for this testnet deployment. "Fixed" means a code change plus a test that fails when that change is disabled (S-07 excepted, see Methodology).

| ID | Severity | Finding | File(s) | Status |
|---|---|---|---|---|
| S-01 | Medium | **x402 payment replay.**<br>• In sim mode, `LocalFacilitator.verify` didn't check settled nonces. Replaying a captured `PAYMENT-SIGNATURE` re-ran the paid handler (another phone call on `/v1/call` with a new `attemptId`, a bonus, an oracle verdict), and `settle` returned the old receipt as success.<br>• In both modes, concurrent copies of one header all passed verify before the first settled. | `packages/shared/src/facilitator.ts`, `x402-seller.ts` | **Fixed.**<br>• Verify now refuses `nonce_already_used`, matching the chain.<br>• The paywall holds an in-process lock per `from:nonce` between verify and settle (`payment_in_progress`).<br>• A failed handler still leaves the authorization reusable for an honest retry. |
| S-02 | Medium | **Facilitator receipt confusion.** The settle dedupe was keyed only by `from:nonce`. Any payload reusing someone's `from` and `nonce` (different `to`, `value` or signature) got the cached **success** receipt without verification. This affected both the self-hosted and the local facilitator. | `services/facilitator/src/app.ts`, `packages/shared/src/facilitator.ts` | **Fixed.** Dedupe is now keyed by `hash(payload + requirements)`. Anything else goes through verify and the on-chain nonce check. |
| S-03 | Medium | **Facilitator is an open gas relay.** `/settle` is unauthenticated, so anyone could make the gas wallet submit zero-value transfers or transfers to any payee. | `services/facilitator/src/app.ts`, `index.ts` | **Partly fixed.**<br>• Zero-value authorizations are refused (`zero_amount`).<br>• New optional `FACILITATOR_PAYEES` allowlist (`payee_not_served`).<br>• **Residual:** with the allowlist unset, 1-wei self-transfers still cost gas. Set `FACILITATOR_PAYEES` to the stack's seller addresses. |
| S-04 | Medium | **Verdicts weren't bound to the question.** Foreman's runner and the business-payer accepted any genuinely signed PASS. A replayed verdict for another attempt or outcome, or a call verdict offered as outcome proof, would have released a booking or an invoice. | `services/foreman/src/runner.ts`, `services/business-payer/src/app.ts`, `packages/shared/src/sign.ts` | **Fixed.** New `verdictTrusted()` also requires `kind` and `subject` (`attemptId`, or `outcomeId:milestone`). |
| S-05 | Medium | **Business-payer signed for any asset.** Its guard checked payee and amount but not `asset`, and read the amount with fUSD's 18 decimals. A 402 naming a 6-decimal token the business also holds would pass the ceiling by a factor of 10^12 and be signed as a valid authorization on that token. | `services/business-payer/src/app.ts` | **Fixed.** `asset_not_allowed` before signing (Foreman's own guard already had this check). |
| S-06 | Low | **Sim/chain divergence.**<br>• `LocalFacilitator` accepted the high-s twin of a signature, which the token rejects (viem's recover accepts it, as shown on anvil).<br>• It accepted `now == validAfter` and `now == validBefore`, which the token rejects.<br>• The self-hosted facilitator uses the same checks, so it would pay gas for transactions that revert. | `packages/shared/src/facilitator.ts` | **Fixed.** Requires a 65-byte signature with low s, and uses strict window bounds. |
| S-07 | Low | The console bearer token was compared with `!==`, which isn't constant-time. | `services/foreman/src/app.ts` | **Fixed** (`timingSafeEqual`) |
| S-08 | Medium | **Console API fails open** when `CONSOLE_TOKEN` is unset. Approve, start, kill, unkill and "mark attended" are then open to anyone who can reach port 4000, which is internet-facing when `FOREMAN_PUBLIC_URL` is a tunnel. `CONSOLE_TOKEN` is set in this deployment (checked for presence only). The MCP worker, by contrast, fails closed. | `services/foreman/src/app.ts` | Open. Recommend refusing to start when `FOREMAN_PUBLIC_URL` is public and `CONSOLE_TOKEN` is empty. |
| S-09 | Low | `?token=` is accepted on every `/api` route, not only `/api/feed`, so the console token can end up in proxy logs and browser history. | `services/foreman/src/app.ts` | Open. Restrict the query token to `/api/feed`. |
| S-10 | Medium | **The attested proof isn't independent.**<br>• Business-payer `POST /attest/:outcomeId` is an unauthenticated endpoint that signs `{outcomeId, attended: true}` with the business key for any id. Foreman, the party being paid, calls it.<br>• `/tick` is also open.<br>• The service binds all interfaces (Bun default). | `services/business-payer/src/app.ts` | Open (design). Fix: a business-owned "mark attended" UI with its own auth, payer bound to `127.0.0.1`. |
| S-11 | Medium | **Unauthenticated data exposure on internet-facing services:**<br>• Phone-worker `GET /calls/:attemptId` returns transcripts and outcomes. Attempt ids carry 48 random bits.<br>• Foreman `/internal/confirmations` and `/internal/attestations` return signed status (no PII). The oracle reads them without credentials.<br>(`/v1/claims` was the worst case, fixed as S-18.) | `services/phone-worker/src/app.ts`, `services/foreman/src/app.ts` | Open. Fix: authenticate the worker's call endpoint, and give the oracle a read token. |
| S-12 | Low | One `WORKER_HMAC_SECRET` is shared by all workers, and the `x-worker` header isn't covered by the HMAC. One worker can post a result as another, e.g. a false "declined". There is also a `dev-hmac-secret` fallback when the variable is unset. A false success still needs an oracle PASS on the real carrier record. | `services/foreman/src/app.ts`, `services/phone-worker/src/index.ts` | Open. Fix: a per-worker secret, and sign `worker + body`. |
| S-13 | Info | The confirmation and booking trust edges described above. Also, the business-payer doesn't compare `contractHash` with a contract it approved. | `services/proof-oracle/src/app.ts`, `services/business-payer/src/app.ts` | Accepted for the hackathon, documented |
| S-14 | Info | **Token design notes:**<br>• No `cancelAuthorization` or `receiveWithAuthorization`: a signed authorization can't be revoked, but it expires after `maxTimeoutSeconds` (300 s).<br>• `transferWithAuthorization` can be front-run, but `to` is signed, so only the submitter changes.<br>• `mint` to `address(0)` is allowed (owner-only, test token).<br>• The usual ERC-20 `approve` race.<br>• Owner is immutable with unlimited mint (test token by design). | `contracts/src/ForemanTestUSD.sol` | Accepted. The `.sol` was **not** edited, so the committed and deployed bytecode still match the source. |
| S-15 | Low | The S-01 in-flight lock is per process. A seller running several instances needs a shared lock (or relies on the facilitator's on-chain nonce check, which covers sequential replays). The budget check in the firewall isn't atomic across concurrent payments, but the runner pays sequentially today. | `packages/shared/src/x402-seller.ts`, `services/foreman/src/firewall/check.ts` | Open, noted in code |
| S-16 | Info | All services bind `0.0.0.0` (Bun default). Only Foreman and the phone workers need to be reachable from outside, for Twilio, confirmation links and webhooks. | `services/*/src/index.ts` | Open. Bind the others to `127.0.0.1` in deployment. |
| S-17 | Medium | `nodemailer@7.0.13` has 20 advisories (4 high: address-parser ReDoS, OAuth2 TLS validation). Exposure is limited: Foreman sends only to emails from the business's own CSV, over the configured SMTP server, without OAuth2. | `services/foreman/package.json` | Open. The upgrade crosses a major version and the live stack was running, so it wasn't done in this review. Dependabot (added) will propose the major bump as a version update. Bun security alerts aren't supported by Dependabot yet. |

**S-18 (Medium, fixed). Customer PII on the public tunnel.**
- Foreman `GET /v1/claims` had no auth and returned customer names and **unmasked attendee emails** for every confirmed or attested outcome.
- Foreman is internet-facing through `FOREMAN_PUBLIC_URL`, so anyone with the tunnel URL could read them.
- The only legitimate caller is the business-payer. It needs the email because the oracle matches it against the booking's attendee, so masking would have broken proof.
- **Fix:** the route now uses the console bearer (`CONSOLE_TOKEN`), and the business-payer sends `Authorization: Bearer $CONSOLE_TOKEN` (`foremanToken`).
- When `CONSOLE_TOKEN` is unset, behaviour is unchanged (open, see S-08). `bun run setup` always generates one, and both services read the same `.env`.
- **Trade-off:** the payer now holds the console token. A dedicated read-only claims token is the follow-up.
- **Tests:** `services/foreman/src/app.test.ts` (401 without or with a wrong token, 200 with it) and `services/business-payer/src/app.test.ts` (header sent; an unauthorised read pays nothing).
- **Files:** `services/foreman/src/app.ts`, `services/business-payer/src/app.ts`, `services/business-payer/src/index.ts`.

## Remaining risks

- **Single-key compromise.** `FOREMAN_PK`, `BUSINESS_PK` and `FACILITATOR_PK` are hot keys in a plain `.env`. Anyone with shell access can spend. There is no HSM, no Kite passport session key, and no rotation.
- **LLM behaviour.** Prompt injection is contained by the enum, `sanitize()` and the firewall, not prevented. SERV can still misclassify an honest "yes" as unclear, which costs a call but no money.
- **Phone calls are real.** The quiet-hours, consent and opt-out checks are tested, but carrier-side behaviour (voicemail, call forwarding) isn't modelled.
- **Testnet only.** fUSD is a test token with an all-powerful owner. Mainnet would use bridged USDC with 6 decimals, which the code supports but which hasn't been run end to end here.

## Limitations of this review

- One internal pass, partly done by an AI agent. No independent auditor, no formal verification, no fuzzing campaign.
- Live services weren't exercised. The stack was running with real Twilio and Cal.com keys, so no calls, emails or payments were made. All tests use injected fakes, an in-memory DB, the local facilitator, or a private anvil chain.
- The console frontend (`apps/console`) was reviewed only for how it handles the token. There was no XSS or CSP review beyond React's default escaping.
- Cloudflare Worker deployment config and secrets weren't inspected.
