// x402 smoke test on Kite testnet.
//   bun scripts/pay-test.ts            # $0.01 from FOREMAN_PK to ORACLE_PAYTO through a local paywall, settled by Pieverse
//   bun scripts/pay-test.ts --verify   # only ask the real facilitator to /verify a signed payment (works unfunded)
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import { HttpFacilitator } from "@foreman/shared/facilitator";
import { kite, txLink } from "@foreman/shared/kite";
import { addr, pk } from "@foreman/shared/env";
import { unb64 } from "@foreman/shared/x402";
import type { PaymentPayload } from "@foreman/shared/x402";
import { payAndFetch, signPayment } from "@foreman/shared/x402-buyer";
import { paywall, requirementFor } from "@foreman/shared/x402-seller";

const net = kite();
const fac = new HttpFacilitator(net.facilitatorUrl);
const payer = pk("FOREMAN_PK");
const payTo = addr("ORACLE_PAYTO");
const opts = { usd: "0.01", payTo, network: net, facilitator: fac, description: "foreman pay-test" };

const balance = async (a: string) => {
  const data = `0x70a08231${a.slice(2).toLowerCase().padStart(64, "0")}`;
  const r = await fetch(net.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: net.token.address, data }, "latest"] }) });
  return BigInt(((await r.json()) as any).result ?? "0x0");
};

console.log(`network ${net.caip2} · token ${net.token.symbol} ${net.token.address} · facilitator ${net.facilitatorUrl}`);
const from = privateKeyToAccount(payer).address;
const bal = await balance(from);
console.log(`payer ${from} balance ${Number(bal) / 10 ** net.token.decimals} ${net.token.symbol}`);

if (process.argv.includes("--verify")) {
  const app = new Hono();
  const req = requirementFor(opts, { req: { url: "http://local/pay-test" } } as any);
  const header = await signPayment(payer, { x402Version: 2, resource: { url: "http://local/pay-test", description: "foreman pay-test", mimeType: "application/json" }, accepts: [req] }, req);
  const v = await fac.verify(unb64<PaymentPayload>(header), req);
  console.log("facilitator /verify →", JSON.stringify(v));
  console.log(v.isValid ? "payload accepted by the live facilitator" : `rejected: ${v.invalidReason} (an unfunded wallet should fail on balance, not on format)`);
  void app;
  process.exit(0);
}

const app = new Hono();
app.post("/pay-test", paywall(opts), (c) => c.json({ ok: true }));
const server = Bun.serve({ port: 0, fetch: app.fetch });
const r = await payAndFetch(`http://localhost:${server.port}/pay-test`, { method: "POST" }, { pk: payer, network: net.caip2, guard: () => {} });
server.stop();
console.log(`status ${r.res.status}`, JSON.stringify(r.receipt));
const link = txLink(r.receipt?.transaction, net);
console.log(link ? `Kitescan: ${link}` : "no transaction (see receipt above)");
process.exit(r.receipt?.success ? 0 : 1);
