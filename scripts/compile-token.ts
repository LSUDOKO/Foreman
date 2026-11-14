// Compile contracts/src/ForemanTestUSD.sol with solc-js into contracts/ForemanTestUSD.json (abi + bytecode, committed).
//   bun scripts/compile-token.ts
import { readFileSync, writeFileSync } from "node:fs";
// @ts-expect-error solc ships no types
import solc from "solc";

const src = "contracts/src/ForemanTestUSD.sol";
const out = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: { [src]: { content: readFileSync(src, "utf8") } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
})));
const errors = (out.errors ?? []).filter((e: any) => e.severity === "error");
if (errors.length) { for (const e of errors) console.error(e.formattedMessage); process.exit(1); }
const c = out.contracts[src].ForemanTestUSD;
writeFileSync("contracts/ForemanTestUSD.json", JSON.stringify({ compiler: solc.version(), abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }, null, 2));
console.log(`compiled with ${solc.version()} → contracts/ForemanTestUSD.json (${c.evm.bytecode.object.length / 2} bytes)`);
