# Claude Code Outbound

A set of Claude Code skills that run cold-email outbound for a client, from onboarding to a draft campaign in your sending tool, with credit gates and quality gates so nothing gets spent or sent by accident.

**The flow in one line:** onboard the client, pick one ICP, search Apollo for free, approve a 10-person sample, enrich only what you approve, verify the emails, write the copy, spin it, lint real renders, and upload a **draft** to Smartlead or ManyReach. You press Start.

## How it works

| # | Stage | Skill | Cost | Your gate |
|---|---|---|---|---|
| 1 | Profile (scrapes the site first) | `icp-onboarding` | 0 | confirm the profile |
| 2 | Free offer | `lead-magnet-brainstorm` | 0 | pick one |
| 3 | Campaign ideas | `campaign-strategy` | 0 | pick campaigns |
| 4 | Search | `apollo-list-builder` (phase 1) | 0 credits | none |
| 5 | 10-sample confirmation | `apollo-list-builder` | 0 | **approve, adjust or skip** |
| 6 | Enrich | `apollo-list-builder` (phase 2) | 1 Apollo credit per contact, capped | approved in step 5 |
| 7 | Verify | `email-verification` (asks which service: MillionVerifier or Reoon, then No2Bounce) | verifier credits | pick the service |
| 8 | Copy | `campaign-copywriting` (4 confirmation steps) | 0 | approve each step |
| 9 | Spam check | `spam-word-checker` | 0 | none |
| 10 | Spintax | `super-spintax` (and `smartlead-spintax` for Smartlead syntax) | 0 | none |
| 11 | Upload as draft | `smartlead-campaign-upload-public`, `smartlead-api`, or `manyreach-campaign-upload` | 0 | **you review and press Start** |

`outbound-autopilot` is the orchestrator that runs all of this, including several campaigns in one pass with a single review.

## What's inside

```
skills/
  outbound-autopilot/              orchestrator + quality gates + render lint + draft-upload script
  apollo-list-builder/             free search, sample gate, capped enrichment (TypeScript scripts)
  email-verification/              MillionVerifier or Reoon (your choice) then No2Bounce, scripts/verify.ts + offline tests
  manyreach-campaign-upload/       ManyReach upload notes and variable rules
  super-spintax/                   spintax rules (20+ subject and opt-out variants)
  icp-onboarding/  lead-magnet-brainstorm/  campaign-strategy/  campaign-copywriting/
  spam-word-checker/  smartlead-spintax/  smartlead-api/  smartlead-campaign-upload-public/
examples/client-profile.example.yaml   starter profile (one ICP per profile)
tests/selftest.sh                       proves the render lint passes clean copy and catches bad data
install.sh                              links the skills into ~/.claude/skills
.env.example                            the keys the skills read
```

## Setup

1. Requirements: Claude Code, Node 22 or newer (scripts run with `--experimental-strip-types`), Python 3.
2. Run the installer, then fill in your keys:

   ```bash
   ./install.sh
   ```

   This links each skill into `~/.claude/skills` (it never overwrites an existing skill) and creates `.env` from `.env.example`.
3. Edit `.env`:

   | Key | Used by |
   |---|---|
   | `APOLLO_API_KEY` | `apollo-list-builder` |
   | `MILLIONVERIFIER_API_KEY` | `email-verification` (if you use MillionVerifier) |
   | `REOON_KEY` | `email-verification` (if you use Reoon) |
   | `NO2BOUNCE_KEY` | `email-verification` (second opinion on risky addresses) |
   | `SMARTLEAD_API_KEY` | Smartlead upload (`SMARTLEADS_API_KEY` is also accepted) |
   | `MANYREACH_API_KEY` | ManyReach REST path (the Manyreach MCP connector can be used instead) |

   Keys are never stored in the skills. `.env` is git-ignored.
4. Start a new Claude Code session and run `/outbound-autopilot`.

Run scripts that need keys with `node --env-file=.env ...` so they read `.env`.

### Email verification choices

The skill asks which services you use and stores the answer in the client profile:

| Choice | Keys needed | Behavior |
|---|---|---|
| MillionVerifier + No2Bounce (recommended) | `MILLIONVERIFIER_API_KEY`, `NO2BOUNCE_KEY` | `ok` is kept, catch-all and unknown go to No2Bounce, invalid and disposable are removed |
| Reoon + No2Bounce | `REOON_KEY`, `NO2BOUNCE_KEY` | original routing, unchanged |
| MillionVerifier only | `MILLIONVERIFIER_API_KEY` | only `ok` is kept; risky addresses are written to a `.held.csv` for review, never sent |

Offline tests for the routing: `node --experimental-strip-types --test skills/email-verification/tests/verify-routing.test.ts`.

## Safety rules built in

- **Credits:** Apollo search costs nothing. Enrichment refuses to run without `--max-credits` and `--approved`. Each enrichment batch is saved so a crash never re-spends credits.
- **One ICP per profile and campaign.** Never combine ICPs; buyers, pains and proof differ per segment.
- **Never starts a campaign.** Uploads are drafts with no inboxes attached. You pick the sender and press Start.
- **Identity gate:** emails are written and signed as the client, with a spun signature block. Never the agency or the inbox owner.
- **Render gate:** `render_lint.py` and `render_lint_sl.py` render full emails with real lead values and check for leftover variables, banned words, a/an errors, doubled words, spacing, ALL CAPS, lowercase sentence starts and long subjects. Run `tests/selftest.sh` to confirm the lint itself works.
- **Per-lead variable gate and company-name gate:** per-lead lines must come from the lead's own site, and company names have banned words stripped.
- **Test send:** send a test to your own inbox and review it before enrolling or starting anything.

The full list is in `skills/outbound-autopilot/SKILL.md`, including a log of mistakes that became rules.

## Quick start

```text
/outbound-autopilot
> "New client: https://example.com. One ICP: <segment>."
```

Typical order: profile, one ICP, offer, five campaigns ranked by relevance to the offer, free Apollo search and 10 samples, your approval and credit cap, enrichment, verification, copy, spintax, lint, draft upload, your test send.

## Notes and limits

- `profiles/` (client data, leads, emails) is git-ignored on purpose. Keep client data out of this repo.
- Tested status is tracked in `TESTED.md` (what was run live, what is offline-only, and when). Start with small batches (3 to 10 contacts).
- Merge variables inside spin options have not been render-tested inside each sending tool's own preview. Send a test first.
- `icp-onboarding` still mentions Prospeo industries and a `~/cold-email-ai-skills/profiles` path from the original skill. `apollo-list-builder` handles the Apollo filter translation, and profiles can live in a local `profiles/` folder.
- Some "next step" lines in the original skills point to Prospeo-based list-building skills that are not included here.
- If you rename or move the repo, re-run `./install.sh`. Symlinks point at this folder.

## Attribution and license

Eight skills are verbatim copies from the open-source cold-email skills repo by GrowthEngineX (MIT): `icp-onboarding`, `lead-magnet-brainstorm`, `campaign-strategy`, `campaign-copywriting`, `spam-word-checker`, `smartlead-spintax`, `smartlead-api`, `smartlead-campaign-upload-public`. The rest (`outbound-autopilot`, `apollo-list-builder`, `manyreach-campaign-upload`, `email-verification`, `super-spintax` and the scripts) were written for this stack. Released under the MIT license in `LICENSE`.

## Contributing and releases

- Enable the safety hook once after cloning: `git config core.hooksPath .githooks`. It blocks commits containing keys, token-like strings or names on your private denylist.
- `./release.sh check` runs the static checks and offline tests. `./release.sh zip` builds a zip from tracked files only. `./release.sh tag X.Y.Z` tags a release after you review `TESTED.md`. It never pushes.
- Live tests (real keys, real credits) are run by the maintainer before a release and recorded in `TESTED.md`. They are not part of CI.
