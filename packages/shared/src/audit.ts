import { canonical, sha256 } from "./canonical";

export const GENESIS = "sha256:genesis";

export interface ChainRow { ts: string; contractId: string | null; type: string; actor: string; data: unknown }

/** hash = sha256(prevHash || canonical(row)). Tampering with any earlier row breaks every later hash. */
export function linkHash(prevHash: string, row: ChainRow): string {
  return `sha256:${sha256(prevHash + canonical(row))}`;
}

export function verifyChain(rows: (ChainRow & { prevHash: string; hash: string })[]) {
  let prev = rows[0]?.prevHash ?? GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.prevHash !== prev) return { ok: false as const, brokenAt: i, reason: "prev_hash_mismatch" };
    const { prevHash: _p, hash, ...row } = r;
    const h = linkHash(prev, { ts: row.ts, contractId: row.contractId, type: row.type, actor: row.actor, data: row.data });
    if (h !== hash) return { ok: false as const, brokenAt: i, reason: "hash_mismatch" };
    prev = hash;
  }
  return { ok: true as const, events: rows.length, head: prev };
}
