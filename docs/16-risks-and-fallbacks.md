# 16 · Risks and fallbacks

Retire the top two risks **first thing Saturday**. Everything else has a plan B that keeps the demo honest.

| # | Risk | How you'll know | Fallback |
|---|---|---|---|
| 1 | **Can't get test pieUSD**, or x402 payment won't settle on Kite testnet | Faucet only gives KITE; facilitator returns errors | **A.** Ask in Kite Discord for testnet pieUSD (mention you're in the SERV hackathon). **B.** Try the older testnet token from Kite's service-provider guide (`0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63`) with the facilitator. **C.** Deploy your own EIP-3009 test token on Kite testnet (gas from KITE faucet) and run a self-hosted x402 facilitator (the x402 repos include one) — label it clearly. **D (last resort).** Direct ERC-20/KITE transfers on Kite testnet with the same firewall + ledger, and say so. |
| 2 | **Twilio trial can't call your numbers** | Call fails with geo-permission or trial errors | Enable the country in Voice Geo Permissions; verify numbers; if still blocked, use the **browser softphone** (`client:` identity, `08-phone-worker.md`) — calls are still real Twilio calls with real call records for the oracle |
| 3 | SERV latency makes voice turns slow | Gaps > 3 s on calls | `reasoning_effort: "none"`/`"low"`, short prompts, "One moment" filler, **keypad fallback** after 3 s |
| 4 | SERV credits run out | 402/429 from SERV | Shadow agent only on contract + audit, not voice turns; cache planner output; top up credits if needed (it's cheap) |
| 5 | Cal.com API version differences | 4xx on bookings | Pin `cal-api-version` per endpoint (create documents `2026-02-25`); test create/get/cancel in isolation on Saturday 17:30 |
| 6 | Email lands in spam | Friends don't see the link | Use Gmail SMTP with an app password (sends from your Gmail); tell friends to check spam; console also shows the link as a fallback for rehearsal (not for the final run) |
| 7 | Friends unavailable at recording time | — | Schedule 2 slots; you can play two roles with two of your own numbers (or a family member's) |
| 8 | Cloudflare/ngrok tunnel URL changes | Twilio webhooks 404 | Named Cloudflare tunnel, or set the URL in `.env` and restart workers; check before each run |
| 9 | Replay mode breaks on Vercel | Blank page | Fallback: host the edited video + screenshots on a simple static page |
| 10 | Running out of time | Behind at a checkpoint | Use the cut lines in `11-build-plan.md`; the video and the X post are never cut |
| 11 | Secrets leak in the public repo | — | `.env` in `.gitignore`, `.env.example` only; rotate Twilio/SERV/Cal.com keys after the hackathon |
| 12 | Judges think the lying worker is cheating | — | Label it everywhere as a test worker scripted to fail; explain why (it proves the oracle) |

## Verify-before-trusting list (facts that may have changed)

- [ ] pieUSD address, decimals, EIP-712 domain on testnet Kitescan
- [ ] Facilitator `https://facilitator.pieverse.io/v2` supports `eip155:2368`
- [ ] `@x402/*` package names and the v2 payload field names
- [ ] SERV model id (`gpt-5.4-mini`) is in the catalog; `response_format` support
- [ ] Cal.com `cal-api-version` values for create / get / cancel booking and slots
- [ ] Twilio trial rules for your country
