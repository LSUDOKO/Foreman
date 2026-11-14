// Fill .env with everything a local run needs, keeping every value that's already there.
// Wallets: BUSINESS, FOREMAN and ORACLE_SIGNER get keys; CLEARCALL, QUICKDIAL and ORACLE only need receive addresses.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const path = ".env";
const text = existsSync(path) ? readFileSync(path, "utf8") : "";
const env = new Map<string, string>();
for (const line of text.split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env.set(m[1]!, m[2]!);
}
const added: string[] = [];
const set = (k: string, v: string) => { if (!env.get(k)) { env.set(k, v); added.push(k); } };

// FACILITATOR only pays gas for the self-hosted facilitator (services/facilitator), never holds tokens.
for (const n of ["BUSINESS", "FOREMAN", "ORACLE_SIGNER", "FACILITATOR"]) set(`${n}_PK`, generatePrivateKey());
for (const n of ["BUSINESS", "FOREMAN", "ORACLE_SIGNER", "FACILITATOR"]) set(`${n}_ADDRESS`, privateKeyToAccount(env.get(`${n}_PK`) as `0x${string}`).address);
// Receive-only addresses: services never need these keys. They're kept in .data/receive-keys.json (gitignored)
// so you can sweep testnet funds later.
const receive: Record<string, string> = existsSync(".data/receive-keys.json") ? JSON.parse(readFileSync(".data/receive-keys.json", "utf8")) : {};
for (const n of ["CLEARCALL", "QUICKDIAL", "ORACLE"]) {
  if (!env.get(`${n}_PAYTO`)) {
    const k = generatePrivateKey();
    receive[n] = k;
    set(`${n}_PAYTO`, privateKeyToAccount(k).address);
  }
}
mkdirSync(".data", { recursive: true });
writeFileSync(".data/receive-keys.json", JSON.stringify(receive, null, 2));
set("FOREMAN_PAYTO", env.get("FOREMAN_ADDRESS")!);
set("WORKER_HMAC_SECRET", Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("hex"));
// The console API (kill switch, attendance, exports) is reachable through the :4000 tunnel, so it always has a token.
set("CONSOLE_TOKEN", Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url"));

const defaults: Record<string, string> = {
  SERV_MODEL: "gpt-5.4-mini",
  SERV_BASE_URL: "https://inference-api.openserv.ai/v1",
  KITE_NETWORK: "testnet",
  PAYMENTS_MODE: "sim",
  CLEARCALL_PRICE: "0.50", QUICKDIAL_PRICE: "0.30", BONUS_PRICE: "0.20", ORACLE_PRICE: "0.02",
  INVOICE_CONFIRMED: "4.00", INVOICE_ATTENDED: "2.00", BUSINESS_MAX_PER_OUTCOME: "6.00",
  BUSINESS_NAME: "Smile Dental", BUSINESS_TZ: "Asia/Kolkata", CALCOM_EVENT_TYPE_ID: "1", DB_PATH: ".data/foreman.sqlite",
};
for (const [k, v] of Object.entries(defaults)) set(k, v);

// Fill keys that exist but are blank in place; append the rest.
let keep = text.trim() ? `${text.trimEnd()}\n` : "";
for (const k of added) keep = keep.replace(new RegExp(`^${k}=[ \\t]*$`, "m"), `${k}=${env.get(k)}`);
const extra = added.filter((k) => !new RegExp(`^${k}=`, "m").test(keep)).map((k) => `${k}=${env.get(k)}`).join("\n");
writeFileSync(path, keep + (extra ? `\n# ---- added by bun run setup (${new Date().toISOString()}) ----\n${extra}\n` : ""));

console.log(added.length ? `\nAdded to .env: ${added.join(", ")}` : "\n.env already complete.");
console.log(`\nFund these on Kite testnet (https://faucet.gokite.ai) before PAYMENTS_MODE=live:`);
console.log(`  business ${env.get("BUSINESS_ADDRESS")}\n  foreman  ${env.get("FOREMAN_ADDRESS")}`);
