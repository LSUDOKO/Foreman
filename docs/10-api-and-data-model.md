# 10 · API and data model

## Foreman (`:4000`)

### Console API (local, protected by `CONSOLE_TOKEN` bearer)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/contracts/compile` | Body `{ goal, csv }` → SERV compiles → `{ contract (draft), rejectedRequests, customers }` |
| `POST` | `/api/contracts/:id/approve` | Business approves → status `approved` |
| `POST` | `/api/contracts/:id/start` | → `running`; kicks off planner |
| `GET` | `/api/contracts/:id` | Contract + hash + status |
| `GET` | `/api/jobs/:contractId` | Customers with stepper state |
| `GET` | `/api/ledger/:contractId` | Payments in/out, totals, margin |
| `GET` | `/api/workers` | Registry + reputation + history |
| `GET` | `/api/refusals/:contractId` | Typed refusals |
| `GET` | `/api/decisions/:contractId` | SERV decisions |
| `GET` | `/api/feed` | **SSE** stream of events (`?since=<eventId>` to resume) |
| `GET` | `/api/export/:contractId` | Full event list for replay mode |
| `POST` | `/api/kill` / `/api/unkill` | Kill switch (unkill requires `{ confirm: "<BUSINESS NAME>" }`) |
| `POST` | `/api/outcomes/:id/attended` | Business view: signs attestation with business key, hands to business-payer |

### Worker callbacks (HMAC-signed)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/worker-result` | `CallResult` from a phone worker (header `X-Worker-Signature`) |

### Customer pages (public)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/c/:token` | Confirmation page |
| `POST` | `/c/:token/confirm` | Redeem token → outcome `confirmed_by_customer` |
| `POST` | `/c/:token/decline` | Customer declines → Foreman cancels its hold |

### Paid (x402) — business-payer calls these

| Method | Path | Price |
|---|---|---|
| `GET` | `/v1/claims?contractId=` | free — list outcomes awaiting payment |
| `POST` | `/v1/invoice/:outcomeId/confirmed` | $4.00 |
| `POST` | `/v1/invoice/:outcomeId/attended` | $2.00 |

The invoice handler must refuse (409) if the outcome isn't in the right state, *before* the paywall settles — i.e. check state in a pre-handler so the business never pays for an invalid invoice.

## Proof oracle (`:4200`, x402)

| Method | Path | Price |
|---|---|---|
| `POST` | `/v1/verify/call` | $0.02 |
| `POST` | `/v1/verify/outcome` | $0.02 |
| `GET` | `/v1/pubkey` | free — oracle signer address |

The oracle needs read access to the confirmation token store. Simplest: Foreman exposes `GET /internal/confirmations/:outcomeId` signed with Foreman's key; the oracle verifies the signature. (Document this trust edge honestly; in production the confirmation page would be hosted by the oracle/business, not Foreman.)

## Business payer (`:4300`)

A loop, every 10 s:
```
claims = GET foreman/v1/claims?contractId
for c in claims where state in (confirmed_by_customer, attended_attested):
  if paid(c, milestone) → skip                     (idempotency)
  if total_paid + price > ceiling → refuse over_budget
  verdict = pay(oracle /v1/verify/outcome)          ($0.02)
  if verdict.PASS and verifySignature(verdict) → pay(foreman /v1/invoice/:id/:milestone)
  else record refusal proof_failed
```
Exposes `GET /status` (free) for the console's Business view.

## SQLite schema (Foreman)

```sql
CREATE TABLE contracts (
  id TEXT PRIMARY KEY, json TEXT NOT NULL, hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','approved','running','paused','completed','expired')),
  created_at TEXT NOT NULL
);
CREATE TABLE customers (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, name TEXT, phone TEXT, email TEXT,
  missed_at TEXT, consent_source TEXT, opted_out INTEGER DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'eligible'      -- eligible|skipped|planned|calling|call_verified|booked|confirmation_sent|confirmed|attended|declined|failed
);
CREATE TABLE workers (
  name TEXT PRIMARY KEY, pay_to TEXT NOT NULL, call_url TEXT NOT NULL, bonus_url TEXT NOT NULL,
  price TEXT NOT NULL, bonus TEXT NOT NULL, reputation INTEGER NOT NULL, probation_left INTEGER NOT NULL
);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, worker TEXT NOT NULL, attempt_no INTEGER NOT NULL,
  call_sid TEXT, offers TEXT, result_json TEXT, verdict_json TEXT, quality REAL,
  status TEXT NOT NULL                         -- requested|dialing|reported|verified|failed
);
CREATE TABLE outcomes (
  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, booking_uid TEXT, slot_start TEXT,
  confirm_token_hash TEXT, confirm_expires_at TEXT, confirmed_at TEXT, attended_sig TEXT,
  state TEXT NOT NULL                          -- booked|confirmation_sent|confirmed_by_customer|paid_confirmed|attended_attested|paid_attended|cancelled
);
CREATE TABLE payments (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, direction TEXT CHECK (direction IN ('in','out')),
  from_addr TEXT, to_addr TEXT, counterparty TEXT, purpose TEXT, amount TEXT, tx_hash TEXT,
  ref_id TEXT, created_at TEXT
);
CREATE TABLE refusals (
  id TEXT PRIMARY KEY, contract_id TEXT, code TEXT, actor TEXT, action TEXT, evidence TEXT, created_at TEXT
);
CREATE TABLE idempotency (
  key TEXT PRIMARY KEY, kind TEXT, status TEXT CHECK (status IN ('pending','done','failed')), ref TEXT, created_at TEXT
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, contract_id TEXT, type TEXT, actor TEXT,
  data TEXT, prev_hash TEXT, hash TEXT        -- hash = sha256(prev_hash || canonical(row without hash))
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);   -- kill_switch, etc.
```

## Event types (feed + audit chain)

| Type | Actor | Data |
|---|---|---|
| `contract_compiled` | serv | contract hash, rejectedRequests |
| `contract_approved` / `contract_started` | business | — |
| `customer_skipped` | firewall | customerId, code |
| `serv_decision` | serv | purpose, model, ms, tokens, decision, reason |
| `worker_hired` | foreman | worker, attemptId, reason, probation |
| `payment_out` / `payment_in` | wallet | to/from, amount, purpose, txHash |
| `call_started` / `call_reported` | worker | callSid, outcome, slotIndex |
| `oracle_verdict` | oracle | kind, verdict, code, checks, signature |
| `reputation_changed` | foreman | worker, from, to, reason |
| `booking_created` / `booking_cancelled` | foreman | bookingUid, slot |
| `confirmation_sent` / `customer_confirmed` / `customer_declined` | foreman / customer | outcomeId |
| `attended_attested` | business | outcomeId, signature |
| `refusal` | firewall | code, action, evidence |
| `kill_switch` | operator | on/off |

## Audit chain verification

`GET /api/audit/verify/:contractId` recomputes every hash and returns `{ ok: true, events: 142, head: "sha256:…" }`. Show the head hash in the console header. Optional stretch: post the head hash to Kite testnet in a 0-value tx at the end of the job ("anchored on-chain").

## Shared types

```ts
type Usd = string;                       // "0.50"
type CallOutcome = "accepted"|"declined"|"no_answer"|"opted_out"|"wrong_person"|"out_of_scope_only"|"failed";
interface CallResult { attemptId: string; callSid: string; outcome: CallOutcome; slotIndex?: 0|1;
  requested: string[]; transcript: { who: "agent"|"caller"; text: string }[]; durationSec: number; }
interface Verdict { verdict: "PASS"|"FAIL"; code?: string; checks: { name: string; pass: boolean; evidence: string }[];
  checkedAt: string; oracle: `0x${string}`; signature: `0x${string}`; }
type RefusalCode = "action_not_permitted"|"proof_failed"|"no_consent"|"quiet_hours"|"duplicate_action"|"over_budget"
  |"per_call_cap_exceeded"|"payee_not_allowlisted"|"needs_human_approval"|"worker_below_reputation_floor"
  |"max_attempts_reached"|"opted_out"|"injection_detected"|"kill_switch_engaged"|"contract_not_running"
  |"contract_expired"|"proof_missing"|"slot_not_offered";
```

## Demo CSV (`demo/no-shows.csv`)

```csv
id,name,phone,email,missed_at,consent_source,demo_role
c1,Asha,+9198XXXXXXX1,you@gmail.com,2026-11-13T09:30:00+05:30,booking form opt-in 2026-10-02,you: accept slot 1
c2,Meera,+9198XXXXXXX2,friend1@gmail.com,2026-11-13T11:00:00+05:30,booking form opt-in 2026-09-18,friend: accept slot 2 (QuickDial lies first)
c3,Rahul,+9198XXXXXXX3,friend2@gmail.com,2026-11-13T12:30:00+05:30,booking form opt-in 2026-10-11,friend: social-engineering attack then decline
c4,Dev,+9198XXXXXXX4,dev@example.com,2026-11-13T15:00:00+05:30,,no consent → skipped
c5,Kiran,+9198XXXXXXX5,you+kiran@gmail.com,2026-11-13T16:30:00+05:30,booking form opt-in 2026-08-30,your 2nd number: don't answer
```
`demo_role` is ignored by the code; it's a note for you. All numbers except c4 must be verified in Twilio trial.
