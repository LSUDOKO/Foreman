// Start every service with its own env, prefix their logs, and stop them all on Ctrl-C.
// Port map: foreman 4000 · ClearCall 4110 · QuickDial 4111 · oracle 4210 · business-payer 4300 · sandbox 4400 · console 5173.
// x402 paywalls run in-process on each seller (per-route prices), so there are no separate wrapper ports.
import type { Subprocess } from "bun";

export interface Svc { name: string; cwd?: string; cmd: string[]; env?: Record<string, string>; color: number }

export const SERVICES = (extra: Record<string, string> = {}): Svc[] => [
  { name: "sandbox", cmd: ["bun", "services/sandbox/src/index.ts"], color: 90 },
  { name: "oracle", cmd: ["bun", "services/proof-oracle/src/index.ts"], color: 36 },
  { name: "clearcall", cmd: ["bun", "services/phone-worker/src/index.ts"], env: { WORKER_NAME: "ClearCall", WORKER_MODE: "honest", PORT: "4110" }, color: 32 },
  { name: "quickdial", cmd: ["bun", "services/phone-worker/src/index.ts"], env: { WORKER_NAME: "QuickDial", WORKER_MODE: "faulty", PORT: "4111" }, color: 33 },
  { name: "foreman", cmd: ["bun", "services/foreman/src/index.ts"], color: 35 },
  { name: "payer", cmd: ["bun", "services/business-payer/src/index.ts"], color: 34 },
].map((s) => ({ ...s, env: { ...s.env, ...extra } }));

export function startAll(svcs: Svc[], quiet = false): Subprocess[] {
  return svcs.map((s) => {
    const p = Bun.spawn(s.cmd, { cwd: s.cwd, env: { ...process.env, ...s.env }, stdout: "pipe", stderr: "pipe" });
    const tag = `\x1b[${s.color}m${s.name.padEnd(9)}\x1b[0m`;
    for (const stream of [p.stdout, p.stderr])
      void (async () => {
        const dec = new TextDecoder();
        for await (const chunk of stream as ReadableStream<Uint8Array>)
          if (!quiet) for (const line of dec.decode(chunk).split("\n")) if (line.trim()) console.log(`${tag} ${line}`);
      })();
    return p;
  });
}

export async function waitHealthy(ports: number[], timeoutMs = 20_000) {
  const t0 = Date.now();
  for (const port of ports) {
    while (true) {
      try { if ((await fetch(`http://localhost:${port}/healthz`)).ok) break; } catch {}
      if (Date.now() - t0 > timeoutMs) throw new Error(`service on :${port} did not become healthy`);
      await Bun.sleep(200);
    }
  }
}

if (import.meta.main) {
  const procs = startAll(SERVICES());
  if (!process.argv.includes("--no-console"))
    // Vite only reads apps/console/.env*, so hand it the API URL and console token explicitly.
    procs.push(...startAll([{ name: "console", cwd: "apps/console", cmd: ["bun", "run", "dev"], color: 37, env: {
      VITE_API_URL: process.env.VITE_API_URL ?? "http://localhost:4000", VITE_CONSOLE_TOKEN: process.env.CONSOLE_TOKEN ?? "",
    } }]));
  const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await waitHealthy([4400, 4210, 4110, 4111, 4000, 4300]).then(
    () => console.log("\nall services healthy · console http://localhost:5173 · API http://localhost:4000\n"),
    (e) => console.error(String(e)),
  );
}
