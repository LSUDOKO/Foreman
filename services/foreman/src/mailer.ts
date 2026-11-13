import { urls } from "@foreman/shared/env";

export interface Mail { to: string; subject: string; text: string; html: string; links: Record<string, string> }

/** Gmail SMTP (app password) when SMTP_USER is set; otherwise the local sandbox inbox. */
export async function sendMail(m: Mail): Promise<{ via: "smtp" | "sandbox"; id: string }> {
  if (process.env.SMTP_USER) {
    const nodemailer = await import("nodemailer");
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await t.sendMail({ from: `"${process.env.BUSINESS_NAME ?? "Smile Dental"}" <${process.env.SMTP_USER}>`, to: m.to, subject: m.subject, text: m.text, html: m.html });
    return { via: "smtp", id: info.messageId };
  }
  const r = await fetch(`${urls().sandbox}/mail`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(m) });
  if (!r.ok) throw new Error(`sandbox inbox ${r.status}`);
  return { via: "sandbox", id: ((await r.json()) as { id: string }).id };
}
