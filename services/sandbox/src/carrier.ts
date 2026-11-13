// Sandbox carrier: speaks the subset of Twilio's Calls REST API that Foreman uses, and plays the
// customer side of each call from demo/personas.json by POSTing signed webhooks to the worker.
import { Hono } from "hono";
import { twilioSignature } from "@foreman/shared/sign";
import type { TwilioCallRecord } from "@foreman/shared/twilio";

export interface Persona { name: string; answer: boolean; seconds?: number; turns?: ({ speech: string } | { digits: string })[]; email?: "confirm" | "decline" | "ignore" }
export interface SimCall extends TwilioCallRecord { url: string; statusCallback: string; log: { who: string; text: string }[] }

const sid = () => `CA${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

export function createCarrier(o: { personas: Record<string, Persona>; authToken: string; stepMs: number; onChange?: () => void }) {
  const calls = new Map<string, SimCall>();
  const app = new Hono();

  app.post("/2010-04-01/Accounts/:acct/Calls.json", async (c) => {
    if (!c.req.header("authorization")?.startsWith("Basic ")) return c.json({ code: 20003, message: "Authenticate" }, 401);
    const p = (await c.req.parseBody()) as Record<string, string>;
    const call: SimCall = {
      sid: sid(), to: p.To!, from: p.From!, status: "queued", duration: null, start_time: null, end_time: null,
      url: p.Url!, statusCallback: p.StatusCallback!, log: [],
    };
    calls.set(call.sid, call);
    void run(call, Number(p.TimeLimit ?? 180));
    return c.json(call, 201);
  });

  app.get("/2010-04-01/Accounts/:acct/Calls/:file", (c) => {
    const call = calls.get(c.req.param("file").replace(/\.json$/, ""));
    if (!call) return c.json({ code: 20404, message: "The requested resource was not found", status: 404 }, 404);
    const { url: _u, statusCallback: _s, log: _l, ...rec } = call;
    return c.json(rec);
  });

  app.post("/2010-04-01/Accounts/:acct/Calls/:file", async (c) => {
    const call = calls.get(c.req.param("file").replace(/\.json$/, ""));
    if (!call) return c.json({ code: 20404 }, 404);
    const p = (await c.req.parseBody()) as Record<string, string>;
    if (p.Status === "completed" && call.status === "in-progress") call.status = "completed";
    return c.json(call);
  });

  async function post(url: string, params: Record<string, string>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": twilioSignature(o.authToken, url, params) },
      body: new URLSearchParams(params),
    });
    return res.text();
  }

  async function run(call: SimCall, timeLimit: number) {
    const persona = o.personas[call.to];
    await Bun.sleep(o.stepMs);
    call.status = "ringing";
    o.onChange?.();
    await Bun.sleep(o.stepMs * 2);
    if (!persona?.answer) {
      call.status = "no-answer";
      call.duration = "0";
      o.onChange?.();
      await post(call.statusCallback, { CallSid: call.sid, CallStatus: "no-answer", CallDuration: "0", To: call.to });
      return;
    }
    call.status = "in-progress";
    call.start_time = new Date().toUTCString();
    o.onChange?.();
    let twiml = await post(call.url, { CallSid: call.sid, CallStatus: "in-progress", To: call.to });
    for (const turn of persona.turns ?? []) {
      call.log.push({ who: "agent", text: sayText(twiml) });
      const action = /<Gather[^>]*action="([^"]+)"/.exec(twiml)?.[1]?.replace(/&amp;/g, "&");
      if (!action) break;
      await Bun.sleep(o.stepMs * 2);
      const params: Record<string, string> = { CallSid: call.sid, To: call.to };
      if ("speech" in turn) params.SpeechResult = turn.speech;
      else params.Digits = turn.digits;
      call.log.push({ who: "caller", text: "speech" in turn ? turn.speech : `[${turn.digits}]` });
      twiml = await post(action, params);
    }
    call.log.push({ who: "agent", text: sayText(twiml) });
    await Bun.sleep(o.stepMs);
    call.status = "completed";
    call.duration = String(Math.min(persona.seconds ?? 45, timeLimit));
    call.end_time = new Date().toUTCString();
    o.onChange?.();
    await post(call.statusCallback, { CallSid: call.sid, CallStatus: "completed", CallDuration: call.duration, To: call.to });
  }

  return { app, calls };
}

const sayText = (twiml: string) =>
  [...twiml.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)].map((m) => m[1]!.replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')).join(" ");
