// Money is always a decimal string in USD ("0.50"). Arithmetic happens in integer cents
// (contract values have ≤ 2 decimals) and is converted to token units only at signing time.

const USD_RE = /^\d+(\.\d{1,2})?$/;

export function isUsd(v: string): boolean {
  return USD_RE.test(v);
}

export function cents(v: string): number {
  if (!isUsd(v)) throw new Error(`invalid USD amount: ${v}`);
  const [w, f = ""] = v.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0"));
}

export function usd(c: number): string {
  if (!Number.isInteger(c) || c < 0) throw new Error(`invalid cents: ${c}`);
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
}

export const addUsd = (...vs: string[]) => usd(vs.reduce((s, v) => s + cents(v), 0));
export const gtUsd = (a: string, b: string) => cents(a) > cents(b);

/** USD string → token base units (bigint) for a token with `decimals`. */
export function toUnits(v: string, decimals: number): bigint {
  return BigInt(cents(v)) * 10n ** BigInt(decimals - 2);
}

/** Token base units → USD string, rejecting sub-cent amounts. */
export function fromUnits(units: bigint | string, decimals: number): string {
  const u = BigInt(units);
  const step = 10n ** BigInt(decimals - 2);
  if (u % step !== 0n) throw new Error(`amount ${u} is not a whole number of cents`);
  return usd(Number(u / step));
}
