// x402 smoke test on Kite testnet.
//   bun scripts/pay-test.ts            # $0.01 from FOREMAN_PK to ORACLE_PAYTO through a local paywall, settled by Pieverse
//   bun scripts/pay-test.ts --verify   # only ask the real facilitator to /verify a signed payment (works unfunded)
import { Hono } from "hono";
import { hashDomain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HttpFacilitator } from "@foreman/shared/facilitator";
import { kite, txLink } from "@foreman/shared/kite";
import { addr, pk } from "@foreman/shared/env";
import { unb64 } from "@foreman/shared/x402";
import type { PaymentPayload } from "@foreman/shared/x402";
import { payAndFetch, signPayment } from "@foreman/shared/x402-buyer";
import { paywall, requirementFor } from "@foreman/shared/x402-seller";

const net = kite();
// With fUSD the facilitator is ours (services/facilitator); start it for this run if it isn't up.
let facProc: ReturnType<typeof Bun.spawn> | undefined;
if (/localhost:4500/.test(net.facilitatorUrl) && !(await fetch(`${net.facilitatorUrl}/healthz`).then((r) => r.ok, () => false))) {
  facProc = Bun.spawn(["bun", "services/facilitator/src/index.ts"], { stdout: "inherit", stderr: "inherit" });
  process.on("exit", () => facProc?.kill());
  for (let i = 0; i < 50 && !(await fetch(`${net.facilitatorUrl}/healthz`).then((r) => r.ok, () => false)); i++) await Bun.sleep(200);
}
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
  // 1. Our EIP-712 domain must equal the token's on-chain DOMAIN_SEPARATOR, or every live payment fails.
  const ds = await fetch(net.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: net.token.address, data: "0x3644e515" }, "latest"] }) });
  const onchain = ((await ds.json()) as any).result;
  const ours = hashDomain({ domain: { name: net.token.eip712Name, version: net.token.eip712Version, chainId: BigInt(net.chainId), verifyingContract: net.token.address }, types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] } });
  console.log(`EIP-712 domain: ${ours === onchain ? "matches on-chain DOMAIN_SEPARATOR" : `MISMATCH (ours ${ours}, chain ${onchain})`}`);
  // 2. A valid payload must get past signature checks; a tampered one must not.
  const good = unb64<PaymentPayload>(header);
  const v = await fac.verify(good, req);
  const bad = structuredClone(good);
  const sig = bad.payload.signature;
  bad.payload.signature = `${sig.slice(0, 10)}${sig[10] === "a" ? "b" : "a"}${sig.slice(11)}` as `0x${string}`;
  const t = await fac.verify(bad, req);
  console.log("valid payload    →", JSON.stringify(v));
  console.log("tampered payload →", JSON.stringify(t));
  const sigChecked = /signature/i.test(t.invalidReason ?? "") && !/signature/i.test(v.invalidReason ?? "");
  console.log(sigChecked ? "facilitator verifies our signature; the valid one fails only on " + (v.invalidReason ?? "nothing") : "could not confirm signature checking");
  void app;
  process.exit(ours === onchain && sigChecked ? 0 : 1);
}

const app = new Hono();
app.post("/pay-test", paywall(opts), (c) => c.json({ ok: true }));
const server = Bun.serve({ port: 0, fetch: app.fetch });
const r = await payAndFetch(`http://localhost:${server.port}/pay-test`, { method: "POST" }, { pk: payer, network: net.caip2, guard: () => {} });
server.stop();
console.log(`status ${r.res.status}`, JSON.stringify(r.receipt), r.res.ok ? "" : (await r.res.text()).slice(0, 400));
const link = txLink(r.receipt?.transaction, net);
console.log(link ? `Kitescan: ${link}` : "no transaction (see receipt above)");
process.exit(r.receipt?.success ? 0 : 1);
