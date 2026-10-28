// Pure routing and parsing helpers (no network). Covered by tests/verify-routing.test.ts.
export type Primary = "millionverifier" | "reoon";
export type Secondary = "no2bounce" | "none";
export type Route = "KEEP" | "SECOND" | "REMOVE";

// Reoon routing: unchanged from the original skill.
export function routeReoon(status: string, isSafeToSend: boolean): Route {
  if (status === "safe" && isSafeToSend) return "KEEP";
  if (["catch_all", "unknown", "role_account"].includes(status)) return "SECOND";
  return "REMOVE"; // invalid, disabled, spamtrap, inbox_full and anything unrecognized
}

// MillionVerifier routing: ok keeps; catch_all/unknown (and anything unclear, incl. error/reverify) get a second opinion; invalid/disposable are removed.
export function routeMillionVerifier(result: string): Route {
  const r = (result || "").toLowerCase().trim();
  if (r === "ok") return "KEEP";
  if (r === "invalid" || r === "disposable") return "REMOVE";
  return "SECOND";
}

// No2Bounce routing: unchanged from the original skill.
export function routeNo2Bounce(finalScoreValue: string): "KEEP" | "REMOVE" {
  return ["Deliverable", "Deliverable/AcceptAll", "Risky/AcceptAll"].includes(finalScoreValue) ? "KEEP" : "REMOVE";
}

export interface Decision { keep: boolean; held: boolean }

// Final decision. With secondary "none" (MillionVerifier-only) nothing risky is sent: it is held for review.
export function decide(route: Route, secondary: Secondary, n2b?: string): Decision {
  if (route === "KEEP") return { keep: true, held: false };
  if (route === "REMOVE") return { keep: false, held: false };
  if (secondary === "none") return { keep: false, held: true };
  return { keep: n2b !== undefined && routeNo2Bounce(n2b) === "KEEP", held: false };
}

export function parseCsv(t: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0]) rows.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export const csvEsc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;

// Reads a MillionVerifier report CSV into email -> result. Column names are matched case-insensitively.
export function parseMvReport(csv: string): Record<string, string> {
  const [head, ...rows] = parseCsv(csv);
  if (!head) return {};
  const lower = head.map((h) => h.trim().toLowerCase());
  const ei = lower.indexOf("email"), ri = lower.indexOf("result");
  if (ei < 0 || ri < 0) throw new Error(`MillionVerifier report has no email/result columns (got: ${head.join(", ")})`);
  const out: Record<string, string> = {};
  for (const r of rows) out[(r[ei] ?? "").trim().toLowerCase()] = (r[ri] ?? "").trim();
  return out;
}
