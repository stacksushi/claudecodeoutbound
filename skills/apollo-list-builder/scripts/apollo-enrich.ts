// Phase 2: SPENDS CREDITS (1 per contact). Run only after the user approved the sample.
// Usage: APOLLO_API_KEY=... npx tsx apollo-enrich.ts --dir=campaigns/<slug> --max-credits=500 --approved
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";

const KEY = process.env.APOLLO_API_KEY;
if (!KEY) throw new Error("APOLLO_API_KEY missing");

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const dir = arg("dir");
const cap = Number(arg("max-credits"));
if (!dir || !cap) throw new Error("--dir and --max-credits required");
if (!process.argv.includes("--approved")) throw new Error("Refusing to spend credits without --approved (user must confirm the sample first)");

const { people } = JSON.parse(readFileSync(`${dir}/search-results.json`, "utf8"));
const seenPath = `${dir}/../.enriched-ids.txt`;
const seen = new Set(existsSync(seenPath) ? readFileSync(seenPath, "utf8").split("\n") : []);
const todo = people.filter((p: any) => p.id && !seen.has(p.id)).slice(0, cap);

mkdirSync(`${dir}/checkpoints`, { recursive: true });
const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const rows: string[] = [];
let credits = 0;

for (let i = 0; i < todo.length; i += 10) {
  const batch = todo.slice(i, i + 10);
  const ck = `${dir}/checkpoints/batch-${i}.json`;
  let j: any;
  if (existsSync(ck)) j = JSON.parse(readFileSync(ck, "utf8"));
  else {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch("https://api.apollo.io/api/v1/people/bulk_match?reveal_personal_emails=false", {
        method: "POST",
        headers: { "x-api-key": KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ details: batch.map((p: any) => ({ id: p.id })) }),
      });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 2 ** attempt * 2000)); continue; }
      if (!res.ok) throw new Error(`Apollo ${res.status}: ${await res.text()}`);
      j = await res.json();
      writeFileSync(ck, JSON.stringify(j));
      break;
    }
  }
  for (const m of j?.matches ?? []) {
    if (!m) continue;
    appendFileSync(seenPath, `${m.id}\n`);
    if (!m.email) continue;
    credits++;
    rows.push([m.email, m.first_name, m.last_name, m.organization?.name, m.organization?.primary_domain, m.title, m.linkedin_url].map(q).join(","));
  }
}

writeFileSync(`${dir}/enriched.csv`, ["email,first_name,last_name,company_name,company_domain,title,linkedin_url", ...rows].join("\n"));
appendFileSync(`${dir}/credit-log.md`, `- ${new Date().toISOString()}: requested ${todo.length}, emails found ${rows.length}, cap ${cap}\n`);
console.log(`requested ${todo.length}; emails found ${rows.length}. Next: /email-verification on ${dir}/enriched.csv`);
