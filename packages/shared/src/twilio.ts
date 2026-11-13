// Minimal Twilio Voice REST client over fetch. The base URL is swappable so the same code talks to
// api.twilio.com (live) or the local sandbox carrier — see twilioBase() in env.ts.
import { twilioBase } from "./env";

export interface TwilioCreds { accountSid: string; user: string; pass: string; base: string }

export interface TwilioCallRecord {
  sid: string;
  to: string;
  from: string;
  status: string;            // queued|ringing|in-progress|completed|busy|failed|no-answer|canceled
  duration: string | null;   // seconds, string
  start_time: string | null; // RFC 2822
  end_time: string | null;
}

export function twilioCreds(kind: "worker" | "oracle" = "worker"): TwilioCreds {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "ACsandbox";
  const base = twilioBase();
  if (kind === "oracle" && process.env.TWILIO_API_KEY_SID)
    return { accountSid, base, user: process.env.TWILIO_API_KEY_SID, pass: process.env.TWILIO_API_KEY_SECRET ?? "" };
  return { accountSid, base, user: accountSid, pass: process.env.TWILIO_AUTH_TOKEN ?? "sandbox" };
}

const auth = (c: TwilioCreds) => `Basic ${Buffer.from(`${c.user}:${c.pass}`).toString("base64")}`;
const callsUrl = (c: TwilioCreds) => `${c.base}/2010-04-01/Accounts/${c.accountSid}/Calls`;

export async function createCall(
  c: TwilioCreds,
  p: { to: string; from: string; url: string; statusCallback: string; timeLimit: number },
  f: typeof fetch = fetch,
): Promise<TwilioCallRecord> {
  const body = new URLSearchParams({
    To: p.to, From: p.from, Url: p.url, Method: "POST",
    StatusCallback: p.statusCallback, StatusCallbackMethod: "POST", StatusCallbackEvent: "completed",
    TimeLimit: String(p.timeLimit),
  });
  const res = await f(`${callsUrl(c)}.json`, {
    method: "POST",
    headers: { authorization: auth(c), "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json()) as any;
  if (!res.ok) throw new Error(`twilio create call ${res.status}: ${j?.message ?? JSON.stringify(j)}`);
  return j;
}

/** Returns null on 404 — the oracle's `call_not_found`. */
export async function getCall(c: TwilioCreds, sid: string, f: typeof fetch = fetch): Promise<TwilioCallRecord | null> {
  if (!/^CA[0-9a-fA-F]{32}$/.test(sid)) return null;
  const res = await f(`${callsUrl(c)}/${sid}.json`, { headers: { authorization: auth(c) } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`twilio get call ${res.status}`);
  return (await res.json()) as TwilioCallRecord;
}

export async function endCall(c: TwilioCreds, sid: string, f: typeof fetch = fetch): Promise<void> {
  await f(`${callsUrl(c)}/${sid}.json`, {
    method: "POST",
    headers: { authorization: auth(c), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ Status: "completed" }),
  });
}

/** TwiML helpers. Text is XML-escaped; nothing the caller said is ever echoed into TwiML. */
export const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function twiml(...parts: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${parts.join("")}</Response>`;
}
export const say = (text: string, voice = process.env.TWILIO_VOICE ?? "Polly.Aditi") => `<Say voice="${voice}">${xml(text)}</Say>`;
export function gather(action: string, inner: string, lang = "en-IN") {
  return `<Gather input="speech dtmf" action="${xml(action)}" method="POST" speechTimeout="auto" numDigits="1" timeout="6" language="${lang}">${inner}</Gather>`;
}
export const hangup = () => "<Hangup/>";
