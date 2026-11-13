import { describe, expect, test } from "bun:test";
import { checkCall, checkConfirmed } from "./checks";

const claim = { attemptId: "att_1", callSid: "CA" + "a".repeat(32), to: "+919800000001", claimedStatus: "accepted", minSeconds: 20, attemptCreatedAt: "2026-11-15T10:00:00Z" };
const rec = { sid: claim.callSid, to: "+919800000001", from: "+15550000000", status: "completed", duration: "64", start_time: "Sun, 15 Nov 2026 10:00:10 +0000", end_time: null };

describe("call oracle", () => {
  test("PASS on a real, connected, long enough, fresh call", () => expect(checkCall(claim, rec).code).toBeUndefined());
  test("call_not_found for a fake SID", () => expect(checkCall(claim, null).code).toBe("call_not_found"));
  test("call_too_short", () => expect(checkCall(claim, { ...rec, duration: "5" }).code).toBe("call_too_short"));
  test("wrong_number", () => expect(checkCall(claim, { ...rec, to: "+919800000009" }).code).toBe("wrong_number"));
  test("call_not_completed", () => expect(checkCall(claim, { ...rec, status: "no-answer" }).code).toBe("call_not_completed"));
  test("stale_call", () => expect(checkCall(claim, { ...rec, start_time: "Sat, 14 Nov 2026 10:00:00 +0000" }).code).toBe("stale_call"));
});

const oc = { outcomeId: "out_1", milestone: "confirmed" as const, bookingUid: "bk_1", expected: { attendeeEmail: "Asha@example.com", start: "2026-11-16T10:30:00Z" }, contractHash: "sha256:x" };
const bk = { uid: "bk_1", status: "accepted", start: "2026-11-16T10:30:00.000Z", end: "2026-11-16T11:00:00.000Z", eventTypeId: 1, attendees: [{ name: "Asha", email: "asha@example.com", timeZone: "Asia/Kolkata" }] };
const conf = { outcomeId: "out_1", redeemed: true, redeemedAt: "2026-11-15T10:10:00Z", expiresAt: "2026-11-15T12:00:00Z", signatureValid: true };

describe("outcome oracle", () => {
  test("PASS when all five proofs hold", () => {
    const r = checkConfirmed(oc, bk, conf);
    expect(r.code).toBeUndefined();
    expect(r.checks.map((c) => c.name)).toEqual(["booking_exists", "booking_status_accepted", "attendee_matches", "slot_matches", "customer_confirmation_click"]);
  });
  test("booking_not_found", () => expect(checkConfirmed(oc, null, conf).code).toBe("booking_not_found"));
  test("booking_not_accepted", () => expect(checkConfirmed(oc, { ...bk, status: "cancelled" }, conf).code).toBe("booking_not_accepted"));
  test("slot_mismatch", () => expect(checkConfirmed(oc, { ...bk, start: "2026-11-16T12:00:00Z" }, conf).code).toBe("slot_mismatch"));
  test("attendee_mismatch", () => expect(checkConfirmed(oc, { ...bk, attendees: [{ name: "X", email: "x@y.z", timeZone: "UTC" }] }, conf).code).toBe("attendee_mismatch"));
  test("not_confirmed_by_customer when token not redeemed", () =>
    expect(checkConfirmed(oc, bk, { ...conf, redeemed: false, redeemedAt: null }).code).toBe("not_confirmed_by_customer"));
  test("not_confirmed_by_customer when confirmation signature is invalid", () =>
    expect(checkConfirmed(oc, bk, { ...conf, signatureValid: false }).code).toBe("not_confirmed_by_customer"));
});
