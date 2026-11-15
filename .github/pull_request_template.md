## What changed

<!-- One or two lines. Link the issue if there is one. -->

## Why

## How it was checked

- [ ] `bun run typecheck`
- [ ] `bun test` (paste the pass/fail counts)
- [ ] Contract touched? `bun scripts/compile-token.ts && git diff --exit-code contracts/ForemanTestUSD.json`

## Money / safety paths

- [ ] Touches x402 payments, the facilitator, the firewall, oracle verdicts, webhook auth or the token contract. If so, say what an attacker could try and which test covers it.
- [ ] No secrets, private keys or real phone numbers in the diff, logs or fixtures.
