// Deploy the fUSD test stablecoin (EIP-3009) on Kite testnet, mint test funds, and give the self-hosted
// facilitator some KITE for gas. Gas comes from FOREMAN's KITE (faucet.gokite.ai). Safe to re-run: an existing
// KITE_TOKEN_ADDRESS is reused and balances are only topped up to the targets.
//   bun scripts/deploy-token.ts
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, formatEther, formatUnits, hashDomain, http, parseEther, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { KITE_NETWORKS, txLink } from "@foreman/shared/kite";
import { addressOf, pk } from "@foreman/shared/env";
import type { Hex } from "@foreman/shared/types";

const net = KITE_NETWORKS.testnet;
const artifact = JSON.parse(readFileSync("contracts/ForemanTestUSD.json", "utf8")) as { abi: any[]; bytecode: Hex };
const chain = defineChain({ id: net.chainId, name: "Kite testnet", nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 }, rpcUrls: { default: { http: [process.env.KITE_RPC ?? net.rpc] } } });
const owner = privateKeyToAccount(pk("FOREMAN_PK"));
const pub = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ account: owner, chain, transport: http() });
const gasWallet = addressOf("FACILITATOR_PK");

const TARGETS: [string, Hex, string][] = [["business", addressOf("BUSINESS_PK"), "50"], ["foreman", owner.address, "20"]];
const FACILITATOR_GAS = parseEther("0.25");

console.log(`deployer ${owner.address} · ${formatEther(await pub.getBalance({ address: owner.address }))} KITE`);

let token = process.env.KITE_TOKEN_ADDRESS as Hex | undefined;
if (token && (await pub.getCode({ address: token }))) {
  console.log(`reusing fUSD at ${token}`);
} else {
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success" || !r.contractAddress) throw new Error(`deploy failed: ${txLink(hash, net)}`);
  token = r.contractAddress;
  console.log(`deployed fUSD at ${token}\n  ${txLink(hash, net)}`);
}

const read = (functionName: string, args: unknown[] = []) => pub.readContract({ address: token!, abi: artifact.abi, functionName, args }) as Promise<any>;
const domain = hashDomain({
  domain: { name: await read("name"), version: await read("version"), chainId: BigInt(net.chainId), verifyingContract: token },
  types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] },
});
if (domain !== (await read("DOMAIN_SEPARATOR"))) throw new Error("EIP-712 domain mismatch: signatures would not verify");
console.log("EIP-712 domain matches on-chain DOMAIN_SEPARATOR");

for (const [who, address, amount] of TARGETS) {
  const have = (await read("balanceOf", [address])) as bigint;
  const want = parseUnits(amount, 18);
  if (have >= want) { console.log(`${who.padEnd(8)} ${formatUnits(have, 18)} fUSD (ok)`); continue; }
  const hash = await wallet.writeContract({ address: token, abi: artifact.abi, functionName: "mint", args: [address, want - have] });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`${who.padEnd(8)} minted ${formatUnits(want - have, 18)} fUSD → ${amount}\n  ${txLink(hash, net)}`);
}

const gas = await pub.getBalance({ address: gasWallet });
if (gas < FACILITATOR_GAS / 2n) {
  const hash = await wallet.sendTransaction({ to: gasWallet, value: FACILITATOR_GAS - gas });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`facilitator gas wallet ${gasWallet} topped up to ${formatEther(FACILITATOR_GAS)} KITE\n  ${txLink(hash, net)}`);
} else console.log(`facilitator gas wallet ${gasWallet} has ${formatEther(gas)} KITE (ok)`);

console.log(`\nSet these in .env:\n  KITE_TOKEN_ADDRESS=${token}\n  PAYMENTS_MODE=live\n  FACILITATOR_URL=http://localhost:4500`);
