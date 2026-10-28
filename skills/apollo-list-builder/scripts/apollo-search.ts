// Phase 1: zero-credit Apollo people search. Writes search-results.json + sample.csv.
// Usage: APOLLO_API_KEY=... npx tsx apollo-search.ts --filters=filters.json --out=campaigns/<slug> [--pages=5]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.APOLLO_API_KEY;
if (!KEY) throw new Error("APOLLO_API_KEY missing");

const arg = (n: string, d?: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;

const filtersPath = arg("filters");
const out = arg("out");
const maxPages = Number(arg("pages", "5"));
if (!filtersPath || !out) throw new Error("--filters and --out required");

const filters = JSON.parse(readFileSync(filtersPath, "utf8"));
mkdirSync(out, { recursive: true });

async function page(n: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "x-api-key": KEY!, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify({ ...filters, page: n, per_page: 100 }),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 2000));
      continue;
    }
    if (!res.ok) throw new Error(`Apollo ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error("Apollo rate limit: gave up");
}

const people: any[] = [];
let total = 0;
for (let n = 1; n <= maxPages; n++) {
  const j = await page(n);
  total = j.total_entries ?? j.pagination?.total_entries ?? total;
  people.push(...(j.people ?? []));
  if (!j.people?.length || n >= (j.pagination?.total_pages ?? n)) break;
}

writeFileSync(`${out}/search-results.json`, JSON.stringify({ total, people }, null, 1));

const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const rows = people.slice(0, 10).map((p) =>
  [p.first_name, p.last_name_obfuscated ?? p.last_name, p.title, p.organization?.name, p.has_email].map(q).join(",")
);
writeFileSync(`${out}/sample.csv`, ["first_name,last_name,title,company,has_email", ...rows].join("\n"));

console.log(`total matches: ${total}; pulled: ${people.length}; sample written to ${out}/sample.csv. Credits spent: 0`);
