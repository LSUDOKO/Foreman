import { z } from "zod";
import { PERMITTED_ACTIONS } from "@foreman/shared/contract";
import { servJson, shadowAgent } from "@foreman/shared/serv";
import { assemble, ContractDraft, DEFAULTS } from "./assemble";
import type { ServerFacts } from "./assemble";

const SYSTEM = `You compile a small business's goal into a strict JSON outcome-contract draft for an AI agent that rebooks no-show customers.
Never output wallet addresses; refer to payees by name only, chosen from the worker registry you are given.
Allowed actions are exactly: ${PERMITTED_ACTIONS.join(", ")}.
If the goal asks for anything outside those actions (refunds, cancelling existing bookings, price changes, sharing data, ...),
leave it out of permittedActions and list it in "rejectedRequests" with a short reason.
Money values are decimal strings like "5.00" and must come from the goal or the stated defaults.
Hours are "HH:MM" 24h in the business time zone.
Output JSON with keys: totalBudget, perCallCap, allowedHours {start,end}, searchWindowDays, perCustomerMaxAttempts, maxCallSeconds,
humanApprovalAbove, reputationFloor, permittedActions, forbiddenActions, payees, rejectedRequests [{request, reason}].`;

const HINT =
  "Every field in the schema must be present. Money values must come from the goal or the stated defaults. permittedActions must be a subset of the five allowed actions. Reject anything that asks for refunds, cancellations of existing bookings or price changes.";

/** Regex-based draft used only when SERV is unavailable (decision is labelled source:"fallback"). */
export function fallbackDraft(goal: string): ContractDraft {
  const budget = /(?:spend|budget)[^$\d]*\$?\s?(\d+(?:\.\d{1,2})?)/i.exec(goal)?.[1] ?? /\$\s?(\d+(?:\.\d{1,2})?)/.exec(goal)?.[1];
  const hours = /between\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)\s+and\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)/i.exec(goal);
  const to24 = (h: string, m: string | undefined, ap: string) => `${String((Number(h) % 12) + (ap.toLowerCase() === "pm" ? 12 : 0)).padStart(2, "0")}:${m ?? "00"}`;
  const rejected = [
    /refund/i.test(goal) && { request: "issue_refund", reason: "refunds are not a permitted action" },
    /cancel (all|existing|every)/i.test(goal) && { request: "cancel_existing_bookings", reason: "only Foreman's own unconfirmed holds may be cancelled" },
    /(discount|price)/i.test(goal) && { request: "change_prices", reason: "pricing is not a permitted action" },
  ].filter(Boolean) as { request: string; reason: string }[];
  return ContractDraft.parse({
    totalBudget: budget ?? "5.00",
    allowedHours: hours ? { start: to24(hours[1]!, hours[2], hours[3]!), end: to24(hours[4]!, hours[5], hours[6]!) } : undefined,
    permittedActions: [...PERMITTED_ACTIONS],
    payees: [],
    rejectedRequests: rejected,
  });
}

export async function compileContract(goal: string, facts: ServerFacts) {
  const decision = await servJson({
    purpose: "compile_contract",
    system: SYSTEM,
    user: JSON.stringify({
      goal,
      workerRegistry: Object.keys(facts.registry),
      defaults: { ...DEFAULTS, totalBudget: "5.00" },
      businessTimeZone: facts.timeZone,
    }),
    schema: ContractDraft,
    normalize: normalizeDraft,
    tools: [shadowAgent(HINT, 3)],
    effort: "low", // shadow-agent validation does the heavy lifting; medium measured >100 s end to end
    timeoutMs: 90_000,
    fallback: () => fallbackDraft(goal),
  });
  const { contract, rejectedRequests } = assemble(decision.data, facts);
  contract.goal = goal;
  return { contract, rejectedRequests, decision };
}

function normalizeDraft(raw: any): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw.contract && typeof raw.contract === "object" ? { ...raw.contract, rejectedRequests: raw.rejectedRequests ?? raw.contract.rejectedRequests } : raw;
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
  return {
    ...r,
    totalBudget: str(r.totalBudget ?? r.spend?.totalBudget) ?? "5.00",
    perCallCap: str(r.perCallCap ?? r.spend?.perCallCap),
    humanApprovalAbove: str(r.humanApprovalAbove),
    allowedHours: r.allowedHours ?? r.callPolicy?.allowedHours,
    payees: (r.payees ?? r.payeeAllowlist ?? []).map(String),
    rejectedRequests: (r.rejectedRequests ?? []).map((x: any) => (typeof x === "string" ? { request: x, reason: "not permitted" } : { request: String(x.request ?? x.action ?? x.name), reason: String(x.reason ?? "not permitted") })),
  };
}

export const CompileInput = z.object({ goal: z.string().min(10), csv: z.string().min(10) });
