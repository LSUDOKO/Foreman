// Cal.com API v2 client. Versions pinned per endpoint from the API reference:
// slots → 2024-09-04, bookings (create/get/cancel) → 2024-08-13.
// calBase() switches between api.cal.com and the local sandbox calendar.
import { calBase } from "./env";

export const CAL_VERSIONS = { slots: "2024-09-04", bookings: "2024-08-13" } as const;

export interface CalBooking {
  uid: string;
  status: string; // accepted|cancelled|pending|rejected
  start: string;
  end: string;
  eventTypeId: number;
  attendees: { name: string; email: string; timeZone: string; phoneNumber?: string }[];
  metadata?: Record<string, string>;
}

export interface CalClient { base: string; key: string; f: typeof fetch }

export function calClient(key = process.env.CALCOM_API_KEY ?? "sandbox", f: typeof fetch = fetch): CalClient {
  return { base: calBase(), key, f };
}

const headers = (c: CalClient, v: string) => ({
  authorization: `Bearer ${c.key}`, "cal-api-version": v, "content-type": "application/json",
});

/** Free slot start times (UTC ISO) for an event type in [start, end). */
export async function freeSlots(c: CalClient, eventTypeId: number, start: Date, end: Date, timeZone: string): Promise<string[]> {
  const q = new URLSearchParams({ eventTypeId: String(eventTypeId), start: start.toISOString(), end: end.toISOString(), timeZone });
  const res = await c.f(`${c.base}/v2/slots?${q}`, { headers: headers(c, CAL_VERSIONS.slots) });
  const j = (await res.json()) as any;
  if (!res.ok) throw new Error(`calcom slots ${res.status}: ${JSON.stringify(j?.error ?? j)}`);
  const out: string[] = [];
  for (const day of Object.values(j.data ?? {}) as any[]) for (const s of day) out.push(new Date(s.start).toISOString());
  return out.sort();
}

export async function createBooking(
  c: CalClient,
  p: { eventTypeId: number; start: string; attendee: { name: string; email: string; timeZone: string; phoneNumber?: string }; metadata: Record<string, string> },
): Promise<CalBooking> {
  const res = await c.f(`${c.base}/v2/bookings`, { method: "POST", headers: headers(c, CAL_VERSIONS.bookings), body: JSON.stringify(p) });
  const j = (await res.json()) as any;
  if (!res.ok) throw new Error(`calcom create booking ${res.status}: ${JSON.stringify(j?.error ?? j)}`);
  return j.data;
}

export async function getBooking(c: CalClient, uid: string): Promise<CalBooking | null> {
  const res = await c.f(`${c.base}/v2/bookings/${encodeURIComponent(uid)}`, { headers: headers(c, CAL_VERSIONS.bookings) });
  if (res.status === 404) return null;
  const j = (await res.json()) as any;
  if (!res.ok) throw new Error(`calcom get booking ${res.status}`);
  return j.data ?? null;
}

export async function cancelBooking(c: CalClient, uid: string, reason: string): Promise<void> {
  const res = await c.f(`${c.base}/v2/bookings/${encodeURIComponent(uid)}/cancel`, {
    method: "POST", headers: headers(c, CAL_VERSIONS.bookings), body: JSON.stringify({ cancellationReason: reason }),
  });
  if (!res.ok) throw new Error(`calcom cancel ${res.status}`);
}

export const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();
