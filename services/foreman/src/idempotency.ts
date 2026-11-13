import { sha256 } from "@foreman/shared/canonical";
import type { DB } from "./db";
import { nowIso } from "./db";

export const keys = {
  call: (contractId: string, customerId: string, attemptNo: number) => `call:${sha256(`${contractId}:call:${customerId}:${attemptNo}`)}`,
  booking: (contractId: string, customerId: string) => `booking:${sha256(`${contractId}:booking:${customerId}`)}`,
  email: (contractId: string, outcomeId: string) => `email:${sha256(`${contractId}:email:${outcomeId}`)}`,
  pay: (contractId: string, payee: string, purpose: string, refId: string) => `pay:${sha256(`${contractId}:pay:${payee.toLowerCase()}:${purpose}:${refId}`)}`,
};

export type IdemStatus = "pending" | "done" | "failed";

/** Keys are written *before* a side effect (pending) and flipped after (done). A crash leaves pending for the reconciler. */
export class Idempotency {
  constructor(private db: DB) {}
  status(key: string): IdemStatus | null {
    return (this.db.query("SELECT status FROM idempotency WHERE key = ?").get(key) as { status: IdemStatus } | null)?.status ?? null;
  }
  /** Seen = an action already ran or is in flight. Failed keys may be retried. */
  seen = (key: string) => {
    const s = this.status(key);
    return s === "pending" || s === "done";
  };
  begin(key: string, kind: string): boolean {
    const r = this.db.query("INSERT INTO idempotency (key, kind, status, created_at) VALUES (?, ?, 'pending', ?) ON CONFLICT(key) DO UPDATE SET status = 'pending' WHERE status = 'failed'").run(key, kind, nowIso());
    return r.changes > 0;
  }
  done(key: string, ref: string) { this.db.query("UPDATE idempotency SET status = 'done', ref = ? WHERE key = ?").run(ref, key); }
  fail(key: string) { this.db.query("UPDATE idempotency SET status = 'failed' WHERE key = ?").run(key); }
  ref(key: string): string | null { return (this.db.query("SELECT ref FROM idempotency WHERE key = ?").get(key) as { ref: string } | null)?.ref ?? null; }
  pending(kind: string): string[] {
    return (this.db.query("SELECT key FROM idempotency WHERE status = 'pending' AND kind = ?").all(kind) as { key: string }[]).map((r) => r.key);
  }
}
