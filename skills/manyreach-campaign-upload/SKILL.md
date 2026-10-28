---
name: manyreach-campaign-upload
description: Upload a verified leads.csv plus the copy from /campaign-copywriting (after spam check and super-spintax) to ManyReach as a campaign that is NOT started. ManyReach counterpart of smartlead-campaign-upload-public, built from the user's cold-email-campaign pipeline (custom1-8 mapping, ManyReach-safe spintax, rate limits). Use after /email-verification when the sending platform is ManyReach.
---

# ManyReach Campaign Upload

Mirror of `smartlead-campaign-upload-public` for ManyReach. Same rule: **never start the campaign**. The user reviews in ManyReach and presses Start.

Two ways to call ManyReach: the connected Manyreach MCP (preferred when available; start with `describe()`), or the REST API below.

## API (from the user's cold-email-campaign pipeline)

- Base URL `https://app.manyreach.com/api/v2`, header `X-API-Key`, spec at `https://app.manyreach.com/swagger/docs/v2`
- Rate limit 60 requests/minute per endpoint: send 55, pause 62s, retry any 429 after the cooldown
- `GET /campaigns`, `POST /campaigns`, `POST /prospects/bulk`, `PATCH /prospects/{id}`, `DELETE /campaigns/{id}/prospects/{prospectId}`

## Field mapping

| ManyReach field | Source |
|---|---|
| firstName, lastName, email, company, city | leads.csv (`company` = normalized `company_name`) |
| custom1 | intro_line |
| custom2 | line_2 |
| custom3 | cta |
| custom4 | followup_1 |
| custom5 | followup_2 |
| custom6, custom7, custom8 | subject_1, subject_2, subject_3 |

Each custom field must stay under 1800 characters.

## ManyReach-safe formatting (apply to the copy before upload)

These come straight from the user's pipeline and override the Smartlead spintax conventions for this platform only:

- Spintax is `{a|b|c}` with no leading or trailing pipes
- No apostrophes or backticks inside spintax (causes parser error Code:x32): expand contractions (don't becomes do not, i'll becomes i will)
- No commas inside spintax options (ManyReach treats commas as delimiters)
- Plain text only, real `\r\n` line breaks, no HTML tags
- Strip apostrophes from interpolated company names, cities and categories
- Cities lowercase and conversational (st. pete, ft. lauderdale)
- Company names normalized: no Inc/Corp/LLC/Ltd/Co./.com/P.A./P.C./PLLC, ALL CAPS to Title Case

`{{first_name}}` style merge fields from `/campaign-copywriting` are converted to the ManyReach per-prospect fields at build time, because the personalization lines are pre-rendered into custom1-8. If the copy uses ManyReach merge tags directly, use `{First Name}` and `{Company Name}` as in the user's existing campaigns.

## Flow

1. Confirm inputs exist: `leads.csv` (every row `safe_to_send=Yes`), final copy with spintax, `spam-word-checker` passed
2. `GET /campaigns`; create the campaign if it does not exist
3. `POST /prospects/bulk` in batches, mapping fields above
4. Verify count in ManyReach equals `leads.csv` rows
5. Print the ManyReach campaign URL. Do NOT start it.

## Updating an already uploaded list (cleanup mode)

1. Fetch prospects: `GET /prospects?includeCampaignIds.campaignIds={id}&limit=1000` (paginate)
2. Cross-reference by email with the verification results; DELETE unverified ones
3. PATCH updated copy fields
4. Respect the 55-per-minute pacing

## Spam check before upload

Run this checklist: no "free", no apostrophes or commas inside spintax, plain text only, no all-caps acronyms, subjects under 4 words, fields under 1800 characters, spam trigger words list (guarantee, no obligation, act now, limited time, urgent, click here, buy now, discount, offer, deal, winner, congratulations).

## Learned from the first live build (campaign created through the Manyreach MCP)

Prefer this template-in-campaign path over the older custom1-8 pre-rendered path above.

- **Variable names are a closed list** (uppercase): `{{FIRST_NAME}}`, `{{COMPANY}}`, `{{STATE}}`, `{{CITY}}`, `{{JOB_POSITION}}`, `{{CUSTOM_1}}`..`{{CUSTOM_20}}`, `{{SENDER_FIRSTNAME}}`, `{{SENDER_SIGNATURE}}`. Never `{{company_name}}`, `{{COMPANY_NAME}}`, `{{CUSTOM1}}` or `{{SENDER_NAME}}`. Convert copywriting names at build time (first_name to FIRST_NAME, company_name to COMPANY, state to STATE, custom per-lead lines to CUSTOM_n).
- **Bodies are HTML** (`<p>...</p>`, `<br>`); `textOnlyEmails: true` still sends plain text. Newlines alone are not paragraphs.
- **Spintax:** `{a|b|c}` works, options may contain variables. A/B tests across whole bodies use `{abtest|body A|body B|}` with a trailing pipe. Do NOT put a pipe inside a variable (`{{X | default: "y"}}`) inside a spin or abtest group; use `deactivateIfMissingPlaceholder: true` instead so incomplete leads are skipped.
- **Flow:** `campaign/post` (Draft) then the campaign already has sequence "1" (check `campaign/get_sequences_by_id`), add follow-ups with `sequence/post_followups_by_id` (`waitMin` 1-1000, `waitUnits`, omit `subject` to inherit, `sendInSameThread` for threaded), enrol with `prospect/post_bulk` + `campaignId` (max 100 rows, upsert by email; Draft means nothing sends), then `campaign/start_by_id` only after a fresh explicit go-ahead.
- **Sender:** never pick silently; ask the user. `fromEmails` defaults to the login address, which usually cannot send. Set `fromName` and `replyToEmail` to the client identity.
- **Never use the agency's signature or inbox identity for client copy.** See the identity gate in `outbound-autopilot`.
- **Watch for:** a stray `RE: ` prefix appeared on a campaign subject after a patch; read the campaign back after every patch and fix it.
- **Prospect fields:** Apollo enrichment returns state, city, headcount and domain; map to `state`, `city`, `companySize`, `domain`. Put the per-lead phrase in `custom1` and make sure it reads after the article in the copy ("a" before a vowel breaks it).
- **Rate limit:** 60 requests/minute per key. Large tool outputs (for example `sender/get`) are saved to a file; extract with jq.
