---
name: outbound-autopilot
description: Orchestrator for the user's own outbound stack. Runs strategy (icp-onboarding, lead-magnet-brainstorm, campaign-strategy), then for every selected campaign does Apollo free search, 10-sample confirmation, enrichment, 2-step verification, copywriting, spam check, super-spintax and a DRAFT upload to ManyReach and/or Smartlead. Goal is many campaigns with one review pass and no manual file handling. Use when asked to "run campaigns", "start outbound for <business>", or to create multiple campaigns at once.
---

# Outbound Autopilot

Adapted from `cold-email-kickoff`. Original learnings and rules of every downstream skill are unchanged; only list building, verification, spintax and the sending target differ.

## Assumptions

Domains and inboxes already exist and are warmed. Infra questions from `cold-email-kickoff` Step 1 collapse to: confirm `APOLLO_API_KEY`, the verification keys for the chosen service (`MILLIONVERIFIER_API_KEY` or `REOON_KEY`, plus `NO2BOUNCE_KEY`) and the sender key (`MANYREACH_API_KEY` and/or `SMARTLEAD_API_KEY`) are set. If one is missing, stop and say which.

## One ICP per profile and per campaign (hard rule)

Never combine ICPs. Each segment (for example medical practices, auto dealerships) has its own decision makers, pains, compliance angle, proof points and copy, so each gets its own `client-profile.yaml` with an `icp_segment` field and its own `profiles/<slug>/` folder.

- `/icp-onboarding`: when a form or interview covers several industries, split them into segments first, show them separately, and run one segment at a time.
- `/apollo-list-builder`: build filters only from the segment's `decision_makers` and `icp_hard_filters`. Titles, industry keywords and headcount from other segments must not appear in the search.
- `/campaign-strategy` and `/campaign-copywriting`: use only that segment's pains, proof and angle. Do not borrow another segment's case study unless the user approves.
- Several campaigns in one run = several campaigns inside the same segment, or separate runs for separate segments. Contacts are deduped across all of them.

## Pipeline

| # | Stage | Skill | Spend | Human gate |
|---|---|---|---|---|
| 1 | Profile | `/icp-onboarding` (website scrape first) | 0 | confirm yaml |
| 2 | Offer | `/lead-magnet-brainstorm` | 0 | pick magnet |
| 3 | Ideas | `/campaign-strategy` (15-25 ideas) | 0 | pick N campaigns |
| 4 | Search | `/apollo-list-builder` phase 1 | 0 credits | none |
| 5 | Sample gate | 10 sample contacts + total per campaign | 0 | **approve, adjust or skip** |
| 6 | Enrich | `/apollo-list-builder` phase 2 | 1 credit per contact, capped | none (approved in 5) |
| 7 | Verify | `/email-verification` (asks which service: MillionVerifier or Reoon, then No2Bounce) | verifier cost | none |
| 8 | Copy | `/campaign-copywriting` (its 4 steps) | 0 | see below |
| 9 | Guardrails | `/spam-word-checker` | 0 | none |
| 10 | Spintax | `/super-spintax` (and `/smartlead-spintax` rules for Smartlead syntax) | 0 | none |
| 11 | Upload | `/manyreach-campaign-upload` and/or `/smartlead-campaign-upload-public` | 0 | review and press Start |

Gate 5 is the credit gate. Gate 11 is the launch gate (campaigns are always uploaded as DRAFT, never started).

## Running many campaigns with one pass

1. After stage 3, ask which campaigns to run (default: the top 3 recommended plus all required types: Creative Ideas, New Hire, Lookalike).
2. Create a folder per campaign: `profiles/<slug>/campaigns/<campaign-slug>/` holding `filters.json`, `search-results.json`, `sample.csv`, `leads.csv`, `variants.yaml`.
3. Run stage 4 for every campaign in parallel (free). Dedupe people across campaigns by Apollo id and email so no contact is paid for twice or emailed by two campaigns.
4. Present ONE review: for each campaign the total matches, the 10 samples, the credits it would cost, and the proposed cap. The user answers approve / adjust / skip per campaign in one message. Adjustments re-run stage 4 for that campaign only.
5. For approved campaigns run stages 6 to 10 in parallel (subagent fan-out per campaign, as in the user's cold-email-campaign pipeline). Copywriting step confirmations in `/campaign-copywriting` are answered from the campaign-strategy row (angle, subject strategy, CTA) and the recommended option; surface them only if the user asked to review copy.
6. Stage 11 uploads every campaign as DRAFT and prints one table: campaign, leads, platform URL.

## Quality gates (hard stops, added after a bad test send)

A test send once went out signed as the agency CEO while claiming the client's results, with an auto-dealership lead sent to a clinic, an ungrammatical opt-out line, and mixed casing. Template checks (braces, banned words, length) did not catch it. These gates now run before any upload or start:

1. **Identity gate.** `client-profile.yaml` must name `sender_identity`. The signature, `fromName` and every "we/our/we support" claim must belong to that identity (the client), never the agency or whoever owns the inbox. Mismatch = stop. Do not use `{{SENDER_SIGNATURE}}` unless that signature is the client's.
2. **Render gate.** Run `scripts/render_lint.py payload.json prospects.json 60` (or `scripts/render_lint_sl.py bodies.json subjects.json leads.json 60` for plain-variable copy). It renders full emails with real prospect rows and the real signature, then checks leftover variables, banned words, a/an, doubled words, spacing, ALL CAPS, lowercase sentence starts and known bad phrases. Exit code 1 = fix before upload. The lint itself must be self-tested with a known-bad prospect (for example "allergy clinic" after "a").
3. **Human read gate.** Read at least 5 full renders per email step (print them), and read every subject and unsub option in its slot. Check that each variant's first sentence is true and relevant for the segment (outside proof needs a bridge line).
4. **Claims gate.** Every number or claim must trace to the client's form or website. Unconfirmed claims (for example what the scorecard covers) are softened or removed, and listed for client approval.
5. **Test-send gate.** Send a test to the owner's own inbox from the real campaign and have them review it before enrolling any prospect or starting.
6. **Signature footprint.** The signature is a spun block (name, title, company line) defined once in the profile (`sender_identity.signature_spin`) and pasted into every email. It varies per send. Never use the sending inbox's own signature unless it is the client's.
7. **Per-lead variable gate.** Variables like `{{service}}` and `{{icp}}` must come from the lead's own website (not guessed). Tag each lead `data_confidence` high, medium or low from the evidence; upload only high and medium, hold low until researched. Sites that block fetching (Cloudflare, 403) are low confidence unless the name states the niche.
8. **Company-name gate.** Strip banned tokens (for example "marketing") and ALL CAPS from `{{company_name}}` before use; capitalize a lowercase start (efelle to Efelle). Subjects containing the company name must still be 4 words or fewer.
9. **Blunder log.** Each new mistake becomes a lint rule. Logged: "No problem" (banned word) slipped into a spin option, subject too long when the company name is two words, banned word in a subject, signed as wrong identity, the same fixed signature on every email, "a" before a vowel, "stop writing you", "If so" pointing at the wrong clause, spun-in "RE:" subject prefix, irrelevant lead story.

Scripts: `scripts/render_lint.py` (ManyReach-style variables), `scripts/render_lint_sl.py` (plain `{{variable}}` copy for Smartlead) and `scripts/smartlead_draft.py` (draft-only Smartlead upload).

## Rules that must not be violated

- Never spend Apollo credits without an approved sample, a cap, and the `--approved` flag.
- Never start a campaign.
- Only `safe_to_send=Yes` rows reach upload. Ask the user which verification service they use (MillionVerifier + No2Bounce, Reoon + No2Bounce, or MillionVerifier only) before verifying, and store it in the profile as `verification`.
- Copy precedence when rules overlap: `/campaign-copywriting` hard rules, then `/spam-word-checker` (banned words are banned in every spintax variant), then `/super-spintax` writing style (lowercase everywhere, merge fields untouched, no "quick question" anywhere, 20+ subject and unsub variants). Spin the final approved copy last so spintax never reintroduces a banned word.
- Merge field name from copywriting stays `{{company_name}}`.
- ManyReach target: apply the ManyReach-safe formatting from `/manyreach-campaign-upload` after spintax (no apostrophes, no commas inside options, plain text).
- Mention persistent deliverability issues are not fixed by spintax (super-spintax caveat: auth, list quality, volume, weak offer).

## Outputs per business

```
profiles/<slug>/client-profile.yaml
profiles/<slug>/lead-magnets.md
profiles/<slug>/campaign-strategy.md
profiles/<slug>/campaign-plan.md
profiles/<slug>/campaigns/<campaign-slug>/{filters.json,sample.csv,leads.csv,variants.yaml,credit-log.md}
```
