import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createForemanMcp } from "./server";
import worker from "./worker";

// In-memory stand-in for the Foreman console API (shapes mirror services/foreman/src/app.ts). No network.
function fakeForeman(token = "tok") {
  const seen: { method: string; path: string; auth?: string }[] = [];
  const contracts: Record<string, any> = {};
  let kill = false;
  const app = new Hono();
  app.use("*", async (c, next) => {
    seen.push({ method: c.req.method, path: c.req.path, auth: c.req.header("authorization") });
    if (c.req.path.startsWith("/api/") && c.req.header("authorization") !== `Bearer ${token}`) return c.json({ error: "unauthorized" }, 401);
    return next();
  });
  app.get("/healthz", (c) => c.json({ ok: true, name: "foreman", modes: { calls: "mock" } }));
  app.get("/api/modes", (c) => c.json({ modes: { calls: "mock", pay: "mock" }, network: "kite-testnet", chainId: 2368, explorer: "https://x", token: { symbol: "fUSD", address: "0x1" }, identities: {} }));
  app.get("/api/kill", (c) => c.json({ killSwitch: kill }));
  app.post("/api/kill", (c) => { kill = true; return c.json({ killSwitch: true, endedCalls: 0 }); });
  app.post("/api/contracts/compile", async (c) => {
    const { goal } = await c.req.json();
    const id = `ctr_test_${Object.keys(contracts).length}`;
    const contract = { id, goal, spend: { currency: "pieUSD", totalBudget: "5.00", perCallCap: "0.50", perCustomerMaxAttempts: 2, expiresAt: "2026-12-01T00:00:00Z" }, outcome: { pricing: { onConfirmed: "3.00", onAttended: "2.00" } }, callPolicy: { allowedHours: { start: "09:00", end: "18:00" } } };
    contracts[id] = { contract, hash: "0xabc", status: "draft" };
    return c.json({ contract, hash: "0xabc", status: "draft", rejectedRequests: [], summary: ["s"], customers: [{ id: "c1" }] });
  });
  app.get("/api/contracts/latest", (c) => { const k = Object.values(contracts).at(-1); return k ? c.json({ ...k, summary: [] }) : c.json({ error: "no_contracts" }, 404); });
  app.get("/api/contracts/:id", (c) => { const k = contracts[c.req.param("id")]; return k ? c.json(k) : c.json({ error: "not_found" }, 404); });
  app.post("/api/contracts/:id/start", (c) => { contracts[c.req.param("id")].status = "running"; return c.json({ status: "running" }); });
  app.get("/api/jobs/:id", (c) => c.json([{ id: "c1", name: "Asha", state: "pending", attempts: [] }]));
  return { seen, contracts, fetchImpl: async (url: string, init?: RequestInit) => app.fetch(new Request(url, init)) };
}

async function connect(f: ReturnType<typeof fakeForeman>, token = "tok") {
  const server = createForemanMcp({ baseUrl: "http://foreman.test/", token, fetchImpl: f.fetchImpl });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const text = (r: any) => r.content.map((x: any) => x.text).join("");

describe("foreman mcp", () => {
  test("lists exactly the safe tools (no approve / unkill)", async () => {
    const { tools } = await (await connect(fakeForeman())).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["foreman_audit_verify", "foreman_compile_goal", "foreman_decisions", "foreman_job", "foreman_kill", "foreman_ledger", "foreman_refusals", "foreman_start", "foreman_status", "foreman_workers"]);
    expect(tools.find((t) => t.name === "foreman_kill")!.description).toContain("human-only");
  });

  test("status + auth header sent on every /api call", async () => {
    const f = fakeForeman();
    const r: any = await (await connect(f)).callTool({ name: "foreman_status", arguments: {} });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ ok: true, network: "kite-testnet", killSwitch: false, latestContract: null });
    const apiCalls = f.seen.filter((s) => s.path.startsWith("/api/"));
    expect(apiCalls.length).toBeGreaterThan(0);
    expect(apiCalls.every((s) => s.auth === "Bearer tok")).toBe(true);
  });

  test("compile returns a draft with limits and the approval note", async () => {
    const r: any = await (await connect(fakeForeman())).callTool({ name: "foreman_compile_goal", arguments: { goal: "Rebook last week's no-shows", csv: "id,name\nc1,Asha" } });
    expect(r.structuredContent).toMatchObject({ id: "ctr_test_0", hash: "0xabc", status: "draft", limits: { totalBudget: "5.00", perCallCap: "0.50" } });
    expect(text(r)).toContain("must review and approve");
  });

  test("start refuses a draft without calling /start, then starts once approved", async () => {
    const f = fakeForeman();
    const client = await connect(f);
    await client.callTool({ name: "foreman_compile_goal", arguments: { goal: "Rebook last week's no-shows", csv: "x" } });
    const r: any = await client.callTool({ name: "foreman_start", arguments: { contractId: "ctr_test_0" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("not \"approved\"");
    expect(f.seen.some((s) => s.path.endsWith("/start"))).toBe(false);
    f.contracts.ctr_test_0.status = "approved"; // a human approved it in the console
    const ok: any = await client.callTool({ name: "foreman_start", arguments: { contractId: "ctr_test_0" } });
    expect(ok.structuredContent).toMatchObject({ status: "running" });
  });

  test("kill engages the switch", async () => {
    const r: any = await (await connect(fakeForeman())).callTool({ name: "foreman_kill", arguments: {} });
    expect(r.structuredContent).toMatchObject({ killSwitch: true });
  });

  test("Foreman errors become MCP tool errors", async () => {
    const bad: any = await (await connect(fakeForeman(), "wrong")).callTool({ name: "foreman_job", arguments: { contractId: "ctr_x" } });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("401");
    expect(text(bad)).toContain("unauthorized");
  });

  test("worker rejects missing/wrong MCP token and describes itself on GET /", async () => {
    const env = { MCP_TOKEN: "secret", FOREMAN_URL: "http://foreman.test" };
    expect((await worker.fetch(new Request("https://w/mcp", { method: "POST" }), env)).status).toBe(401);
    expect((await worker.fetch(new Request("https://w/mcp", { method: "POST", headers: { authorization: "Bearer nope" } }), env)).status).toBe(401);
    expect((await worker.fetch(new Request("https://w/mcp", { method: "POST", headers: { authorization: "Bearer x" } }), {})).status).toBe(401);
    expect(await (await worker.fetch(new Request("https://w/"), env)).json()).toMatchObject({ endpoint: "/mcp" });
    const init = await worker.fetch(new Request("https://w/mcp", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }), env);
    expect(init.status).toBe(200);
    expect(JSON.stringify(await init.json())).toContain("foreman_status");
  });
});
