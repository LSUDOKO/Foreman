// ForemanTestUSD (fUSD) against a real EVM: spawns anvil on a random high port, deploys the committed bytecode
// (contracts/ForemanTestUSD.json) with viem and exercises EIP-3009 the way the x402 facilitator does.
// Skipped when anvil isn't installed (set ANVIL_BIN, or install Foundry). Never touches Kite or any env RPC.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import {
  createPublicClient, createTestClient, createWalletClient, defineChain, hashDomain, http, maxUint256, parseEther, toHex,
} from "viem";
import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import artifact from "../../contracts/ForemanTestUSD.json";
import { LocalFacilitator } from "../../packages/shared/src/facilitator";
import { TRANSFER_WITH_AUTHORIZATION } from "../../packages/shared/src/x402";
import type { PaymentPayload, PaymentRequirements } from "../../packages/shared/src/x402";

const ANVIL = [process.env.ANVIL_BIN, Bun.which("anvil"), `${homedir()}/.config/.foundry/bin/anvil`, `${homedir()}/.foundry/bin/anvil`]
  .find((p): p is string => !!p && existsSync(p));
const CHAIN_ID = 2368; // same chain id as Kite testnet, so the EIP-712 domain matches what production signs
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n; // secp256k1 order
const abi = artifact.abi;

let proc: ReturnType<typeof Bun.spawn> | undefined;
let pub: ReturnType<typeof createPublicClient>;
let token: Address;
let rpc = "";
const chain = defineChain({ id: CHAIN_ID, name: "anvil-kite", nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1"] } } });

const ownerPk = generatePrivateKey(), alicePk = generatePrivateKey(), relayerPk = generatePrivateKey(), mallory = generatePrivateKey();
const owner = privateKeyToAccount(ownerPk), alice = privateKeyToAccount(alicePk), relayer = privateKeyToAccount(relayerPk);
const bob = privateKeyToAccount(generatePrivateKey()).address;
const wallet = (pk: Hex) => createWalletClient({ account: privateKeyToAccount(pk), chain, transport: http(rpc) });

async function send(pk: Hex, functionName: string, args: unknown[]) {
  const hash = await wallet(pk).writeContract({ address: token, abi, functionName, args } as any);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`reverted: ${functionName}`);
  return r;
}
/** Simulate first so a revert surfaces its reason string. */
async function reverts(pk: Hex, functionName: string, args: unknown[]) {
  return pub.simulateContract({ account: privateKeyToAccount(pk), address: token, abi, functionName, args } as any);
}
const read = (functionName: string, args: unknown[] = []) => pub.readContract({ address: token, abi, functionName, args } as any) as Promise<any>;
const now = async () => (await pub.getBlock()).timestamp;
const nonce = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

interface Auth { from: Address; to: Address; value: bigint; validAfter: bigint; validBefore: bigint; nonce: Hex }
async function auth(o: Partial<Auth> = {}): Promise<Auth> {
  const t = await now();
  return { from: alice.address, to: bob, value: parseEther("1"), validAfter: t - 600n, validBefore: t + 300n, nonce: nonce(), ...o };
}
const sign = (pk: Hex, a: Auth, domain: Partial<{ name: string; version: string; chainId: number; verifyingContract: Address }> = {}) =>
  privateKeyToAccount(pk).signTypedData({
    domain: { name: "Foreman Test USD", version: "1", chainId: CHAIN_ID, verifyingContract: token, ...domain },
    types: TRANSFER_WITH_AUTHORIZATION, primaryType: "TransferWithAuthorization", message: a,
  });
const args = (a: Auth, sig: Hex) => [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, sig];
const vrs = (sig: Hex) => ({ r: `0x${sig.slice(2, 66)}` as Hex, s: BigInt(`0x${sig.slice(66, 130)}`), v: parseInt(sig.slice(130, 132), 16) });
/** The other valid ECDSA signature for the same digest: s' = n - s, v flipped. */
function malleate(sig: Hex): Hex {
  const { r, s, v } = vrs(sig);
  return `${r}${(N - s).toString(16).padStart(64, "0")}${(v === 27 ? 28 : 27).toString(16)}` as Hex;
}

beforeAll(async () => {
  if (!ANVIL) return;
  const port = 20000 + Math.floor(Math.random() * 40000);
  rpc = `http://127.0.0.1:${port}`;
  proc = Bun.spawn([ANVIL, "--port", String(port), "--chain-id", String(CHAIN_ID), "--silent"], { stdout: "ignore", stderr: "ignore" });
  pub = createPublicClient({ chain, transport: http(rpc) });
  for (let i = 0; ; i++) {
    try { await pub.getChainId(); break; } catch { if (i > 100) throw new Error("anvil did not start"); await Bun.sleep(100); }
  }
  const tc = createTestClient({ chain, mode: "anvil", transport: http(rpc) });
  for (const a of [owner, alice, relayer, privateKeyToAccount(mallory)]) await tc.setBalance({ address: a.address, value: parseEther("10") });
  const hash = await wallet(ownerPk).deployContract({ abi, bytecode: artifact.bytecode as Hex });
  token = (await pub.waitForTransactionReceipt({ hash })).contractAddress!;
  await send(ownerPk, "mint", [alice.address, parseEther("100")]);
}, 30_000);

afterAll(() => { proc?.kill(); });

describe.skipIf(!ANVIL)("ForemanTestUSD on anvil (EIP-3009)", () => {
  test("metadata, owner and the EIP-712 domain separator match what x402 clients sign", async () => {
    expect(await read("name")).toBe("Foreman Test USD");
    expect(await read("symbol")).toBe("fUSD");
    expect(await read("version")).toBe("1");
    expect(await read("decimals")).toBe(18);
    expect((await read("owner")).toLowerCase()).toBe(owner.address.toLowerCase());
    expect(await read("DOMAIN_SEPARATOR")).toBe(hashDomain({ domain: { name: "Foreman Test USD", version: "1", chainId: BigInt(CHAIN_ID), verifyingContract: token }, types: { EIP712Domain: [
      { name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
    ] } }));
  });

  test("only the owner can mint", async () => {
    await expect(reverts(alicePk, "mint", [alice.address, 1n])).rejects.toThrow("only owner");
    const before = await read("totalSupply");
    await send(ownerPk, "mint", [bob, 5n]);
    expect(await read("totalSupply")).toBe(before + 5n);
  });

  test("a relayer submits a signed authorization: funds move, nonce is marked used", async () => {
    const a = await auth();
    const sig = await sign(alicePk, a);
    const [ab, bb] = [await read("balanceOf", [alice.address]), await read("balanceOf", [bob])];
    expect(await read("authorizationState", [alice.address, a.nonce])).toBe(false);
    const r = await send(relayerPk, "transferWithAuthorization", args(a, sig));
    expect(r.logs.length).toBe(2); // AuthorizationUsed + Transfer
    expect(await read("balanceOf", [alice.address])).toBe(ab - a.value);
    expect(await read("balanceOf", [bob])).toBe(bb + a.value);
    expect(await read("authorizationState", [alice.address, a.nonce])).toBe(true);
  });

  test("a replayed nonce is rejected, through either overload", async () => {
    const a = await auth();
    const sig = await sign(alicePk, a);
    await send(relayerPk, "transferWithAuthorization", args(a, sig));
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, sig))).rejects.toThrow("authorization used");
    const { v, r, s } = vrs(sig);
    await expect(reverts(relayerPk, "transferWithAuthorization", [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, v, r, toHex(s, { size: 32 })]))
      .rejects.toThrow("authorization used");
  });

  test("the v/r/s overload settles a fresh authorization", async () => {
    const a = await auth({ value: 7n });
    const { v, r, s } = vrs(await sign(alicePk, a));
    await send(relayerPk, "transferWithAuthorization", [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, v, r, toHex(s, { size: 32 })]);
    expect(await read("authorizationState", [alice.address, a.nonce])).toBe(true);
  });

  test("expired and not-yet-valid authorizations are rejected with their reasons", async () => {
    const t = await now();
    const old = await auth({ validAfter: 0n, validBefore: t - 1n });
    await expect(reverts(relayerPk, "transferWithAuthorization", args(old, await sign(alicePk, old)))).rejects.toThrow("authorization expired");
    const future = await auth({ validAfter: t + 3600n, validBefore: t + 7200n });
    await expect(reverts(relayerPk, "transferWithAuthorization", args(future, await sign(alicePk, future)))).rejects.toThrow("authorization not yet valid");
  });

  test("both bounds are exclusive: a block at exactly validAfter or validBefore reverts, one second inside succeeds", async () => {
    const tc = createTestClient({ chain, mode: "anvil", transport: http(rpc) });
    // gas is set explicitly so the tx is mined (and reverts) at the pinned timestamp instead of failing estimation
    const at = async (ts: bigint, a: Auth) => {
      await tc.setNextBlockTimestamp({ timestamp: ts });
      const hash = await wallet(relayerPk).writeContract({ address: token, abi, functionName: "transferWithAuthorization", args: args(a, await sign(alicePk, a)), gas: 200_000n } as any);
      return (await pub.waitForTransactionReceipt({ hash })).status;
    };
    const T = (await now()) + 100n;
    expect(await at(T, await auth({ validAfter: T, validBefore: T + 1000n }))).toBe("reverted");
    expect(await at(T + 10n, await auth({ validAfter: 0n, validBefore: T + 10n }))).toBe("reverted");
    expect(await at(T + 20n, await auth({ validAfter: T + 19n, validBefore: T + 21n }))).toBe("success");
  });

  test("a signature by anyone other than `from` is rejected", async () => {
    const a = await auth();
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, await sign(mallory, a)))).rejects.toThrow("invalid signature");
  });

  test("any change to the signed fields, the chain id or the token address invalidates the signature", async () => {
    const a = await auth({ value: 1n });
    const sig = await sign(alicePk, a);
    for (const edit of [{ value: 2n }, { to: privateKeyToAccount(mallory).address }, { validBefore: a.validBefore + 1n }])
      await expect(reverts(relayerPk, "transferWithAuthorization", args({ ...a, ...edit }, sig))).rejects.toThrow("invalid signature");
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, await sign(alicePk, a, { chainId: 2366 })))).rejects.toThrow("invalid signature");
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, await sign(alicePk, a, { verifyingContract: bob })))).rejects.toThrow("invalid signature");
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, await sign(alicePk, a, { name: "pieUSD" })))).rejects.toThrow("invalid signature");
  });

  test("the high-s twin of a valid signature is rejected, and the failed attempt doesn't burn the nonce", async () => {
    const a = await auth({ value: 3n });
    const sig = await sign(alicePk, a);
    expect(vrs(sig).s <= N / 2n).toBe(true); // viem signs low-s
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, malleate(sig)))).rejects.toThrow("bad signature s");
    await send(relayerPk, "transferWithAuthorization", args(a, sig));
    expect(await read("authorizationState", [alice.address, a.nonce])).toBe(true);
  });

  test("malformed signatures: wrong length, v not 27/28, zero r/s", async () => {
    const a = await auth();
    const sig = await sign(alicePk, a);
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, sig.slice(0, 130) as Hex))).rejects.toThrow("bad signature length");
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, `${sig.slice(0, 130)}1b00` as Hex))).rejects.toThrow("bad signature length");
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, `${sig.slice(0, 130)}1d` as Hex))).rejects.toThrow("invalid signature");
    await expect(reverts(relayerPk, "transferWithAuthorization", args(a, `0x${"00".repeat(64)}1b` as Hex))).rejects.toThrow("invalid signature");
  });

  test("zero-address recipient and overdrawn balances are rejected", async () => {
    const z = await auth({ to: "0x0000000000000000000000000000000000000000" });
    await expect(reverts(relayerPk, "transferWithAuthorization", args(z, await sign(alicePk, z)))).rejects.toThrow("zero address");
    const big = await auth({ value: parseEther("1000000") });
    await expect(reverts(relayerPk, "transferWithAuthorization", args(big, await sign(alicePk, big)))).rejects.toThrow("balance");
    await expect(reverts(alicePk, "transfer", [bob, parseEther("1000000")])).rejects.toThrow("balance");
  });

  test("allowances: transferFrom is capped, an infinite allowance is not decremented", async () => {
    const spender = privateKeyToAccount(mallory).address;
    await send(alicePk, "approve", [spender, 10n]);
    await expect(reverts(mallory, "transferFrom", [alice.address, bob, 11n])).rejects.toThrow("allowance");
    await send(mallory, "transferFrom", [alice.address, bob, 10n]);
    expect(await read("allowance", [alice.address, spender])).toBe(0n);
    await send(alicePk, "approve", [spender, maxUint256]);
    await send(mallory, "transferFrom", [alice.address, bob, 1n]);
    expect(await read("allowance", [alice.address, spender])).toBe(maxUint256);
  });

  test("supply can't overflow: minting past 2^256-1 reverts (checked arithmetic)", async () => {
    const supply = (await read("totalSupply")) as bigint;
    await expect(reverts(ownerPk, "mint", [bob, maxUint256 - supply + 1n])).rejects.toThrow();
    await send(ownerPk, "mint", [bob, maxUint256 - supply]);
    expect(await read("totalSupply")).toBe(maxUint256);
    await expect(reverts(ownerPk, "mint", [bob, 1n])).rejects.toThrow();
  });

  test("sim/live parity: the local facilitator also rejects the high-s twin the chain refuses", async () => {
    const t = Math.floor(Date.now() / 1000);
    const req: PaymentRequirements = { scheme: "exact", network: `eip155:${CHAIN_ID}`, asset: token, amount: "5", payTo: bob, maxTimeoutSeconds: 300, extra: { name: "Foreman Test USD", version: "1" } };
    const a = { from: alice.address, to: bob, value: 5n, validAfter: BigInt(t - 600), validBefore: BigInt(t + 300), nonce: nonce() };
    const sig = await sign(alicePk, a);
    const p = (s: Hex): PaymentPayload => ({ x402Version: 2, accepted: req, payload: { signature: s, authorization: { ...a, value: "5", validAfter: String(a.validAfter), validBefore: String(a.validBefore) } } });
    const fac = new LocalFacilitator();
    expect((await fac.verify(p(sig), req)).isValid).toBe(true);
    expect(await fac.verify(p(malleate(sig)), req)).toEqual({ isValid: false, invalidReason: "invalid_signature" });
  });
});
