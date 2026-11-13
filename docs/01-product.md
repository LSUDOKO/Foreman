# 01 · Product

## One line

**Foreman calls your no-shows, rebooks them, and charges only for confirmed rebookings.**

## The problem

Every appointment business loses money to no-shows every single day: clinics, dentists, physios, salons, gyms, tutors, driving schools. Published studies of outpatient clinics commonly report no-show rates in the mid-teens to mid-twenties percent. Today the fix is a receptionist phoning people between other tasks. It's slow, it's skipped on busy days, and nobody measures whether it works.

AI calling tools exist, but they sell **minutes and seats**. The business still carries the risk: if the calls fail, the business still pays.

## The offer

> "Give me yesterday's no-shows and your calendar. I'll call them and rebook them. You pay **$6 per confirmed rebooking** — $4 when the customer confirms, $2 when they actually show up. Wrong numbers, failed calls, polite declines: my cost, not yours."

The business never pays for effort, only for a provable outcome.

## Who buys

| Segment | Why they care | Appointment value (indicative) |
|---|---|---|
| Dental / physio / dermatology clinics | Empty chair = lost revenue, staff already paid | $40–150 |
| Salons and spas | High no-show rates, thin margins | $20–80 |
| Gyms / personal trainers | Missed sessions lead to churn | $15–60 |
| Tutors / driving schools | Calendar gaps are pure loss | $15–40 |

**First beachhead:** independent clinics with an online calendar (Cal.com, Google Calendar, Calendly). They have the data, the pain and a card.

## How Foreman makes money: the spread

```
margin per job = (confirmed outcomes × price per outcome)
               − (call attempts × cost per attempt)
               − (verifications × oracle fee)
```

Foreman absorbs the risk of attempts. **Every improvement in SERV's decisions** (who to call first, what time, which slots to offer, when to stop) means fewer attempts per outcome, which goes straight to margin. This is a much stronger revenue story than "workers earn a fee".

### Demo-run economics (testnet pieUSD; your real numbers come from the ledger)

| Line | Amount |
|---|---|
| No-shows uploaded | 5 |
| Skipped by consent gate | 1 (cost $0) |
| Call attempts | 5 (one re-hire after a lying worker) |
| Paid to phone workers (per-call) | $2.30 |
| Paid to phone workers (proven-call bonuses) | $0.60 |
| Paid to proof oracle (call checks) | $0.08 |
| **Foreman total spend** | **$2.98** |
| Confirmed rebookings | 2 |
| **Paid by business to Foreman** ($4 confirm + $2 attended, ×2) | **$12.00** |
| **Foreman margin** | **$9.02** |
| **Revenue recovered for the business** (2 × $60 appointments) | **$120.00** |

The business spends $12 and gets $120 of appointments back. Foreman makes $9.02. Both sides win, and the ledger proves it.

### At scale (illustrative, for the pitch only)

A clinic with 20 appointments/day and a 15% no-show rate has ~3 no-shows/day, ~60/month. If Foreman rebooks a third of them: 20 outcomes × $6 = **$120/month per clinic**, recovering ~$1,200 of appointments. 1,000 clinics ≈ $1.4M ARR. Say clearly in the pitch that these are assumptions, not results.

## Why now, why agents, why Kite

- **Agents can now hire agents.** Foreman doesn't need to own phone infrastructure; it rents it per call over x402 (on Kite mainnet, from catalog services like StablePhone).
- **Payment per outcome needs machine-verifiable proof and instant settlement.** Kite gives agent identities, spending limits and stablecoin settlement; x402 makes every service payable per request.
- **Reasoning quality = margin.** SERV makes small models decide like big ones, which keeps cost per attempt low.

## Positioning vs alternatives

| | Receptionist | AI call tools (per minute) | **Foreman** |
|---|---|---|---|
| Pays for | Salary | Minutes / seats | **Confirmed rebookings only** |
| Risk on failed calls | Business | Business | **Foreman** |
| Proof of result | None | Call logs | **Oracle-verified booking + customer confirmation** |
| Safety controls | Human judgment | Varies | Consent gate, allowlists, typed refusals, kill switch |

## The pitch (memorise this)

1. "No-shows cost every clinic money every day. The fix today is a receptionist phoning between patients."
2. "Foreman does the calling and rebooking, and the clinic pays **only for confirmed rebookings**."
3. "Foreman hires phone agents and pays them on Kite. A proof oracle checks every claim against the carrier, the calendar and the customer's own click. **The model never authorises a payment.**"
4. "Everyone else's agent spends money. Foreman earns it, and only when the customer confirms."
