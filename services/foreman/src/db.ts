import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY, json TEXT NOT NULL, hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','approved','running','paused','completed','expired')),
  rejected TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT NOT NULL, contract_id TEXT NOT NULL, name TEXT, phone TEXT, email TEXT,
  missed_at TEXT, consent_source TEXT, opted_out INTEGER DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'eligible', refusal TEXT, offers TEXT, plan_reason TEXT, steps TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (contract_id, id)
);
CREATE TABLE IF NOT EXISTS workers (
  name TEXT PRIMARY KEY, pay_to TEXT NOT NULL, call_url TEXT NOT NULL, bonus_url TEXT NOT NULL,
  price TEXT NOT NULL, bonus TEXT NOT NULL, reputation INTEGER NOT NULL, probation_left INTEGER NOT NULL,
  is_new INTEGER NOT NULL DEFAULT 0, badge TEXT
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, customer_id TEXT NOT NULL, worker TEXT NOT NULL, attempt_no INTEGER NOT NULL,
  call_sid TEXT, offers TEXT, result_json TEXT, verdict_json TEXT, quality REAL, created_at TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, customer_id TEXT NOT NULL, attempt_id TEXT, booking_uid TEXT, slot_start TEXT,
  confirm_token_hash TEXT, confirm_expires_at TEXT, confirmed_at TEXT, attended_sig TEXT, created_at TEXT NOT NULL,
  state TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, direction TEXT CHECK (direction IN ('in','out')),
  from_addr TEXT, to_addr TEXT, counterparty TEXT, purpose TEXT, amount TEXT, tx_hash TEXT,
  ref_id TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS refusals (
  id TEXT PRIMARY KEY, contract_id TEXT, code TEXT, actor TEXT, action TEXT, clause TEXT, evidence TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY, kind TEXT, status TEXT CHECK (status IN ('pending','done','failed')), ref TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, contract_id TEXT, type TEXT, actor TEXT,
  data TEXT, prev_hash TEXT, hash TEXT
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS events_contract ON events (contract_id, id);
`;

export type DB = Database;

export function openDb(path = process.env.DB_PATH ?? ".data/foreman.sqlite"): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

export function setting(db: DB, key: string): string | null {
  return (db.query("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | null)?.value ?? null;
}
export function setSetting(db: DB, key: string, value: string) {
  db.query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
