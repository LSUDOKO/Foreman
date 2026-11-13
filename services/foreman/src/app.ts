import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { contractHash, describeContract } from "@foreman/shared/contract";
import { adapterModes } from "@foreman/shared/env";
import type { Facilitator } from "@foreman/shared/facilitator";
import type { KiteNetwork } from "@foreman/shared/kite";
import { txLink } from "@foreman/shared/kite";
import { hmacValid, signJson, verifyJson } from "@foreman/shared/sign";
import type { CallResult, Hex } from "@foreman/shared/types";
import { paywall } from "@foreman/shared/x402-seller";
import { confirmPage, tokenHash } from "./confirm";
import { compileContract } from "./contract/compiler";
import { customersFromCsv } from "./csv";
import type { DB } from "./db";
import { newId, nowIso, setSetting, setting } from "./db";
import type { EventLog } from "./events";
import { mask } from "./mask";
import type { Runner } from "./runner";
import type { Store } from "./store";

export interface AppDeps {
  db: DB;
  store: Store;
  log: EventLog;
  runner: Runner;
  network: KiteNetwork;
  facilitator: Facilitator;
  foremanPk: Hex;
  foremanAddress: Hex;
  businessAddress: Hex;
  oracleSigner: () => Promise<Hex>;
  identities: () => Promise<Record<string, { address: string; role: string; signer?: string }>>;
  facts: () => Omit<Parameters<typeof compileContract>[1], "id" | "now">;
  payerUrl: string;
  hmacSecret: string;
  consoleToken?: string;
}

export function createApp(d: AppDeps) {
  const { store, log, runner } = d;
  const app = new Hono();

  app.use("/api/*", cors());
  app.use("/v1/*", cors({ origin: "*", exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"] }));
  app.get("/healthz", (c) => c.json({ ok: true, name: "foreman", modes: adapterModes() }));

  // Console API: bearer CONSOLE_TOKEN when set (SSE may pass ?token= because EventSource can't set headers).
  const auth: MiddlewareHandler = async (c, next) => {
    if (!d.consoleToken || c.req.path === "/api/worker-result") return next();
    const t = c.req.header("authorization")?.replace(/^Bearer /, "") ?? c.req.query("token");
    if (t !== d.consoleToken) return c.json({ error: "unauthorized" }, 401);
    return next();
  };
  app.use("/api/*", auth);

  const need = (id: string) => store.contract(id);
  const names = async () => {
    const ids = await d.identities();
    return Object.fromEntries(Object.entries(ids).map(([n, v]) => [v.address.toLowerCase(), n]));
  };

  app.get("/api/modes", async (c) => c.json({ modes: adapterModes(), network: d.network.name, chainId: d.network.chainId, explorer: d.network.explorer, identities: await d.identities() }));

  app.post("/api/contracts/compile", async (c) => {
    const { goal, csv } = (await c.req.json().catch(() => ({}))) as { goal?: string; csv?: string };
    if (!goal || goal.trim().length < 10) return c.json({ error: "goal_required" }, 400);
    const parsed = customersFromCsv(csv ?? "");
    if (parsed.errors.length || !parsed.customers.length) return c.json({ error: "invalid_csv", details: parsed.errors }, 400);
    const id = `ctr_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${crypto.randomUUID().slice(0, 6)}`;
    const { contract, rejectedRequests, decision } = await compileContract(goal.trim(), { ...d.facts(), id, now: new Date() });
    store.saveContract(contract, "draft", rejectedRequests);
    store.addCustomers(id, parsed.customers);
    runner.serv(id, decision);
    const hash = contractHash(contract);
    log.emit("contract_compiled", "serv", {
      contract, hash, rejectedRequests, summary: describeContract(contract, await names()),
      customers: parsed.customers.map((x) => ({ id: x.id, name: x.name, phone: mask.phone(x.phone), email: mask.email(x.email), missedAt: x.missedAt, consent: !!x.consentSource })),
    }, id);
    return c.json({ contract, hash, status: "draft", rejectedRequests, summary: describeContract(contract, await names()), customers: store.customers(id).map(publicCustomer) });
  });

  app.get("/api/contracts/latest", (c) => {
    const id = store.latestContractId();
    return id ? c.redirect(`/api/contracts/${id}`) : c.json({ error: "no_contracts" }, 404);
  });

  app.get("/api/contracts/:id", async (c) => {
    const k = need(c.req.param("id"));
    if (!k) return c.json({ error: "not_found" }, 404);
    return c.json({ ...k, summary: describeContract(k.contract, await names()) });
  });

  app.post("/api/contracts/:id/approve", async (c) => {
    const k = need(c.req.param("id"));
    if (!k) return c.json({ error: "not_found" }, 404);
    if (k.status !== "draft") return c.json({ error: "not_draft", status: k.status }, 409);
    const by = ((await c.req.json().catch(() => ({}))) as { by?: string }).by ?? k.contract.business.name;
    k.contract.approval.approvedBy = by;
    k.contract.approval.approvedAt = nowIso();
    store.saveContract(k.contract, "approved");
    log.emit("contract_approved", "business", { by, hash: k.hash, approvedAt: k.contract.approval.approvedAt }, k.contract.id);
    return c.json({ status: "approved", hash: k.hash });
  });

  app.post("/api/contracts/:id/start", async (c) => {
    const k = need(c.req.param("id"));
    if (!k) return c.json({ error: "not_found" }, 404);
    if (k.status !== "approved") return c.json({ error: "not_approved", status: k.status }, 409);
    store.setStatus(k.contract.id, "running");
    log.emit("contract_started", "business", {
      hash: k.hash, modes: adapterModes(), identities: await d.identities(),
      workers: store.workers().map((w) => ({ name: w.name, payTo: w.payTo, price: w.price, bonus: w.bonus, reputation: w.reputation, probationLeft: w.probationLeft, isNew: w.isNew, badge: w.badge })),
      budget: k.contract.spend.totalBudget,
    }, k.contract.id);
    void runner.start(k.contract.id).catch((e) => log.emit("refusal", "foreman", { code: "runner_error", message: String(e?.message ?? e) }, k.contract.id));
    return c.json({ status: "running" });
  });

  app.get("/api/jobs/:id", (c) => c.json(store.customers(c.req.param("id")).map((x) => ({
    ...publicCustomer(x),
    attempts: store.attempts(c.req.param("id"), x.id).map((a) => ({ id: a.id, worker: a.worker, attemptNo: a.attemptNo, status: a.status, verdict: a.verdict?.verdict, code: a.verdict?.code, quality: a.quality })),
  }))));

  app.get("/api/ledger/:id", (c) => {
    const id = c.req.param("id");
    const lines = store.payments(id).map((p) => ({ ...p, link: txLink(p.txHash, d.network) }));
    return c.json({ in: lines.filter((p) => p.direction === "in"), out: lines.filter((p) => p.direction === "out"), totals: runner.totals(id) });
  });

  app.get("/api/workers", (c) => c.json(store.workers().map((w) => ({
    ...w,
    history: (d.db.query("SELECT ts, data FROM events WHERE type = 'reputation_changed' ORDER BY id").all() as { ts: string; data: string }[])
      .map((r) => ({ ts: r.ts, ...JSON.parse(r.data) })).filter((h) => h.worker === w.name),
  }))));

  app.get("/api/refusals/:id", (c) => c.json(store.refusals(c.req.param("id"))));
  app.get("/api/decisions/:id", (c) => c.json(log.since(0, c.req.param("id")).filter((e) => e.type === "serv_decision")));
  app.get("/api/audit/verify/:id", (c) => c.json(log.verify()));

  app.get("/api/export/:id", async (c) => {
    const id = c.req.param("id");
    const k = need(id);
    if (!k) return c.json({ error: "not_found" }, 404);
    return c.json({
      exportedAt: nowIso(), contractId: id, hash: k.hash, network: { name: d.network.name, chainId: d.network.chainId, explorer: d.network.explorer },
      modes: adapterModes(), audit: log.verify(), events: log.since(0, id),
    });
  });

  app.get("/api/feed", (c) => {
    const since = Number(c.req.query("since") ?? 0);
    const contractId = c.req.query("contractId") || undefined;
    return streamSSE(c, async (s) => {
      const queue: string[] = [];
      let wake: (() => void) | null = null;
      for (const e of log.since(since, contractId)) await s.writeSSE({ id: String(e.id), event: "event", data: JSON.stringify(e) });
      const off = log.subscribe((e) => {
        if (contractId && e.contractId && e.contractId !== contractId) return;
        queue.push(JSON.stringify(e));
        wake?.();
      });
      s.onAbort(() => { off(); wake?.(); });
      while (!s.aborted) {
        while (queue.length) {
          const data = queue.shift()!;
          await s.writeSSE({ id: String(JSON.parse(data).id), event: "event", data });
        }
        await Promise.race([new Promise<void>((r) => (wake = r)), s.sleep(15_000).then(() => s.writeSSE({ event: "ping", data: "" }))]);
      }
    });
  });

  app.post("/api/kill", async (c) => {
    setSetting(d.db, "kill_switch", "1");
    const ended = await runner.endInFlight();
    log.emit("kill_switch", "operator", { on: true, endedCalls: ended }, store.latestContractId());
    return c.json({ killSwitch: true, endedCalls: ended });
  });

  app.post("/api/unkill", async (c) => {
    const { confirm } = (await c.req.json().catch(() => ({}))) as { confirm?: string };
    const name = d.facts().businessName;
    if ((confirm ?? "").trim().toUpperCase() !== name.toUpperCase()) return c.json({ error: "type_business_name", expected: name.toUpperCase() }, 400);
    setSetting(d.db, "kill_switch", "0");
    log.emit("kill_switch", "operator", { on: false }, store.latestContractId());
    return c.json({ killSwitch: false });
  });

  app.get("/api/kill", (c) => c.json({ killSwitch: setting(d.db, "kill_switch") === "1" }));

  // Business view: "Mark attended". The business-payer signs the attestation with the business key.
  app.post("/api/outcomes/:id/attended", async (c) => {
    const o = store.outcome(c.req.param("id"));
    if (!o) return c.json({ error: "not_found" }, 404);
    if (o.state !== "paid_confirmed") return c.json({ error: "invalid_state", state: o.state, note: "the confirmed invoice must be paid first" }, 409);
    const r = await fetch(`${d.payerUrl}/attest/${encodeURIComponent(o.id)}`, { method: "POST" });
    if (!r.ok) return c.json({ error: "payer_unavailable" }, 502);
    const att = (await r.json()) as { payload: { outcomeId: string; attended: boolean }; signature: Hex };
    if (att.payload.outcomeId !== o.id || !att.payload.attended || !(await verifyJson(att.payload, att.signature, d.businessAddress)))
      return c.json({ error: "attestation_invalid" }, 400);
    store.updateOutcome(o.id, { attendedSig: att.signature });
    if (!store.transitionOutcome(o.id, "paid_confirmed", "attended_attested")) return c.json({ error: "invalid_state" }, 409);
    const cu = store.customer(o.contractId, o.customerId)!;
    log.emit("attended_attested", "business", { outcomeId: o.id, customerId: cu.id, name: cu.name, signature: att.signature }, o.contractId);
    runner.setCustomer(o.contractId, cu, "attended");
    return c.json({ state: "attended_attested" });
  });

  // Phone-worker callbacks, HMAC-signed with the shared secret.
  app.post("/api/worker-result", async (c) => {
    const body = await c.req.text();
    if (!hmacValid(d.hmacSecret, body, c.req.header("x-worker-signature"))) return c.json({ error: "bad_signature" }, 401);
    const r = JSON.parse(body) as CallResult;
    return runner.acceptResult(c.req.header("x-worker") ?? "", r) ? c.json({ ok: true }) : c.json({ error: "unknown_or_duplicate" }, 409);
  });

  // ───────── customer pages (public) ─────────
  const byToken = (t: string) => {
    const o = store.outcomeByToken(tokenHash(t));
    if (!o) return null;
    const k = store.contract(o.contractId)!;
    return { o, k };
  };
  const pageState = (o: NonNullable<ReturnType<typeof byToken>>["o"]) =>
    o.state === "cancelled" ? "declined" : o.state === "confirmation_sent" ? (new Date(o.confirmExpiresAt!) < new Date() ? "expired" : "open") : "confirmed";

  app.get("/c/:token", (c) => {
    const x = byToken(c.req.param("token"));
    if (!x) return c.html(confirmPage({ business: d.facts().businessName, slot: nowIso(), tz: d.facts().timeZone, token: "", state: "invalid" }), 404);
    return c.html(confirmPage({ business: x.k.contract.business.name, slot: x.o.slotStart!, tz: x.k.contract.business.timeZone, token: c.req.param("token"), state: pageState(x.o) as any }));
  });

  app.post("/c/:token/confirm", (c) => {
    const x = byToken(c.req.param("token"));
    if (!x) return c.html(confirmPage({ business: d.facts().businessName, slot: nowIso(), tz: d.facts().timeZone, token: "", state: "invalid" }), 404);
    if (pageState(x.o) === "open") runner.confirm(x.o.id);
    const o = store.outcome(x.o.id)!;
    return c.html(confirmPage({ business: x.k.contract.business.name, slot: o.slotStart!, tz: x.k.contract.business.timeZone, token: "", state: pageState(o) as any }), pageState(o) === "expired" ? 410 : 200);
  });

  app.post("/c/:token/decline", async (c) => {
    const x = byToken(c.req.param("token"));
    if (!x) return c.html(confirmPage({ business: d.facts().businessName, slot: nowIso(), tz: d.facts().timeZone, token: "", state: "invalid" }), 404);
    if (pageState(x.o) === "open") await runner.decline(x.o.id);
    const o = store.outcome(x.o.id)!;
    return c.html(confirmPage({ business: x.k.contract.business.name, slot: o.slotStart!, tz: x.k.contract.business.timeZone, token: "", state: pageState(o) as any }));
  });

  // ───────── proof sources for the oracle (signed by Foreman's key) ─────────
  app.get("/internal/confirmations/:outcomeId", async (c) => {
    const o = store.outcome(c.req.param("outcomeId"));
    if (!o || !o.confirmExpiresAt) return c.json({ error: "not_found" }, 404);
    const record = { outcomeId: o.id, redeemed: !!o.confirmedAt, redeemedAt: o.confirmedAt, expiresAt: o.confirmExpiresAt };
    return c.json({ record, signature: await signJson(d.foremanPk, record) });
  });

  app.get("/internal/attestations/:outcomeId", (c) => {
    const o = store.outcome(c.req.param("outcomeId"));
    if (!o?.attendedSig) return c.json({ error: "not_found" }, 404);
    return c.json({ payload: { outcomeId: o.id, attended: true }, signature: o.attendedSig });
  });

  // ───────── what the business-payer sees and pays ─────────
  app.get("/v1/claims", async (c) => {
    const id = c.req.query("contractId") ?? store.latestContractId();
    if (!id || !need(id)) return c.json([]);
    const k = need(id)!;
    return c.json(store.outcomes(id).flatMap((o) => {
      const milestone = o.state === "confirmed_by_customer" ? "confirmed" : o.state === "attended_attested" ? "attended" : null;
      if (!milestone) return [];
      const cu = store.customer(id, o.customerId)!;
      return [{
        outcomeId: o.id, contractId: id, milestone, customer: cu.name, bookingUid: o.bookingUid, contractHash: k.hash,
        price: milestone === "confirmed" ? k.contract.outcome.pricing.onConfirmed : k.contract.outcome.pricing.onAttended,
        expected: { attendeeEmail: cu.email, start: o.slotStart },
      }];
    }));
  });

  const invoicing = new Set<string>();
  const oneAtATime: MiddlewareHandler = async (c, next) => {
    const key = `${c.req.param("outcomeId")}:${c.req.param("milestone")}`;
    if (invoicing.has(key)) return c.json({ error: "invoice_in_progress" }, 409);
    invoicing.add(key);
    try { await next(); } finally { invoicing.delete(key); }
  };
  const MILESTONE = { confirmed: { from: "confirmed_by_customer", to: "paid_confirmed", step: "paid" }, attended: { from: "attended_attested", to: "paid_attended", step: "paid_attended" } } as const;

  app.post(
    "/v1/invoice/:outcomeId/:milestone",
    oneAtATime,
    paywall({
      network: d.network, facilitator: d.facilitator, payTo: d.foremanAddress, description: "Foreman: proven rebooking",
      usd: (c) => {
        const o = store.outcome(c.req.param("outcomeId")!)!;
        const p = store.contract(o.contractId)!.contract.outcome.pricing;
        return c.req.param("milestone") === "attended" ? p.onAttended : p.onConfirmed;
      },
      // Refuse before any 402 so the business never pays for an invoice in the wrong state.
      precheck: (c) => {
        const m = MILESTONE[c.req.param("milestone") as keyof typeof MILESTONE];
        const o = store.outcome(c.req.param("outcomeId")!);
        if (!m) return c.json({ error: "unknown_milestone" }, 404);
        if (!o) return c.json({ error: "not_found" }, 404);
        if (o.state !== m.from) return c.json({ error: "invalid_state", state: o.state, expected: m.from }, 409);
      },
      onSettled: (c, s) => {
        const m = MILESTONE[c.req.param("milestone") as keyof typeof MILESTONE];
        const o = store.outcome(c.req.param("outcomeId")!)!;
        store.transitionOutcome(o.id, m.from, m.to);
        const k = store.contract(o.contractId)!;
        const amount = c.req.param("milestone") === "attended" ? k.contract.outcome.pricing.onAttended : k.contract.outcome.pricing.onConfirmed;
        store.addPayment({ id: newId("pay"), contractId: o.contractId, direction: "in", from: s.payer ?? d.businessAddress, to: d.foremanAddress, counterparty: k.contract.business.name, purpose: `invoice_${c.req.param("milestone")}`, amount, txHash: s.transaction, refId: o.id, createdAt: nowIso() });
        const cu = store.customer(o.contractId, o.customerId)!;
        log.emit("payment_in", "business", { from: k.contract.business.name, fromAddr: s.payer, to: "Foreman", amount, purpose: `invoice_${c.req.param("milestone")}`, milestone: c.req.param("milestone"), outcomeId: o.id, customerId: cu.id, txHash: s.transaction, link: txLink(s.transaction, d.network), earned: store.earned(o.contractId) }, o.contractId);
        runner.setCustomer(o.contractId, cu, m.step === "paid" ? "paid" : "paid_attended");
      },
    }),
    (c) => c.json({ ok: true, outcomeId: c.req.param("outcomeId"), milestone: c.req.param("milestone") }),
  );

  return app;
}

const publicCustomer = (x: ReturnType<Store["customers"]>[number]) => ({
  id: x.id, name: x.name, phone: mask.phone(x.phone), email: mask.email(x.email), missedAt: x.missedAt, consent: !!x.consentSource,
  state: x.state, refusal: x.refusal, offers: x.offers, planReason: x.planReason, steps: x.steps,
});
