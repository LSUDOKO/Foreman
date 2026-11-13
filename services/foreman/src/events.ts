import { GENESIS, linkHash, verifyChain } from "@foreman/shared/audit";
import type { EventType, FeedEvent } from "@foreman/shared/types";
import type { DB } from "./db";
import { newId, nowIso } from "./db";

type Listener = (e: FeedEvent) => void;

/** Append-only, hash-chained event log. One global chain so ordering across contracts is provable too. */
export class EventLog {
  private listeners = new Set<Listener>();
  constructor(private db: DB) {}

  emit(type: EventType, actor: string, data: Record<string, unknown>, contractId: string | null): FeedEvent {
    const tx = this.db.transaction(() => {
      const prev = (this.db.query("SELECT hash FROM events ORDER BY id DESC LIMIT 1").get() as { hash: string } | null)?.hash ?? GENESIS;
      const row = { ts: nowIso(), contractId, type, actor, data };
      const hash = linkHash(prev, row);
      const { lastInsertRowid } = this.db
        .query("INSERT INTO events (ts, contract_id, type, actor, data, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(row.ts, contractId, type, actor, JSON.stringify(data), prev, hash);
      return { id: Number(lastInsertRowid), ...row, prevHash: prev, hash } as FeedEvent;
    });
    const e = tx();
    for (const l of this.listeners) l(e);
    return e;
  }

  /** Refusals go to their own table (for the Safety page) and to the chain. */
  refuse(contractId: string | null, code: string, actor: string, action: string, clause: string, evidence: Record<string, unknown>) {
    this.db.query("INSERT INTO refusals (id, contract_id, code, actor, action, clause, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(newId("ref"), contractId, code, actor, action, clause, JSON.stringify(evidence), nowIso());
    return this.emit("refusal", "firewall", { code, action, clause, by: actor, evidence }, contractId);
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  since(id: number, contractId?: string): FeedEvent[] {
    const rows = contractId
      ? this.db.query("SELECT * FROM events WHERE id > ? AND (contract_id = ? OR contract_id IS NULL) ORDER BY id").all(id, contractId)
      : this.db.query("SELECT * FROM events WHERE id > ? ORDER BY id").all(id);
    return (rows as any[]).map(toEvent);
  }

  verify() {
    const rows = (this.db.query("SELECT * FROM events ORDER BY id").all() as any[]).map(toEvent);
    return verifyChain(rows);
  }
}

const toEvent = (r: any): FeedEvent => ({
  id: r.id, ts: r.ts, contractId: r.contract_id, type: r.type, actor: r.actor, data: JSON.parse(r.data), prevHash: r.prev_hash, hash: r.hash,
});
