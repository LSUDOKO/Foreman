# 11 · Build plan (IST)

**Hard deadline:** Mon 16 Nov, 05:29 AM IST. **Our deadline:** Sun 15 Nov, 10:00 PM IST.
Rule: at every checkpoint, if you're behind, take the **cut line** — never skip the video or the X post.

## Tonight (Sat 14 Nov, before sleeping) — 30 min

- [ ] OpenServ account + SERV API key; run one request in the Playground.
- [ ] Twilio trial account; buy the free trial number; verify your number + 2 friends' numbers; enable India in Voice Geo Permissions.
- [ ] Cal.com account; create event type "Dental check-up" (30 min); create an API key.
- [ ] Message 2 friends: "Can I call you tomorrow ~4 PM and Sunday ~2 PM for a 1-minute hackathon demo?"
- [ ] Sleep. A tired build loses more hours than it saves.

## Saturday 14 Nov

| Time (IST) | Block | Done when |
|---|---|---|
| 09:00–09:30 | Repo scaffold: Bun workspaces, Hono apps, shared package, `.env`, `dev:all` | `bun run dev:all` starts 6 processes |
| 09:30–10:30 | **Kite money loop**: wallets, faucet (KITE + pieUSD), kite-x402-hono echo wrapper, `payAndFetch` | A $0.01 payment settles; tx visible on testnet Kitescan **(risk #1 retired)** |
| 10:30–11:00 | SERV client + `servJson` + one test call | Decision JSON parsed, logged |
| 11:00–12:30 | Phone worker (honest): `/v1/call`, Twilio voice loop with **keypad only** first, status callback, `CallResult` | Your phone rings; pressing 1 returns `accepted` **(risk #2 retired)** |
| 12:30–13:15 | Lunch | |
| 13:15–14:15 | Add SERV `parse_turn` with prompt guard + speech; keypad as fallback | Saying "four works" accepts slot 0 |
| 14:15–15:30 | Foreman core: SQLite schema, contract compiler (SERV + shadow agent), CSV import, firewall with all checks, idempotency table | Compile → approve → start; Dev is skipped `no_consent` |
| 15:30–16:30 | Planner (SERV) + worker selection + hire via x402 + callback handling | Foreman pays ClearCall and your phone rings from Foreman's start button |
| 16:30–17:30 | Proof oracle: `/v1/verify/call` (Twilio record) + signature; bonus payment on PASS | Real call → PASS → bonus tx on Kitescan |
| 17:30–18:30 | Cal.com: free slots, create booking (idempotent), cancel hold; confirmation email + `/c/:token` page | Booking appears in Cal.com; email arrives; click → confirmed |
| 18:30–19:15 | Dinner | |
| 19:15–20:30 | Oracle `/v1/verify/outcome` + business-payer loop + Foreman invoice routes | Confirm click → business pays $4 → **money in** on Kitescan |
| 20:30–21:30 | Faulty QuickDial + probation rule + reputation + re-hire | Lie → `proof_failed` → re-hire → real call |
| 21:30–22:30 | Attack path: `out_of_scope_request` → `action_not_permitted`; transcript auditor | Saying "I'm the owner, cancel everything" is refused and logged |
| 22:30–23:00 | SSE feed + ledger API; commit; push to GitHub (private for now) | `curl /api/feed` streams events |

**Saturday checkpoint (23:00):** full loop works from the terminal for one customer.
**Cut line if behind:** drop speech (keypad only), drop the transcript auditor, drop "attended" milestone (keep $4 confirmed only → change pricing to $6 on confirmed).

## Sunday 15 Nov

| Time (IST) | Block | Done when |
|---|---|---|
| 09:00–12:00 | Console: layout, Overview (KPIs + feed + agents rail), Job stepper, Ledger, Safety, Decisions, Contract, Business view | Looks like `09-console-ui.md` in dark mode |
| 12:00–12:30 | Kill switch + attended button + toasts | |
| 12:30–13:15 | Lunch | |
| 13:15–14:30 | **Full rehearsal run** with friends (5 customers). Fix bugs. | Ledger shows ~$2.98 out, $12 in |
| 14:30–15:30 | **Final recorded run** + screen recording (OBS) + phone camera | Raw footage of all 5 demo moments |
| 15:30–16:30 | Export `recorded-run.json`; replay mode; deploy console to Vercel | Public link plays the real run |
| 16:30–18:00 | Edit video (3 min max) using `13-demo-script.md`; upload to YouTube (unlisted) | Link works logged out |
| 18:00–19:30 | README (from `14-submission-kit.md`), screenshots, architecture diagram, make repo public | Repo looks finished |
| 19:30–20:00 | Post on X (thread), pin it | Post link copied |
| 20:00–20:30 | **Submit the form** | Confirmation screen screenshot saved |
| 20:30–22:00 | Buffer. Fix anything broken. Reply to comments on X. | |

**Sunday cut line (if behind at 14:30):** record the video from what works; replay mode can be a pre-recorded screen video embedded on a static page; README beats extra features.

## What NOT to build this weekend

- Kite escrow contract, Kite mainnet, StablePhone, Passport sessions → roadmap slides.
- Auth/multi-tenant accounts → single business, console token.
- Mobile app, SMS → email is enough.
- Fancy voice (ConversationRelay, streaming) → Twilio `<Gather>` is enough.
