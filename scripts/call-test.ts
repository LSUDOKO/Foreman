// Ring a phone through ClearCall (keypad path is the shortest). Needs dev:all running and, for a real phone,
// TWILIO_* + CLEARCALL_PUBLIC_URL (a tunnel to :4110). Without Twilio keys it rings a sandbox persona instead.
//   bun scripts/call-test.ts +91XXXXXXXXXX
import { Hono } from "hono";
import { hmacValid } from "@foreman/shared/sign";
import { kite } from "@foreman/shared/kite";
import { pk, str, urls } from "@foreman/shared/env";
import { payAndFetch } from "@foreman/shared/x402-buyer";

const to = process.argv[2];
if (!to || !/^\+\d{8,15}$/.test(to)) { console.error("usage: bun scripts/call-test.ts +<E.164 number>"); process.exit(2); }

const done = Promise.withResolvers<unknown>();
const cb = new Hono().post("/r", async (c) => {
  const body = await c.req.text();
  if (!hmacValid(str("WORKER_HMAC_SECRET", "dev-hmac-secret"), body, c.req.header("x-worker-signature"))) return c.text("bad sig", 401);
  done.resolve(JSON.parse(body));
  return c.json({ ok: true });
});
const server = Bun.serve({ port: 4999, fetch: cb.fetch });
const callbackUrl = process.env.CALLBACK_PUBLIC_URL ?? `http://localhost:${server.port}/r`;

const net = kite();
const r = await payAndFetch(`${urls().clearcall}/v1/call`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({
    attemptId: `att_test_${Date.now()}`, to, business: str("BUSINESS_NAME", "Smile Dental"), customerName: "there",
    missed: new Date(Date.now() - 86400e3).toISOString(), offers: [new Date(Date.now() + 2 * 86400e3).toISOString(), new Date(Date.now() + 2 * 86400e3 + 5400e3).toISOString()],
    timeZone: str("BUSINESS_TZ", "Asia/Kolkata"), maxSeconds: 90, callbackUrl,
  }),
}, { pk: pk("FOREMAN_PK"), network: net.caip2, guard: (q) => console.log(`paying ${q.amount} base units to ${q.payTo}`) });
console.log(`worker → ${r.res.status}`, await r.res.text(), r.receipt?.transaction ?? "");
console.log("waiting for the call result (press 1 on the phone)…");
console.log(JSON.stringify(await done.promise, null, 2));
server.stop();
process.exit(0);
