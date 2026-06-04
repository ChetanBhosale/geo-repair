---
id: llms-txt
name: llms.txt
category: Crawl surface
pillars: [geo]
tier: A
fixable: true
scope: site-wide
priority: medium
---

# llms-txt — /llms.txt index for AI engines

## What it checks & why
A `/llms.txt` (Markdown) at the served root gives AI engines a curated map of the site: name,
one-line description, and links to the key pages. Pairs with `markdown-twins` — llms.txt is the
*index*, the twins are the *pages*.

## Pass bar
pass = `/llms.txt` present, non-empty, with curated key-page links. partial = present but empty /
linkless. fail = none.

## How to fix (by framework)
- Write `/llms.txt` as a **static file in the served root** — `public/llms.txt`
  (Next/Astro/Vite/static) or `static/llms.txt` (SvelteKit). No dependency needed.
- Content: site name, a one-line description, and a curated list of key-page links derived from
  the sitemap / primary nav (not every URL — the important ones).

## Auto-fix vs flag
Derive links from real sitemap/nav data only. Existing non-empty llms.txt → validate, don't
overwrite.

## Verify
`/llms.txt` resolves 200 as text/markdown-ish, non-empty, links valid, build passes.

## Skip or flag when
A good llms.txt already exists → no-op. No discoverable key pages (single-page site) → minimal
index or flag.
