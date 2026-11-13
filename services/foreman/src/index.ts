import { addr, num, pk, PORTS, str, urls } from "@foreman/shared/env";
import { facilitatorFromEnv } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import type { Hex } from "@foreman/shared/types";
import { privateKeyToAccount } from "viem/accounts";
import { createApp } from "./app";
import { openDb } from "./db";
import { EventLog } from "./events";
import { Idempotency } from "./idempotency";
import { Payments } from "./pay";
import { Runner } from "./runner";
import { Store } from "./store";
import { seedWorkers } from "./registry";

const network = kite();
const db = openDb();
const store = new Store(db);
const log = new EventLog(db);
const idem = new Idempotency(db);
const foremanPk = pk("FOREMAN_PK");
const foremanAddress = privateKeyToAccount(foremanPk).address;
const U = urls();

seedWorkers(store);

// The verdict signer Foreman trusts is configured, not fetched, so a swapped oracle can't vouch for itself.
const oracleSigner = async () => addr("ORACLE_SIGNER_ADDRESS");

let runner: Runner;
const payments = new Payments(store, log, idem, { pk: foremanPk, from: foremanAddress, network, ctx: (id) => runner.ctx(id) });
runner = new Runner({
  db, store, log, idem, payments, oracleUrl: U.oracle, oracleSigner,
  publicUrl: U.foremanPublic.replace(/\/$/, ""), callbackUrl: `${U.foremanPublic.replace(/\/$/, "")}/api/worker-result`,
  eventTypeId: num("CALCOM_EVENT_TYPE_ID", 1), resultTimeoutMs: num("RESULT_TIMEOUT_MS", 300_000),
});

const app = createApp({
  db, store, log, runner, network, facilitator: facilitatorFromEnv(), foremanPk, foremanAddress,
  businessAddress: addr("BUSINESS_ADDRESS"), oracleSigner, payerUrl: U.payer,
  hmacSecret: str("WORKER_HMAC_SECRET", "dev-hmac-secret"), consoleToken: process.env.CONSOLE_TOKEN || undefined,
  identities: async () => ({
    Foreman: { address: foremanAddress, role: "outcome agent" },
    ClearCall: { address: addr("CLEARCALL_PAYTO"), role: "phone worker" },
    QuickDial: { address: addr("QUICKDIAL_PAYTO"), role: "phone worker (new · test worker scripted to fail)" },
    Oracle: { address: addr("ORACLE_PAYTO"), role: "proof oracle", signer: await oracleSigner() },
    [str("BUSINESS_NAME", "Smile Dental")]: { address: addr("BUSINESS_ADDRESS"), role: "buyer" },
  }),
  facts: () => ({
    businessName: str("BUSINESS_NAME", "Smile Dental"),
    timeZone: str("BUSINESS_TZ", "Asia/Kolkata"),
    payerWallet: addr("BUSINESS_ADDRESS"),
    eventTypeId: num("CALCOM_EVENT_TYPE_ID", 1),
    pricing: { onConfirmed: str("INVOICE_CONFIRMED", "4.00"), onAttended: str("INVOICE_ATTENDED", "2.00") },
    bonusOnProvenCall: str("BONUS_PRICE", "0.20"),
    registry: Object.fromEntries([...store.workers().map((w) => [w.name, w.payTo as Hex]), ["Oracle", addr("ORACLE_PAYTO")]]),
    ttlHours: num("CONTRACT_TTL_HOURS", 24),
  }),
});

setInterval(() => void runner.sweepExpired(), 30_000);

const port = num("PORT", PORTS.foreman);
export default { port, fetch: app.fetch, idleTimeout: 0 };
console.log(`foreman on :${port} · payments ${facilitatorFromEnv().mode} · ${network.caip2}`);
