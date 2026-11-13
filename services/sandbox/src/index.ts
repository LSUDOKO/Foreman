import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { num, PORTS, str } from "@foreman/shared/env";
import { createCalendar } from "./calendar";
import { createCarrier } from "./carrier";
import type { Persona } from "./carrier";
import { createInbox } from "./inbox";

// Personas are keyed by phone; attach emails from the demo CSV so the inbox knows who clicks what.
const personas = JSON.parse(readFileSync(str("PERSONAS_PATH", "demo/personas.json"), "utf8")) as Record<string, Persona>;
delete (personas as any)._note;
for (const line of readFileSync(str("DEMO_CSV", "demo/no-shows.csv"), "utf8").trim().split("\n").slice(1)) {
  const [, , phone, email] = line.split(",");
  if (phone && personas[phone]) (personas[phone] as any).emailAddress = email;
}

const stepMs = num("SANDBOX_STEP_MS", 400);
const carrier = createCarrier({ personas, authToken: str("TWILIO_AUTH_TOKEN", "sandbox"), stepMs });
const calendar = createCalendar();
const inbox = createInbox({ personas, stepMs });

const app = new Hono();
app.get("/healthz", (c) => c.json({ ok: true, name: "sandbox", emulates: ["twilio-voice", "calcom-v2", "inbox"] }));
app.route("/twilio", carrier.app);
app.route("/cal", calendar.app);
app.route("/mail", inbox.app);
app.get("/state", (c) =>
  c.json({
    calls: [...carrier.calls.values()],
    bookings: [...calendar.bookings.values()],
    mails: inbox.mails,
  }),
);

const port = num("PORT", PORTS.sandbox);
export default { port, fetch: app.fetch, idleTimeout: 60 };
console.log(`sandbox (Twilio + Cal.com + inbox emulator) on :${port}`);
