# Contributing

Thanks for looking. Foreman moves money on behalf of a business, so the bar for changes to payments and safety is
higher than for the UI. Everything runs locally without accounts.

## Setup

```bash
bun install          # Bun ≥ 1.3 (CI uses 1.3.5)
bun run setup        # writes test wallets and defaults into .env
bun run dev:all      # all services against the sandbox; dashboard on http://localhost:5173/app
```

Never commit `.env`, `.data/` or `recordings/` (all gitignored). Recordings hold real phone numbers and voices.

## Before you open a pull request

```bash
bun run typecheck
bun test
bun run e2e          # five customers end to end against the sandbox
```

CI runs the same three on every push and pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), plus the
console build. Testing details: [TESTING.md](TESTING.md).

Don't run `bun run pay-test`, `bun run call-test` or a live `dev:all` against someone else's keys: they spend testnet
funds, ring real phones and send real email.

## Rules for changes

- **Money and safety need a test.** Anything touching [`firewall/check.ts`](services/foreman/src/firewall/check.ts), [`pay.ts`](services/foreman/src/pay.ts), the x402 buyer/seller/facilitators in [`packages/shared`](packages/shared/src), the oracle checks, or the business-payer must add or update a test that fails without the change.
- **The model never authorises a payment.** SERV output goes through a zod schema and the firewall. Don't add a path where model output reaches a payment, an address or a permitted action directly.
- **New actions are refused by default.** A new kind of side effect needs an entry in the firewall's `NEEDS` map and, if the contract should allow it, in `PERMITTED_ACTIONS`.
- **Side effects get an idempotency key** written `pending` before the effect (see [`idempotency.ts`](services/foreman/src/idempotency.ts)).
- **State changes are events.** The console is a pure function of the event log; if the UI needs it, emit it, and keep personal data masked.
- **Sandbox parity.** If you call a new Twilio or Cal.com endpoint, emulate it in [`services/sandbox`](services/sandbox/src) so the e2e run keeps working without accounts.
- **Never label simulated as real.** `sim:` settlements must not render as Kitescan links; sandbox adapters stay labelled.

## Style

TypeScript, ES modules, Hono for HTTP, zod for anything from outside the process. Keep functions small and comments
for the *why*. Commit messages follow Conventional Commits (`feat(foreman): …`, `fix(shared): …`, `docs: …`), as in
the history.

## Reporting security issues

Please don't open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
