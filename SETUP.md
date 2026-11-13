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
bun -e 'import {generatePrivateKey, privateKeyToAccount} from "viem/accounts";
for (const n of ["BUSINESS","FOREMAN","ORACLE_SIGNER","CLEARCALL","QUICKDIAL","ORACLE"]) {
  const pk = generatePrivateKey(); console.log(n+"_PK="+pk, " # "+privateKeyToAccount(pk).address) }'
```
Only BUSINESS and FOREMAN need funds. For CLEARCALL, QUICKDIAL and ORACLE you only need the addresses (`*_PAYTO`).

## `.env.example`

```bash
# ---------- SERV ----------
SERV_API_KEY=
SERV_MODEL=gpt-5.4-mini
SERV_BASE_URL=https://inference-api.openserv.ai/v1

# ---------- Kite ----------
KITE_NETWORK=testnet
KITE_RPC=https://rpc-testnet.gokite.ai/
KITE_EXPLORER=https://testnet.kitescan.ai
FACILITATOR_URL=https://facilitator.pieverse.io/v2
PAY_TOKEN=0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A   # pieUSD (verify on Kitescan)

BUSINESS_PK=
FOREMAN_PK=
ORACLE_SIGNER_PK=
FOREMAN_PAYTO=          # address of FOREMAN_PK
CLEARCALL_PAYTO=
QUICKDIAL_PAYTO=
ORACLE_PAYTO=

# ---------- Prices (USD in pieUSD) ----------
CLEARCALL_PRICE=0.50
QUICKDIAL_PRICE=0.30
BONUS_PRICE=0.20
ORACLE_PRICE=0.02
INVOICE_CONFIRMED=4.00
INVOICE_ATTENDED=2.00
BUSINESS_MAX_PER_OUTCOME=6.00

# ---------- Twilio ----------
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
TWILIO_API_KEY_SID=     # oracle reads call records with this
TWILIO_API_KEY_SECRET=
CLEARCALL_PUBLIC_URL=   # https://xxxx.trycloudflare.com → :4110
QUICKDIAL_PUBLIC_URL=   # → :4111
WORKER_HMAC_SECRET=

# ---------- Cal.com ----------
CALCOM_API_KEY=
CALCOM_EVENT_TYPE_ID=
CALCOM_READ_KEY=        # business read key for the oracle (can be the same key for the hackathon)

# ---------- Email ----------
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
FOREMAN_PUBLIC_URL=     # https://yyyy.trycloudflare.com → :4000 (for /c/:token links)

# ---------- App ----------
BUSINESS_NAME=Smile Dental
BUSINESS_TZ=Asia/Kolkata
CONSOLE_TOKEN=
DB_PATH=.data/foreman.sqlite
```

## Run

```bash
bun install
cp .env.example .env            # fill it in
cloudflared tunnel --url http://localhost:4110   # ClearCall  → paste URL into CLEARCALL_PUBLIC_URL
cloudflared tunnel --url http://localhost:4111   # QuickDial  → QUICKDIAL_PUBLIC_URL
cloudflared tunnel --url http://localhost:4000   # Foreman    → FOREMAN_PUBLIC_URL
bun run dev:all                 # foreman 4000 (+ invoice paywalls 4001/4002), workers 4110/4111 behind paywalls 4100–4103,
                                # oracle 4210 behind paywall 4200, payer 4300, console 5173 (port map: docs/07)
open http://localhost:5173
```

## Smoke tests (in order)

```bash
bun scripts/pay-test.ts         # $0.01 x402 payment → Kitescan link
bun scripts/serv-test.ts        # SERV classifies an attack as out_of_scope_request
bun scripts/call-test.ts +91XXXXXXXXXX   # your phone rings (keypad path)
bun test                        # firewall, oracle, idempotency
```

## Replay build

```bash
curl -H "Authorization: Bearer $CONSOLE_TOKEN" localhost:4000/api/export/ctr_demo_001 > demo/recorded-run.json
cp demo/recorded-run.json apps/console/public/recorded-run.json
cd apps/console && VITE_REPLAY_ONLY=1 bun run build    # deploy dist/ to Vercel
```
