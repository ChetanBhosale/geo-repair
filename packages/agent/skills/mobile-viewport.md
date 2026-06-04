---
id: mobile-viewport
name: Mobile viewport meta
category: Rendering
pillars: [seo]
tier: A
fixable: true
scope: site-wide
priority: low
---

# mobile-viewport — <meta name="viewport">

## What it checks & why
The static `<meta name="viewport">` tag: present, responsive (`width=device-width`), zoom not
disabled. A deterministic, agent-safe markup fix. **Distinct from `mobile-responsive`** (CSS
layout), which stays out of scope / flag-only.

## Pass bar
pass = present + responsive + zoom enabled. partial = present but missing `width=device-width` or
disables zoom. fail = missing.

## How to fix
Add or correct `<meta name="viewport" content="width=device-width, initial-scale=1">` in the shared
head (root layout / `_document` / `_app` / `.astro` layout / static head). Don't disable
user-scalable.

## Auto-fix vs flag
Markup tag only — never touch CSS or layout (that's the out-of-scope `mobile-responsive` line).

## Verify
Build + type-check pass; viewport tag present and responsive.

## Skip or flag when
Already present + responsive → no-op.
