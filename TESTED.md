# Tested status

Live = run against the real service with a small batch. Offline = covered by local tests only. Re-check after any change to that area.

| Area | Status | Date | Notes |
|---|---|---|---|
| Apollo free search | Live | 2026-10-26 | 0 credits; only `has_*` flags returned (no size, city, domain) |
| Apollo enrichment | Live | 2026-10-26 | 10 contacts, all returned emails; returns state, city, headcount, domain |
| MillionVerifier + No2Bounce (`verify.ts`) | Live | 2026-10-28 | 5 emails: ok kept, catch_all to No2Bounce, invalid and disposable removed |
| Reoon + No2Bounce (original script) | Live | 2026-10-26 | before the provider rewrite |
| Reoon path in the new `verify.ts` | Offline only | | routing unit tests; run a live smoke test before relying on it |
| MillionVerifier only (held file) | Offline only | | routing unit tests |
| Smartlead draft upload (`smartlead_draft.py`) | Live | 2026-10-27 | drafts, no inboxes, 3 steps with A/B/C variants |
| ManyReach draft (Manyreach MCP) | Live | 2026-10-26 | campaign, follow-ups and prospects as a draft |
| Render lint (`render_lint*.py`) | Offline | 2026-10-28 | `tests/selftest.sh` |
| Spintax variables inside each tool's preview | Not tested | | send a test to your own inbox first |

Nothing in this repo starts a campaign. Every upload is a draft.
