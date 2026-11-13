# 03 · The outcome contract

**No contract, no job. No proof spec, no contract.**

Before Foreman spends anything, SERV compiles the business's goal into a typed `OutcomeContract`. The firewall enforces it; the oracles check against it; the console shows it. The business approves it with one click before the job starts.

## Input → contract

Business goal (typed in the console):

> "Call yesterday's no-shows from the CSV and rebook them into free check-up slots this week. Don't spend more than $5 on calls. Only call people who opted in. Calls between 9 AM and 9 PM."

SERV turns this into the contract below (validated by zod; anything missing → the compiler asks the business to fill it in; the shadow agent's hint checks every required field is grounded in the goal or defaults).

## Schema (TypeScript, the source of truth)

```ts
// packages/shared/src/contract.ts
import { z } from "zod";

export const Address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const OutcomeContract = z.object({
  id: z.string(),                         // "ctr_01H..."
  version: z.literal(1),
  business: z.object({
    name: z.string(),                     // "Smile Dental"
    timeZone: z.string(),                 // "Asia/Kolkata"
    payerWallet: Address,                 // business-payer address
  }),
  goal: z.string(),                       // the original text, verbatim
  outcome: z.object({
    kind: z.literal("confirmed_rebooking"),
    calendar: z.object({
      provider: z.literal("calcom"),
      eventTypeId: z.number(),
      searchWindowDays: z.number().int().min(1).max(14),
    }),
    pricing: z.object({                   // what the business pays Foreman
      currency: z.literal("pieUSD"),
      onConfirmed: z.string(),            // "4.00"
      onAttended: z.string(),             // "2.00"
    }),
    proof: z.object({                     // the acceptance test, agreed up front
      confirmed: z.array(z.enum([
        "booking_exists",                 // GET booking returns it
        "booking_status_accepted",
        "attendee_matches",               // email/phone match the no-show record
        "slot_matches",                   // start time = the slot the customer accepted
        "customer_confirmation_click",    // signed token redeemed by the customer
      ])).min(5),
      attended: z.array(z.enum(["business_attestation"])).min(1),
    }),
  }),
  spend: z.object({                       // Foreman's own limits
    currency: z.literal("pieUSD"),
    totalBudget: z.string(),              // "5.00"
    perCallCap: z.string(),               // "0.60"
    perCustomerMaxAttempts: z.number().int().min(1).max(3),
    payeeAllowlist: z.array(Address).min(1), // worker + oracle payTo addresses
    expiresAt: z.string(),                // ISO
  }),
  permittedActions: z.array(z.enum([
    "place_call",
    "offer_slot",
    "create_booking",
    "cancel_own_unconfirmed_booking",
    "send_confirmation_email",
  ])),
  forbiddenActions: z.array(z.string()),  // informational; firewall denies anything not permitted
  consent: z.object({
    required: z.literal(true),
    source: z.string(),                   // "CSV column consent_source"
  }),
  callPolicy: z.object({
    allowedHours: z.object({ start: z.string(), end: z.string() }), // "09:00","21:00" business TZ
    aiDisclosure: z.literal(true),        // first sentence of every call
    maxCallSeconds: z.number().int().max(180),
    honourOptOut: z.literal(true),
  }),
  workerPolicy: z.object({
    reputationFloor: z.number().int(),    // 50 — below this a worker is never hired
    probationCallsForNewWorkers: z.number().int().min(0).max(1), // 1
    bonusOnProvenCall: z.string(),        // "0.20"
  }),
  approval: z.object({
    approvedBy: z.string().nullable(),    // business user, set on approve
    approvedAt: z.string().nullable(),
    humanApprovalAbove: z.string(),       // any single payment above this needs a click: "1.00"
  }),
});
export type OutcomeContract = z.infer<typeof OutcomeContract>;
```

## Example (what the console shows)

```json
{
  "id": "ctr_demo_001",
  "version": 1,
  "business": { "name": "Smile Dental", "timeZone": "Asia/Kolkata", "payerWallet": "0xBUSINESS..." },
  "goal": "Call yesterday's no-shows ... Calls between 9 AM and 9 PM.",
  "outcome": {
    "kind": "confirmed_rebooking",
    "calendar": { "provider": "calcom", "eventTypeId": 123456, "searchWindowDays": 7 },
    "pricing": { "currency": "pieUSD", "onConfirmed": "4.00", "onAttended": "2.00" },
    "proof": {
      "confirmed": ["booking_exists","booking_status_accepted","attendee_matches","slot_matches","customer_confirmation_click"],
      "attended": ["business_attestation"]
    }
  },
  "spend": {
    "currency": "pieUSD", "totalBudget": "5.00", "perCallCap": "0.60",
    "perCustomerMaxAttempts": 2,
    "payeeAllowlist": ["0xCLEARCALL...", "0xQUICKDIAL...", "0xORACLE..."],
    "expiresAt": "2026-11-15T18:30:00Z"
  },
  "permittedActions": ["place_call","offer_slot","create_booking","cancel_own_unconfirmed_booking","send_confirmation_email"],
  "forbiddenActions": ["cancel_existing_bookings","issue_refund","change_prices","share_customer_data"],
  "consent": { "required": true, "source": "CSV column consent_source" },
  "callPolicy": { "allowedHours": { "start": "09:00", "end": "21:00" }, "aiDisclosure": true, "maxCallSeconds": 150, "honourOptOut": true },
  "workerPolicy": { "reputationFloor": 50, "probationCallsForNewWorkers": 1, "bonusOnProvenCall": "0.20" },
  "approval": { "approvedBy": null, "approvedAt": null, "humanApprovalAbove": "1.00" }
}
```

## Rules the compiler must follow

- **The model never writes an address.** SERV outputs names ("ClearCall", "oracle"); the server resolves them from its own registry (`workers.json`). Any address in model output is discarded.
- Money fields are strings with ≤ 2 decimals; the server converts to token units (pieUSD has 18 decimals).
- Defaults when the goal is silent: `perCustomerMaxAttempts=2`, `maxCallSeconds=150`, `reputationFloor=50`, `humanApprovalAbove="1.00"`, `searchWindowDays=7`.
- `permittedActions` can only be a subset of the five above. The business cannot add `issue_refund` through the goal text; the compiler rejects it with `action_not_supported`.
- The compiled contract is hashed (`sha256` of canonical JSON). The hash is stored on every event and shown in the console. Changing the contract means a new id.

## Lifecycle

`draft → approved → running → (paused by kill switch) → completed | expired`

- Only `approved`/`running` contracts can spend.
- `expiresAt` passing moves it to `expired`; outstanding unconfirmed bookings are cancelled (`cancel_own_unconfirmed_booking`) so the business's calendar isn't left with ghost holds.
