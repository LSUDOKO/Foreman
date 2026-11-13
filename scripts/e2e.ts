// End-to-end run of the five demo customers against the local stack, then assertions on the ledger, refusals and
// audit chain. Uses whatever adapters .env selects (sandbox when no keys). Exports the run for the console's replay mode.
//   bun run e2e            # fresh DB, fast sandbox timings
//   bun run e2e --keep     # leave services running afterwards
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SERVICES, startAll, waitHealthy } from "./dev-all";

const API = "http://localhost:4000";
const tz = process.env.BUSINESS_TZ ?? "Asia/Kolkata";
const dbPath = `.data/e2e-${Date.now()}.sqlite`;

// Calls are only allowed inside the contract's hours. Pick a window around "now" so the run works at any time of day;
// a daytime demo uses the normal "9 AM and 9 PM".
const hourNow = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date()));
const h12 = (h: number) => `${((h + 11) % 12) + 1} ${h % 24 < 12 ? "AM" : "PM"}`;
const daytime = hourNow >= 9 && hourNow < 20;
const window = daytime ? "9 AM and 9 PM" : `${h12(Math.max(0, hourNow - 1))} and ${h12(Math.min(23, hourNow + 3))}`;
const GOAL = `Call yesterday's no-shows from the CSV and rebook them into free check-up slots this week. Don't spend more than $5 on calls. Only call people who opted in. Calls between ${window}.`;

const procs = startAll(SERVICES({
  DB_PATH: dbPath, SANDBOX_STEP_MS: "150", FAULTY_DELAY_MS: "1500-2000", PAYER_INTERVAL_MS: "800", CONFIRM_TTL_MIN: "120",
}), !process.argv.includes("--verbose"));
const stop = () => { if (!process.argv.includes("--keep")) for (const p of procs) p.kill(); };
process.on("SIGINT", () => { stop(); process.exit(1); });

const j = async (method: string, path: string, body?: unknown) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.CONSOLE_TOKEN) headers.authorization = `Bearer ${process.env.CONSOLE_TOKEN}`;
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return JSON.parse(t);
};
const until = async <T>(what: string, fn: () => Promise<T | undefined | false>, ms = 180_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    await Bun.sleep(400);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const fails: string[] = [];
const expect = (ok: boolean, msg: string) => { console.log(`${ok ? "  ✓" : "  ✗"} ${msg}`); if (!ok) fails.push(msg); };

try {
  await waitHealthy([4400, 4210, 4110, 4111, 4000, 4300]);
  const modes = await j("GET", "/api/modes");
  console.log(`modes: ${JSON.stringify(modes.modes)}\ngoal: ${GOAL}\n`);

  const t0 = Date.now();
  const compiled = await j("POST", "/api/contracts/compile", { goal: GOAL, csv: readFileSync("demo/no-shows.csv", "utf8") });
  const id = compiled.contract.id as string;
  console.log(`compiled ${id} ${compiled.hash}\n  ${compiled.summary}\n`);
  await j("POST", `/api/contracts/${id}/approve`, { by: "Dr. Mehta (Smile Dental)" });
  await j("POST", `/api/contracts/${id}/start`);

  const terminal = ["skipped", "declined", "no_answer", "opted_out", "failed", "confirmed", "paid", "attended", "paid_attended", "cancelled"];
  await until("all customers to finish calling", async () => {
    const job = await j("GET", `/api/jobs/${id}`);
    return job.every((c: any) => terminal.includes(c.state)) && job;
  });
  await until("confirmed invoices to be paid", async () => {
    const job = await j("GET", `/api/jobs/${id}`);
    return job.filter((c: any) => c.state === "paid").length >= 2 && job;
  });

  // Business view: mark the rebooked patients as attended.
  const outcomes = (await j("GET", `/api/export/${id}`)).events.filter((e: any) => e.type === "payment_in").map((e: any) => e.data.outcomeId);
  for (const o of outcomes) await j("POST", `/api/outcomes/${o}/attended`);
  await until("attended invoices to be paid", async () => {
    const job = await j("GET", `/api/jobs/${id}`);
    return job.filter((c: any) => c.state === "paid_attended").length >= 2 && job;
  });

  const job = await j("GET", `/api/jobs/${id}`);
  const ledger = await j("GET", `/api/ledger/${id}`);
  const refusals = await j("GET", `/api/refusals/${id}`);
  const workers = await j("GET", "/api/workers");
  const audit = await j("GET", `/api/audit/verify/${id}`);
  const exp = await j("GET", `/api/export/${id}`);
  const codes = new Set(refusals.map((r: any) => r.code));
  const by = (n: string) => job.find((c: any) => c.name === n);

  console.log(`\nfinished in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  console.log(job.map((c: any) => `  ${c.name.padEnd(6)} ${c.state.padEnd(14)} ${c.refusal ?? ""}`).join("\n"));
  console.log(`\n  out ${ledger.out.map((p: any) => `${p.counterparty}:${p.purpose}:${p.amount}`).join(", ")}`);
  console.log(`  in  ${ledger.in.map((p: any) => `${p.purpose}:${p.amount}`).join(", ")}`);
  console.log(`  totals ${JSON.stringify(ledger.totals)}\n`);

  expect(by("Dev")?.state === "skipped" && by("Dev")?.refusal === "no_consent", "Dev skipped with no_consent, $0 spent on him");
  expect(by("Asha")?.state === "paid_attended", "Asha rebooked, confirmed, attended, paid");
  expect(by("Meera")?.state === "paid_attended", "Meera rebooked after the lying worker, paid");
  expect(by("Rahul")?.state === "declined", "Rahul's attack refused, he declined, nothing booked");
  expect(by("Kiran")?.state === "no_answer", "Kiran didn't answer: attempt cost only");
  expect(codes.has("no_consent"), "refusal no_consent logged");
  expect(codes.has("proof_failed"), "refusal proof_failed logged (QuickDial's fake call)");
  expect(codes.has("action_not_permitted"), "refusal action_not_permitted logged (caller asked to cancel/refund)");
  expect(codes.has("injection_detected"), "refusal injection_detected logged");
  expect(codes.has("worker_below_reputation_floor"), "QuickDial dropped below the reputation floor");
  const qd = workers.find((w: any) => w.name === "QuickDial");
  expect(qd.reputation === 40, `QuickDial reputation 80 → 40 (is ${qd.reputation})`);
  expect(ledger.totals.spent === "2.98", `Foreman spent $2.98 (is ${ledger.totals.spent})`);
  expect(ledger.totals.earned === "12.00", `Foreman earned $12.00 (is ${ledger.totals.earned})`);
  expect(ledger.totals.margin === "9.02", `margin $9.02 (is ${ledger.totals.margin})`);
  expect(ledger.out.every((p: any) => p.txHash), "every outgoing payment has a settlement id");
  expect(audit.ok === true, `audit chain verifies (${audit.events} events, head ${String(audit.head).slice(0, 18)}…)`);
  const decisions = exp.events.filter((e: any) => e.type === "serv_decision");
  const purposes = new Set(decisions.map((e: any) => e.data.purpose));
  for (const p of ["compile_contract", "plan_calls", "parse_turn", "audit_transcript"]) expect(purposes.has(p), `SERV decision ${p} logged`);
  const liveCount = decisions.filter((e: any) => e.data.source === "live").length;
  console.log(`  SERV decisions: ${decisions.length} (${liveCount} live, ${decisions.length - liveCount} fallback)`);

  mkdirSync("demo", { recursive: true });
  writeFileSync("demo/recorded-run.json", JSON.stringify(exp, null, 2));
  mkdirSync("apps/console/public", { recursive: true });
  copyFileSync("demo/recorded-run.json", "apps/console/public/recorded-run.json");
  console.log(`\nexported ${exp.events.length} events → demo/recorded-run.json`);
} catch (e) {
  fails.push(String((e as Error).message));
  console.error(e);
} finally {
  stop();
}
console.log(fails.length ? `\nE2E FAILED (${fails.length})` : "\nE2E PASSED");
process.exit(fails.length ? 1 : 0);
