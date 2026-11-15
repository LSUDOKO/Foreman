# Testing

Framework: `bun test` (Bun 1.3). Tests sit next to the code they cover (`*.test.ts`). Contract tests that need a real
EVM live in `tests/contract/`.

## How to run

```bash
bun install --frozen-lockfile
bun run typecheck                 # tsc --noEmit over packages, services, scripts, tests
bun test                          # everything
bun test tests/contract           # fUSD on anvil only
bun test services/foreman         # one service

# the committed contract artifact must match the source
bun scripts/compile-token.ts && git diff --exit-code contracts/ForemanTestUSD.json
```

- **Contract suite.** It needs `anvil` from Foundry. The test finds it on `PATH`, `~/.foundry/bin`, `~/.config/.foundry/bin` or `ANVIL_BIN`. Without anvil the 15 tests are reported as skipped, not failed. Each run starts its own anvil on a random port between 20000 and 60000, deploys the committed bytecode, and kills the node afterwards.
- **Safety: the suite never reaches anything real.** Bun loads `.env` into the test process, so every test injects its own `fetch`, Twilio credentials, network object and in-memory SQLite, plus the local facilitator or a private anvil chain. No test places a call, sends email, books in Cal.com or touches Kite testnet.
- **Commands that are not tests.** `bun run e2e`, `call-test`, `pay-test`, `serv-test` and `dev:all` start services or use live keys. CI runs `e2e` against the sandbox with no secrets.

## Results

Run on 2026-11-16 (IST) with bun 1.3.5, anvil 1.4.2, on commit `4edcb2f` plus the working-tree changes from the security review:

```
bun test        → 168 pass, 0 fail, 20 files
bun run typecheck → clean (exit 0)
compile-token   → no diff against contracts/ForemanTestUSD.json
without anvil   → tests/contract: 0 pass, 15 skip, 0 fail
```

Before the review the suite had 105 tests in 18 files. The review added 63.

| File | Tests | Covers |
|---|---:|---|
| `tests/contract/ForemanTestUSD.test.ts` | 15 | **fUSD on a real EVM (anvil, chain id 2368).** Covers:<br>• Metadata, and `DOMAIN_SEPARATOR` equal to viem's EIP-712 domain hash.<br>• Owner-only mint.<br>• A relayer submitting `transferWithAuthorization`: balances, `authorizationState`, events.<br>• A replayed nonce rejected through both overloads (bytes and v/r/s).<br>• Expired and not-yet-valid authorizations, with both bounds checked as exclusive in blocks pinned to the exact timestamp.<br>• A signature from someone other than `from`.<br>• Edited `value`, `to` or `validBefore`, or a wrong chain id, verifying contract or domain name.<br>• The high-s twin rejected without burning the nonce.<br>• Malformed signatures: length, v, zero r/s.<br>• Zero-address `to`, overdrawn balance, allowance cap, infinite allowance.<br>• Supply overflow at 2^256-1.<br>• Parity: the local facilitator also rejects the high-s twin. |
| `services/foreman/src/firewall/check.test.ts` | 39 | Every refusal code `check()` can emit, table-driven, with a guard test: a new code in `REFUSAL_CODES` fails the suite until it has a row (`proof_failed` and `injection_detected` are raised by the runner). Also boundary cases (exactly at budget, probation), case-insensitive but exact payee match, and prototype-named action kinds refused. |
| `services/foreman/src/pay.test.ts` | 5 | Foreman's x402 buyer guard. A 402 with the wrong payee, a different asset or more than the per-call cap, or a payee missing from the contract allowlist, is refused **with no signature sent**. An honest payment goes through once, and the same purpose and ref is never paid twice. |
| `services/foreman/src/app.test.ts` | 16 | Confirmation links:<br>• Double-click confirms once.<br>• GET never mutates.<br>• An expired link returns 410 and confirms nothing.<br>• Decline after confirm, and confirm after decline, are no-ops.<br>• Tokens one character off, and garbage tokens, get 404 and aren't reflected.<br>Also: x402 invoices (state precheck before any 402, paid once), worker HMAC, kill switch, decline and expiry releasing holds, console bearer auth (401 without the token, `?token=` wrong), and `/v1/claims` (PII) requiring the bearer. |
| `packages/shared/src/x402.test.ts` | 10 | x402 v2 exact:<br>• Sign, settle, receipt.<br>• Guard refusal happens before signing.<br>• **A replayed header is refused (`nonce_already_used`) and doesn't re-run the handler.**<br>• **Three concurrent copies of one header give one 200.**<br>• An honest retry after a handler failure still works.<br>• Tampered amount, forged `from`.<br>• Local facilitator refusals: payee, amount, network, window, and a forged payload not inheriting a receipt. |
| `services/facilitator/src/app.test.ts` | 9 | Self-hosted facilitator with a fake chain:<br>• Settles once.<br>• Unfunded payer refused.<br>• Concurrent identical settles submit once.<br>• Wrong asset or network refused.<br>• A different payload with a used `from+nonce` doesn't inherit success.<br>• A used nonce is refused at verify.<br>• Zero value refused.<br>• Payee allowlist.<br>• Malformed body gets 400. |
| `services/business-payer/src/app.test.ts` | 7 | A FAIL is bought once and never invoiced. A **genuinely signed PASS about another outcome, or of the wrong kind, isn't accepted**, while a matching PASS does reach the invoice. An oracle 402 in another token or above the price ceiling is refused before signing. The payer sends its bearer when reading Foreman's claims, and an unauthorised read pays nothing. |
| `services/proof-oracle/src/app.test.ts` | 4 | Paid call and outcome verification. Verdict tampering: any edited field, a wrong signer, a malformed signature, a re-signed imposter claiming the oracle address, and a wrong subject or kind all fail. |
| `services/proof-oracle/src/checks.test.ts` | 13 | Deterministic call and outcome checks against carrier and calendar records |
| `services/phone-worker/src/app.test.ts` | 8 | Voice loop (disclosure first, keypad, HMAC result), unsigned webhook gets 403. **A Twilio signature is bound to its URL, params and token**: signed for another attempt, Digits changed after signing, wrong token, or a forged status callback all get 403. **One call payment can't be replayed** to hire a second call or to pay the bonus. Social-engineering turn, no answer, duplicate attempt, faulty worker. |
| `services/phone-worker/src/turn.test.ts` | 13 | Turn parser fallback and `sanitize()`: injection forced to `out_of_scope_request`, slot index bounds, normalising field-name drift |
| `services/mcp/src/server.test.ts` | 7 | Only the safe tools are listed (no approve or unkill). Auth header is sent. Draft start refused. Errors surfaced. The Worker rejects a missing or wrong `MCP_TOKEN` (401). |
| `services/foreman/src/contract/compiler.test.ts` | 5 | Goal → contract: rejected requests, addresses replaced from the registry, defaults |
| `services/foreman/src/planner/planner.test.ts` | 5 | Call plan and worker selection |
| `packages/shared/src/audit.test.ts` | 3 | Hash-chained audit log, tamper detection |
| `packages/shared/src/money.test.ts` | 3 | USD ↔ units, cents arithmetic |
| `services/foreman/src/csv.test.ts`, `events.test.ts`, `reconcile.test.ts`, `services/sandbox/src/calendar.test.ts` | 6 | CSV parsing, event log, crash reconciliation of booking keys, sandbox calendar |

## CI

`.github/workflows/ci.yml` runs, in order:
1. `bun install --frozen-lockfile`
2. Foundry (`foundry-rs/foundry-toolchain@v1`, so the anvil suite runs instead of skipping)
3. `bun run typecheck`
4. `bun test`
5. The contract-artifact check
6. The existing sandbox `setup` + `e2e`
7. The console build

Dependabot (`.github/dependabot.yml`) proposes bun and GitHub Actions updates weekly.

## What is not tested

- **Live integrations.** Real Twilio calls, Cal.com, SMTP, SERV, Pieverse and Kite testnet are exercised only by the manual scripts (`call-test`, `pay-test`, `serv-test`) and the live demo, not by `bun test`.
- **The SERV turn parser against the live model.** `scripts/serv-test.ts` holds that fixture table. Unit tests use the deterministic fallback.
- **Self-hosted facilitator → anvil.** The facilitator's `kiteChain()` adapter (viem `writeContract` + receipt) isn't run against a chain. The facilitator logic is tested with a fake chain, and the token with direct calls.
- **The console UI (`apps/console`).** No component or browser tests. CI only builds it.
- **Concurrency across processes.** The paywall's in-flight lock is tested within one process only.
- **Fuzzing or property tests** for the contract or the firewall, and **load tests**.
- **Unauthenticated endpoints** (worker `/calls/:id`, payer `/attest` and `/tick`, Foreman `/internal/*`). They are documented as open findings in SECURITY.md. No test asserts they are protected, because they aren't.
