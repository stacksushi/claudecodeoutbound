---
name: apollo-list-builder
description: Credit-safe list building with Apollo. Searches the ICP with Apollo's zero-credit search API, shows 10 sample contacts plus the total count for confirmation, and only then runs email enrichment (1 credit per contact). Replaces the Prospeo list-building skills (prospeo-full-export, disco-like, blitz etc.) in this version of the stack. Use whenever a campaign needs a lead list.
---

# Apollo List Builder (search free, enrich on confirm)

Two phases with a hard gate between them. Phase 1 costs 0 credits. Phase 2 costs 1 credit per contact and never starts without an approved sample.

## Inputs

- `profiles/<slug>/client-profile.yaml` (from `/icp-onboarding`): hard filters, soft preferences, excluded domains
- A campaign spec from `/campaign-strategy` (its "List Filters" column adds filters on top of the base ICP)
- `APOLLO_API_KEY` in `.env`
- `--max-credits=N` (required for Phase 2; the cap the user is willing to spend on this campaign)

## One ICP only

Read `icp_segment` from the profile. Refuse to run if the profile mixes segments. Use only that segment's `decision_makers` as titles and its own industry keywords. Never merge titles or industries from another segment into one search.

## Phase 1: Free search (0 credits)

Endpoint: `POST https://api.apollo.io/api/v1/mixed_people/api_search` (People API Search). It returns people matches without emails or phones and does not consume credits. Auth via `x-api-key` header.

1. Translate the ICP to Apollo params: `person_titles[]`, `person_seniorities[]`, `organization_num_employees_ranges[]` (e.g. `"51,200"`), `person_locations[]` / `organization_locations[]`, `q_organization_keyword_tags[]` or industry keywords, `contact_email_status` where supported. Titles must include synonyms (same rule as `/icp-onboarding`).
2. Apply `excluded_domains` and `industries_out` after the search (drop matching rows).
3. Triggers are soft: use them to rank, never as hard filters (learning carried over from `/icp-onboarding`).
4. Run `scripts/apollo-search.ts` which writes:
   - `campaigns/<campaign-slug>/search-results.json` (all pages pulled, up to the page cap)
   - `campaigns/<campaign-slug>/sample.csv` (10 rows: first name, obfuscated last name, title, company, has_email; tested: the free search does NOT return domain, headcount or city, only has_* flags)
   - total match count from `pagination.total_entries`
5. Do NOT call any Apollo endpoint that reveals emails in this phase. Before using any other search endpoint (for example organization search), confirm in Apollo's current docs that it is credit-free; if unsure, skip it.

## The gate

Show the user, per campaign:

```
Campaign: <name>
Total matches: <N>   Estimated enrichment cost: <N_to_enrich> credits (1 per contact)
Sample (10):
  1. <First> <L.>, <Title> @ <Company> (email available: <yes/no>)
  ...
Approve enrich up to <cap> contacts? (yes / adjust filters / skip)
```

- If the sample looks wrong, adjust filters and re-run Phase 1 (still free). Repeat until approved.
- Approval is per campaign and per run. A "yes" does not carry over to a different campaign or a bigger cap.
- When running several campaigns at once, collect all samples first and present them in one review so the user answers once.

## Phase 2: Enrich (1 credit per contact)

Only after an explicit yes.

1. Dedupe before spending: drop people already enriched in any other campaign (keyed on Apollo person id and email) and people already in `profiles/<slug>/suppression.csv` if present.
2. Take the first `min(approved_cap, total)` people.
3. Run `scripts/apollo-enrich.ts`: `POST /api/v1/people/bulk_match` in batches of 10 using the person ids from search. Keep `reveal_personal_emails` false. Checkpoint the raw response per batch to disk so a crash never re-spends credits.
4. Keep only rows with an email. Report credits spent vs. emails found (waste = credits spent without a usable email).
5. Write `campaigns/<campaign-slug>/enriched.csv`, then hand off to `/email-verification` (Reoon then No2Bounce, unchanged). Only `safe_to_send=Yes` rows go forward.

## Output

`campaigns/<campaign-slug>/leads.csv` in the schema of `smartlead-campaign-upload-public/references/leads-csv-schema.md` (email, first_name, last_name, company_name, company_domain, title, linkedin_url) after verification, plus company-name normalization from the user's `cold-email-campaign` command (strip Inc/Corp/LLC, fix ALL CAPS, strip apostrophes).

## Safeguards

- Never enrich without `--max-credits` and a recorded approval.
- Never exceed the approved cap, even if more matches exist.
- Respect Apollo rate limits; back off on 429 and resume from the checkpoint.
- Log every enrichment run (campaign, credits spent, emails found, date) to `campaigns/<campaign-slug>/credit-log.md`.

## Files

- `scripts/apollo-search.ts`
- `scripts/apollo-enrich.ts`

## Learned from the first live run

- The free search returns only `has_*` flags, so company size, state and city are unknown until enrichment. Enrichment (`bulk_match`) returns state, city, headcount, domain and LinkedIn; re-check the headcount range and the buyer title after enrichment and drop mismatches (a search hit titled Practice Manager came back as Marketing / HR Manager).
- Before spending credits: drop rows with `has_email` false, keep one contact per company, and exclude government and non-practice organizations.
- When joining several `enriched.csv` files, add a newline between them; the files have no trailing newline and a naive concatenation silently merges two rows.
- Verification can remove contacts too (one failed No2Bounce), so plan list size above the target.
