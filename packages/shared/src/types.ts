export type Usd = string;
export type Hex = `0x${string}`;

export const CALL_OUTCOMES = ["accepted", "declined", "no_answer", "opted_out", "wrong_person", "out_of_scope_only", "failed"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export interface TranscriptLine { who: "agent" | "caller"; text: string }

export interface CallResult {
  attemptId: string;
  callSid: string;
  outcome: CallOutcome;
  slotIndex?: 0 | 1;
  requested: string[];
  injection?: boolean;
  transcript: TranscriptLine[];
  durationSec: number;
  /** SERV decisions made inside the worker during the call, surfaced in Foreman's Decisions page. */
  decisions?: { purpose: string; source: "live" | "fallback"; ms: number; model: string; intent: string; injection: boolean; guards: string[] }[];
}

export interface CallRequest {
  attemptId: string;
  to: string;
  business: string;
  customerName: string;
  missed: string;
  offers: string[];
  timeZone: string;
  maxSeconds: number;
  callbackUrl: string;
}

export interface Check { name: string; pass: boolean; evidence: string }

export interface Verdict {
  kind: "call" | "outcome";
  subject: string;
  verdict: "PASS" | "FAIL";
  code?: string;
  checks: Check[];
  checkedAt: string;
  oracle: Hex;
  signature: Hex;
}

export const REFUSAL_CODES = [
  "action_not_permitted", "proof_failed", "no_consent", "quiet_hours", "duplicate_action", "over_budget",
  "per_call_cap_exceeded", "payee_not_allowlisted", "needs_human_approval", "worker_below_reputation_floor",
  "max_attempts_reached", "opted_out", "injection_detected", "kill_switch_engaged", "contract_not_running",
  "contract_expired", "proof_missing", "slot_not_offered",
] as const;
export type RefusalCode = (typeof REFUSAL_CODES)[number];

export const EVENT_TYPES = [
  "contract_compiled", "contract_approved", "contract_started", "contract_completed", "customer_skipped",
  "serv_decision", "worker_hired", "payment_out", "payment_in", "call_started", "call_reported",
  "oracle_verdict", "reputation_changed", "booking_created", "booking_cancelled", "confirmation_sent",
  "customer_confirmed", "customer_declined", "attended_attested", "refusal", "kill_switch", "transcript_audited", "customer_state",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface FeedEvent {
  id: number;
  ts: string;
  contractId: string | null;
  type: EventType;
  actor: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export const INTENTS = ["accept_slot", "decline", "ask_other_time", "opt_out", "wrong_person", "unclear", "out_of_scope_request"] as const;
export type Intent = (typeof INTENTS)[number];

/** Mode of each real-world adapter, surfaced in the console so nothing simulated passes as real. */
export interface AdapterModes {
  serv: "live" | "fallback";
  payments: "kite-testnet" | "kite-mainnet" | "sim";
  carrier: "twilio" | "sandbox";
  calendar: "calcom" | "sandbox";
  email: "smtp" | "sandbox";
}
