import { expect, test } from "bun:test";
import { cancelBooking, createBooking, freeSlots, getBooking } from "@foreman/shared/calcom";
import { createCalendar } from "./calendar";

test("sandbox calendar speaks the Cal.com v2 subset through the real client", async () => {
  const { app } = createCalendar();
  const c = { base: "http://cal", key: "k", f: ((u: string, i?: RequestInit) => app.request(u.replace("http://cal", ""), i)) as unknown as typeof fetch };
  const from = new Date("2026-11-16T00:00:00Z"); // Monday
  const slots = await freeSlots(c, 1, from, new Date("2026-11-17T00:00:00Z"), "Asia/Kolkata");
  expect(slots[0]).toBe("2026-11-16T04:30:00.000Z");
  expect(slots.length).toBe(16);
  const b = await createBooking(c, { eventTypeId: 1, start: slots[0]!, attendee: { name: "Asha", email: "asha@example.com", timeZone: "Asia/Kolkata" }, metadata: { idemKey: "k1" } });
  expect(b.status).toBe("accepted");
  expect((await freeSlots(c, 1, from, new Date("2026-11-17T00:00:00Z"), "UTC")).includes(slots[0]!)).toBe(false);
  await expect(createBooking(c, { eventTypeId: 1, start: slots[0]!, attendee: { name: "X", email: "x@y.z", timeZone: "UTC" }, metadata: {} })).rejects.toThrow("409");
  expect((await getBooking(c, b.uid))?.metadata?.idemKey).toBe("k1");
  await cancelBooking(c, b.uid, "test");
  expect((await getBooking(c, b.uid))?.status).toBe("cancelled");
  expect(await getBooking(c, "bk_missing")).toBeNull();
});
