---
id: citation-quality
name: Citation quality
category: Content
pillars: [aeo]
tier: A
fixable: true
scope: per-page
priority: medium
---

# citation-quality — cite trusted external sources

## What it checks & why
Does the page cite trusted external sources (research, `.gov`/`.edu`, standards bodies, primary
data)? In a large citation study this was a top predictor of whether ChatGPT/Perplexity/Claude
*quote* a page. Weighted conservatively — and **never a citation promise**.

## Pass bar
pass = names + links credible sources where claims warrant. partial = names sources but doesn't
link them. fail = unsupported claims / no sourcing.

## How to fix
- **Tier A (auto):** where the prose **already names a source** ("according to a 2024 Pew study",
  "per the W3C spec") but doesn't link it, wire the real outbound link — only when the source is
  unambiguous and verifiable.
- **Tier C (gated):** adding net-new sourced claims/statistics, from intake + existing content only.

## Auto-fix vs flag
Auto-fix is **link-wiring of existing references only**. **Never invent a source, stat, or URL.**
Omit when unsure. Never imply that adding citations guarantees the page will be cited.

## Verify
Build + type-check pass; wired links resolve to the named authoritative source; no fabrication.

## Skip or flag when
No named sources to link and Tier C not approved → skip with reason.
