# 04 · Proof oracles

> **The model can never be the sole authoriser of a payment.**

An LLM saying "looks good" is not verification. Foreman's money moves only on **deterministic checks against sources the worker doesn't control**: the phone carrier, the calendar, and the customer.

## Two oracles, one service

`proof-oracle` is an x402 seller on Kite testnet. Every verification costs **$0.02** and returns a signed verdict.

| Endpoint | Who calls it | What it proves | Source of truth |
|---|---|---|---|
| `POST /v1/verify/call` | Foreman, before paying a worker's bonus or acting on its result | The call really happened, connected, and lasted long enough for a real conversation | **Twilio call record** (read with oracle's own Twilio credentials) |
| `POST /v1/verify/outcome` | Business payer, before paying Foreman | The rebooking is real and the customer confirmed it | **Cal.com booking record** (business's read key) + **confirmation token store** |

## `/v1/verify/call`

Request:

```json
{ "attemptId": "att_123", "callSid": "CAxxxxxxxx", "to": "+9198xxxxxxx", "claimedStatus": "accepted", "minSeconds": 20 }
```

Checks (all must pass):

| Check | Rule | Fail code |
|---|---|---|
| Call exists | `GET /2010-04-01/Accounts/{sid}/Calls/{callSid}.json` returns 200 | `call_not_found` |
| Right number | `to` on the record equals the customer's number | `wrong_number` |
| Connected | `status == "completed"` | `call_not_completed` |
| Real conversation | `duration ≥ minSeconds` | `call_too_short` |
| Fresh | `start_time` after the attempt was created | `stale_call` |

Response:

```json
{
  "verdict": "FAIL",
  "code": "call_not_found",
  "checks": [{ "name": "call_exists", "pass": false, "evidence": "Twilio 404 for CA9f1..." }],
  "checkedAt": "2026-11-15T10:42:11Z",
  "oracle": "0xORACLE...",
  "signature": "0x..."   // EIP-191 signature by the oracle's key over sha256(canonical JSON)
}
```

> The oracle signs verdicts with its own key (`ORACLE_SIGNER_PK`, separate from its payTo) so anyone can verify a verdict later.

## `/v1/verify/outcome`

Request:

```json
{ "outcomeId": "out_77", "milestone": "confirmed", "bookingUid": "bk_abc", "expected": { "attendeeEmail": "asha@example.com", "start": "2026-11-16T10:30:00Z" }, "contractHash": "sha256:..." }
```

Checks for `milestone = "confirmed"` (exactly the contract's `proof.confirmed` list):

| Check | Rule | Fail code |
|---|---|---|
| `booking_exists` | `GET https://api.cal.com/v2/bookings/{uid}` returns the booking | `booking_not_found` |
| `booking_status_accepted` | `data.status == "accepted"` | `booking_not_accepted` |
| `attendee_matches` | an attendee's email (or phone) equals the no-show record | `attendee_mismatch` |
| `slot_matches` | `data.start == expected.start` | `slot_mismatch` |
| `customer_confirmation_click` | confirmation token for this outcome was redeemed, before expiry, from the link sent to the customer | `not_confirmed_by_customer` |

For `milestone = "attended"`: `business_attestation` — the business clicked "Attended" in the business view, which signs `{outcomeId, attended:true}` with the business key. The oracle verifies that signature. (Attendance is the business's own fact; we don't pretend to verify it independently.)

### Why the customer's click matters

Calendar read-back alone proves a booking *exists*, not that the customer *wanted* it. An agent paid per booking is tempted to book people who said "maybe". The confirmation click, from the customer's own inbox, closes that loophole. No click within 2 hours → Foreman cancels its own hold and earns nothing.

## Two-key release

| Key | Who holds it | What it unlocks |
|---|---|---|
| **Hard key** — oracle `PASS` | proof-oracle (deterministic code) | Any payment: worker bonus, Foreman invoice |
| **Soft key** — SERV shadow-agent quality score | Foreman (SERV transcript audit) | **Only reputation.** Never money. |

Concretely:
- `oracle PASS` + quality high → bonus paid, reputation +5.
- `oracle PASS` + quality low (e.g. rude, made a promise outside the contract) → bonus paid (the call did happen), reputation −15, transcript flagged for human review.
- `oracle FAIL` → no bonus, reputation −40, result discarded, re-hire if attempts remain. Quality score is irrelevant.

## Worker payment split (Foreman ↔ its own workers)

This is where the milestone idea belongs, because we control the acceptance test:

| Milestone | Amount (ClearCall) | Amount (QuickDial) | Released when |
|---|---|---|---|
| Per call attempt | $0.50 | $0.30 | Up front, via x402 when the call is requested |
| Proven-call bonus | $0.20 | $0.20 | `/v1/verify/call` PASS |

Be honest in the README: **this is buyer-enforced milestone release, not trustless escrow.** A worker could take the up-front fee and do nothing; it then loses its bonus and its reputation, and the floor stops Foreman hiring it again. A Kite escrow contract is on the roadmap (`15-roadmap-to-production.md`).

## Reputation

```
start: ClearCall 90 (seeded track record), QuickDial 80 (new)
PASS & quality ≥ 0.7   → +5   (cap 100)
PASS & quality < 0.7   → −15
FAIL                   → −40
hire only if score ≥ contract.workerPolicy.reputationFloor (50)
new workers get contract.workerPolicy.probationCallsForNewWorkers (1) probation call
```

The probation rule is why Foreman tries QuickDial once in the demo — deterministic, and realistic for a marketplace.

## Implementation notes

- Cal.com: send `Authorization: Bearer <BUSINESS_CALCOM_READ_KEY>` and the `cal-api-version` header the endpoint requires. The create-booking endpoint documents `cal-api-version: 2026-02-25`; check the get-booking page for its version value and pin both in `shared/calcom.ts`.
- Twilio: use the oracle's **own** API key (a Twilio API Key/Secret pair on the same account is fine for the hackathon; in production the carrier record would come from the worker's provider via a signed receipt).
- Cache nothing between verifications. Each call re-reads the source.
- Every verdict is written to Foreman's audit chain with the oracle's signature.
