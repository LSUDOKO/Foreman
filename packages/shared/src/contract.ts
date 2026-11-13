import { z } from "zod";
import { hashOf } from "./canonical";
import { isUsd } from "./money";

export const Address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const Usd = z.string().refine(isUsd, "money must be a decimal string with ≤ 2 decimals");

export const PERMITTED_ACTIONS = [
  "place_call", "offer_slot", "create_booking", "cancel_own_unconfirmed_booking", "send_confirmation_email",
] as const;
export const PermittedAction = z.enum(PERMITTED_ACTIONS);
export type PermittedAction = z.infer<typeof PermittedAction>;

export const CONFIRMED_PROOF = [
  "booking_exists", "booking_status_accepted", "attendee_matches", "slot_matches", "customer_confirmation_click",
] as const;

export const ContractStatus = z.enum(["draft", "approved", "running", "paused", "completed", "expired"]);
export type ContractStatus = z.infer<typeof ContractStatus>;

export const OutcomeContract = z.object({
  id: z.string(),
  version: z.literal(1),
  business: z.object({ name: z.string(), timeZone: z.string(), payerWallet: Address }),
  goal: z.string(),
  outcome: z.object({
    kind: z.literal("confirmed_rebooking"),
    calendar: z.object({
      provider: z.literal("calcom"),
      eventTypeId: z.number(),
      searchWindowDays: z.number().int().min(1).max(14),
    }),
    pricing: z.object({ currency: z.literal("pieUSD"), onConfirmed: Usd, onAttended: Usd }),
    proof: z.object({
      confirmed: z.array(z.enum(CONFIRMED_PROOF)).min(5),
      attended: z.array(z.enum(["business_attestation"])).min(1),
    }),
  }),
  spend: z.object({
    currency: z.literal("pieUSD"),
    totalBudget: Usd,
    perCallCap: Usd,
    perCustomerMaxAttempts: z.number().int().min(1).max(3),
    payeeAllowlist: z.array(Address).min(1),
    expiresAt: z.string().datetime(),
  }),
  permittedActions: z.array(PermittedAction),
  forbiddenActions: z.array(z.string()),
  consent: z.object({ required: z.literal(true), source: z.string() }),
  callPolicy: z.object({
    allowedHours: z.object({ start: z.string().regex(/^\d\d:\d\d$/), end: z.string().regex(/^\d\d:\d\d$/) }),
    aiDisclosure: z.literal(true),
    maxCallSeconds: z.number().int().min(30).max(180),
    honourOptOut: z.literal(true),
  }),
  workerPolicy: z.object({
    reputationFloor: z.number().int().min(0).max(100),
    probationCallsForNewWorkers: z.number().int().min(0).max(1),
    bonusOnProvenCall: Usd,
  }),
  approval: z.object({
    approvedBy: z.string().nullable(),
    approvedAt: z.string().nullable(),
    humanApprovalAbove: Usd,
  }),
});
export type OutcomeContract = z.infer<typeof OutcomeContract>;

/** Hash covers the terms, not the approval stamp, so approving doesn't change the contract's identity. */
export function contractHash(c: OutcomeContract): string {
  const { approval, ...terms } = c;
  return hashOf({ ...terms, approval: { humanApprovalAbove: approval.humanApprovalAbove } });
}

/** One-paragraph plain-English summary shown next to the JSON. */
export function describeContract(c: OutcomeContract, names: Record<string, string> = {}): string {
  const payees = c.spend.payeeAllowlist.map((a) => names[a.toLowerCase()] ?? a).join(", ");
  const h = c.callPolicy.allowedHours;
  return [
    `Foreman may spend up to $${c.spend.totalBudget} on calls, at most $${c.spend.perCallCap} per payment, only to ${payees}, until ${c.spend.expiresAt}.`,
    `It may call customers with consent on file between ${h.start} and ${h.end} (${c.business.timeZone}), at most ${c.spend.perCustomerMaxAttempts} attempts each, always disclosing it is an AI.`,
    `${c.business.name} pays $${c.outcome.pricing.onConfirmed} when a rebooking is proven and confirmed by the customer, and $${c.outcome.pricing.onAttended} when the business attests attendance.`,
    `Any payment above $${c.approval.humanApprovalAbove} needs a human click. Anything else (${c.forbiddenActions.join(", ") || "refunds, cancellations"}) is refused.`,
  ].join(" ");
}
