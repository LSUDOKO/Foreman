// Sandbox inbox: receives Foreman's confirmation emails and lets scripted customers click them.
import { Hono } from "hono";
import type { Persona } from "./carrier";

export interface Mail { id: string; to: string; subject: string; text: string; html: string; links: Record<string, string>; at: string; action?: string }

export function createInbox(o: { personas: Record<string, Persona>; stepMs: number; onChange?: () => void }) {
  const mails: Mail[] = [];
  const byEmail = (email: string) => Object.values(o.personas).find((p) => (p as any).emailAddress === email);
  const app = new Hono();

  app.post("/", async (c) => {
    const m = (await c.req.json()) as Omit<Mail, "id" | "at">;
    const mail: Mail = { ...m, id: `mail_${mails.length + 1}`, at: new Date().toISOString() };
    mails.push(mail);
    o.onChange?.();
    const persona = byEmail(m.to);
    const act = persona?.email;
    if (act === "confirm" || act === "decline") {
      setTimeout(async () => {
        const url = mail.links[act];
        if (!url) return;
        const r = await fetch(url, { method: "POST" });
        mail.action = `${act} → ${r.status}`;
        o.onChange?.();
      }, o.stepMs * 4);
    }
    return c.json({ ok: true, id: mail.id });
  });

  app.get("/", (c) => c.json(mails));
  return { app, mails };
}
