import OpenAI from "openai";
import type { z } from "zod";

export const PROMPT_GUARD = { type: "function", function: { name: "serv_prompt_guard" } } as const;

/** SERV reads tool options only from schema defaults, so the hint lives in `default`. */
export const shadowAgent = (hint: string, maxIterations = 3) =>
  ({
    type: "function",
    function: {
      name: "serv_shadow_agent",
      description: "Run shadow-agent validation.",
      parameters: {
        type: "object",
        properties: {
          hint: { type: "string", default: hint },
          max_iterations: { type: "integer", default: maxIterations },
        },
      },
    },
  }) as const;

export type Effort = "none" | "low" | "medium" | "high";

export interface ServDecision<T> {
  purpose: string;
  model: string;
  effort: Effort;
  source: "live" | "fallback";
  ms: number;
  usage: { input: number; output: number } | null;
  guards: string[];
  data: T;
  error?: string;
}

export interface ServJsonOpts<T> {
  purpose: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  tools?: readonly unknown[];
  effort?: Effort;
  timeoutMs?: number;
  /** Map near-miss model output onto the schema (e.g. `requested_items` → `requested`) before validation. */
  normalize?: (raw: any) => unknown;
  /** Deterministic answer used when SERV is unavailable; the decision is then labelled source:"fallback". */
  fallback?: () => T;
}

type Listener = (d: ServDecision<unknown>) => void;
const listeners = new Set<Listener>();
export const onServDecision = (l: Listener) => (listeners.add(l), () => listeners.delete(l));

let client: OpenAI | null = null;
export function servClient(): OpenAI | null {
  if (!process.env.SERV_API_KEY) return null;
  client ??= new OpenAI({
    baseURL: process.env.SERV_BASE_URL ?? "https://inference-api.openserv.ai/v1",
    apiKey: process.env.SERV_API_KEY,
    maxRetries: 0,
  });
  return client;
}
export const servConfigured = () => !!process.env.SERV_API_KEY;

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("no JSON object in model output");
  }
}

/** Call SERV and return schema-valid JSON. Retries once on invalid output; falls back if provided. */
export async function servJson<T>(o: ServJsonOpts<T>): Promise<ServDecision<T>> {
  const model = process.env.SERV_MODEL ?? "gpt-5.4-mini";
  const effort = o.effort ?? "low";
  const guards = (o.tools ?? []).map((t: any) => t?.function?.name).filter(Boolean);
  const t0 = performance.now();
  const c = servClient();
  let lastErr = c ? "" : "SERV_API_KEY not set";

  for (let attempt = 0; c && attempt < 2; attempt++) {
    try {
      const res = await c.chat.completions.create(
        {
          model,
          reasoning_effort: effort,
          ...(o.tools?.length ? { tools: o.tools as any } : {}),
          messages: [
            { role: "system", content: `${o.system}\nReturn only one JSON object, no prose.` },
            { role: "user", content: attempt ? `${o.user}\n\nYour previous reply was invalid (${lastErr}). Return only valid JSON.` : o.user },
          ],
        } as any,
        { timeout: o.timeoutMs ?? 20_000 },
      );
      const raw = extractJson(res.choices[0]?.message?.content ?? "");
      const data = o.schema.parse(o.normalize ? o.normalize(raw) : raw);
      const u = res.usage;
      return emit({
        purpose: o.purpose, model: res.model ?? model, effort, source: "live", guards, data,
        ms: Math.round(performance.now() - t0),
        usage: u ? { input: u.prompt_tokens, output: u.completion_tokens } : null,
      });
    } catch (e: any) {
      lastErr = String(e?.message ?? e).slice(0, 300);
      if (e?.name === "APIConnectionTimeoutError" || e?.status >= 400) break; // don't burn the latency budget twice
    }
  }
  if (!o.fallback) throw new Error(`SERV ${o.purpose} failed: ${lastErr}`);
  return emit({
    purpose: o.purpose, model, effort, source: "fallback", guards, data: o.fallback(),
    ms: Math.round(performance.now() - t0), usage: null, error: lastErr,
  });
}

function emit<T>(d: ServDecision<T>): ServDecision<T> {
  for (const l of listeners) l(d as ServDecision<unknown>);
  return d;
}
