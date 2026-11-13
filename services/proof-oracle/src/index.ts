import { addr, num, pk, PORTS, str, urls } from "@foreman/shared/env";
import { facilitatorFromEnv } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import { createOracle } from "./app";

const app = createOracle({
  network: kite(),
  facilitator: facilitatorFromEnv(),
  payTo: addr("ORACLE_PAYTO"),
  price: str("ORACLE_PRICE", "0.02"),
  signerPk: pk("ORACLE_SIGNER_PK"),
  foremanUrl: urls().foreman,
  foremanAddress: addr("FOREMAN_ADDRESS"),
  businessAddress: addr("BUSINESS_ADDRESS"),
});

const port = num("PORT", PORTS.oracle);
export default { port, fetch: app.fetch };
console.log(`proof-oracle on :${port}`);
