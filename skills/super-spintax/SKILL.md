---
name: super-spintax
description: Generate super spintax (20+ variations per block) for cold email subject lines, unsub lines, signatures and body copy to break spam fingerprints.
---

# Super spintax

Turn cold email copy into super spintax: 20+ variations per block where repetition is most visible, so every send looks individually written and google can't fingerprint it as bulk.

## Inputs to ask for (only if missing)

- The email copy: subject, body, unsub line, signature
- Proof points for the signature (case studies, numbers, client names)
- Sending tool, so syntax matches (smartlead uses `{a|b|c}`; confirm syntax for others like manyreach before loading)

## Density by section (priority order)

| # | Section | Variations | What to vary |
|---|---|---|---|
| 1 | Subject line | 20+ | Whole-line rewrites, not one swapped word. #1 fingerprint signal |
| 2 | Unsubscribe line | 20+ | Phrasing, tone, structure. Most teams never spin this |
| 3 | Signature fields | 4-5 per field | Name format (first last / first initial / first only), title (founder / co-founder / ceo / owner), company name format, location |
| 3a | Signature proof line | 5-10 | Case studies / social proof as spintax, e.g. "helped clay 10x their revenue" / "we generate 200-300 positive replies per day" / "one customer gets 80 positive replies per day" |
| 4 | Body | 3-4 full variants, then a spin every ~5 words | Openers, transitions, cta wording |

## Writing style rules (apply to every variant)

- **No capitals anywhere.** Write everything lowercase, including sentence starts, acronyms and brand names (sec, wuxi, biosecure, ceo, saas). No all-caps words ever.
- **Professional but conversational.** Write like a sharp peer reaching out one-to-one: clear, direct and respectful, never stiff marketing copy. No slang, hype or overly cute phrasing. Grammar can be relaxed (short fragments are fine), but never sloppy or hard to read.
- Keep facts, numbers and names exactly as given; only the casing and phrasing change.
- Merge fields stay exactly as written (`{{first_name}}`, `{{company}}`); never lowercase or spin inside them.

Example:

- Original: "I went through 2026 SEC filings and pulled every biotech that flagged WuXi or BIOSECURE as a risk. 60 of them. 4 have WuXi agreements filed as exhibits."
- Correct: "i went through 2026 sec filings and pulled every biotech that flagged wuxi or biosecure as a risk. 60 of them. 4 have wuxi agreements filed as exhibits."

## Build rules

- **Never use "quick question" or any version of it**, anywhere (subject, body, cta): quick q, quick one, a quick question, quick ask, quick thought, quick idea, quick note, question for you, got a sec. These are overused cold email tells.
- Vary structure, not just synonyms. "worth a look?" vs "worth a peek?" counts as one variant to a filter
- Keep variants within ±20% of the original's length
- Nest at most 2 levels deep
- No spam trigger words, no hype, no emojis. One bad option ships on ~5% of sends
- No duplicate variants inside a block
- Every variant must make sense on its own and in every combination

## Output format

For each section, output one spintax block in the tool's syntax, labeled by section:

```
subject:
{thought on your outbound|{{first_name}}, idea for {{company}}|re: {{company}} pipeline|worth a look?|...}

unsub:
{not relevant? just reply "no"|if this isn't a fit, let me know and i'll stop|reply "pass" and i won't follow up|...}
```

Then the assembled email per body variant, ready to paste.

## QA before handing over

- [ ] subject block has 20+ distinct variants
- [ ] unsub block has 20+ distinct variants
- [ ] signature fields each spun, proof line added
- [ ] body has 3-4 variants with spins roughly every 5 words
- [ ] no capital letters outside merge fields
- [ ] no "quick question" or any version of it
- [ ] braces balanced, merge fields intact
- [ ] read 10 random renders mentally: all read as professional but conversational

## Why it works (for context)

Google pattern-matches across sends. 500 emails with an identical subject and unsub line read as bulk. In eric's case, inboxes at 40% sender bounce cleared up right after spinning just the subject and unsub. Spintax won't fix bad auth (spf/dkim/dmarc), dirty lists, over-volume or a weak offer, so flag those if the user mentions persistent issues.
