import { privateKeyToAccount } from "viem/accounts";
import { PORTS, num, pk } from "@foreman/shared/env";
import { kite } from "@foreman/shared/kite";
import { createFacilitator, kiteChain } from "./app";

const net = kite();
const key = pk("FACILITATOR_PK");
const gasAddress = privateKeyToAccount(key).address;
const { app } = createFacilitator({ net, chain: kiteChain(net, key), gasAddress });
const port = num("PORT", PORTS.facilitator);
Bun.serve({ port, fetch: app.fetch });
console.log(`facilitator on :${port} · ${net.caip2} · ${net.token.symbol} ${net.token.address} · gas ${gasAddress}`);
