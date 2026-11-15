# Business

Foreman sells an outcome, not software or minutes: a no-show patient who is back in the calendar and confirmed it.
This page separates **what's implemented and measured** from **what's planned** (marked *Future*). There is no
traction, revenue or partnership to report yet; Foreman was built during the SERV Hackathon and run twice.

## Who pays

**Primary customer: small appointment-based clinics**, starting with dental clinics (the demo business is "Smile
Dental", Asia/Kolkata time zone). They have a calendar, a list of no-shows every day, and a front desk with no time to
call them back.

The same flow fits any business with bookable slots and a no-show list (salons, physiotherapy, gyms, studios): the
contract, the oracle checks and the pricing don't change, only the call script and the calendar event type.

## The problem, sized with sources

| Fact | Source |
|---|---|
| Average no-show rate "of the order of 23%" across 105 studies; highest in Africa (43.0%), lowest in Oceania (13.2%) | [Dantas et al., *Health Policy* 2018, systematic review](https://pubmed.ncbi.nlm.nih.gov/29482948/) |
| Mean no-show rate 18.8% across 10 clinics; average cost **$196 per no-show** (2008); a centralised phone reminder moved the rate only from 16.3% to 15.8% | [Kheirkhah et al., *BMC Health Services Research* 2016](https://link.springer.com/article/10.1186/s12913-015-1243-z) |
| SMS reminders raise attendance compared with no reminder (RR 1.14), similar to phone reminders, at lower cost | [Cochrane review CD007458, Gurol-Urganci et al. 2013](https://www.cochrane.org/evidence/CD007458_mobile-phone-messaging-reminders-attendance-healthcare-appointments) |
| Industry estimate: missed appointments cost US healthcare **$150B a year**, about $200 per unused hour-long slot | [Healthcare Innovation, 2017](https://www.hcinnovationgroup.com/clinical-it/article/13008175/missed-appointments-cost-the-us-healthcare-system-150b-each-year): a vendor commentary (SCI Solutions), not peer-reviewed |

We have not built our own market-size model. The point the sources support: no-shows are common, each one costs a
clinic real money, and reminders reduce them only modestly. Nothing in that list *recovers* a no-show after it happens.

## Competitors and alternatives

| Alternative | How it's paid | Gap Foreman fills |
|---|---|---|
| Front desk / call centre staff | per hour | paid whether or not anyone rebooks; call-backs slip when the desk is busy |
| Reminder and patient-engagement suites: [Weave](https://www.getweave.com/), [Solutionreach](https://www.solutionreach.com/), [NexHealth](https://www.nexhealth.com/) | software subscription | reminders, texting, booking and waitlist tools; the clinic still carries the outcome risk |
| AI voice-agent platforms: [Retell AI](https://www.retellai.com/) ($0.07–$0.31/min, "no per-resolution charge"), [Vapi](https://vapi.ai/pricing) ($0.05/min hosting plus model pass-through), [Bland](https://www.bland.ai/pricing) ($0.14/min Start plan) | per minute | the clinic pays for failed calls and builds the agent itself; no independent proof of the result |
| Doing nothing | free | the slot and the patient are lost |

Prices are as published on each site, accessed 16 Nov 2026. Our claim is narrow: none of these charges only for a
proven, patient-confirmed rebooking. Foreman does.

## Pricing (implemented)

Enforced in code, configurable per deployment:

| Line | Price | Env | Where it's enforced |
|---|---|---|---|
| Confirmed rebooking (booking exists + patient tapped Confirm, oracle PASS) | **$4.00** | `INVOICE_CONFIRMED` | Foreman's x402 invoice route; contract `outcome.pricing.onConfirmed` |
| Attended visit (business-signed attestation, oracle PASS) | **$2.00** | `INVOICE_ATTENDED` | same, `onAttended` |
| Clinic's ceiling per outcome | **$6.00** | `BUSINESS_MAX_PER_OUTCOME` | business-payer refuses anything above it (`over_budget`) |
| Effort (calls, no-answers, declines, failed workers) | **$0.00** | none | Foreman pays its agents from its own wallet |

The clinic also pays the oracle **$0.02 per outcome verification** from its own payer agent, so it never has to trust
Foreman's word.

## Foreman's costs (implemented)

Foreman pays the agents it hires, per request, over x402:

| Agent | Price | Env |
|---|---|---|
| ClearCall (honest caller) | $0.50 per call | `CLEARCALL_PRICE` |
| QuickDial (cheaper caller, test worker scripted to lie) | $0.30 per call | `QUICKDIAL_PRICE` |
| Proven-call bonus (only after oracle PASS) | $0.20 | `BONUS_PRICE` |
| Proof oracle, per call verification | $0.02 | `ORACLE_PRICE` |

Plus SERV inference and, on chain, the facilitator's gas (about 66k gas per payment; a full run is about 0.03 testnet
KITE). These are not in the ledgers below.

## Unit economics from the real runs

Two runs, kept apart: the **14 Nov** run settled on Kite testnet with sandbox phone and calendar; the **15 Nov** run used
real Twilio, Cal.com and Gmail with payments in local mode (Kite testnet had stalled).

| | 14 Nov (on-chain) | 15 Nov (live calls) |
|---|---|---|
| No-shows on the list | 5 | 5 |
| Skipped, no consent ($0 spent) | 1 | 1 |
| Called | 4 | 4 |
| Rebooked and confirmed by the patient | 2 | 3 |
| Attended (attested) | 2 | 2 |
| **Clinic paid Foreman** | **$12.00** | **$16.00** |
| **Foreman paid its agents** | **$2.98** | **$3.20** |
| **Foreman margin** | **$9.02** (75%) | **$12.80** (80%) |
| Foreman cost per confirmed rebooking | $1.49 | $1.07 |
| Clinic paid for effort | $0.00 | $0.00 |

15 Nov cost per customer called, from the ledger: Asha $0.72, Meera $1.04 (QuickDial's failed $0.30 + $0.02 check, then
ClearCall), Rahul $0.72, Kiran $0.72 (proven call, declined), Dev $0.00.

The dashboard shows "recovered for the clinic: $180" for 15 Nov. That figure **assumes $60 per visit** (3 visits); it
isn't measured. Under the same assumption the clinic pays at most $6 for a $60 visit.

Five customers is a demo, not a sample. The numbers show the mechanics work and where the margin comes from, not what
rebooking rate a real clinic will see.

## Go-to-market (*Future*)

From [docs/15](docs/15-roadmap-to-production.md), none of it started yet:

1. **Pilot**: three clinics, first 50 outcomes free; measure recovery rate, attempts per outcome and recovered revenue.
2. **Self-serve**: connect a calendar, upload or sync no-shows, approve a standing contract.
3. **Daily autopilot**: yesterday's no-shows processed every morning within the clinic's standing contract.
4. **Distribution through booking software**: white-label for scheduling vendors (platform fee + per outcome).
5. **Second revenue line**: publish the proof oracle as a paid Kite service so other agents can pay to verify bookings.

Pricing ideas in docs/15 (*Future*, not in code): volume price of $4.50 per outcome above 100 a month; white-label plan.
The stated unit target there is ≤ 2.5 attempts and ≤ $0.40 per attempt, so ≤ $1.00 cost per outcome.

## Risks

| Risk | Mitigation today | Still open |
|---|---|---|
| Calling rules (TCPA for AI voices in the US, TRAI in India, DNC registries) | consent gate, AI disclosure in the first sentence, quiet hours, permanent opt-out | per-customer consent records, DNC checks, legal review per country |
| Health data | the script says "your appointment", never the treatment; phones and emails masked in exports | HIPAA / DPDP review, encryption at rest, retention limits, DPA per clinic |
| A worker lies about calls | the oracle reads the carrier record; failed proof means no bonus, reputation −40, below the floor | escrow and carrier-signed receipts |
| Foreman fakes a confirmation | the confirmation record is Foreman-signed and checked by the oracle | trust edge: move the page to the oracle or the business |
| Prompt injection on calls | `serv_prompt_guard`, 7-value intent enum, deterministic firewall | none known; keep the fixture suite growing |
| Settlement token and chain | real fUSD settlement on Kite testnet; pieUSD path verified | Kite mainnet USDC.e; testnet stalls (15 Nov) |
| Low rebooking rates in practice | outcome pricing puts this risk on Foreman, not the clinic | needs pilots to measure |

More in [docs/16](docs/16-risks-and-fallbacks.md) and [SECURITY.md](SECURITY.md).
