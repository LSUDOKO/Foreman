import { privateKeyToAccount } from "viem/accounts";
import { kite } from "./kite";
import type { AdapterModes, Hex } from "./types";

export const PORTS = { foreman: 4000, clearcall: 4110, quickdial: 4111, oracle: 4210, payer: 4300, sandbox: 4400, console: 5173 } as const;

const local = (p: number) => `http://localhost:${p}`;

export const urls = () => ({
  foreman: process.env.FOREMAN_URL ?? local(PORTS.foreman),
  foremanPublic: process.env.FOREMAN_PUBLIC_URL || process.env.FOREMAN_URL || local(PORTS.foreman),
  clearcall: process.env.CLEARCALL_URL ?? local(PORTS.clearcall),
  quickdial: process.env.QUICKDIAL_URL ?? local(PORTS.quickdial),
  oracle: process.env.ORACLE_URL ?? local(PORTS.oracle),
  payer: process.env.PAYER_URL ?? local(PORTS.payer),
  sandbox: process.env.SANDBOX_URL ?? local(PORTS.sandbox),
});

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — run \`bun run setup\` to generate wallets into .env`);
  return v;
}

export const pk = (name: string) => need(name) as Hex;
export const addr = (name: string) => need(name) as Hex;
export const addressOf = (pkName: string) => privateKeyToAccount(pk(pkName)).address;

export function adapterModes(): AdapterModes {
  const live = process.env.PAYMENTS_MODE === "live";
  return {
    serv: process.env.SERV_API_KEY ? "live" : "fallback",
    payments: live ? (kite().name === "mainnet" ? "kite-mainnet" : "kite-testnet") : "sim",
    carrier: (process.env.TWILIO_API_BASE ?? "").includes("api.twilio.com") || (!process.env.TWILIO_API_BASE && !!process.env.TWILIO_AUTH_TOKEN) ? "twilio" : "sandbox",
    calendar: (process.env.CALCOM_API_BASE ?? "").includes("api.cal.com") || (!process.env.CALCOM_API_BASE && !!process.env.CALCOM_API_KEY) ? "calcom" : "sandbox",
    email: process.env.SMTP_USER ? "smtp" : "sandbox",
  };
}

export const num = (name: string, d: number) => (process.env[name] ? Number(process.env[name]) : d);
export const str = (name: string, d: string) => process.env[name] || d;
