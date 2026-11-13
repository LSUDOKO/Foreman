import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { customersFromCsv, parseCsv } from "./csv";

test("demo CSV parses; Dev has no consent", () => {
  const { customers, errors } = customersFromCsv(readFileSync("demo/no-shows.csv", "utf8"));
  expect(errors).toEqual([]);
  expect(customers.map((c) => c.name)).toEqual(["Asha", "Meera", "Rahul", "Dev", "Kiran"]);
  expect(customers.find((c) => c.name === "Dev")!.consentSource).toBeNull();
});

test("quoted fields and bad rows", () => {
  expect(parseCsv('a,b\n"x, y","say ""hi"""\r\n')).toEqual([{ a: "x, y", b: 'say "hi"' }]);
  const { errors } = customersFromCsv("id,name,phone,email,missed_at,consent_source\nc1,A,12345,a@b.c,2026-11-13T09:30:00Z,x\n");
  expect(errors[0]).toContain("E.164");
});
