import { privateKeyToAccount } from "viem/accounts";
import { addr, num, pk, PORTS, str, urls } from "@foreman/shared/env";
import { kite } from "@foreman/shared/kite";
import { createPayer } from "./app";

const businessPk = pk("BUSINESS_PK");
const U = urls();
const { app, tick } = createPayer({
  pk: businessPk,
  address: privateKeyToAccount(businessPk).address,
  network: kite(),
  foremanUrl: U.foreman,
  oracleUrl: U.oracle,
  foremanPayTo: addr("FOREMAN_ADDRESS"),
  oraclePayTo: addr("ORACLE_PAYTO"),
  oracleSigner: addr("ORACLE_SIGNER_ADDRESS"),
  maxPerOutcome: str("BUSINESS_MAX_PER_OUTCOME", "6.00"),
  maxOraclePrice: str("ORACLE_PRICE", "0.02"),
  foremanToken: process.env.CONSOLE_TOKEN || undefined,
});

setInterval(() => void tick(), num("PAYER_INTERVAL_MS", 10_000));

const port = num("PORT", PORTS.payer);
export default { port, fetch: app.fetch, idleTimeout: 60 };
console.log(`business-payer on :${port}`);
