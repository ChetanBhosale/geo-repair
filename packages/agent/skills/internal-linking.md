---
id: internal-linking
name: Internal linking
category: Content
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: low
---

# internal-linking — descriptive anchors, no orphans

## What it checks & why
Descriptive anchor text (no "click here" / bare URLs) and no orphan pages, so engines understand
link context and can reach every page.

## Pass bar
pass = descriptive anchors + page reachable from a hub. partial = some weak anchors. fail = bare
"click here" anchors / orphaned page.

## How to fix
- Rewrite "click here" / bare-URL anchor **text** (not the `href`) using the target page's title.
- Orphan pages: add **one** contextually relevant link from an existing hub (nav, footer, or a
  related section that already exists).

## Auto-fix vs flag
Minimal, relevant links only; preserve layout; no link farms. Only rewrite anchor **text**, never
the destination. No sensible placement for an orphan link → flag.

## Verify
Build + type-check pass; anchors descriptive; new link points to a real route; layout unchanged.

## Skip or flag when
Anchors already descriptive and no orphans → no-op. No natural hub to link an orphan from → flag.
