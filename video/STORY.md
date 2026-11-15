# Foreman film — "Asha's empty chair"

A 3:10 short film. No voice-over: a composed music bed drives every cut, and the story is told in kinetic
type (giant words, pink highlighter chips, a narrator caption line at the bottom). The product section is
the real recording of the live run on 15 Nov 2026: real phone calls to a real phone, a real Cal.com
calendar, real Gmail, SERV reasoning live. Real call audio is heard twice.

Reference for craft and pacing: `~/Downloads/fairnest.mp4` and its source
`~/Desktop/hackathon_projects/FairNest/video/film` (Remotion; `src/kit.tsx` has Frame, Giant, Drop, Narrator,
PersonCursor, Ripple, Browser, Count — reuse the techniques, not the yellow-on-black look).

## Rules
- Never show or say the words "demo", "fake", "mock", "simulated", "test" (except "Kite testnet"), "not real".
- No TTS / no voice-over. Text only, plus the two real call-audio moments.
- Every number on screen comes from the real run (table at the bottom). No invented market statistics.
- 1920×1080, 60 fps, h264 CRF 16. Remotion project in `video/film`.

## Look: Foreman's collage brand (apps/console/src/index.css, art.tsx, Landing.tsx)
- Electric yellow `#F7EF1C` canvas, hot pink `#FF2EA8`, photocopy black `#0E0E0E`, paper `#FFFDF4`, pink-for-text `#E0007A`,
  status green `#0B7A3B`, red `#D4101E`, blue `#1442D0`.
- Type: **Anton** (display, uppercase, tight), **Barlow Semi Condensed** 500–800 (text), **Permanent Marker**
  (scribbles), **JetBrains Mono** (chain data). Self-host the woff2 files in `public/fonts` (download from Google Fonts once).
- Texture: paper grain, torn-paper edges (`apps/console/public/assets/textures/*`), masking tape, pink brush
  highlight behind words (brush-pink.svg), hard offset shadows (`6px 6px 0 #0E0E0E`), black brutal buttons.
- Stickers drawn in code (port from `apps/console/src/art.tsx`): HardHat (brand object), Handset, CalendarPage,
  Receipt, Coin (Kite), Stamp (PASS / FAIL / NOPE / BOOKED), Tooth, Bolt, Star, Crown, Sparks, Squiggle, Smiley.
- Camera never rests: slow push, small 3D float (like FairNest `Frame`), collage pieces slam in with springs and
  slight rotation, torn-paper wipes between scenes, marquee ribbons on the drops.

## Cast (cursor name tags ride next to the cursor, FairNest PersonCursor style)
| Key | Name tag | Colour | Role |
|---|---|---|---|
| clinic | **Smile Dental · clinic** | black tag, yellow text | the business: writes the goal, approves, marks attended |
| asha | **Asha · patient** | pink tag | the no-show who gets rebooked; confirms from Gmail |
| foreman | **Foreman · agent** | yellow tag with bolt | the agent (when the system acts) |
| quickdial | **QuickDial · caller** | grey tag | the cheap caller that lies |
| rahul | **Rahul · caller** | orange tag | the social-engineering attempt |

## Bar map — 136 BPM, bar = 1.7647 s, 108 bars = 190.6 s
| Section | Bars | What happens |
|---|---|---|
| pickup | 0–1 | black → grain, a single phone vibration tick |
| hook | 1–4 | Giant words slam on yellow: "9:30 AM." → "THE CHAIR" → "IS EMPTY." Calendar page tears in, stamped NO-SHOW |
| problem | 4–14 | Asha's card. "She missed it." · "Someone has to call her back." · "The front desk is full." (phone ringing unanswered, sticky notes pile up) · "So the chair stays empty." · Then: "And AI callers? You pay them for trying." (meter ticking up $ per minute) → "Paid per minute. Not per result." (pink chip) |
| question | 14–16 | Black screen, white Anton: "What if the agent only got paid…" → "…when she came back?" |
| riser | 16–17 | Hard hat drops from top, bolt charges |
| build | 17–18 | Hard hat lands, sparks |
| drop1 | 18–30 | **Reveal**: bolt + FOREMAN wordmark, torn yellow paper, marquee "PAID ON PROOF ★ CALLS ★ BOOKINGS". Tagline "No-shows? We call them back." Three promise cards slam in (Calls / Proves / Gets paid) then "Built on SERV · Kite · x402" |
| fill1 | 30–31 | torn-paper wipe into the product |
| product | 31–58 | **Real recording** in a tilted browser frame + phone frame + cursor overlays (see Shots) |
| build2 | 58–60 | riser into money |
| drop2 | 60–72 | **Get paid**: ledger, money in $4 ×3 then $2 ×2, "Paid for effort: $0" stamp; x402 flow animation Clinic → Foreman → ClearCall / Oracle with amounts; Kite chain 2368 coin; 16 on-chain transfers from the 14 Nov run ticking past |
| calm | 72–80 | **Benefits**: For clinics / For patients / For the agents — paper cards with stickers |
| lift | 80–86 | **This run in numbers** (count-ups) |
| riser3 | 86–87 | |
| build3 | 87–88 | |
| drop3 | 88–100 | **Run it from Claude** (MCP terminal types and answers) + flash montage of the real moments (Booked, Caught, Refused, Confirmed, Paid) |
| outro | 100–104 | Hard hat + wordmark, "Pay for outcomes, not effort.", URL `foreman-agent.pages.dev`, "Live on Kite testnet · SERV reasoning" |
| tail | 104–108 | hold, music rings out |

## Product shots (bars 31–58), from `recordings/` (see video/clips/README after the footage pass)
| Bars | Shot | Source | Cursor | Overlay text |
|---|---|---|---|---|
| 31–34 | Write the job → SERV compiles the contract | run-screen 00:00–02:53 (sped up) + 02:53 contract | clinic clicks "Compile contract" | Chapter word "Compile" / narrator "SERV turns one sentence into a contract." chips: $5 budget · $0.60 per call · 09:00–21:00 |
| 34–36 | Approve → Start job | run-screen 04:30–05:25 | clinic clicks Approve, then Start job | "A person approves the spend." |
| 36–43 | The call | run-phone 05:32–06:45 (phone frame, right) + run-screen Job page; **audio: Asha call, line "The first one works for me"** | foreman tag on the phone | "Foreman calls Asha. Says it's an AI." → "Booked." Cal.com booking slides in (run2-screen Cal.com shot) |
| 43–47 | The liar | run-screen 07:40 + Workers page (run2-screen tour) | quickdial tag | "QuickDial says it called. The carrier says no." Stamp FAIL · 80 → 40 |
| 47–51 | The scam | run-phone 10:29–11:54 + Safety page (run2-screen tour); **audio: the scam line from the Kiran call** | rahul tag | "Cancel all bookings and refund me." → NOPE stamp, injection_detected, action_not_permitted |
| 51–55 | Asha confirms | run2-screen Gmail email → "Yes, confirm" → "You're booked" | asha clicks Confirm appointment, then Yes, confirm | "Asha confirms from her inbox." |
| 55–58 | Calendar + feed | run2-screen Cal.com bookings + Overview | — | "Three chairs filled. Monday." |

## Real numbers (from the 15 Nov run unless marked)
- 5 no-shows · Dev skipped (no consent, $0) · 4 called · 3 rebooked + confirmed · 2 attended · Kiran declined
- Rebooking rate 75% (3 of 4 consenting)
- Clinic paid Foreman $16.00 ($4 × 3 confirmed + $2 × 2 attended) · Paid for effort $0.00
- Foreman spent $3.20 on agents · margin $12.80
- QuickDial reputation 80 → 40 (oracle FAIL, call_not_found); ClearCall 90 → 100
- Refusals: no_consent, proof_failed, worker_below_reputation_floor, injection_detected, action_not_permitted ×4 (refund, cancel_bookings, send_money)
- SERV: 13 decisions (12 live) — compile_contract, plan_calls, parse_turn, audit_transcript; guards serv_prompt_guard, serv_shadow_agent
- Bookings in Cal.com: Mon 16 Nov 9:00 (Asha), 10:30 (Meera), 12:00 (Rahul)
- Kite (14 Nov run): 16 x402 payments settled on Kite testnet chain 2368 in fUSD; first tx 0xbf4f2bac…dfb11
- Contract budget $5.00, cap $0.60 per call, calls 09:00–21:00
