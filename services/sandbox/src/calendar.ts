// Sandbox calendar: the subset of Cal.com API v2 Foreman uses (slots, create, get, cancel).
// Opening hours are 10:00–17:30 IST (04:30–12:00 UTC), Mon–Sat, 30-minute slots.
import { Hono } from "hono";
import type { CalBooking } from "@foreman/shared/calcom";

export function createCalendar(o: { onChange?: () => void } = {}) {
  const bookings = new Map<string, CalBooking>();
  const app = new Hono();

  const requireVersion = (v: string | undefined, want: string) => v === want;

  app.get("/v2/slots", (c) => {
    if (!requireVersion(c.req.header("cal-api-version"), "2024-09-04")) return c.json({ status: "error", error: { message: "cal-api-version 2024-09-04 required" } }, 400);
    const start = new Date(c.req.query("start")!);
    const end = new Date(c.req.query("end")!);
    const taken = new Set([...bookings.values()].filter((b) => b.status === "accepted").map((b) => new Date(b.start).getTime()));
    const data: Record<string, { start: string }[]> = {};
    const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    for (; day < end; day.setUTCDate(day.getUTCDate() + 1)) {
      if (day.getUTCDay() === 0) continue;
      for (let m = 4 * 60 + 30; m <= 12 * 60; m += 30) {
        const t = new Date(day.getTime() + m * 60_000);
        if (t < start || t >= end || taken.has(t.getTime())) continue;
        (data[t.toISOString().slice(0, 10)] ??= []).push({ start: t.toISOString() });
      }
    }
    return c.json({ status: "success", data });
  });

  app.post("/v2/bookings", async (c) => {
    if (!requireVersion(c.req.header("cal-api-version"), "2024-08-13")) return c.json({ status: "error", error: { message: "cal-api-version 2024-08-13 required" } }, 400);
    const p = (await c.req.json()) as any;
    const startMs = new Date(p.start).getTime();
    if ([...bookings.values()].some((b) => b.status === "accepted" && new Date(b.start).getTime() === startMs))
      return c.json({ status: "error", error: { message: "slot no longer available" } }, 409);
    const b: CalBooking = {
      uid: `bk_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, status: "accepted",
      start: new Date(startMs).toISOString(), end: new Date(startMs + 30 * 60_000).toISOString(),
      eventTypeId: p.eventTypeId, attendees: [p.attendee], metadata: p.metadata ?? {},
    };
    bookings.set(b.uid, b);
    o.onChange?.();
    return c.json({ status: "success", data: b }, 201);
  });

  app.get("/v2/bookings/:uid", (c) => {
    const b = bookings.get(c.req.param("uid"));
    return b ? c.json({ status: "success", data: b }) : c.json({ status: "error", error: { message: "not found" } }, 404);
  });

  app.post("/v2/bookings/:uid/cancel", async (c) => {
    const b = bookings.get(c.req.param("uid"));
    if (!b) return c.json({ status: "error" }, 404);
    b.status = "cancelled";
    o.onChange?.();
    return c.json({ status: "success", data: b });
  });

  return { app, bookings };
}
