// Anchor the audit-chain head on Kite: a 0-value self-transfer from Foreman's wallet whose calldata is the head hash.
// Needs a little KITE for gas in FOREMAN's wallet (faucet.gokite.ai).
//   bun scripts/anchor.ts [contractId]
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { kite, txLink } from "@foreman/shared/kite";
import { pk, urls } from "@foreman/shared/env";

const net = kite();
const chain = defineChain({ id: net.chainId, name: `Kite ${net.name}`, nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 }, rpcUrls: { default: { http: [net.rpc] } } });
const account = privateKeyToAccount(pk("FOREMAN_PK"));

const auth = { headers: { authorization: `Bearer ${process.env.CONSOLE_TOKEN ?? ""}` } };
const id = process.argv[2] ?? (await (await fetch(`${urls().foreman}/api/contracts/latest`, auth)).json() as any).contract?.id;
const audit = (await (await fetch(`${urls().foreman}/api/audit/verify/${id}`, auth)).json()) as { ok: boolean; events: number; head: string };
if (!audit.ok) { console.error("audit chain does not verify — refusing to anchor", audit); process.exit(1); }

const pub = createPublicClient({ chain, transport: http() });
const gas = await pub.getBalance({ address: account.address });
if (gas === 0n) { console.error(`${account.address} has no KITE for gas. Fund it at https://faucet.gokite.ai`); process.exit(1); }

const head = audit.head.replace("sha256:", "");
const wallet = createWalletClient({ account, chain, transport: http() });
const hash = await wallet.sendTransaction({ to: account.address, value: 0n, data: `0x${head}` });
await pub.waitForTransactionReceipt({ hash });
console.log(`anchored ${audit.events} events, head sha256:${head}\n${txLink(hash, net)}`);
