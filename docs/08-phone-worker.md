# 08 · Phone worker

One codebase, two instances:

| Instance | Port (public, x402) | Port (upstream) | Price/call | Mode |
|---|---|---|---|---|
| **ClearCall** | 4100 | 4110 | $0.50 | `honest` |
| **QuickDial** | 4101 | 4111 | $0.30 | `faulty` (demo only, clearly labelled) |

Both behave like a StablePhone-style service: you give them a number and instructions; they run the conversation and return a structured result.

## API

`POST /v1/call` (x402-paid)

```json
{
  "attemptId": "att_123",
  "to": "+9198XXXXXXXX",
  "business": "Smile Dental",
  "customerName": "Asha",
  "missed": "2026-11-13T09:30:00+05:30",
  "offers": ["2026-11-16T10:30:00Z", "2026-11-16T12:00:00Z"],
  "timeZone": "Asia/Kolkata",
  "maxSeconds": 150,
  "callbackUrl": "https://<foreman-public>/api/worker-result"
}
```

Immediate response: `{ "attemptId": "att_123", "callSid": "CA…", "status": "dialing" }`.
When the call ends the worker POSTs a `CallResult` to `callbackUrl` (signed with an HMAC shared secret per worker):

```json
{
  "attemptId": "att_123",
  "callSid": "CA…",
  "outcome": "accepted | declined | no_answer | opted_out | wrong_person | out_of_scope_only | failed",
  "slotIndex": 0,
  "requested": [],
  "transcript": [ { "who": "agent", "text": "Hi, this is an AI assistant calling on behalf of Smile Dental…" }, { "who": "caller", "text": "Yes, four works." } ],
  "durationSec": 64
}
```

`GET /calls/:attemptId` (free) returns the same for polling.

## Voice loop (Twilio, trial account)

```
POST /v1/call
  → twilio.calls.create({ to, from: TWILIO_FROM, url: PUBLIC/twilio/voice/:attemptId,
                          statusCallback: PUBLIC/twilio/status/:attemptId,
                          statusCallbackEvent: ["completed"], timeLimit: maxSeconds })

POST /twilio/voice/:attemptId   (first turn)
  → TwiML:
    <Say>Hi, this is an AI assistant calling on behalf of Smile Dental. We missed you at your appointment on Friday.
         Would you like to rebook? I have Monday at 4 PM, or Monday at 5:30 PM.</Say>
    <Gather input="speech dtmf" action="/twilio/turn/:attemptId" speechTimeout="auto" numDigits="1" timeout="6"/>
    <Say>I didn't catch that. We'll send you an email instead. Goodbye.</Say>

POST /twilio/turn/:attemptId    (each turn; Twilio sends SpeechResult or Digits)
  → if Digits: 1 → accept slot 0, 2 → accept slot 1, 9 → decline
  → else SERV parse_turn (with serv_prompt_guard), 3 s timeout → keypad fallback
  → switch intent:
      accept_slot          → <Say>Great, Monday at 4 PM. You'll get an email to confirm it. Thank you!</Say><Hangup/>
      decline              → <Say>No problem. Have a good day.</Say><Hangup/>
      ask_other_time       → offer next two slots once (if provided), else decline politely
      opt_out              → <Say>Understood, we won't call again.</Say><Hangup/>
      wrong_person         → <Say>Sorry for the trouble. Goodbye.</Say><Hangup/>
      out_of_scope_request → <Say>I can only help reschedule your own appointment. For anything else, please contact Smile Dental directly.</Say>
                             then re-ask the slot question once (record requested[])
      unclear              → re-ask once, then keypad fallback

POST /twilio/status/:attemptId  (call ended) → assemble CallResult → POST callbackUrl
```

Voice: `<Say voice="Polly.Aditi">` (or any Twilio-supported voice) for a friendly Indian-English voice; set `language="en-IN"` on `<Gather>` for better recognition.

Twilio **trial** constraints (plan around them, mention them in the video):
- You can only call **verified** numbers (add your and your friends' numbers in the Twilio console: Phone Numbers → Verified Caller IDs).
- A short trial notice plays first and the callee may need to press a key. Say in the video: "Twilio trial notice — production uses a paid number."
- Enable the destination country in **Voice Geographic Permissions** (e.g. India) before the first call.
- Trial credit is limited: each test call costs a little of it. Do your rehearsals on the keypad path, which is shorter.

## Faulty mode (QuickDial)

Purpose: prove the oracle catches a convincing lie. In `faulty` mode the worker:
1. Accepts the x402 payment.
2. **Does not place a call.**
3. Waits 20–40 s (so it "feels" real), then posts a `CallResult` with `outcome: "accepted"`, a plausible fake `callSid` (`CA` + 32 hex chars), `durationSec: 71`, and a natural-sounding transcript in which the customer happily accepts the second slot.

Make the lie convincing. If a human would have believed it, the oracle catching it is the whole point. The console labels QuickDial with a small "test worker — scripted to fail" badge in **replay mode** and in the README, so nobody thinks we're hiding it.

## Softphone fallback (if real PSTN calls are blocked)

If Twilio can't reach your country's numbers on trial, use a **browser softphone**: a `/softphone` page in the worker using the Twilio Voice JavaScript SDK with an access token for identity `customer-asha`. `calls.create({ to: "client:customer-asha", ... })` rings the browser tab instead of a phone. Everything else (Gather, SERV, oracle reading the Twilio call record) stays identical. Film the laptop tab ringing instead of the phone.

## What the worker must never do

- Never speak a number, price, refund or cancellation that isn't in the fixed templates.
- Never offer slots other than the ones Foreman sent.
- Never call outside `maxSeconds` (`timeLimit` enforces it on Twilio's side).
- Never return a result without the `callSid` the oracle needs.

## Environment (per instance)

```
WORKER_NAME=ClearCall
WORKER_MODE=honest            # or faulty
PORT=4110                     # upstream (behind the x402 wrapper on 4100)
PUBLIC_BASE_URL=https://clearcall-xyz.trycloudflare.com
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1XXXXXXXXXX      # your trial number
WORKER_HMAC_SECRET=...        # shared with Foreman for result callbacks
SERV_API_KEY=...
SERV_MODEL=gpt-5.4-mini
```
