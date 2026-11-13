import { addr, num, PORTS, str, urls } from "@foreman/shared/env";
import { facilitatorFromEnv } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import { createWorker } from "./app";

const name = str("WORKER_NAME", "ClearCall");
const key = name.toUpperCase();
const port = num("PORT", key === "QUICKDIAL" ? PORTS.quickdial : PORTS.clearcall);
const delay = str("FAULTY_DELAY_MS", "20000-40000").split("-").map(Number) as [number, number];

const { app } = createWorker({
  name,
  mode: str("WORKER_MODE", "honest") === "faulty" ? "faulty" : "honest",
  network: kite(),
  facilitator: facilitatorFromEnv(),
  payTo: addr(`${key}_PAYTO`),
  price: str(`${key}_PRICE`, key === "QUICKDIAL" ? "0.30" : "0.50"),
  bonus: str("BONUS_PRICE", "0.20"),
  publicUrl: process.env[`${key}_PUBLIC_URL`] || (key === "QUICKDIAL" ? urls().quickdial : urls().clearcall),
  from: str("TWILIO_FROM", "+15005550006"),
  hmacSecret: str("WORKER_HMAC_SECRET", "dev-hmac-secret"),
  turnTimeoutMs: num("SERV_TURN_TIMEOUT_MS", 4000),
  faultyDelayMs: [delay[0] ?? 20000, delay[1] ?? delay[0] ?? 40000],
});

export default { port, fetch: app.fetch, idleTimeout: 30 };
console.log(`${name} (${str("WORKER_MODE", "honest")}) on :${port}`);
