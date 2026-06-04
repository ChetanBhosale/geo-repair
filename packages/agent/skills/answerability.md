---
id: answerability
name: Answerability (AEO core)
category: Answerability
pillars: [aeo]
tier: A
fixable: true
scope: per-page
priority: high
---

# answerability — question-shaped headings + FAQ

## What it checks & why
Question-shaped headings + FAQ blocks, and `FAQPage` schema when Q&A already renders. Answer
engines extract direct answers from this structure. The AEO core signal.

## Pass bar
pass = question-shaped sections + FAQ schema where Q&A exists. partial = some structure / missing
schema. fail = none.

## How to fix
- **Tier A (auto):** when Q&A content **already renders**, emit `FAQPage` JSON-LD extracted
  verbatim from it; surface existing question-shaped headings. Mark up, don't author.
- **Tier C (gated, `approved === true` + intake):** authoring net-new FAQ Q&A. Generate only from
  intake answers + existing on-site content, in the site's voice.

## Auto-fix vs flag
Tier A is structural/markup over **existing** content only. No FAQ content + no Tier-C opt-in →
skip with reason, optionally flag as a Tier-C opportunity. **Never invent Q&A** in Tier A.

## Verify
Build + type-check pass; FAQ schema validates against rendered Q&A; no fabricated content.

## Skip or flag when
No Q&A renders and Tier C not approved → skip ("no FAQ content"). Overlaps `definitions` — this
covers the broader FAQ/question-shaped signal.
