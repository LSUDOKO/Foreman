# 02 · Architecture

## Design principles

1. **Rent the physical world, don't fake it.** Real calls (Twilio), real calendar (Cal.com), real email, real on-chain payments (Kite testnet).
2. **The model decides, code authorises.** SERV makes judgment calls; a deterministic firewall and deterministic oracles gate every action and every payment.
3. **Every party is a separate agent with its own wallet.** Even though we run them all for the hackathon, they never share keys or databases.
4. **Everything is replayable.** Every event is written to a hash-chained log; the console can replay a recorded run with real tx hashes.

## Services

| Service | Port | Role | Wallet | Paid by | Pays |
|---|---|---|---|---|---|
| `foreman` | 4000 (+ paywalls 4001/4002) | Outcome agent: contracts, planning, hiring, booking, confirmation, ledger, SSE feed, invoice seller | `FOREMAN_PK` | business-payer | phone workers, oracle |
| `phone-worker` (ClearCall) | 4100 → 4110 | x402 seller: places a call, runs the voice loop, returns structured result | `CLEARCALL_PAYTO` (receive only) | foreman | — |
| `phone-worker` (QuickDial) | 4101 → 4111 | Same code, `WORKER_MODE=faulty` for the demo | `QUICKDIAL_PAYTO` | foreman | — |
| `proof-oracle` | 4200 → 4210 | x402 seller: `/v1/verify/call`, `/v1/verify/outcome` — deterministic checks | `ORACLE_PAYTO` | foreman, business-payer | — |
| `business-payer` | 4300 | The clinic's payment agent: watches claims, asks the oracle, pays Foreman's invoices | `BUSINESS_PK` | — | foreman, oracle |
| `console` | 5173 | React UI: live feed, ledger, workers, safety, business view, replay mode | — | — | — |

Ports written `A → B` mean: public x402 paywall on A (kite-x402-hono) in front of the service on B. Full port map in `07-kite-x402-payments.md`.

Shared code lives in `packages/shared`: Kite network constants, x402 buyer client, x402 seller helper, SERV client, types, idempotency, audit chain.

## Repository layout

```
foreman/
├─ apps/
│  └─ console/                 # Vite + React + Tailwind + shadcn/ui
├─ services/
│  ├─ foreman/                 # Hono, bun:sqlite
│  │  ├─ src/contract/         # SERV contract compiler + zod schema
│  │  ├─ src/planner/          # SERV call planner + worker selection
│  │  ├─ src/firewall/         # deterministic policy engine, typed refusals
│  │  ├─ src/booking/          # Cal.com client (slots, create, cancel)
│  │  ├─ src/confirm/          # confirmation tokens, email, /c/:token page
│  │  ├─ src/ledger/           # payments, margin, audit chain
│  │  ├─ src/hire/             # x402 buyer calls to workers + oracle
│  │  ├─ src/invoice/          # x402 seller: /v1/invoice/:outcomeId/:milestone
│  │  └─ src/feed/             # SSE event stream
│  ├─ phone-worker/            # Hono, Twilio voice loop, x402 seller
│  ├─ proof-oracle/            # Hono, Twilio + Cal.com readers, x402 seller
│  └─ business-payer/          # small loop: poll claims → verify → pay
├─ packages/
│  └─ shared/                  # kite.ts, x402-buyer.ts, x402-seller.ts, serv.ts, audit.ts, types.ts
├─ demo/
│  ├─ no-shows.csv             # demo customers (your and friends' verified numbers)
│  └─ recorded-run.json        # exported for replay mode
├─ docs/                       # this pack
└─ package.json                # bun workspaces, "dev:all" via concurrently
```

## Wallets (all on Kite testnet, chain 2368)

| Wallet | Holds | Signs | Needs |
|---|---|---|---|
| Business | test pieUSD | x402 payments to Foreman + oracle | pieUSD from faucet |
| Foreman | test pieUSD | x402 payments to workers + oracle | pieUSD from faucet |
| ClearCall, QuickDial, Oracle | receive only | nothing | just an address |

x402 "exact" payments use EIP-3009 `transferWithAuthorization` signatures, so **payers don't need KITE for gas** — the facilitator submits the transaction. Keep a little KITE anyway for any manual transfers.

## Component diagram

```mermaid
flowchart LR
  subgraph Business
    CSV[No-shows CSV]
    CAL[(Cal.com calendar)]
    BP[business-payer\nBUSINESS wallet]
  end
  subgraph Foreman
    CC[Contract compiler\nSERV + shadow agent]
    PL[Planner + worker selection\nSERV]
    FW[Firewall\ndeterministic]
    BK[Booking + confirmation]
    LG[Ledger + audit chain]
    INV[Invoice seller x402]
  end
  subgraph Workers[x402 sellers on Kite]
    W1[ClearCall\nphone-worker]
    W2[QuickDial\nphone-worker faulty]
    OR[proof-oracle]
  end
  TW[(Twilio)]
  CUST((Customer phone\n+ email))

  CSV --> CC --> PL --> FW
  FW -- x402 pay per call --> W1 & W2
  W1 & W2 -- calls --> TW --> CUST
  W1 & W2 -- result --> FW
  FW --> BK --> CAL
  BK -- confirm link --> CUST
  CUST -- click --> BK
  FW -- x402 verify --> OR
  OR -- reads --> TW & CAL
  BP -- x402 verify --> OR
  BP -- x402 pay invoice --> INV
  FW & BK & INV --> LG
```

## Sequence: one customer, happy path

```mermaid
sequenceDiagram
  autonumber
  participant F as Foreman
  participant S as SERV
  participant W as ClearCall (x402)
  participant T as Twilio
  participant C as Customer
  participant K as Cal.com
  participant O as Oracle (x402)
  participant B as Business payer

  F->>S: plan call (customer, free slots)
  S-->>F: offer 16:00 and 17:30, reason
  F->>F: firewall: consent ✓ hours ✓ budget ✓ payee ✓ idem ✓
  F->>W: POST /v1/call (402 → sign → pay $0.50)
  W->>T: create call
  T->>C: phone rings
  C-->>W: "Four o'clock works" (speech)
  W->>S: parse turn (+ serv_prompt_guard)
  S-->>W: {intent: accept_slot, slot: 0}
  W-->>F: result {accepted 16:00, callSid, transcript}
  F->>O: /v1/verify/call (pay $0.02)
  O->>T: GET call record
  O-->>F: PASS (completed, 64s)
  F->>W: bonus $0.20 (proven call)
  F->>K: create booking (idempotency key)
  F->>C: email "Confirm your 4 PM appointment"
  C->>F: clicks Confirm
  F->>F: outcome claim: confirmed
  B->>O: /v1/verify/outcome (pay $0.02)
  O->>K: GET booking
  O-->>B: PASS (accepted, attendee ✓, slot ✓, confirmation ✓)
  B->>F: pay invoice $4 (x402)
  Note over B,F: Later: business marks "attended" → pays $2
```

## Sequence: the lying worker

```mermaid
sequenceDiagram
  participant F as Foreman
  participant Q as QuickDial (faulty)
  participant O as Oracle
  participant T as Twilio
  participant W as ClearCall
  F->>Q: probation call (pay $0.30)
  Q-->>F: "accepted 17:30", fake callSid, convincing transcript
  F->>O: /v1/verify/call
  O->>T: GET /Calls/{fakeSid}
  T-->>O: 404
  O-->>F: FAIL proof_failed:call_not_found
  F->>F: withhold bonus, reputation 80 → 40, do NOT book
  F->>W: re-hire for same customer (same idempotency scope, new attempt)
  W-->>F: real call, real acceptance
```

## Event flow and the live feed

Every state change emits an event: `{id, ts, jobId, type, actor, data, prevHash, hash}`. Foreman stores it in SQLite and pushes it over SSE (`GET /api/feed`). The console renders the feed; replay mode reads the same events from `recorded-run.json` on a timer. See `10-api-and-data-model.md` for the event types.

## Deployment (free)

| Piece | Where | Note |
|---|---|---|
| All Bun services | Your laptop + a **Cloudflare Tunnel** (`cloudflared tunnel --url`) or ngrok free | Twilio needs a public HTTPS webhook URL for the phone workers |
| Console (replay mode) | **Vercel** free (static build) | The public demo link for judges |
| Console (live mode) | Local, shown in the video | Needs your keys |

Optional: Render free web services for the Bun apps if you want a live public backend; cold starts make it unreliable for live calls, so record the video locally.
