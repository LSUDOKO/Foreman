import { expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { LocalFacilitator } from "@foreman/shared/facilitator";
import { kite } from "@foreman/shared/kite";
import { createOracle } from "../../proof-oracle/src/app";
import { createPayer } from "./app";

const net = kite("testnet");
const signerPk = generatePrivateKey();
const oraclePayTo = privateKeyToAccount(generatePrivateKey()).address;
const foremanAddr = privateKeyToAccount(generatePrivateKey()).address;

test("a FAILed outcome is verified once, never re-bought every tick, and never invoiced", async () => {
  const claim = { outcomeId: "out_1", contractId: "ctr", milestone: "confirmed", customer: "Asha", bookingUid: "bk_gone", contractHash: "sha256:x", price: "4.00", expected: { attendeeEmail: "a@b.c", start: "2026-11-16T04:30:00Z" } };
  const oracle = createOracle({
    network: net, facilitator: new LocalFacilitator(), payTo: oraclePayTo, price: "0.02", signerPk, foremanUrl: "http://foreman",
    foremanAddress: foremanAddr, businessAddress: foremanAddr,
    fetchImpl: (async () => new Response("{}", { status: 404 })) as any, // booking was cancelled in the calendar
  });
  let invoices = 0;
  const f = (async (u: string, i?: RequestInit) => {
    const url = new URL(u);
    if (url.host === "oracle") return oracle.request(url.pathname, i);
    if (url.pathname === "/v1/claims") return Response.json([claim]);
    if (url.pathname.startsWith("/v1/invoice")) { invoices++; return new Response("{}", { status: 500 }); }
    return new Response("nf", { status: 404 });
  }) as unknown as typeof fetch;
  const pk = generatePrivateKey();
  const payer = createPayer({
    pk, address: privateKeyToAccount(pk).address, network: net, foremanUrl: "http://foreman", oracleUrl: "http://oracle",
    foremanPayTo: foremanAddr, oraclePayTo, oracleSigner: privateKeyToAccount(signerPk).address, maxPerOutcome: "6.00", maxOraclePrice: "0.02", fetchImpl: f,
  });
  for (let i = 0; i < 4; i++) await payer.tick();
  expect(payer.journal.filter((j) => j.kind === "verify").length).toBe(1);
  expect(payer.journal.find((j) => j.kind === "refusal")?.code).toBe("proof_failed:booking_not_found");
  expect(invoices).toBe(0);
});
