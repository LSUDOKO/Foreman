import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface ForemanMcpOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
}

type Json = any;
type Out = { text: string; data: Record<string, unknown> };

const HUMAN_ONLY =
  "Approving a contract (authorising spend) and releasing the kill switch are human-only steps done in the Foreman console; this server cannot do either.";

/** MCP server wrapping the Foreman console API. Read tools are safe; only compile, start and kill mutate. */
export function createForemanMcp({ baseUrl, token, fetchImpl = fetch }: ForemanMcpOptions) {
  const base = baseUrl.replace(/\/+$/, "");
  const server = new McpServer({ name: "foreman", version: "0.1.0" }, { instructions: `Foreman is an outcome agent: it compiles a business goal into a spend contract, calls no-show customers via phone-worker agents, verifies outcomes with a proof oracle and settles payments over x402 on Kite testnet. ${HUMAN_ONLY}` });

  const api = async (path: string, init: { method?: string; body?: unknown } = {}): Promise<Json> => {
    const method = init.method ?? "GET";
    const r = await fetchImpl(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const extra = data && typeof data === "object" ? Object.entries(data).filter(([k]) => k !== "error").map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ") : "";
      throw new Error(`Foreman ${method} ${path} failed (${r.status}): ${data?.error ?? r.statusText}${extra ? ` ${extra}` : ""}`);
    }
    return data;
  };
  const latest = async (): Promise<Json | null> => {
    try { return await api("/api/contracts/latest"); }
    catch (e) { if (String((e as Error).message).includes("no_contracts")) return null; throw e; }
  };
  const idOf = async (id?: string) => {
    if (id) return id;
    const k = await latest();
    if (!k) throw new Error("No contracts yet; compile one with foreman_compile_goal.");
    return k.contract.id as string;
  };
  const enc = encodeURIComponent;
  const contractId = { contractId: z.string().optional().describe("Contract id (ctr_…). Defaults to the latest contract.") };

  const tool = <S extends z.ZodRawShape>(name: string, description: string, shape: S, readOnly: boolean, run: (a: z.infer<z.ZodObject<S>>) => Promise<Out>) =>
    server.registerTool(name, { description, inputSchema: shape, annotations: { readOnlyHint: readOnly, openWorldHint: true } }, (async (a: z.infer<z.ZodObject<S>>) => {
      try {
        const { text, data } = await run(a);
        return { content: [{ type: "text" as const, text: `${text}\n\n${JSON.stringify(data)}` }], structuredContent: data };
      } catch (e) {
        return { isError: true, content: [{ type: "text" as const, text: (e as Error).message ?? String(e) }] };
      }
    }) as any);

  tool("foreman_status", "Foreman health, adapter modes (live vs mock), network/settlement token, kill-switch state and the latest contract.", {}, true, async () => {
    const [health, modes, kill, k] = await Promise.all([api("/healthz"), api("/api/modes"), api("/api/kill"), latest()]);
    const c = k ? { id: k.contract.id, status: k.status, hash: k.hash, goal: k.contract.goal, summary: k.summary } : null;
    return {
      text: [
        `Foreman ${health.ok ? "up" : "DOWN"} on ${modes.network} (chain ${modes.chainId}), token ${modes.token?.symbol}.`,
        `Modes: ${Object.entries(modes.modes ?? {}).map(([k, v]) => `${k}=${v}`).join(", ")}.`,
        `Kill switch: ${kill.killSwitch ? "ENGAGED" : "off"}.`,
        c ? `Latest contract ${c.id} is ${c.status}.` : "No contracts yet.",
      ].join("\n"),
      data: { ok: !!health.ok, modes: modes.modes, network: modes.network, chainId: modes.chainId, explorer: modes.explorer, token: modes.token, killSwitch: !!kill.killSwitch, latestContract: c },
    };
  });

  tool("foreman_compile_goal",
    `Compile a business goal plus a customer CSV into a DRAFT outcome contract (spend limits, call policy, proof rules). Nothing is spent or called. The draft must then be approved by a human in the Foreman console before it can start. ${HUMAN_ONLY}`,
    {
      goal: z.string().min(10).describe("Business goal in plain language, e.g. 'Rebook last week's no-shows, spend at most $5'."),
      csv: z.string().describe("Customer CSV with header id,name,phone,email,missed_at,consent_source (phone E.164, missed_at ISO 8601)."),
    }, false, async ({ goal, csv }) => {
      const r = await api("/api/contracts/compile", { method: "POST", body: { goal, csv } });
      const s = r.contract.spend;
      const limits = { totalBudget: s.totalBudget, perCallCap: s.perCallCap, perCustomerMaxAttempts: s.perCustomerMaxAttempts, expiresAt: s.expiresAt, currency: s.currency, pricing: r.contract.outcome.pricing, allowedHours: r.contract.callPolicy.allowedHours };
      const note = "A human must review and approve this contract in the Foreman console before it can start.";
      return {
        text: `Draft contract ${r.contract.id} (hash ${r.hash}) for ${r.customers.length} customer(s). Budget $${s.totalBudget}, max $${s.perCallCap}/payment, ${s.perCustomerMaxAttempts} attempt(s)/customer, expires ${s.expiresAt}.${r.rejectedRequests?.length ? ` Rejected requests: ${r.rejectedRequests.length}.` : ""}\n${note}`,
        data: { id: r.contract.id, hash: r.hash, status: r.status, limits, rejectedRequests: r.rejectedRequests, summary: r.summary, customers: r.customers.length, note },
      };
    });

  tool("foreman_start",
    `Start an APPROVED contract: Foreman begins calling customers and paying workers within the approved limits. Refuses drafts. ${HUMAN_ONLY}`,
    { contractId: z.string().describe("Contract id (ctr_…) that a human has approved.") }, false, async ({ contractId: id }) => {
      const k = await api(`/api/contracts/${enc(id)}`);
      if (k.status !== "approved") throw new Error(`Contract ${id} is "${k.status}", not "approved". A human must approve it in the Foreman console first; this server cannot approve.`);
      const r = await api(`/api/contracts/${enc(id)}/start`, { method: "POST" });
      return { text: `Contract ${id} is ${r.status}.`, data: { id, ...r } };
    });

  tool("foreman_job", "Customers on a contract with their current state and call attempts (contact details masked).", contractId, true, async (a) => {
    const id = await idOf(a.contractId);
    const customers: Json[] = await api(`/api/jobs/${enc(id)}`);
    const byState: Record<string, number> = {};
    for (const c of customers) byState[c.state] = (byState[c.state] ?? 0) + 1;
    return {
      text: `${id}: ${customers.length} customer(s). ${Object.entries(byState).map(([s, n]) => `${s}=${n}`).join(", ") || "none"}.\n${customers.map((c) => `- ${c.id} ${c.name}: ${c.state}${c.refusal ? ` (refusal: ${c.refusal})` : ""}, ${c.attempts?.length ?? 0} attempt(s)`).join("\n")}`,
      data: { contractId: id, byState, customers },
    };
  });

  tool("foreman_ledger", "Money in (business invoices) and out (worker payments), margin, and explorer links for each settled tx.", contractId, true, async (a) => {
    const id = await idOf(a.contractId);
    const r = await api(`/api/ledger/${enc(id)}`);
    const line = (p: Json) => `- ${p.direction} $${p.amount} ${p.purpose} ${p.counterparty ?? ""} ${p.link ?? p.txHash ?? ""}`.trim();
    return {
      text: `${id}: earned $${r.totals.earned}, spent $${r.totals.spent}, margin $${r.totals.margin}. ${r.in.length} in, ${r.out.length} out.\n${[...r.in, ...r.out].map(line).join("\n")}`,
      data: { contractId: id, ...r },
    };
  });

  tool("foreman_workers", "Phone-worker agents with price, bonus, reputation, probation and reputation history.", {}, true, async () => {
    const ws: Json[] = await api("/api/workers");
    return {
      text: ws.map((w) => `- ${w.name}: reputation ${w.reputation}, $${w.price}/call (+$${w.bonus} bonus)${w.probationLeft ? `, probation ${w.probationLeft}` : ""}${w.badge ? `, ${w.badge}` : ""}`).join("\n") || "No workers.",
      data: { workers: ws },
    };
  });

  tool("foreman_refusals", "Actions Foreman refused because they would break the contract (budget, consent, hours, payee allowlist…).", contractId, true, async (a) => {
    const id = await idOf(a.contractId);
    const rs: Json[] = await api(`/api/refusals/${enc(id)}`);
    return { text: `${id}: ${rs.length} refusal(s).\n${rs.map((r) => `- ${r.code} by ${r.actor}: ${r.action}${r.clause ? ` (clause ${r.clause})` : ""}`).join("\n")}`, data: { contractId: id, refusals: rs } };
  });

  tool("foreman_decisions", "SERV decisions (Foreman's recorded reasoning: plans, worker choice, retries) for a contract.", contractId, true, async (a) => {
    const id = await idOf(a.contractId);
    const ds: Json[] = await api(`/api/decisions/${enc(id)}`);
    return { text: `${id}: ${ds.length} SERV decision(s).\n${ds.map((d) => `- [${d.ts}] ${JSON.stringify(d.data).slice(0, 200)}`).join("\n")}`, data: { contractId: id, decisions: ds } };
  });

  tool("foreman_audit_verify", "Verify the hash-chained audit log (the whole chain, all contracts). Reports whether it is intact.", contractId, true, async (a) => {
    const id = a.contractId ?? (await latest())?.contract.id ?? "all";
    const r = await api(`/api/audit/verify/${enc(id)}`);
    return { text: `Audit chain ${r.ok ? "INTACT" : "BROKEN"}: ${r.events} event(s), head ${r.head}.`, data: r };
  });

  tool("foreman_kill",
    "Engage the kill switch: stop all new calls and payments and end in-flight calls immediately. Use when anything looks wrong. Releasing it is human-only (console, typing the business name); this server cannot release it.",
    {}, false, async () => {
      const r = await api("/api/kill", { method: "POST" });
      return { text: `Kill switch ENGAGED; ended ${r.endedCalls} in-flight call(s). Only a human can release it from the console.`, data: r };
    });

  return server;
}
