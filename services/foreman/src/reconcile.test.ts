import { expect, test } from "bun:test";
import { createBooking } from "@foreman/shared/calcom";
import { createCalendar } from "../../sandbox/src/calendar";
import { openDb } from "./db";
import { EventLog } from "./events";
import { Idempotency, keys } from "./idempotency";
import { reconcileBookings } from "./reconcile";
import { Store } from "./store";

test("crash after booking_created but before done: reconciler finds it by metadata.idemKey; no second booking", async () => {
  const { app, bookings } = createCalendar();
  const cal = { base: "http://cal", key: "k", f: ((u: string, i?: RequestInit) => app.request(u.replace("http://cal", ""), i)) as unknown as typeof fetch };
  const db = openDb(":memory:");
  const store = new Store(db), idem = new Idempotency(db), log = new EventLog(db);

  const k1 = keys.booking("ctr_1", "c1");
  idem.begin(k1, "booking", { contractId: "ctr_1", customerId: "c1", email: "asha@example.com", outcomeId: "out_1", slot: "2026-11-16T04:30:00Z" });
  await createBooking(cal, { eventTypeId: 1, start: "2026-11-16T04:30:00Z", attendee: { name: "Asha", email: "asha@example.com", timeZone: "UTC" }, metadata: { idemKey: k1 } });
  // ...process dies here: key still pending.

  const k2 = keys.booking("ctr_1", "c2");
  idem.begin(k2, "booking", { contractId: "ctr_1", customerId: "c2", email: "meera@example.com", outcomeId: "out_2" }); // died before calling Cal.com

  const report = await reconcileBookings(store, idem, log, cal);
  expect(report.find((r) => r.key === k1)?.found).toMatch(/^bk_/);
  expect(report.find((r) => r.key === k2)?.found).toBeNull();
  expect(idem.status(k1)).toBe("done");
  expect(idem.status(k2)).toBe("failed");
  expect(idem.seen(k1)).toBe(true); // the runner will never create a second booking for Asha
  expect([...bookings.values()].filter((b) => b.status === "accepted").length).toBe(0); // ghost hold released
  expect(bookings.size).toBe(1);
});
