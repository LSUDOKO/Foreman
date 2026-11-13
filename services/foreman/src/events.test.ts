import { expect, test } from "bun:test";
import { openDb } from "./db";
import { EventLog } from "./events";
import { Idempotency, keys } from "./idempotency";

test("event log chains hashes, streams to subscribers and detects tampering", () => {
  const db = openDb(":memory:");
  const log = new EventLog(db);
  const seen: string[] = [];
  log.subscribe((e) => seen.push(e.type));
  log.emit("contract_compiled", "serv", { hash: "sha256:x" }, "ctr_1");
  log.refuse("ctr_1", "no_consent", "foreman", "place_call", "consent.required", { customer: "c4" });
  log.emit("kill_switch", "operator", { on: true }, null);
  expect(seen).toEqual(["contract_compiled", "refusal", "kill_switch"]);
  expect(log.verify()).toMatchObject({ ok: true, events: 3 });
  expect(log.since(1, "ctr_1").map((e) => e.type)).toEqual(["refusal", "kill_switch"]);
  db.query("UPDATE events SET data = ? WHERE id = 2").run(JSON.stringify({ code: "edited" }));
  expect(log.verify()).toMatchObject({ ok: false, brokenAt: 1 });
});

test("idempotency: pending blocks, failed can retry, done records ref", () => {
  const idem = new Idempotency(openDb(":memory:"));
  const k = keys.booking("ctr_1", "c1");
  expect(idem.begin(k, "booking")).toBe(true);
  expect(idem.begin(k, "booking")).toBe(false);
  expect(idem.seen(k)).toBe(true);
  expect(idem.pending("booking")).toEqual([k]);
  idem.fail(k);
  expect(idem.seen(k)).toBe(false);
  expect(idem.begin(k, "booking")).toBe(true);
  idem.done(k, "bk_1");
  expect(idem.ref(k)).toBe("bk_1");
  expect(idem.begin(k, "booking")).toBe(false);
  // Re-hire uses a new attempt number (new call key) but the same booking key.
  expect(keys.call("ctr_1", "c2", 1)).not.toBe(keys.call("ctr_1", "c2", 2));
});
