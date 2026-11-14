import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createForemanMcp } from "./server";

const server = createForemanMcp({ baseUrl: process.env.FOREMAN_URL || "http://localhost:4000", token: process.env.CONSOLE_TOKEN || undefined });
await server.connect(new StdioServerTransport());
