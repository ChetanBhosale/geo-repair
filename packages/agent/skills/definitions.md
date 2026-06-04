---
id: definitions
name: Definitions / answer-first content
category: Answerability
pillars: [aeo]
tier: A
fixable: true
scope: per-page
priority: medium
---

# definitions — answer-first, define the terms

## What it checks & why
Is key content answer-first and does it define its terms ("X is Y" up front, the question answered
in the first sentence)? Direct answerability + plain definitions were top predictors of AI quoting
a page. Overlaps `answerability` but scores the definitional/answer-first signal specifically.

## Pass bar
pass = the definition/answer leads its section (and is marked up where genuinely definitional).
partial = present but buried. fail = absent.

## How to fix
- **Tier A (auto, structural ONLY):** when the page **already states** a definition/answer but
  buries it, move it to the top of its section; where the text is genuinely definitional, mark it
  up (`DefinedTerm`, or a tight Q→A block). **Reorder / mark up existing text only — never change
  its meaning.**
- **Tier C (gated, `approved === true` + intake):** writing net-new definitions / answer-first
  intros, in the site's voice, from intake + existing content only.

## Auto-fix vs flag
If surfacing the answer would require rewriting the claim → **flag** (don't edit) unless Tier C is
approved.

## Verify
Build + type-check pass; visible meaning unchanged; any JSON-LD validates.

## Skip or flag when
No definitional content + no Tier-C opt-in → skip, optionally flag as a Tier-C opportunity.
