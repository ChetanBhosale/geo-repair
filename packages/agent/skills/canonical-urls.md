---
id: canonical-urls
name: Canonical URLs
category: Metadata
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: medium
---

# canonical-urls — self-referential canonical per route

## What it checks & why
Each route should declare a **self-referential, absolute** canonical URL so engines collapse
duplicates onto the right page and don't split signals across query/variant URLs.

## Pass bar
pass = self-referential absolute canonical present. partial = present but relative / inconsistent.
fail = missing.

## How to fix (by framework)
- **Next App Router:** `alternates.canonical` in the Metadata API (resolved via `metadataBase`).
- **Next Pages:** absolute `<link rel="canonical">` in `next/head`.
- **Astro:** `<link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)}>` — needs
  `site` in config; set it or flag.
- **Static HTML:** self-referential absolute `<link rel="canonical">` per head.
- **Remix / SvelteKit:** per-route `meta` / `<svelte:head>` with the absolute URL.

## Auto-fix vs flag
Self-referential + absolute by default. Point elsewhere **only** if `evidence` names a duplicate
target. Ambiguous canonical target → skip + flag (do not guess).

## Verify
Build + type-check pass; canonical resolves to the page's own absolute URL.

## Skip or flag when
Correct canonical already present → no-op. Intentional cross-page canonical (per evidence) →
preserve. Note: a canonical pointing **away** from a real page is also an `indexability` problem.
