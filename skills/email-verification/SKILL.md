---
name: email-verification
description: "2-step email verification pipeline: a primary verifier (MillionVerifier or Reoon, user's choice) then No2Bounce for risky addresses. Use this skill whenever the user wants to verify, validate, or clean email lists — whether from Muraena leads, CSV imports, or any other source. Triggers on: 'verify emails', 'validate emails', 'clean email list', 'check deliverability', 'email verification', 'safe to send', 'remove bad emails', 'check emails', or any request involving bulk email validation before sending campaigns."
---

# 2-Step Email Verification Pipeline

This skill verifies email addresses through two services in sequence to maximize deliverability while recovering valid emails behind catch-all domains. The first service is the user's choice: **MillionVerifier** or **Reoon**. The second is **No2Bounce** (risky and catch-all addresses only).

## Step 0: Ask which services to use (always first)

Before verifying anything, ask the user which combination they use (one question, with these options):

1. **MillionVerifier + No2Bounce** (recommended, most users have MillionVerifier)
2. **Reoon + No2Bounce**
3. **MillionVerifier only** (no second opinion: risky addresses are held for review, never sent)

Then:

- Check `.env` for the matching keys (`MILLIONVERIFIER_API_KEY` or `REOON_KEY`, plus `NO2BOUNCE_KEY` unless MillionVerifier only). If one is missing, stop and tell the user the exact variable name to add to `.env`. Never ask them to paste a key into chat and never write a key into any file.
- Save the choice in the client profile: `verification: {primary: millionverifier|reoon, secondary: no2bounce|none}`.
- Tell the user how many unique emails will be verified (that is the credit usage) before running.

## API Credentials

Keys are read from environment variables (put them in a local `.env`, never in this file):

- `MILLIONVERIFIER_API_KEY`: MillionVerifier API key
- `REOON_KEY`: Reoon API key
- `NO2BOUNCE_KEY`: No2Bounce API key

In the API examples below, `<REOON_KEY>`, `<MILLIONVERIFIER_API_KEY>` and `<NO2BOUNCE_KEY>` mean the values of those variables.

Run the bundled script (reads keys from `.env`):

```bash
node --env-file=.env --experimental-strip-types scripts/verify.ts \
  --in=enriched.csv --out=verified.csv --primary=millionverifier   # or --primary=reoon
# add --secondary=none for MillionVerifier only; add --resume to reuse a saved primary result
```

## Step 1 (option A): MillionVerifier (primary verification)

Use when the user chose MillionVerifier. Bulk flow (host `bulkapi.millionverifier.com`, key as the `key` query parameter):

**Upload:**
```
POST https://bulkapi.millionverifier.com/bulkapi/v2/upload?key=<MILLIONVERIFIER_API_KEY>
Body: multipart/form-data, field file_contents = a text or CSV file with one email per line
Response: { "file_id": ..., "status": "in_progress", ... }
```

**Poll:**
```
GET https://bulkapi.millionverifier.com/bulkapi/v2/fileinfo?key=<KEY>&file_id=<FILE_ID>
```
- Poll every 15 seconds until `status` = `finished` (other values: `in_progress`, `in_queue_to_start`, `paused`, `error`, `canceled`)

**Download:**
```
GET https://bulkapi.millionverifier.com/bulkapi/v2/download?key=<KEY>&file_id=<FILE_ID>&filter=all
```
- Report is a CSV with an `email` column and a `result` column. Single-email API (`GET https://api.millionverifier.com/api/v3?api=<KEY>&email=<EMAIL>`) is for spot checks only; use bulk for lists.
- Live-tested on 2026-10-28 with 5 emails (upload, file info, download and the `email` and `result` columns all worked). The script still fails loudly if the report has no `email` and `result` columns.

### MillionVerifier Status Routing

| MillionVerifier `result` | Action |
|---|---|
| `ok` | **Keep** (Safe to Send = Yes) |
| `catch_all` | **Send to Step 2** (No2Bounce) |
| `unknown` | **Send to Step 2** (No2Bounce) |
| `error`, `reverify`, or anything unrecognized | **Send to Step 2**, never silently removed |
| `invalid` | **Remove** |
| `disposable` | **Remove** |

With **MillionVerifier only**, `catch_all`, `unknown` and unclear results are written to `<out>.held.csv` for the user to review. They are never added to the verified list.

## Step 1 (option B): Reoon (Primary Verification)

Reoon performs deep SMTP-level verification on every email. It catches invalid, disabled, and spam-trap addresses, and identifies catch-all domains that need secondary verification.

### Bulk Verification

**Create task:**
```
POST https://emailverifier.reoon.com/api/v1/create-bulk-verification-task/
Body: { "name": "Task Name", "emails": ["email1@domain.com", ...], "key": "<REOON_KEY>" }
```
- Max 50,000 emails per task
- Response: `{ "status": "success", "task_id": 123456, "count_processing": N }`

**Poll for results:**
```
GET https://emailverifier.reoon.com/api/v1/get-result-bulk-verification-task/?key=<REOON_KEY>&task_id=<TASK_ID>
```
- Poll every 15 seconds until `status` = `completed`
- Results is a dict keyed by email address (not a list)

### Reoon Status Routing

| Reoon Status | `is_safe_to_send` | Action |
|---|---|---|
| `safe` | `true` | **Keep** — mark Safe to Send = Yes |
| `catch_all` | `false` | **Send to Step 2** (No2Bounce) |
| `unknown` | `false` | **Send to Step 2** (No2Bounce) |
| `role_account` | `false` | **Send to Step 2** (No2Bounce) |
| `invalid` | `false` | **Remove** — dead email |
| `disabled` | `false` | **Remove** — inbox disabled |
| `spamtrap` | `false` | **Remove** — dangerous to send |
| `inbox_full` | `false` | **Remove** — undeliverable |

Only emails with status `catch_all`, `unknown`, or `role_account` proceed to Step 2. Everything else is either already confirmed safe or confirmed dead.

## Step 2: No2Bounce (Secondary Verification — risky/catchall only)

No2Bounce provides a second opinion on emails that Reoon couldn't definitively classify. It's particularly good at determining deliverability on catch-all domains.

### Bulk Verification

**Submit emails:**
```
POST https://connect.no2bounce.com/v2/n2b_validate_bulk
Headers: { "apitoken": "<NO2BOUNCE_KEY>", "Content-Type": "application/json" }
Body: { "emailList": ["email1@domain.com", ...] }
```
- Response: `{ "message": "Success", "data": { "trackingId": "abc123" } }`
- Batch size: 500 emails per request recommended

**Poll for results:**
```
GET https://connect.no2bounce.com/v2/n2b_validate_bulk?trackingId=<TRACKING_ID>
Headers: { "apitoken": "<NO2BOUNCE_KEY>" }
```
- Poll every 15 seconds until `overallStatus` = `Completed`
- Results come as a CSV download via `result.downloadFile` URL
- CSV columns: `email`, `finalScore`, `finalScoreValue`, `catchall`

### No2Bounce Status Routing

| No2Bounce `finalScoreValue` | Action |
|---|---|
| `Deliverable` | **Keep** — mark Safe to Send = Yes |
| `Deliverable/AcceptAll` | **Keep** — deliverable on catch-all domain |
| `Risky/AcceptAll` | **Keep** — risky but sendable |
| `UnDeliverable` | **Remove** |
| `UnDeliverable/AcceptAll` | **Remove** |

## Final "Safe to Send" Logic

**MillionVerifier primary:**

```
if mv_result == "ok":                        Safe to Send = Yes
elif mv_result in (invalid, disposable):     REMOVE
else (catch_all, unknown, error, other):
    if secondary == none:                    HOLD (write to .held.csv, not sent)
    elif no2bounce in (Deliverable, Deliverable/AcceptAll, Risky/AcceptAll): Safe to Send = Yes
    else:                                    REMOVE
```

**Reoon primary (unchanged):**

```
if reoon_status == "safe" AND is_safe_to_send == true:
    Safe to Send = Yes

elif reoon_status in (invalid, disabled, spamtrap, inbox_full):
    REMOVE — do not include in output

elif reoon_status in (catch_all, unknown, role_account):
    if no2bounce == "Deliverable":
        Safe to Send = Yes
    elif no2bounce in ("Deliverable/AcceptAll", "Risky/AcceptAll"):
        Safe to Send = Yes
    else:
        REMOVE — do not include in output

else:
    REMOVE — do not include in output
```

## Implementation Notes

- Always use the bulk APIs (not single) for lists. Reoon: bulk API (single endpoint has a 5-thread concurrency limit) — single endpoint has a 5-thread concurrency limit
- Reoon results are a **dict** keyed by email, not a list — handle both formats defensively
- No2Bounce is async — submit, get trackingId, then poll until complete
- No2Bounce returns a CSV download URL, not inline results — download and parse it
- Output columns: `primary_provider`, `primary_status`, `n2b_status`, `safe_to_send` (replaces the old `reoon_status`). Run `--resume` to reuse a saved primary result.
- Save intermediate results (primary JSON, No2Bounce JSON) to files for checkpointing — if the script fails partway through, you can resume from cached results
- Final CSV should exclude all "No" emails — only output verified deliverable leads
