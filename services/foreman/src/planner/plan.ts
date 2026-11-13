import { z } from "zod";
import { servJson } from "@foreman/shared/serv";
import type { Customer } from "../store";

export const Plan = z.object({
  order: z.array(z.object({ customerId: z.string(), offer: z.array(z.string()), reason: z.string().default("") })),
  skip: z.array(z.object({ customerId: z.string(), reason: z.string().default("") })).default([]),
});
export type Plan = z.infer<typeof Plan>;

const SYSTEM = `You plan outbound rebooking calls for a small business's no-show customers.
Decide the call order and which TWO free slots to offer each customer. Prefer slots near the time of day they originally booked,
and spread customers across different slots. You may only offer slots from the "freeSlots" list, copied exactly.
Customers with a poor history may go in "skip" (they will be called last if budget remains).
Output: {"order":[{"customerId","offer":[iso, iso],"reason"}], "skip":[{"customerId","reason"}]}`;

const minutesOfDay = (iso: string, tz: string) => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz })
    .format(new Date(iso)).split(":").map(Number);
  return h! * 60 + m!;
};

/** Deterministic plan: missed-time order; two closest-in-time-of-day free slots each, never reused across customers. */
export function fallbackPlan(customers: Customer[], free: string[], tz: string): Plan {
  const used = new Set<string>();
  const order = [...customers].sort((a, b) => a.missedAt.localeCompare(b.missedAt)).map((c) => {
    const target = minutesOfDay(c.missedAt, tz);
    const pick = free.filter((s) => !used.has(s))
      .slice(0, 16) // stay within the first couple of days
      .map((s, i) => ({ s, i, d: Math.abs(minutesOfDay(s, tz) - target) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, 2).map((x) => x.s).sort();
    pick.forEach((s) => used.add(s));
    return { customerId: c.id, offer: pick, reason: "Earliest free slots closest to the time of day they originally booked." };
  });
  return { order, skip: [] };
}

/** Server checks: offers must be real free slots, at most two, never shared between customers; every customer eligible. */
export function validatePlan(plan: Plan, customers: Customer[], free: string[], tz: string): Plan {
  const freeByTime = new Map(free.map((s) => [new Date(s).getTime(), s]));
  const eligible = new Set(customers.map((c) => c.id));
  const used = new Set<string>();
  const seen = new Set<string>();
  const backup = fallbackPlan(customers, free, tz);
  const clean = (id: string, offer: string[]) => {
    const ok = offer.map((o) => freeByTime.get(new Date(o).getTime())).filter((s): s is string => !!s && !used.has(s)).slice(0, 2);
    for (const s of backup.order.find((x) => x.customerId === id)?.offer ?? []) if (ok.length < 2 && !used.has(s) && !ok.includes(s)) ok.push(s);
    for (const s of free) if (ok.length < 2 && !used.has(s) && !ok.includes(s)) ok.push(s);
    ok.forEach((s) => used.add(s));
    return ok.sort();
  };
  const candidates = [
    ...plan.order,
    ...plan.skip.map((s) => ({ customerId: s.customerId, offer: [] as string[], reason: `called last: ${s.reason}` })),
  ];
  const order: Plan["order"] = [];
  for (const o of candidates) {
    if (!eligible.has(o.customerId) || seen.has(o.customerId)) continue;
    seen.add(o.customerId);
    order.push({ ...o, offer: clean(o.customerId, o.offer) });
  }
  for (const c of customers)
    if (!seen.has(c.id)) order.push({ customerId: c.id, offer: clean(c.id, []), reason: "added by server: planner omitted this customer" });
  return { order, skip: plan.skip.filter((s) => eligible.has(s.customerId)) };
}

export async function planCalls(customers: Customer[], free: string[], tz: string, now: Date) {
  const d = await servJson({
    purpose: "plan_calls",
    system: SYSTEM,
    user: JSON.stringify({
      nowInBusinessTz: new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(now),
      timeZone: tz,
      customers: customers.map((c) => ({ customerId: c.id, name: c.name, missedAt: c.missedAt })),
      freeSlots: free.slice(0, 40),
    }),
    schema: Plan,
    normalize: normalizePlan,
    effort: "low",
    timeoutMs: 30_000,
    fallback: () => fallbackPlan(customers, free, tz),
  });
  return { ...d, data: validatePlan(d.data, customers, free, tz) };
}

/** Accept the shapes models drift into: `offers`, a comma string, objects with `start`, `id` for `customerId`. */
export function normalizePlan(raw: any): unknown {
  const list = (v: any): string[] =>
    Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? String(x.start ?? x.slot ?? x.time ?? "") : String(x))).filter(Boolean)
      : typeof v === "string" ? v.split(/[,;]\s*/).filter(Boolean)
      : v && typeof v === "object" ? list(Object.values(v)) : [];
  const order = (raw?.order ?? raw?.calls ?? raw?.plan ?? []).map((o: any) => ({
    customerId: String(o.customerId ?? o.customer_id ?? o.id ?? ""),
    offer: list(o.offer ?? o.offers ?? o.slots),
    reason: String(o.reason ?? o.why ?? ""),
  }));
  const skip = (raw?.skip ?? []).map((o: any) => ({ customerId: String(o.customerId ?? o.customer_id ?? o.id ?? ""), reason: String(o.reason ?? "") }));
  return { order, skip };
}
