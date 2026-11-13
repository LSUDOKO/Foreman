// Crash recovery for real-world side effects. A key left `pending` means we may or may not have acted.
// Ask the real world (the calendar) before doing anything again — never guess.
import { calClient, cancelBooking, listBookings } from "@foreman/shared/calcom";
import type { CalClient } from "@foreman/shared/calcom";
import { nowIso } from "./db";
import type { EventLog } from "./events";
import type { Idempotency } from "./idempotency";
import type { Store } from "./store";

export async function reconcileBookings(store: Store, idem: Idempotency, log: EventLog, cal: CalClient = calClient()) {
  const report: { key: string; found: string | null }[] = [];
  for (const { key, context: x } of idem.pendingWithContext("booking")) {
    if (!x.email) { idem.fail(key); report.push({ key, found: null }); continue; }
    const match = (await listBookings(cal, x.email)).find((b) => b.metadata?.idemKey === key && b.status === "accepted");
    if (!match) {
      idem.fail(key); // nothing was created: safe to book again later under the same key
      report.push({ key, found: null });
      continue;
    }
    idem.done(key, match.uid);
    if (!store.outcome(x.outcomeId!)) {
      store.addOutcome({ id: x.outcomeId!, contractId: x.contractId!, customerId: x.customerId!, attemptId: x.attemptId ?? null, bookingUid: match.uid, slotStart: match.start, createdAt: nowIso(), state: "booked" });
      // The customer never got a confirmation link for this hold, so release it rather than leave a ghost booking.
      await cancelBooking(cal, match.uid, "reconciler: hold created before a crash, never confirmed").catch(() => {});
      store.updateOutcome(x.outcomeId!, { state: "cancelled" });
      log.emit("booking_cancelled", "foreman", { outcomeId: x.outcomeId, customerId: x.customerId, bookingUid: match.uid, reason: "reconciled after crash: released unconfirmed hold", reconciled: true }, x.contractId ?? null);
    }
    report.push({ key, found: match.uid });
  }
  return report;
}
