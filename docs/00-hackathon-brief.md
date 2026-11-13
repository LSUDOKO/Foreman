# 00 · Hackathon brief

## The event

| | |
|---|---|
| Event | SERV Hackathon — Edition 02 (online), run by OpenServ |
| Page | https://www.openserv.ai/hackathon-2 |
| Prize pool | $5,000 (track winners, best overall build, special mention; breakdown TBA) |
| Our track | **Track 02 — Kite**: "Build agents with a verifiable identity and spending limits you control, so it can shop, book, and pay on your behalf, safely." |
| Hard rule | **Every track must use SERV Reasoning.** |
| Judged on | **Creativity, user readiness, revenue potential** |

## Deadline in IST

| Moment | UTC | IST |
|---|---|---|
| Submissions close | Sun 15 Nov 2026, 23:59 | **Mon 16 Nov 2026, 05:29 AM** |
| **Our internal deadline** | Sun 15 Nov, 16:30 | **Sun 15 Nov, 10:00 PM** |

Never plan to submit in the last 7 hours. Video uploads, form glitches and X posting eat time.

## What must be submitted

Form: https://openserv.typeform.com/submissions02

- [ ] **Public GitHub repo** (MIT licence, README from `docs/14-submission-kit.md`)
- [ ] **Demo link or video** — YouTube (unlisted is fine) 2–3 min, plus the public console link in replay mode
- [ ] **Short write-up**: what it does, **how it uses SERV Reasoning**, which track (Kite)
- [ ] **X post** about the project, published before the deadline; paste its link into the form
- [ ] OpenServ account + API key (needed to build; pre-registered participants got $5 SERV credits)

## How Foreman scores on each judging criterion

| Criterion | What we show | Where |
|---|---|---|
| **Creativity** | An agent that *earns* money for outcomes instead of spending it; a two-sided agent economy (business ↔ Foreman ↔ workers ↔ oracle) on Kite; a human voice as the attack vector | Demo moments 3 and 4 |
| **User readiness** | Works end to end with real phone calls and a real calendar; typed refusals; kill switch; consent gate; idempotency; public replay link anyone can click through | Console + replay mode |
| **Revenue potential** | Clear buyer (any appointment business), recurring daily pain, pay-per-outcome pricing, margin ledger that proves unit economics | Ledger page, `01-product.md` |

## How Foreman satisfies "uses SERV Reasoning" (be explicit in the write-up)

SERV makes five decisions, all logged with their reasoning:

1. **Compile** the business goal into a typed outcome contract (with `serv_shadow_agent` validating completeness).
2. **Plan** call order and which two slots to offer each customer.
3. **Choose** which worker to hire from quotes + reputation.
4. **Understand** each spoken turn on the call as a strict intent (with `serv_prompt_guard`, because a human voice is untrusted input).
5. **Audit** each transcript for quality and unauthorised promises (shadow agent) — feeds reputation only, never money.

## How Foreman satisfies the Kite track

- **Verifiable identity**: each agent (Foreman, two phone workers, oracle, business payer) has its own wallet address on Kite; identities are shown in the console with Kitescan links.
- **Spending limits you control**: outcome contract sets total budget, per-call cap, payee allowlist, expiry; enforced in code before any signature, and visible in the console.
- **Shop, book and pay safely**: Foreman *books* real appointments and *pays* other agents over x402 on Kite; the business pays Foreman only after deterministic proof.
- Built on Kite's own building blocks: Kite testnet (chain 2368), x402 v2 with the Pieverse facilitator, network constants from the **kite-x402-hono** priority repo.

## Rules to respect

- Existing projects are allowed if a meaningful feature is added. **Foreman is new**, built during the event — say so.
- Be honest about what is testnet and what is trial (see `14-submission-kit.md` for exact wording).
- Only call phone numbers whose owners agreed (you and friends). See `05-safety-firewall.md`.

## Help channels

- X: [@openservai](https://x.com/openservai)
- Telegram: https://t.me/openservai
- Discord (developer questions): https://discord.com/invite/9u724WsWCU
- Kite docs: https://docs.gokite.ai · Kite Discord for testnet token questions
