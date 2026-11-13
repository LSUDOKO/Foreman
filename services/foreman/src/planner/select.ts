import { z } from "zod";
import { servJson } from "@foreman/shared/serv";
import type { ServDecision } from "@foreman/shared/serv";
import type { Worker } from "../store";

export interface Selection { worker: Worker; reason: string; probation: boolean; source: "rule" | "live" | "fallback" }

const SYSTEM = `You choose which phone-worker agent to hire for one outbound call.
Weigh price per call, bonus, reputation (0-100) and the remaining budget. Cheaper is better only if reputation is comparable.
Output: {"worker": "<name from the list>", "reason": "<one sentence>"}`;

const Choice = z.object({ worker: z.string(), reason: z.string() });

/**
 * Deterministic first: workers under the floor are never hired; a new worker with probation left gets exactly one
 * call once the job already has a verified call to compare against. SERV only chooses among the rest.
 */
export async function selectWorker(
  workers: Worker[],
  o: { floor: number; verifiedCalls: number; remainingBudget: string; exclude?: string[] },
): Promise<{ sel: Selection | null; decision?: ServDecision<z.infer<typeof Choice>> }> {
  const pool = workers.filter((w) => !o.exclude?.includes(w.name));
  const probation = pool.find((w) => w.isNew && w.probationLeft > 0);
  if (probation && o.verifiedCalls > 0)
    return { sel: { worker: probation, probation: true, source: "rule", reason: `${probation.name} is new: the contract grants one probation call (workerPolicy.probationCallsForNewWorkers).` } };
  const eligible = pool.filter((w) => w.reputation >= o.floor && !(w.isNew && w.probationLeft > 0));
  if (!eligible.length) return { sel: null };
  if (eligible.length === 1)
    return { sel: { worker: eligible[0]!, probation: false, source: "rule", reason: `${eligible[0]!.name} is the only eligible worker above the reputation floor (${o.floor}).` } };

  const decision = await servJson({
    purpose: "select_worker",
    system: SYSTEM,
    user: JSON.stringify({ remainingBudget: o.remainingBudget, quotes: eligible.map((w) => ({ name: w.name, pricePerCall: w.price, bonus: w.bonus, reputation: w.reputation })) }),
    schema: Choice,
    effort: "low",
    timeoutMs: 20_000,
    fallback: () => {
      const best = [...eligible].sort((a, b) => b.reputation - a.reputation || Number(a.price) - Number(b.price))[0]!;
      return { worker: best.name, reason: `Highest reputation (${best.reputation}) at $${best.price} per call.` };
    },
  });
  // The model names a worker; the server maps the name. An unknown name falls back to the best eligible worker.
  const w = eligible.find((x) => x.name.toLowerCase() === decision.data.worker.toLowerCase())
    ?? [...eligible].sort((a, b) => b.reputation - a.reputation)[0]!;
  return { sel: { worker: w, probation: false, source: decision.source, reason: decision.data.reason }, decision };
}
