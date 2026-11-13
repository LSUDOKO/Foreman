import type { CalBooking } from "@foreman/shared/calcom";
import type { TwilioCallRecord } from "@foreman/shared/twilio";
import { sameInstant } from "@foreman/shared/calcom";
import type { Check } from "@foreman/shared/types";

export interface CallClaim { attemptId: string; callSid: string; to: string; claimedStatus: string; minSeconds: number; attemptCreatedAt: string }

const norm = (p: string) => p.replace(/[^\d+]/g, "");

/** Deterministic call checks against the carrier record. First failure gives the verdict code. */
export function checkCall(claim: CallClaim, rec: TwilioCallRecord | null): { checks: Check[]; code?: string } {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, evidence: string, code: string) => {
    checks.push({ name, pass, evidence });
    return pass ? undefined : code;
  };
  if (!rec) {
    add("call_exists", false, `carrier has no record of ${claim.callSid}`, "call_not_found");
    return { checks, code: "call_not_found" };
  }
  const codes = [
    add("call_exists", true, `carrier record ${rec.sid}`, "call_not_found"),
    add("right_number", norm(rec.to) === norm(claim.to), `record to=${rec.to}, expected ${claim.to}`, "wrong_number"),
    add("connected", rec.status === "completed", `status=${rec.status}`, "call_not_completed"),
    add("real_conversation", Number(rec.duration ?? 0) >= claim.minSeconds, `duration=${rec.duration ?? 0}s, min ${claim.minSeconds}s`, "call_too_short"),
    add(
      "fresh",
      !!rec.start_time && new Date(rec.start_time).getTime() >= new Date(claim.attemptCreatedAt).getTime() - 5_000,
      `start_time=${rec.start_time}, attempt created ${claim.attemptCreatedAt}`,
      "stale_call",
    ),
  ];
  return { checks, code: codes.find(Boolean) };
}

export interface OutcomeClaim {
  outcomeId: string;
  milestone: "confirmed" | "attended";
  bookingUid: string;
  expected: { attendeeEmail: string; start: string };
  contractHash: string;
}

export interface Confirmation { outcomeId: string; redeemed: boolean; redeemedAt: string | null; expiresAt: string; signatureValid: boolean }

/** Exactly the contract's proof.confirmed list. */
export function checkConfirmed(claim: OutcomeClaim, b: CalBooking | null, conf: Confirmation | null): { checks: Check[]; code?: string } {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, evidence: string, code: string) => (checks.push({ name, pass, evidence }), pass ? undefined : code);
  if (!b) {
    add("booking_exists", false, `calendar has no booking ${claim.bookingUid}`, "booking_not_found");
    return { checks, code: "booking_not_found" };
  }
  const email = claim.expected.attendeeEmail.toLowerCase();
  const codes = [
    add("booking_exists", true, `booking ${b.uid}`, "booking_not_found"),
    add("booking_status_accepted", b.status === "accepted", `status=${b.status}`, "booking_not_accepted"),
    add("attendee_matches", b.attendees.some((a) => a.email.toLowerCase() === email), `attendees=${b.attendees.map((a) => a.email).join(",")}`, "attendee_mismatch"),
    add("slot_matches", sameInstant(b.start, claim.expected.start), `start=${b.start}, accepted ${claim.expected.start}`, "slot_mismatch"),
    add(
      "customer_confirmation_click",
      !!conf && conf.signatureValid && conf.redeemed && !!conf.redeemedAt && new Date(conf.redeemedAt) <= new Date(conf.expiresAt),
      conf ? `redeemed=${conf.redeemed} at ${conf.redeemedAt ?? "—"}, expires ${conf.expiresAt}, signature ${conf.signatureValid ? "valid" : "INVALID"}` : "no confirmation record",
      "not_confirmed_by_customer",
    ),
  ];
  return { checks, code: codes.find(Boolean) };
}

export function checkAttended(attestationValid: boolean, evidence: string): { checks: Check[]; code?: string } {
  return {
    checks: [{ name: "business_attestation", pass: attestationValid, evidence }],
    code: attestationValid ? undefined : "attestation_invalid",
  };
}
