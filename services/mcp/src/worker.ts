import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createForemanMcp } from "./server";

export interface Env { FOREMAN_URL?: string; CONSOLE_TOKEN?: string; MCP_TOKEN?: string }

/** Constant-time compare so the bearer check doesn't leak MCP_TOKEN by timing. */
const same = (a: string, b: string) => {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/" && req.method === "GET")
      return Response.json({ name: "foreman-mcp", description: "MCP server for Foreman (outcome agent: contracts, phone-worker calls, proof oracle, x402 settlement on Kite testnet). Approve and unkill are human-only.", endpoint: "/mcp", transport: "streamable-http", auth: "Authorization: Bearer <MCP_TOKEN>" });
    if (pathname !== "/mcp") return Response.json({ error: "not_found" }, { status: 404 });
    // Fail closed: no MCP_TOKEN configured means nobody gets in.
    const t = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!env.MCP_TOKEN || !same(t, env.MCP_TOKEN)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
    // Stateless: a fresh server + transport per request.
    const server = createForemanMcp({ baseUrl: env.FOREMAN_URL || "http://localhost:4000", token: env.CONSOLE_TOKEN });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(req);
  },
};
