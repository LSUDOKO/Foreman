# Deployment

Foreman has two kinds of moving parts:

- **Static and stateless**: the landing page and replay dashboard (Cloudflare Pages) and the MCP proxy (Cloudflare Worker). Deployed today.
- **Agents with keys**: Foreman, the phone workers, the oracle, the business-payer and the facilitator. They hold private keys, keep SQLite state and receive Twilio webhooks, so they run on your machine or a server.

Current deployments:

| What | URL |
|---|---|
| Site + dashboard (replay of the 14 Nov on-chain run) | https://foreman-agent.pages.dev · https://foreman-agent.pages.dev/app/?replay |
| MCP Worker | https://foreman-mcp.adoranto737.workers.dev (bearer token, proxies to a running Foreman) |
| fUSD token on Kite testnet | [`0xef5765044D85C6A27C66A6e322063E8A67bAB4bB`](https://testnet.kitescan.ai/address/0xef5765044D85C6A27C66A6e322063E8A67bAB4bB) |

---

## 1. Local stack (no accounts)

Requires [Bun](https://bun.sh) ≥ 1.3 (CI pins 1.3.5).

```bash
bun install
bun run setup        # wallets, HMAC secret, console token and defaults into .env; never overwrites existing values
bun run dev:all      # every service with prefixed logs and health checks
```

`bun run setup` ([`scripts/setup.ts`](scripts/setup.ts)) writes `BUSINESS_*`, `FOREMAN_*`, `ORACLE_SIGNER_*` and
`FACILITATOR_*` keys and addresses, receive-only `CLEARCALL_PAYTO` / `QUICKDIAL_PAYTO` / `ORACLE_PAYTO` (their keys go to
`.data/receive-keys.json`, gitignored), `WORKER_HMAC_SECRET` and `CONSOLE_TOKEN`.

`bun run dev:all` ([`scripts/dev-all.ts`](scripts/dev-all.ts)) starts:

| Service | Port |
|---|---|
| foreman | 4000 |
| ClearCall / QuickDial | 4110 / 4111 |
| proof-oracle | 4210 |
| business-payer | 4300 |
| sandbox | 4400 |
| facilitator (only when `FACILITATOR_URL` points at it) | 4500 |
| console | 5173 (landing `/`, dashboard `/app`) |

Before a fresh run, `bun run reset` wipes the DB so reputations, probation and the kill switch start over (they persist
between runs on purpose).

Checks: `bun test`, `bun run typecheck`, `bun run e2e` (five customers end to end with assertions). See [TESTING.md](TESTING.md).

---

## 2. Going live, one adapter at a time

Each section is independent. Fill it in `.env`, restart, and the console's mode badges flip from `sandbox` / `sim` to live.

### SERV Reasoning

Create a key at https://console.openserv.ai → `SERV_API_KEY`. `bun run serv-test` checks the turn parser against SERV.

### Kite testnet payments (fUSD + our facilitator)

1. `bun run setup` prints `FOREMAN_ADDRESS`. Get KITE for it at https://faucet.gokite.ai.
2. `bun scripts/deploy-token.ts` deploys fUSD (or reuses `KITE_TOKEN_ADDRESS`), checks the on-chain EIP-712 domain, mints 50 fUSD to the business and 20 to Foreman, and sends the facilitator's gas wallet 0.25 KITE.
3. Set what it prints: `KITE_TOKEN_ADDRESS`, `PAYMENTS_MODE=live`, `FACILITATOR_URL=http://localhost:4500`.
4. `bun run pay-test` settles $0.01 and prints a Kitescan link. `dev:all` and `e2e` start the facilitator automatically.

A full five-customer run costs about 0.03 KITE of gas.

**With pieUSD instead:** fund both wallets with pieUSD, delete `KITE_TOKEN_ADDRESS`, set
`FACILITATOR_URL=https://facilitator.pieverse.io/v2`. `bun run pay-test -- --verify` checks the payload against
Pieverse even with an unfunded wallet.

**Anchoring the audit chain:** `bun scripts/anchor.ts [contractId]` posts the head hash to Kite (needs a little KITE in Foreman's wallet).

### Twilio Voice

1. Trial account → number → **Verified Caller IDs** (only call consenting, verified numbers) → enable the country in **Voice Geographic Permissions** → create an **API key** for the oracle.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`.
3. Expose the workers (see [tunnels](#3-tunnels)) and set `CLEARCALL_PUBLIC_URL`, `QUICKDIAL_PUBLIC_URL`.
4. `bun run call-test +91…` rings your phone through ClearCall over x402.

Optional: `TWILIO_RECORD=1` records both sides; `bun run recordings` downloads them to `recordings/` (gitignored).

### Cal.com

Event type "Dental check-up", 30 minutes → Settings → Developer → API keys. Set `CALCOM_API_KEY`,
`CALCOM_EVENT_TYPE_ID` and optionally `CALCOM_READ_KEY` for the oracle.

### Email

Google account → 2-Step Verification → App passwords. Set `SMTP_USER`, `SMTP_PASS`, and `FOREMAN_PUBLIC_URL`
(tunnel to :4000) so the links in the email work.

### The live run

Put real, consenting numbers and emails in `demo/no-shows.csv`, then:

```bash
bun run reset
bun run dev:all
# http://localhost:5173/app → Business view → compile → approve → start
```

Export it for replay with `curl -H "Authorization: Bearer $CONSOLE_TOKEN" localhost:4000/api/export/<contractId> > demo/recorded-run.json`.

### Recording a run

`bun run record` ([`scripts/record-screens.sh`](scripts/record-screens.sh)) records the laptop screen (wf-recorder) and
the phone over USB (scrcpy, needs `adb`) at the same time; Ctrl+C stops both. Android blocks capturing call audio, so set
`TWILIO_RECORD=1` and Twilio records both sides of every call; `bun run recordings` downloads them as MP3. Everything
lands in `recordings/`, which is gitignored because it holds real phone numbers, voices and inboxes. The 15 Nov
recordings were published as a [GitHub release](https://github.com/LSUDOKO/Foreman/releases/tag/demo-recordings-2026-11-15).

---

## 3. Tunnels

Twilio must reach the workers' webhooks and customers must reach the confirmation page.

```bash
cloudflared tunnel --url http://localhost:4110   # ClearCall → CLEARCALL_PUBLIC_URL
cloudflared tunnel --url http://localhost:4111   # QuickDial → QUICKDIAL_PUBLIC_URL
cloudflared tunnel --url http://localhost:4000   # Foreman   → FOREMAN_PUBLIC_URL (confirmation links, MCP Worker upstream)
```

Quick tunnels change URL on restart: update `.env` and restart the services, or use a named tunnel. `:4000` is
reachable through its tunnel, so keep `CONSOLE_TOKEN` set and secret. Don't tunnel the business-payer (:4300) or the
facilitator (:4500). See [SECURITY.md](SECURITY.md).

---

## 4. Cloudflare Pages (site + replay dashboard)

```bash
bun run e2e                                       # or export a live run, see above
cp demo/recorded-run.json apps/console/public/recorded-run.json
cd apps/console
bun run build:replay                              # VITE_REPLAY_ONLY=1, landing at /, dashboard at /app
wrangler pages deploy dist --project-name foreman-agent
```

`build:replay` copies `index.html` to `dist/app/index.html` so `/app` works as a static route. The replay build never
calls an API and holds no keys. `apps/console/vercel.json` is kept for hosting on Vercel instead.

---

## 5. Cloudflare Worker (MCP)

```bash
cd services/mcp
wrangler deploy --var FOREMAN_URL:https://<your foreman tunnel>
wrangler secret put CONSOLE_TOKEN     # same value as Foreman's .env
wrangler secret put MCP_TOKEN         # a new random token for MCP clients
claude mcp add --transport http foreman https://<worker>.workers.dev/mcp --header "Authorization: Bearer <MCP_TOKEN>"
```

Config: [`services/mcp/wrangler.jsonc`](services/mcp/wrangler.jsonc) (`nodejs_compat`, `FOREMAN_URL` var). The Worker
is stateless and refuses every request if `MCP_TOKEN` isn't set. It only answers usefully while Foreman and its tunnel
are up.

Local alternative (stdio):

```bash
claude mcp add foreman -e FOREMAN_URL=http://localhost:4000 -e CONSOLE_TOKEN=<from .env> -- bun services/mcp/src/stdio.ts
```

---

## 6. CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and every pull request: Bun 1.3.5,
`bun install --frozen-lockfile`, `bun run typecheck`, `bun test`, `bun run setup`, `bun run e2e` (sandbox, no secrets, SERV
on its labelled fallback path) and the console build. Deployments are manual (the commands above).

---

## Running the agents on a server

Not done for the hackathon; the shape it would take:

- One host or container per service (or one host running `dev:all`), with the `.env` from a secret store, never the repo.
- Persistent volume for `DB_PATH` (SQLite, WAL).
- Stable HTTPS hostnames for the workers and Foreman instead of quick tunnels.
- Only `:4000` (console API, confirm pages, invoices) and the workers' `/twilio/*` + `/v1/*` routes public; the payer and facilitator private.

Production work beyond that (Postgres, escrow, Kite mainnet) is in [ROADMAP.md](ROADMAP.md).
