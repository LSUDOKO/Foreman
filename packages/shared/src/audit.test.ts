import { expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { GENESIS, linkHash, verifyChain } from "./audit";
import { hmac, hmacValid, signJson, twilioSignature, verifyJson } from "./sign";

function chain(n: number) {
  const rows = [];
  let prev = GENESIS;
  for (let i = 0; i < n; i++) {
    const row = { ts: `2026-11-15T10:00:0${i}Z`, contractId: "ctr_1", type: "refusal", actor: "firewall", data: { i } };
    const hash = linkHash(prev, row);
    rows.push({ ...row, prevHash: prev, hash });
    prev = hash;
  }
  return rows;
}

test("audit chain verifies and detects tampering", () => {
  const rows = chain(5);
  expect(verifyChain(rows)).toMatchObject({ ok: true, events: 5 });
  rows[2]!.data = { i: 99 };
  expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAt: 2 });
});

test("EIP-191 JSON signatures verify against the signer and fail for others", async () => {
  const pk = generatePrivateKey();
  const addr = privateKeyToAccount(pk).address;
  const sig = await signJson(pk, { b: 2, a: 1 });
  expect(await verifyJson({ a: 1, b: 2 }, sig, addr)).toBe(true);
  expect(await verifyJson({ a: 1, b: 3 }, sig, addr)).toBe(false);
});

test("hmac and twilio signature", () => {
  expect(hmacValid("s", "body", hmac("s", "body"))).toBe(true);
  expect(hmacValid("s", "body", hmac("t", "body"))).toBe(false);
  // Cross-checked against twilio@6 getExpectedTwilioSignature().
  const sig = twilioSignature("12345", "https://mycompany.com/myapp.php?foo=1&bar=2", {
    CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212",
  });
  expect(sig).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
});
