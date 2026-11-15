// Download Twilio call recordings (made with TWILIO_RECORD=1) into recordings/ for the demo video.
//   bun scripts/fetch-recordings.ts [hours=6]
import { mkdirSync, existsSync } from "node:fs";

const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
if (!sid || !tok) { console.error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set"); process.exit(2); }
const hours = Number(process.argv[2] ?? 6);
const auth = { authorization: `Basic ${Buffer.from(`${sid}:${tok}`).toString("base64")}` };
const after = new Date(Date.now() - hours * 3600e3).toISOString().slice(0, 10);
const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}`;
const list = (await (await fetch(`${base}/Recordings.json?PageSize=50&DateCreatedAfter=${after}`, { headers: auth })).json()) as any;
mkdirSync("recordings", { recursive: true });
for (const r of list.recordings ?? []) {
  const call = (await (await fetch(`${base}/Calls/${r.call_sid}.json`, { headers: auth })).json()) as any;
  const when = new Date(r.date_created).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = `recordings/call-${when}-${r.call_sid.slice(-6)}.mp3`;
  if (existsSync(file)) { console.log("have", file); continue; }
  const mp3 = await fetch(`${base}/Recordings/${r.sid}.mp3`, { headers: auth });
  await Bun.write(file, await mp3.arrayBuffer());
  console.log(`saved ${file} · ${r.duration}s · to …${String(call.to ?? "").slice(-4)} · ${call.status}`);
}
if (!(list.recordings ?? []).length) console.log("no recordings yet");
