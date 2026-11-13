import { z } from "zod";
import { CONFIRMED_PROOF, OutcomeContract, PERMITTED_ACTIONS } from "@foreman/shared/contract";
import { isUsd } from "@foreman/shared/money";
import type { Hex } from "@foreman/shared/types";

/** What SERV is allowed to decide. No addresses, no prices the business pays — those are server facts. */
export const ContractDraft = z.object({
  totalBudget: z.string(),
  perCallCap: z.string().optional(),
  allowedHours: z.object({ start: z.string(), end: z.string() }).optional(),
  searchWindowDays: z.number().int().optional(),
  perCustomerMaxAttempts: z.number().int().optional(),
  maxCallSeconds: z.number().int().optional(),
  humanApprovalAbove: z.string().optional(),
  reputationFloor: z.number().int().optional(),
  permittedActions: z.array(z.string()).default([]),
  forbiddenActions: z.array(z.string()).default([]),
  payees: z.array(z.string()).default([]),
  rejectedRequests: z.array(z.object({ request: z.string(), reason: z.string() })).default([]),
});
export type ContractDraft = z.infer<typeof ContractDraft>;

export const DEFAULTS = {
  perCustomerMaxAttempts: 2,
  maxCallSeconds: 150,
  reputationFloor: 50,
  humanApprovalAbove: "1.00",
  searchWindowDays: 7,
  perCallCap: "0.60",
  allowedHours: { start: "09:00", end: "21:00" },
  forbiddenActions: ["cancel_existing_bookings", "issue_refund", "change_prices", "share_customer_data"],
};

export interface ServerFacts {
  id: string;
  businessName: string;
  timeZone: string;
  payerWallet: Hex;
  eventTypeId: number;
  pricing: { onConfirmed: string; onAttended: string };
  bonusOnProvenCall: string;
  /** name (case-insensitive) → payTo. The only source of addresses in a contract. */
  registry: Record<string, Hex>;
  now: Date;
  ttlHours: number;
}

const money = (v: string | undefined, d: string) => {
  if (!v) return d;
  const n = v.replace(/[$,\s]|usd|pieusd/gi, "");
  const f = Number(n);
  return Number.isFinite(f) && f >= 0 ? f.toFixed(2) : d;
};
const hhmm = (v: string | undefined, d: string) => (v && /^\d\d:\d\d$/.test(v) ? v : d);
const clamp = (v: number | undefined, lo: number, hi: number, d: number) => (v === undefined ? d : Math.min(hi, Math.max(lo, v)));

export function assemble(draft: ContractDraft, f: ServerFacts) {
  const rejected = [...draft.rejectedRequests];
  const permitted = draft.permittedActions.filter((a): a is (typeof PERMITTED_ACTIONS)[number] => {
    if ((PERMITTED_ACTIONS as readonly string[]).includes(a)) return true;
    rejected.push({ request: a, reason: "action_not_supported" });
    return false;
  });
  // place_call/offer_slot/create_booking/email are the job itself; a goal can narrow but never widen them.
  const permittedActions = permitted.length ? [...new Set(permitted)] : [...PERMITTED_ACTIONS];

  const reg = Object.fromEntries(Object.entries(f.registry).map(([k, v]) => [k.toLowerCase(), v]));
  const named = draft.payees.map((p) => p.toLowerCase()).filter((p) => reg[p]); // anything else (incl. raw addresses) is dropped
  const payeeAllowlist = [...new Set((named.length ? named : Object.keys(reg)).map((n) => reg[n]!))];

  const contract = OutcomeContract.parse({
    id: f.id,
    version: 1,
    business: { name: f.businessName, timeZone: f.timeZone, payerWallet: f.payerWallet },
    goal: "",
    outcome: {
      kind: "confirmed_rebooking",
      calendar: { provider: "calcom", eventTypeId: f.eventTypeId, searchWindowDays: clamp(draft.searchWindowDays, 1, 14, DEFAULTS.searchWindowDays) },
      pricing: { currency: "pieUSD", ...f.pricing },
      proof: { confirmed: [...CONFIRMED_PROOF], attended: ["business_attestation"] },
    },
    spend: {
      currency: "pieUSD",
      totalBudget: money(draft.totalBudget, "5.00"),
      perCallCap: money(draft.perCallCap, DEFAULTS.perCallCap),
      perCustomerMaxAttempts: clamp(draft.perCustomerMaxAttempts, 1, 3, DEFAULTS.perCustomerMaxAttempts),
      payeeAllowlist,
      expiresAt: new Date(f.now.getTime() + f.ttlHours * 3600_000).toISOString(),
    },
    permittedActions,
    forbiddenActions: [...new Set([...DEFAULTS.forbiddenActions, ...draft.forbiddenActions.filter((x) => !(PERMITTED_ACTIONS as readonly string[]).includes(x))])],
    consent: { required: true, source: "CSV column consent_source" },
    callPolicy: {
      allowedHours: { start: hhmm(draft.allowedHours?.start, DEFAULTS.allowedHours.start), end: hhmm(draft.allowedHours?.end, DEFAULTS.allowedHours.end) },
      aiDisclosure: true,
      maxCallSeconds: clamp(draft.maxCallSeconds, 30, 180, DEFAULTS.maxCallSeconds),
      honourOptOut: true,
    },
    workerPolicy: { reputationFloor: clamp(draft.reputationFloor, 0, 100, DEFAULTS.reputationFloor), probationCallsForNewWorkers: 1, bonusOnProvenCall: f.bonusOnProvenCall },
    approval: { approvedBy: null, approvedAt: null, humanApprovalAbove: isUsd(money(draft.humanApprovalAbove, "")) ? money(draft.humanApprovalAbove, "") : DEFAULTS.humanApprovalAbove },
  });
  return { contract, rejectedRequests: dedupe(rejected) };
}

const dedupe = (r: { request: string; reason: string }[]) => [...new Map(r.map((x) => [x.request.toLowerCase(), x])).values()];
