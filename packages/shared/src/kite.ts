// Network constants follow kite-x402-hono `src/networks.ts` (Apache-2.0, BrK),
// which in turn follows gokite-ai/kite-x402-services. Verified live on 2026-11-14:
// rpc-testnet.gokite.ai returns chainId 0x940 (2368); pieUSD name()="pieUSD", decimals()=18;
// facilitator.pieverse.io/v2/supported lists exact/eip155:2368; the token's on-chain DOMAIN_SEPARATOR equals
// hash({name:"pieUSD", version:"1", chainId:2368, verifyingContract}) — `bun run pay-test -- --verify` re-checks all of this.
export type KiteNetworkName = "testnet" | "mainnet";

export interface KiteNetwork {
  name: KiteNetworkName;
  chainId: number;
  caip2: `eip155:${number}`;
  rpc: string;
  explorer: string;
  facilitatorUrl: string;
  token: { address: `0x${string}`; symbol: string; decimals: number; eip712Name: string; eip712Version: string };
}

export const KITE_NETWORKS: Record<KiteNetworkName, KiteNetwork> = {
  testnet: {
    name: "testnet",
    chainId: 2368,
    caip2: "eip155:2368",
    rpc: "https://rpc-testnet.gokite.ai/",
    explorer: "https://testnet.kitescan.ai",
    facilitatorUrl: "https://facilitator.pieverse.io/v2",
    token: {
      address: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A",
      symbol: "pieUSD",
      decimals: 18,
      eip712Name: "pieUSD",
      eip712Version: "1",
    },
  },
  mainnet: {
    name: "mainnet",
    chainId: 2366,
    caip2: "eip155:2366",
    rpc: "https://rpc.gokite.ai/",
    explorer: "https://kitescan.ai",
    facilitatorUrl: "https://facilitator.pieverse.io/v2",
    token: {
      address: "0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e",
      symbol: "USDC.e",
      decimals: 6,
      eip712Name: "Bridged USDC (Kite AI)",
      eip712Version: "2",
    },
  },
};

export function kite(name = process.env.KITE_NETWORK ?? "testnet"): KiteNetwork {
  const n = KITE_NETWORKS[name as KiteNetworkName];
  if (!n) throw new Error(`unknown KITE_NETWORK ${name}`);
  return {
    ...n,
    rpc: process.env.KITE_RPC ?? n.rpc,
    explorer: (process.env.KITE_EXPLORER ?? n.explorer).replace(/\/$/, ""),
    facilitatorUrl: process.env.FACILITATOR_URL ?? n.facilitatorUrl,
    // A self-deployed EIP-3009 token (scripts/deploy-token.ts) replaces the default when set.
    token: process.env.KITE_TOKEN_ADDRESS ? {
      address: process.env.KITE_TOKEN_ADDRESS as `0x${string}`,
      symbol: process.env.KITE_TOKEN_SYMBOL ?? "fUSD",
      decimals: Number(process.env.KITE_TOKEN_DECIMALS ?? 18),
      eip712Name: process.env.KITE_TOKEN_NAME ?? "Foreman Test USD",
      eip712Version: process.env.KITE_TOKEN_VERSION ?? "1",
    } : n.token,
  };
}

/** Kitescan link, or null for simulated settlements (never fabricate a real-looking link). */
export function txLink(tx: string | null | undefined, net = kite()): string | null {
  if (!tx || tx.startsWith("sim:")) return null;
  return `${net.explorer}/tx/${tx}`;
}

export function addressLink(addr: string, net = kite()): string {
  return `${net.explorer}/address/${addr}`;
}
