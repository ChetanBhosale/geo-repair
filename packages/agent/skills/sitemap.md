---
id: sitemap
name: sitemap.xml
category: Crawl surface
pillars: [seo]
tier: A
fixable: true
scope: site-wide
priority: medium
---

# sitemap — sitemap.xml present, valid, referenced from robots

## What it checks & why
A valid `sitemap.xml` referenced from robots helps every engine discover all routes. (It also
drives our pricing — the page count.)

## Pass bar
pass = present + valid XML + a `Sitemap:` line in robots. partial = present but stale / not
referenced / partial coverage. fail = none.

## How to fix (by framework)
- **Next App Router:** `app/sitemap.ts`. **Next Pages:** route-based (`pages/sitemap.xml.tsx`) or
  an existing `next-sitemap`.
- **Astro:** `@astrojs/sitemap` (a justified dep if absent; needs `site`) or hand-written
  `public/sitemap.xml` for small sites.
- **Static HTML:** write `/sitemap.xml` (absolute URLs, `lastmod`).
- **SvelteKit:** `sitemap.xml/+server.ts`. **Remix:** a resource route.
- Ensure robots has a `Sitemap:` line; validate the XML.

## Auto-fix vs flag
Extend an existing sitemap setup rather than adding a parallel one. Any added dep is justified in
the PR body.

## Verify
sitemap resolves 200, valid XML, robots references it, build passes.

## Skip or flag when
Valid referenced sitemap already present → no-op (validate, don't overwrite).
