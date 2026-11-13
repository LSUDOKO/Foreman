export interface CsvCustomer { id: string; name: string; phone: string; email: string; missedAt: string; consentSource: string | null }

/** Small RFC-4180-ish parser: quoted fields, escaped quotes, CRLF. Unknown columns (e.g. demo_role) are ignored. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  const [head, ...body] = rows;
  if (!head) return [];
  const cols = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? "").trim()])));
}

export function customersFromCsv(text: string): { customers: CsvCustomer[]; errors: string[] } {
  const errors: string[] = [];
  const customers: CsvCustomer[] = [];
  const ids = new Set<string>();
  parseCsv(text).forEach((r, i) => {
    const line = i + 2;
    if (!r.id || ids.has(r.id)) return errors.push(`line ${line}: missing or duplicate id`);
    if (!/^\+\d{8,15}$/.test(r.phone ?? "")) return errors.push(`line ${line}: phone must be E.164 (+countrycode…)`);
    if (!/^[^@\s]+@[^@\s]+$/.test(r.email ?? "")) return errors.push(`line ${line}: invalid email`);
    if (Number.isNaN(Date.parse(r.missed_at ?? ""))) return errors.push(`line ${line}: missed_at must be ISO 8601`);
    ids.add(r.id);
    customers.push({ id: r.id, name: r.name || r.id, phone: r.phone!, email: r.email!, missedAt: r.missed_at!, consentSource: r.consent_source || null });
  });
  return { customers, errors };
}
