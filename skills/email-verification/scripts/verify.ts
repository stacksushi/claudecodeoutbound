// Email verification: primary (MillionVerifier or Reoon) then optional No2Bounce for risky addresses.
// Usage:
//   node --env-file=.env --experimental-strip-types scripts/verify.ts --in=enriched.csv --out=verified.csv --primary=millionverifier [--secondary=no2bounce|none] [--resume]
// Keys (from .env): MILLIONVERIFIER_API_KEY, REOON_KEY, NO2BOUNCE_KEY
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { csvEsc, decide, parseCsv, parseMvReport, routeMillionVerifier, routeReoon, type Primary, type Secondary } from "./verify-lib.ts";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const inP = arg("in"), outP = arg("out");
const primary = arg("primary") as Primary | undefined;
const secondary = (arg("secondary") ?? "no2bounce") as Secondary;
const resume = process.argv.includes("--resume");
if (!inP || !outP) throw new Error("--in and --out are required");
if (primary !== "millionverifier" && primary !== "reoon") {
  throw new Error("--primary is required: millionverifier or reoon. Ask the user which service they use.");
}
if (secondary !== "no2bounce" && secondary !== "none") throw new Error("--secondary must be no2bounce or none");

const need = (name: string) => { const v = process.env[name]; if (!v) throw new Error(`Missing ${name}. Add it to .env (see .env.example).`); return v; };
const MV = primary === "millionverifier" ? need("MILLIONVERIFIER_API_KEY") : "";
const RK = primary === "reoon" ? need("REOON_KEY") : "";
const NK = secondary === "no2bounce" ? need("NO2BOUNCE_KEY") : "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const [head, ...data] = parseCsv(readFileSync(inP, "utf8"));
const ei = head.indexOf("email");
if (ei < 0) throw new Error("input CSV needs an email column");
const emails = [...new Set(data.map((r) => r[ei].trim().toLowerCase()))];
console.log(`Verifying ${emails.length} unique emails with ${primary}${secondary === "none" ? " only" : " then " + secondary}.`);

type P = { status: string; safe: boolean };
const cp = `${outP}.${primary}.json`;

async function viaReoon(): Promise<Record<string, P>> {
  const created = await (await fetch("https://emailverifier.reoon.com/api/v1/create-bulk-verification-task/", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `verify-${Date.now()}`, emails, key: RK }),
  })).json();
  if (created.status !== "success") throw new Error("Reoon create failed: " + JSON.stringify(created));
  for (;;) {
    const j = await (await fetch(`https://emailverifier.reoon.com/api/v1/get-result-bulk-verification-task/?key=${RK}&task_id=${created.task_id}`)).json();
    if (j.status === "completed") {
      const res = j.results ?? {}; const out: Record<string, P> = {};
      const list = Array.isArray(res) ? res : Object.entries(res).map(([email, v]: any) => ({ email, ...v }));
      for (const r of list) out[String(r.email).toLowerCase()] = { status: r.status, safe: r.is_safe_to_send === true };
      return out;
    }
    await sleep(15000);
  }
}

async function viaMillionVerifier(): Promise<Record<string, P>> {
  try {
    const c = await (await fetch(`https://api.millionverifier.com/api/v3/credits?api=${MV}`)).json();
    if (c?.credits !== undefined) console.log(`MillionVerifier credits available: ${c.credits}`);
  } catch { /* credit check is informational */ }
  const fd = new FormData();
  fd.append("file_contents", new Blob([emails.join("\n")], { type: "text/plain" }), "emails.txt");
  const up = await (await fetch(`https://bulkapi.millionverifier.com/bulkapi/v2/upload?key=${MV}`, { method: "POST", body: fd })).json();
  if (!up.file_id) throw new Error("MillionVerifier upload failed: " + JSON.stringify(up));
  console.log(`Uploaded to MillionVerifier, file_id=${up.file_id}`);
  for (;;) {
    const info = await (await fetch(`https://bulkapi.millionverifier.com/bulkapi/v2/fileinfo?key=${MV}&file_id=${up.file_id}`)).json();
    if (info.status === "finished") break;
    if (["error", "canceled"].includes(info.status)) throw new Error("MillionVerifier file " + info.status + ": " + JSON.stringify(info));
    console.log(`  ${info.status} ${info.percent ?? 0}%`);
    await sleep(15000);
  }
  const res = await fetch(`https://bulkapi.millionverifier.com/bulkapi/v2/download?key=${MV}&file_id=${up.file_id}&filter=all`);
  if (!res.ok) throw new Error(`MillionVerifier download failed: ${res.status}`);
  const report = parseMvReport(await res.text());
  const out: Record<string, P> = {};
  for (const e of emails) out[e] = { status: (report[e] ?? "unknown").toLowerCase(), safe: false };
  return out;
}

let prim: Record<string, P>;
if (resume && existsSync(cp)) { prim = JSON.parse(readFileSync(cp, "utf8")); console.log(`Resumed from ${cp}`); }
else { prim = primary === "reoon" ? await viaReoon() : await viaMillionVerifier(); writeFileSync(cp, JSON.stringify(prim, null, 1)); }

const routeOf = (e: string) => primary === "reoon" ? routeReoon(prim[e]?.status ?? "unknown", prim[e]?.safe ?? false) : routeMillionVerifier(prim[e]?.status ?? "unknown");
const second = secondary === "none" ? [] : emails.filter((e) => routeOf(e) === "SECOND");

// No2Bounce (second opinion on risky/catch-all only)
const n2b: Record<string, string> = {};
if (second.length) {
  const sub = await (await fetch("https://connect.no2bounce.com/v2/n2b_validate_bulk", {
    method: "POST", headers: { apitoken: NK, "Content-Type": "application/json" }, body: JSON.stringify({ emailList: second }),
  })).json();
  const id = sub.data?.trackingId; if (!id) throw new Error("No2Bounce submit failed: " + JSON.stringify(sub));
  for (;;) {
    const j = await (await fetch(`https://connect.no2bounce.com/v2/n2b_validate_bulk?trackingId=${id}`, { headers: { apitoken: NK } })).json();
    if (j.overallStatus === "Completed") {
      const [h, ...rs] = parseCsv(await (await fetch(j.result.downloadFile)).text());
      const ci = h.indexOf("email"), vi = h.indexOf("finalScoreValue");
      for (const r of rs) n2b[r[ci].toLowerCase()] = r[vi];
      break;
    }
    await sleep(15000);
  }
  writeFileSync(`${outP}.no2bounce.json`, JSON.stringify(n2b, null, 1));
}

const cols = [...head, "primary_provider", "primary_status", "n2b_status", "safe_to_send"];
const kept = [cols.map(csvEsc).join(",")], held = [cols.map(csvEsc).join(",")];
const summary: Record<string, number> = {};
for (const r of data) {
  const e = r[ei].trim().toLowerCase();
  const d = decide(routeOf(e), secondary, n2b[e]);
  const key = `${prim[e]?.status ?? "unknown"}${n2b[e] ? "/" + n2b[e] : ""} -> ${d.keep ? "KEEP" : d.held ? "HELD" : "REMOVE"}`;
  summary[key] = (summary[key] ?? 0) + 1;
  const row = [...r, primary, prim[e]?.status ?? "unknown", n2b[e] ?? "", d.keep ? "Yes" : "No"];
  if (d.keep) kept.push(row.map(csvEsc).join(","));
  else if (d.held) held.push(row.map(csvEsc).join(","));
}
writeFileSync(outP, kept.join("\n"));
if (held.length > 1) writeFileSync(outP.replace(/\.csv$/, "") + ".held.csv", held.join("\n"));
console.log(summary);
console.log(`kept ${kept.length - 1} of ${data.length} -> ${outP}` + (held.length > 1 ? `; held for review: ${held.length - 1} (${outP.replace(/\.csv$/, "")}.held.csv)` : ""));
