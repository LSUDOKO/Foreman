import { sha256 } from "@foreman/shared/canonical";
import { str } from "@foreman/shared/env";

export const CONFIRM_TTL_MS = () => Number(process.env.CONFIRM_TTL_MIN ?? 120) * 60_000;

/** Single-use bearer token for the customer's link. Only its hash is stored. */
export function newToken() {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
  return { token, hash: sha256(token), expiresAt: new Date(Date.now() + CONFIRM_TTL_MS()).toISOString() };
}
export const tokenHash = (t: string) => sha256(t);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function fmtSlot(iso: string, tz: string) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).format(d).toUpperCase();
  const zone = new Intl.DateTimeFormat("en-IN", { timeZoneName: "short", timeZone: tz }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? tz;
  return { day, time, zone };
}

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
:root{--ink:#1C1917;--muted:#78716C;--line:#E7E5E4;--ok:#16A34A}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#FAFAF9;color:var(--ink);display:grid;place-items:center;min-height:100vh;padding:16px}
.card{width:100%;max-width:400px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:32px 24px;text-align:center}
.logo{width:48px;height:48px;border-radius:12px;background:#ECFDF5;color:var(--ok);display:grid;place-items:center;font-weight:700;font-size:20px;margin:0 auto 12px}
h1{font-size:20px;margin:4px 0 20px}.when{font-size:18px;font-weight:600}.meta{color:var(--muted);font-size:14px;margin-top:4px}
form{display:flex;flex-direction:column;gap:10px;margin-top:24px}button{font:inherit;font-weight:600;border-radius:10px;padding:14px;border:1px solid var(--line);background:#fff;cursor:pointer}
button.primary{background:var(--ink);color:#fff;border-color:var(--ink)}.fine{color:var(--muted);font-size:12px;margin-top:20px}
</style></head><body><main class="card">${body}</main></body></html>`;

export function confirmPage(o: { business: string; slot: string; tz: string; token: string; state: "open" | "confirmed" | "declined" | "expired" | "invalid" }) {
  const { day, time, zone } = fmtSlot(o.slot, o.tz);
  const head = `<div class="logo">${esc(o.business[0] ?? "B")}</div><div class="meta">${esc(o.business)}</div>`;
  if (o.state === "confirmed") return shell("You're booked", `${head}<h1>You're booked.</h1><div class="when">${esc(day)} · ${esc(time)}</div><p class="meta">See you then.</p>`);
  if (o.state === "declined") return shell("Cancelled", `${head}<h1>No problem.</h1><p class="meta">We've released the slot. ${esc(o.business)} won't charge you anything.</p>`);
  if (o.state === "expired" || o.state === "invalid") return shell("Link expired", `${head}<h1>This link has expired.</h1><p class="meta">Please contact ${esc(o.business)} directly to book.</p>`);
  return shell(`Confirm your appointment — ${o.business}`, `${head}<h1>Confirm your new appointment</h1>
<div class="when">${esc(day)} · ${esc(time)} (${esc(zone)})</div><div class="meta">Check-up · 30 min</div>
<form method="post"><button class="primary" formaction="/c/${esc(o.token)}/confirm">Yes, confirm</button><button formaction="/c/${esc(o.token)}/decline">Not anymore</button></form>
<p class="fine">You were called by ${esc(o.business)}'s AI assistant.</p>`);
}

export function confirmEmail(o: { business: string; name: string; slot: string; tz: string; link: string }) {
  const { day, time, zone } = fmtSlot(o.slot, o.tz);
  const subject = `Confirm your ${time} appointment — ${o.business}`;
  const text = `Hi ${o.name},\n\nAs discussed on the phone, we're holding ${day} at ${time} (${zone}) for you.\nPlease confirm here: ${o.link}\n\nIf we don't hear back within 2 hours we'll release the slot.\n\n— ${o.business}`;
  const html = `<div style="font:16px/1.5 system-ui,sans-serif;color:#1C1917;max-width:480px"><p>Hi ${esc(o.name)},</p>
<p>As discussed on the phone, we're holding <b>${esc(day)} at ${esc(time)}</b> (${esc(zone)}) for you.</p>
<p><a href="${esc(o.link)}" style="display:inline-block;background:#1C1917;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Confirm appointment</a></p>
<p style="color:#78716C;font-size:13px">If we don't hear back within 2 hours we'll release the slot. You were called by ${esc(o.business)}'s AI assistant.</p></div>`;
  return { subject, text, html };
}

export const businessName = () => str("BUSINESS_NAME", "Smile Dental");
