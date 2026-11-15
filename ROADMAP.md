# Roadmap

Where Foreman is after the hackathon and what it takes to become something a clinic pays for every month. Based on
[docs/15](docs/15-roadmap-to-production.md) and the known limits listed in the README and [SECURITY.md](SECURITY.md).
Nothing below "Done" has been started. Timings are targets, not commitments.

## Done (0.1.0, 14–15 Nov 2026)

- Outcome contract compiled by SERV, approved by a human, enforced by a deterministic firewall (18 refusal codes)
- Phone workers as x402 sellers; an honest one and a test worker scripted to lie
- Proof oracle with signed verdicts for calls (carrier record) and outcomes (calendar + patient click, or business attestation)
- Business payer agent that verifies before it pays
- Real x402 settlement on Kite testnet in fUSD through a self-hosted facilitator (16/16 payments on 14 Nov); pieUSD path verified with Pieverse
- Live run with real Twilio calls, Cal.com bookings and Gmail confirmations (15 Nov)
- Hash-chained audit log, anchor script, replayable console on Cloudflare Pages, MCP server on a Cloudflare Worker
- 105 tests at release and a five-customer e2e in CI

## Phase 1: mainnet pilot (weeks 1–4)

| Change | How |
|---|---|
| Kite mainnet | `KITE_NETWORK=mainnet` → chain 2366, USDC.e (constants already in [`kite.ts`](packages/shared/src/kite.ts)); Pieverse facilitator |
| Spending limits in Kite Passport | Foreman's budget, per-payment cap and expiry become a Passport spending session approved with a passkey; the firewall stays as a second layer |
| Rent calls from the Kite catalog | a phone service from the catalog behind one adapter that maps its response to `CallResult` |
| Oracle as a public Kite service | other agents pay to ask "is this booking real?"; a second revenue line |
| Real business payment | clinic funds a USDC wallet, or a card top-up feeds the payer wallet |
| Three pilot clinics | first 50 outcomes free; measure attempts per outcome and recovered revenue |
| Server deployment | agents on stable HTTPS hosts instead of quick tunnels; secrets from a secret store |

## Phase 2: trust without trusting us (months 2–3)

- **Escrow on Kite.** Worker fees and business payments go into a small escrow contract; release requires the oracle's signed verdict, verified on chain; disputes time out to a refund. Today milestone payments are buyer-enforced, not trustless.
- **Independent confirmation.** Host the confirmation page at the oracle (or the business), so Foreman can't fake a click. Carrier receipts signed by the phone service.
- **Agent identities.** Register Foreman, the workers and the oracle with Kite agent IDs; show verifiable identity in every receipt.
- **Audit anchoring by default.** Post each job's audit-chain head on Kite automatically ([`scripts/anchor.ts`](scripts/anchor.ts) does it by hand today).

## Phase 3: product (months 3–6)

- Calendars: Google Calendar, Calendly, clinic practice-management systems, Square Appointments, Mindbody
- Channels: SMS or WhatsApp confirmation with proper sender registration per country
- Self-serve onboarding: connect calendar → sync no-shows → approve a standing contract
- Daily autopilot: yesterday's no-shows processed every morning within the standing contract
- Margin engine: learn per clinic the best call time, slot offer and stop rule; A/B test SERV strategies
- Scale-out: parallel customers per contract, Postgres instead of SQLite, push instead of the payer's 10 s poll

## Compliance (before any real customer)

| Area | Plan |
|---|---|
| Consent | store consent source and timestamp per customer; no consent, no call (the gate exists; the records don't) |
| AI voice rules | AI disclosure at call start (done); US TCPA rules for artificial/AI voices, India TRAI rules, each country's DNC registry |
| Data | minimum data; encrypt at rest; delete after 30 days; DPA with each business |
| Health data | never mention the treatment on the call (done); HIPAA / DPDP review before healthcare scale |
| Recording | off by default (done: `TWILIO_RECORD` is opt-in); text transcript only, with notice |
| Opt-out | honoured immediately and permanently (done) |

## Metrics we'll report from pilots

Recovery rate (rebooked ÷ no-shows) · attended rate · attempts per outcome · cost per outcome · gross margin · revenue
recovered per clinic per month · refusals by code · oracle FAIL rate per worker.

## Beyond no-shows

The same engine (outcome contract + rented real-world workers + deterministic proof + pay on proof) fits other jobs:
waitlist fill, payment reminders (proof = payment received), review collection (proof = verified review), supplier
calls (proof = written quote).
