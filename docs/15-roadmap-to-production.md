# 15 · Roadmap: from hackathon to a real business

The hackathon build proves the loop. This is how it becomes something a clinic pays for every month.

## Phase 1 — Mainnet pilot (weeks 1–4)

| Change | How |
|---|---|
| Kite mainnet | `KITE_NETWORK=mainnet` → chain 2366, USDC.e; same facilitator |
| Spending limits in Kite Passport | Foreman's budget/cap/expiry become a **Passport spending session** (total budget, per-transaction limit, time window) approved by the operator with a passkey; our firewall stays as a second layer |
| Rent calls from the Kite catalog | StablePhone (or any catalog phone service) via `ksearch services list --query phone`; one adapter maps its response to `CallResult` |
| Our oracle as a public Kite service | Publish `proof-oracle` to the Kite catalog so other agents can pay to verify bookings ("is this booking real?") — a second revenue line |
| Real business payment | Clinic funds a USDC wallet, or pays by card into a prepaid balance that tops up the business-payer wallet |
| 3 pilot clinics | Free first 50 outcomes; measure attempts per outcome and recovered revenue |

## Phase 2 — Trust without trusting us (months 2–3)

- **Escrow on Kite**: worker fees and business payments go into a small escrow contract; release requires the oracle's signed verdict (verify the oracle signature on-chain). Disputes time out to refund.
- **Independent oracle**: confirmation page hosted by the oracle (not Foreman), so Foreman can't fake a click. Carrier receipts signed by the phone service.
- **Agent identities**: register Foreman, workers and oracle with Kite agent IDs; show verifiable identity in every receipt.
- **Audit anchoring**: post each job's audit-chain head hash on Kite.

## Phase 3 — Product (months 3–6)

- **Calendar integrations**: Google Calendar, Calendly, Practo-style clinic systems, Square Appointments, Mindbody.
- **Channels**: SMS / WhatsApp confirmation (with proper sender registration per country).
- **Self-serve onboarding**: connect calendar → upload or sync no-shows → approve contract → done.
- **Daily autopilot**: every morning at 10:00, yesterday's no-shows are processed automatically within the clinic's standing contract.
- **Margin engine**: learn per clinic the best call time, slot offer and stop rule; A/B test SERV strategies; track attempts per outcome.

## Compliance (non-negotiable before real customers)

| Area | What we do |
|---|---|
| Consent | Store consent source + timestamp per customer; no consent → no call |
| AI voice rules | AI disclosure at call start; follow US TCPA consent rules for artificial/AI voices, India TRAI commercial communication rules, and each country's DNC registry |
| Data | Minimum data (name, phone, email, missed slot); encrypt at rest; delete after 30 days; DPA with each business |
| Health data | Clinics: never mention the treatment on the call ("your appointment", not "your root canal"); HIPAA/DPDP review before US/India healthcare scale |
| Recording | Don't record audio by default; keep text transcript only with notice; per-country rules |
| Opt-out | Honour immediately and permanently |

## Pricing

| Plan | Price | For |
|---|---|---|
| Pay per outcome | $6 per confirmed + attended rebooking ($4 + $2) | Default; zero risk for the business |
| Volume | $4.50 per outcome above 100/month | Multi-location clinics |
| White-label | Platform fee + per outcome | Booking software vendors embedding Foreman |

Unit target: attempts per outcome ≤ 2.5, cost per attempt ≤ $0.40 → cost per outcome ≤ $1.00 → gross margin ≥ 80%.

## Metrics we'll report

- Recovery rate (rebooked ÷ no-shows)
- Attended rate (attended ÷ rebooked)
- Attempts per outcome; cost per outcome; gross margin
- Revenue recovered per clinic per month
- Refusals by code (safety health)
- Oracle FAIL rate per worker (marketplace health)

## Beyond no-shows

The same engine — **outcome contract + rented real-world workers + deterministic proof + pay on proof** — fits other jobs:
- Waitlist fill ("fill tomorrow's cancelled slots")
- Payment reminders (paid per invoice collected, proof = payment received)
- Review collection (paid per verified review)
- Supplier calls ("find who has this part in stock", proof = written quote)
