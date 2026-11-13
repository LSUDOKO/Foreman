import { expect, test } from "bun:test";
import { addUsd, cents, fromUnits, gtUsd, toUnits, usd } from "./money";
import { canonical, hashOf } from "./canonical";

test("cents/usd roundtrip", () => {
  expect(cents("0.50")).toBe(50);
  expect(cents("4")).toBe(400);
  expect(usd(298)).toBe("2.98");
  expect(addUsd("2.30", "0.60", "0.08")).toBe("2.98");
  expect(gtUsd("0.61", "0.60")).toBe(true);
  expect(() => cents("0.501")).toThrow();
  expect(() => cents("-1")).toThrow();
});

test("token units for pieUSD (18) and USDC.e (6)", () => {
  expect(toUnits("0.50", 18)).toBe(500000000000000000n);
  expect(toUnits("4.00", 6)).toBe(4000000n);
  expect(fromUnits(500000000000000000n, 18)).toBe("0.50");
  expect(() => fromUnits(1n, 18)).toThrow();
});

test("canonical JSON is key-order independent", () => {
  expect(canonical({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[1,{"y":2,"z":1}]},"b":1}');
  expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
});
