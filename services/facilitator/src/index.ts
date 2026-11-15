import { privateKeyToAccount } from "viem/accounts";
import { PORTS, num, pk } from "@foreman/shared/env";
import { kite } from "@foreman/shared/kite";
import { createFacilitator, kiteChain } from "./app";

const net = kite();
const key = pk("FACILITATOR_PK");
const gasAddress = privateKeyToAccount(key).address;
// Optional: FACILITATOR_PAYEES=0xabc,0xdef limits settlement to the stack's own sellers.
const payees = (process.env.FACILITATOR_PAYEES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const { app } = createFacilitator({ net, chain: kiteChain(net, key), gasAddress, payees });
const port = num("PORT", PORTS.facilitator);
Bun.serve({ port, fetch: app.fetch });
console.log(`facilitator on :${port} · ${net.caip2} · ${net.token.symbol} ${net.token.address} · gas ${gasAddress}`);
