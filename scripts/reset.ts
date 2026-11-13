// Fresh state before a rehearsal or the recorded run: worker reputations, probation, kill switch and opt-outs
// all live in the database and persist across runs otherwise.
//   bun run reset
import { existsSync, rmSync } from "node:fs";

const db = process.env.DB_PATH ?? ".data/foreman.sqlite";
for (const f of [db, `${db}-wal`, `${db}-shm`]) if (existsSync(f)) rmSync(f);
console.log(`removed ${db} — next start reseeds ClearCall (90) and QuickDial (80, one probation call)`);
