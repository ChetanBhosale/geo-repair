---
id: semantic-html
name: Semantic HTML & heading hierarchy
category: Semantics
pillars: [seo, geo, aeo]
tier: A
fixable: true
scope: per-page
priority: medium
---

# semantic-html — one h1, correct hierarchy, landmarks, sound a11y tree

## What it checks & why
One `<h1>`, a correct heading hierarchy, landmarks (`<header>/<nav>/<main>/<footer>`), and a sound
accessibility tree (valid roles, correct parent/child nesting). This is the structural skeleton
engines and AI use to understand the page. **Text-preserving structural fixes only.**

## Pass bar
pass = single h1 + ordered headings + landmarks present + valid roles. partial = minor issues
(e.g. an extra h1, a missing landmark). fail = no structure / multiple h1 / broken nesting.

## How to fix
Text-preserving structural edits only: demote an extra `<h1>` → `<h2>` (keep the text), convert
fake headings to real ones, wrap clear regions in `<header>/<nav>/<main>/<footer>`. One `<main>`
and one `<h1>` per page. Fix invalid/duplicate `role`s and broken parent/child nesting.

## Auto-fix vs flag
**Never change visible text or layout.** Keep classes; swap only the tag/level. Heavy CSS coupling
to the current tag → flag instead of editing. Stay on the semantics side of the out-of-scope CSS
line.

## Verify
Build + type-check pass; one h1 / one main on edited pages; visible text and layout unchanged.

## Skip or flag when
Structure already sound → no-op. Fix would require restyling (CSS depends on the tag) → flag.
