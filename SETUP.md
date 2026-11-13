# Setup (all free)

## Accounts (≈30 minutes)

| Service | What to do | You get |
|---|---|---|
| **OpenServ** — https://console.openserv.ai | Sign up, create an API key, try the Playground | `SERV_API_KEY` |
| **Twilio** — https://www.twilio.com/try-twilio | Trial account → get trial number → **Verified Caller IDs**: add your + friends' numbers → **Voice Geographic Permissions**: enable your country → create an **API Key** (for the oracle) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` |
| **Cal.com** — https://cal.com | Sign up → event type "Dental check-up", 30 min → Settings → Developer → API keys | `CALCOM_API_KEY`, `CALCOM_EVENT_TYPE_ID` |
| **Gmail** | Google Account → Security → 2-Step Verification → **App passwords** → create one | `SMTP_USER`, `SMTP_PASS` |
| **Kite testnet** | Add chain 2368 (ChainList) to MetaMask; faucet https://faucet.gokite.ai for KITE + pieUSD | funded business + foreman wallets |
| **Cloudflare Tunnel** (or ngrok) | `brew install cloudflared` / download; `cloudflared tunnel --url http://localhost:4110` | public HTTPS URLs for Twilio webhooks |
| **Vercel** | Sign in with GitHub | replay-mode hosting |
| **GitHub** | New repo `foreman` (private until Sunday) | |

## Generate wallets

```bash
bun run setup
```
Writes BUSINESS / FOREMAN / ORACLE_SIGNER keys and addresses, receive-only CLEARCALL / QUICKDIAL / ORACLE addresses
(their keys go to `.data/receive-keys.json`, gitignored), an HMAC secret and the defaults below into `.env`. Existing
values are never overwritten. Only BUSINESS and FOREMAN need funds.

## `.env.example`

See [`.env.example`](.env.example). Every external adapter has a sandbox twin: leave a section blank and that piece runs
locally (labelled SIM / sandbox in the console). `PAYMENTS_MODE=sim|live` switches x402 settlement between the local
signature-checking facilitator and the Pieverse facilitator on Kite.

## Run

```bash
bun install
bun run setup                   # once
cloudflared tunnel --url http://localhost:4110   # live calls only: ClearCall  → CLEARCALL_PUBLIC_URL
cloudflared tunnel --url http://localhost:4111   # QuickDial → QUICKDIAL_PUBLIC_URL
cloudflared tunnel --url http://localhost:4000   # Foreman   → FOREMAN_PUBLIC_URL (confirmation links)
bun run dev:all                 # foreman 4000, ClearCall 4110, QuickDial 4111, oracle 4210, payer 4300, sandbox 4400, console 5173
open http://localhost:5173
```
x402 paywalls are in-process on each seller with per-route prices (docs/07 option B), so there are no wrapper ports.

## Smoke tests (in order)

```bash
bun run pay-test -- --verify    # live Pieverse facilitator checks our signed payload (works unfunded)
bun run pay-test                # $0.01 x402 payment → Kitescan link (needs funded FOREMAN wallet)
bun run serv-test               # 20 turn-parser fixtures incl. attacks, with and without SERV
bun run call-test +91XXXXXXXXXX # your phone rings (keypad path) — sandbox persona without Twilio keys
bun test                        # firewall, oracle, x402, worker loop, invoices, idempotency, reconciler
bun run e2e                     # five-customer demo end to end with assertions
```

## Replay build

```bash
bun run e2e                     # or, after a live run: curl localhost:4000/api/export/<contractId> > demo/recorded-run.json
cp demo/recorded-run.json apps/console/public/recorded-run.json
cd apps/console && VITE_REPLAY_ONLY=1 bun run build    # deploy dist/ to Vercel
```
