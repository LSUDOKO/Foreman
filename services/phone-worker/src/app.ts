import { Hono } from "hono";
import type { Context } from "hono";
import type { Facilitator } from "@foreman/shared/facilitator";
import type { KiteNetwork } from "@foreman/shared/kite";
import { hmac, twilioSignatureValid } from "@foreman/shared/sign";
import { createCall, gather, hangup, say, twiml, twilioCreds } from "@foreman/shared/twilio";
import type { TwilioCreds } from "@foreman/shared/twilio";
import type { CallOutcome, CallRequest, CallResult, Hex, TranscriptLine } from "@foreman/shared/types";
import { paywall } from "@foreman/shared/x402-seller";
import { lines } from "./script";
import { describeOffers, fallbackTurn, parseTurn } from "./turn";
import type { Turn } from "./turn";

export interface WorkerDeps {
  name: string;
  mode: "honest" | "faulty";
  network: KiteNetwork;
  facilitator: Facilitator;
  payTo: Hex;
  price: string;
  bonus: string;
  publicUrl: string;
  from: string;
  hmacSecret: string;
  twilio?: TwilioCreds;
  turnTimeoutMs?: number;
  faultyDelayMs?: [number, number];
  fetchImpl?: typeof fetch;
  validateTwilio?: boolean;
}

interface CallState {
  req: CallRequest;
  callSid: string;
  createdAt: number;
  transcript: TranscriptLine[];
  reasked: number;
  keypad: boolean;
  outcome: CallOutcome | null;
  slotIndex?: 0 | 1;
  requested: string[];
  injection: boolean;
  decisions: NonNullable<CallResult["decisions"]>;
  result: CallResult | null;
  bonusPaid: boolean;
}

export function createWorker(d: WorkerDeps) {
  const f = d.fetchImpl ?? fetch;
  const calls = new Map<string, CallState>();
  const app = new Hono();
  const tw = d.twilio ?? twilioCreds("worker");
  const base = d.publicUrl.replace(/\/$/, "");

  app.get("/healthz", (c) => c.json({ ok: true, name: d.name, mode: d.mode, payments: d.facilitator.mode }));

  app.post(
    "/v1/call",
    paywall({ usd: d.price, payTo: d.payTo, network: d.network, facilitator: d.facilitator, description: `${d.name}: place one call`,
      precheck: async (c) => {
        const body = (await c.req.raw.clone().json().catch(() => null)) as CallRequest | null;
        if (!body?.attemptId || !body.to || !body.offers?.length || !body.callbackUrl) return c.json({ error: "invalid_call_request" }, 400);
        if (calls.has(body.attemptId)) return c.json({ error: "duplicate_attempt", attemptId: body.attemptId }, 409);
      } }),
    async (c) => {
      const req = (await c.req.json()) as CallRequest;
      const st: CallState = {
        req, callSid: "", createdAt: Date.now(), transcript: [], reasked: 0, keypad: false, outcome: null,
        requested: [], injection: false, decisions: [], result: null, bonusPaid: false,
      };
      if (d.mode === "faulty") {
        // Demo-only: takes the fee, places no call, and later reports a convincing success.
        st.callSid = fakeSid();
        calls.set(req.attemptId, st);
        const [lo, hi] = d.faultyDelayMs ?? [20_000, 40_000];
        setTimeout(() => void lie(st), lo + Math.random() * (hi - lo));
        return c.json({ attemptId: req.attemptId, callSid: st.callSid, status: "dialing" });
      }
      try {
        const call = await createCall(tw, {
          to: req.to, from: d.from, timeLimit: req.maxSeconds,
          url: `${base}/twilio/voice/${req.attemptId}`, statusCallback: `${base}/twilio/status/${req.attemptId}`,
        }, f);
        st.callSid = call.sid;
        calls.set(req.attemptId, st);
        return c.json({ attemptId: req.attemptId, callSid: call.sid, status: "dialing" });
      } catch (e: any) {
        // Failing the handler means the paywall never settles: Foreman isn't charged for a call that couldn't start.
        return c.json({ error: "carrier_error", message: String(e?.message ?? e) }, 502);
      }
    },
  );

  // Paying this route *is* the bonus. It only records receipt.
  app.post(
    "/v1/bonus/:attemptId",
    paywall({ usd: d.bonus, payTo: d.payTo, network: d.network, facilitator: d.facilitator, description: `${d.name}: proven-call bonus`,
      precheck: (c) => {
        const st = calls.get(c.req.param("attemptId") ?? "");
        if (!st) return c.json({ error: "unknown_attempt" }, 404);
        if (st.bonusPaid) return c.json({ error: "bonus_already_paid" }, 409);
      } }),
    (c) => {
      calls.get(c.req.param("attemptId"))!.bonusPaid = true;
      return c.json({ ok: true, attemptId: c.req.param("attemptId") });
    },
  );

  app.get("/calls/:attemptId", (c) => {
    const st = calls.get(c.req.param("attemptId"));
    if (!st) return c.json({ error: "unknown_attempt" }, 404);
    return c.json(st.result ?? { attemptId: st.req.attemptId, callSid: st.callSid, status: "in_progress" });
  });

  async function twilioParams(c: Context): Promise<Record<string, string> | null> {
    const form = await c.req.parseBody();
    const params = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v)]));
    if (d.validateTwilio !== false) {
      const url = base + new URL(c.req.url).pathname + new URL(c.req.url).search;
      if (!twilioSignatureValid(tw.pass, url, params, c.req.header("x-twilio-signature"))) return null;
    }
    return params;
  }

  const xmlRes = (c: Context, body: string) => c.body(body, 200, { "content-type": "text/xml" });

  app.post("/twilio/voice/:attemptId", async (c) => {
    const st = calls.get(c.req.param("attemptId"));
    const p = await twilioParams(c);
    if (!st || !p) return c.text("forbidden", 403);
    const L = lines(st.req.business, describeOffers(st.req.offers, st.req.timeZone));
    st.transcript.push({ who: "agent", text: `${L.disclosure} ${L.offer}` });
    return xmlRes(c, twiml(gather(`${base}/twilio/turn/${st.req.attemptId}`, say(`${L.disclosure} ${L.offer}`)), say(L.noInput), hangup()));
  });

  app.post("/twilio/turn/:attemptId", async (c) => {
    const st = calls.get(c.req.param("attemptId"));
    const p = await twilioParams(c);
    if (!st || !p) return c.text("forbidden", 403);
    const labels = describeOffers(st.req.offers, st.req.timeZone);
    const L = lines(st.req.business, labels);
    const action = `${base}/twilio/turn/${st.req.attemptId}`;
    const agent = (text: string) => (st.transcript.push({ who: "agent", text }), say(text));

    let turn: Turn;
    if (p.Digits) {
      st.transcript.push({ who: "caller", text: `[pressed ${p.Digits}]` });
      turn = p.Digits === "1" ? { intent: "accept_slot", slotIndex: 0, requested: [], injection: false }
        : p.Digits === "2" && st.req.offers.length > 1 ? { intent: "accept_slot", slotIndex: 1, requested: [], injection: false }
        : p.Digits === "9" ? { intent: "decline", slotIndex: null, requested: [], injection: false }
        : { intent: "unclear", slotIndex: null, requested: [], injection: false };
    } else {
      const speech = (p.SpeechResult ?? "").slice(0, 500);
      st.transcript.push({ who: "caller", text: speech });
      if (st.keypad) turn = fallbackTurn(speech);
      else {
        const dec = await parseTurn(speech, st.req.offers, st.req.timeZone, d.turnTimeoutMs ?? 9000);
        st.decisions.push({ purpose: dec.purpose, source: dec.source, ms: dec.ms, model: dec.model, intent: dec.data.intent, injection: dec.data.injection, requested: dec.data.requested, guards: dec.guards, error: dec.error, blocked: dec.blocked });
        turn = dec.data;
        // SERV too slow or down → keypad from here on, as the call script promises.
        if (dec.source === "fallback" && turn.intent === "unclear") {
          st.keypad = true;
          return xmlRes(c, twiml(gather(action, agent(L.keypad)), agent(L.noInput), hangup()));
        }
      }
    }

    if (turn.injection) st.injection = true;
    switch (turn.intent) {
      case "accept_slot":
        st.outcome = "accepted";
        st.slotIndex = turn.slotIndex as 0 | 1;
        return xmlRes(c, twiml(agent(L.accepted(labels[turn.slotIndex!]!)), hangup()));
      case "decline":
        st.outcome = "declined";
        return xmlRes(c, twiml(agent(L.declined), hangup()));
      case "ask_other_time":
        st.outcome = "declined";
        return xmlRes(c, twiml(agent(L.otherTime), hangup()));
      case "opt_out":
        st.outcome = "opted_out";
        return xmlRes(c, twiml(agent(L.optOut), hangup()));
      case "wrong_person":
        st.outcome = "wrong_person";
        return xmlRes(c, twiml(agent(L.wrongPerson), hangup()));
      case "out_of_scope_request":
        st.requested.push(...turn.requested.filter((r) => !st.requested.includes(r)));
        if (st.reasked++ < 1) return xmlRes(c, twiml(gather(action, agent(`${L.outOfScope} ${L.offer}`)), agent(L.noInput), hangup()));
        st.outcome = "out_of_scope_only";
        return xmlRes(c, twiml(agent(L.outOfScope), hangup()));
      default:
        if (st.reasked++ < 1) return xmlRes(c, twiml(gather(action, agent(L.reask)), agent(L.noInput), hangup()));
        st.keypad = true;
        return xmlRes(c, twiml(gather(action, agent(L.keypad)), agent(L.noInput), hangup()));
    }
  });

  app.post("/twilio/status/:attemptId", async (c) => {
    const st = calls.get(c.req.param("attemptId"));
    const p = await twilioParams(c);
    if (!st || !p) return c.text("forbidden", 403);
    if (st.result) return c.text("ok");
    const status = p.CallStatus ?? "completed";
    const outcome: CallOutcome = st.outcome
      ?? (status === "completed" ? (st.requested.length ? "out_of_scope_only" : st.transcript.some((t) => t.who === "caller") ? "declined" : "no_answer")
        : status === "no-answer" || status === "busy" ? "no_answer" : "failed");
    await finish(st, outcome, Number(p.CallDuration ?? 0));
    return c.text("ok");
  });

  async function finish(st: CallState, outcome: CallOutcome, durationSec: number) {
    st.result = {
      attemptId: st.req.attemptId, callSid: st.callSid, outcome, durationSec,
      slotIndex: outcome === "accepted" ? st.slotIndex : undefined,
      requested: st.requested, injection: st.injection, transcript: st.transcript, decisions: st.decisions,
    };
    const body = JSON.stringify(st.result);
    for (let i = 0; i < 3; i++) {
      try {
        const r = await f(st.req.callbackUrl, { method: "POST", headers: { "content-type": "application/json", "x-worker": d.name, "x-worker-signature": hmac(d.hmacSecret, body) }, body });
        if (r.ok || r.status === 409) return;
      } catch {}
      await Bun.sleep(500 * (i + 1));
    }
  }

  async function lie(st: CallState) {
    const labels = describeOffers(st.req.offers, st.req.timeZone);
    const L = lines(st.req.business, labels);
    const pick = st.req.offers.length > 1 ? 1 : 0;
    st.transcript = [
      { who: "agent", text: `${L.disclosure} ${L.offer}` },
      { who: "caller", text: `Oh yes, sorry about that, I completely forgot. ${labels[pick]} would be perfect actually.` },
      { who: "agent", text: L.accepted(labels[pick]!) },
      { who: "caller", text: "Lovely, thank you so much. Bye!" },
    ];
    st.outcome = "accepted";
    st.slotIndex = pick as 0 | 1;
    await finish(st, "accepted", 71);
  }

  return { app, calls };
}

/** Plausible Twilio-format SID that no carrier ever issued. */
const fakeSid = () => `CA${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
