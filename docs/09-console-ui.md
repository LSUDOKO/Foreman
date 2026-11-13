# 09 · Console UI — make it look professional

The console is what judges remember. Aim for **"mission control for an agent that earns money"**: calm, dense, precise. Think Linear / Stripe dashboard, not a hackathon template.

## Stack

Vite + React + TypeScript + Tailwind + **shadcn/ui** (Card, Table, Badge, Button, Dialog, Sheet, Tabs, Tooltip, Sonner toasts) + **lucide-react** icons + **Recharts** (one small chart) + **framer-motion** (feed item entrance only). Live data via SSE `GET /api/feed`.

## Visual system

| Token | Value | Use |
|---|---|---|
| Background | `#0B0D12` (dark) / `#FAFAF9` (light) | Page |
| Surface | `#12151C` / `#FFFFFF` | Cards |
| Border | `#222733` / `#E7E5E4` | 1px everywhere, no heavy shadows |
| Text | `#E6E8EE` / `#1C1917`, muted `#8A93A6` / `#78716C` | |
| Accent | `#7C5CFF` (violet) | Primary buttons, active tab, Foreman's identity |
| Money in | `#22C55E` | Business → Foreman |
| Money out | `#F59E0B` | Foreman → workers/oracle |
| Refusal | `#EF4444` | Typed refusals, kill switch |
| Proof | `#38BDF8` | Oracle verdicts |
| Fonts | **Inter** (UI), **JetBrains Mono** (amounts, hashes, addresses, codes) | |

Rules: amounts always mono and right-aligned; addresses shortened `0x38…621A` with copy + Kitescan link; refusal codes rendered as mono red badges (`action_not_permitted`); every timestamp relative ("12s ago") with absolute on hover. Default to dark mode for the video.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Foreman   Smile Dental ▾   Contract ctr_demo_001 · running · sha256:9f1c…   [LIVE] │ [■ KILL] │
├───────────────┬──────────────────────────────────────────────────────┬───────────────┤
│ Overview      │  KPI ROW                                              │ AGENTS        │
│ Job           │  Recovered  Outcomes  Spend      Earned   Margin      │ ◆ Foreman     │
│ Ledger        │  $120.00    2 / 5     $2.98      $12.00   $9.02       │ ☎ ClearCall 95│
│ Workers       │  ──────────────────────────────────────────────────  │ ☎ QuickDial 40│
│ Safety        │  LIVE FEED (newest on top)                            │ ⚖ Oracle      │
│ Decisions     │  10:42:11  ⚖ proof_failed · call_not_found  QuickDial │ 🏥 Smile Dental│
│ Contract      │  10:41:30  ☎ QuickDial: "accepted 17:30" (claim)      │               │
│ Business view │  10:41:02  $ −0.30 → QuickDial  tx 0x8a…  ↗           │ BUDGET        │
│               │  10:40:58  ◆ SERV: hire QuickDial (probation)         │ ███████░ 2.98 │
│ ─────────     │  10:39:12  ✓ Asha confirmed 16:00                     │ of 5.00       │
│ Replay ▶      │  ...                                                  │               │
└───────────────┴──────────────────────────────────────────────────────┴───────────────┘
```

## Pages

### Overview
- KPI row (5 cards): **Revenue recovered for business**, **Outcomes confirmed / no-shows**, **Foreman spend**, **Foreman earned**, **Margin** (with a tiny sparkline).
- **Live feed**: every event, icon by actor, colour by type. Clicking an item opens a side **Sheet** with full detail (transcript, oracle checks with evidence, SERV reasoning, tx links).
- Right rail: agent identities with reputation and Kitescan links; budget bar (spent / total, turns amber at 80%).

### Job
A table, one row per no-show, with a status **stepper**:
`Eligible → Planned → Calling → Call verified → Booked → Confirmation sent → Confirmed → Paid → Attended → Paid`
Skipped/refused rows show the refusal badge instead (e.g. Dev — `no_consent`, $0). Hover a step for its timestamp and evidence.

### Ledger
Two columns side by side: **Money in** (green) and **Money out** (amber). Each line: time, from → to (identities), purpose, amount (mono), tx hash ↗ Kitescan, oracle verdict link. Footer: totals and **margin**. Export CSV button. This page is the closing shot of the video.

### Workers
Cards per worker: name, payTo, price per call, bonus, reputation (big number + history chart), calls, PASS rate, last verdict. QuickDial shows the drop 80 → 40 with the `proof_failed` event marked on the chart.

### Safety
Table of every typed refusal: time, code (red mono badge), actor, requested action, evidence (e.g. transcript excerpt "I'm the owner, cancel everything…"), contract clause that blocked it. Filter chips by code. Kill switch status and history.

### Decisions
Every SERV call: purpose, model, effort, latency, tokens, decision JSON, reason text, and whether `serv_prompt_guard` / `serv_shadow_agent` were active. This page proves "how SERV powers it".

### Contract
Pretty view of the `OutcomeContract`: plain-English summary on the left ("Foreman may spend up to $5.00 on calls, max $0.60 per payment, only to ClearCall, QuickDial and the Oracle, until 15 Nov 18:30 UTC…"), raw JSON with hash on the right. **Approve** button (business) when in draft.

### Business view
What the clinic sees: outcomes awaiting payment, "Mark attended" buttons, invoices paid, total recovered. Separate colour accent (green) so it's obviously the other party.

## Customer confirmation page (`/c/:token`, served by Foreman)

Mobile-first, white, the business's name and logo initial, nothing about crypto:

```
            🦷 Smile Dental
   Confirm your new appointment
   Monday 16 Nov · 4:00 PM (IST)
   Dental check-up · 30 min
   [ Yes, confirm ]   [ Not anymore ]
   You were called by Smile Dental's AI assistant.
```
After click: "You're booked. See you Monday." Token is single-use, expires in 2 h, signed (HMAC) and bound to the outcome id.

## Replay mode (the public demo link)

- `demo/recorded-run.json` = the full event list exported from a real run (`GET /api/export`), including real tx hashes.
- The console detects `?replay=1` (or no backend) and plays events on a timer: speed 1× / 4× / 10×, pause, scrub bar with markers for the five demo moments.
- A small banner: "Replay of a real run on Kite testnet · 15 Nov 2026 · all tx links are live." Kitescan links work because the transactions are real.
- Build with `VITE_REPLAY_ONLY=1` and deploy to Vercel → this is the link in the submission form.

## Micro-interactions that sell it

- New feed items slide in (150 ms), money items flash their colour once.
- KPI numbers count up when they change.
- Refusals shake the badge once (subtle).
- Kill switch: confirm dialog "Type SMILE DENTAL to stop all spending".
- Toasts (Sonner) for: payment settled, oracle PASS/FAIL, customer confirmed.

## Accessibility and polish checklist

- [ ] Every colour-coded item also has an icon or text label.
- [ ] Contrast AA on both themes.
- [ ] Empty states written ("No refusals yet — the firewall hasn't had to say no.").
- [ ] Loading skeletons, not spinners.
- [ ] Favicon, page title "Foreman — outcome agent", Open Graph image (screenshot of the ledger) for the X post preview.
