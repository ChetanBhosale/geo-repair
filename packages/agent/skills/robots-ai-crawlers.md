---
id: robots-ai-crawlers
name: robots.txt AI-crawler rules
category: Crawl surface
pillars: [geo]
tier: A
fixable: true
scope: site-wide
priority: high
---

# robots-ai-crawlers — allow AI crawlers in robots.txt

## What it checks & why
robots.txt must not accidentally block AI crawlers: `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`,
`ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Google-Extended`, `CCBot`. A blocked crawler can't
read the site at all, so this gates everything downstream.

## Pass bar
pass = AI crawlers allowed (or no disallow targeting them) + robots reachable. partial = some
allowed / ambiguous. fail = robots blocks one or more AI crawlers on real routes.

## How to fix (by framework)
- **Next App Router:** `app/robots.ts`, OR edit an existing static `public/robots.txt` — never
  create a conflicting pair.
- **Next Pages / Astro / Vite / static:** `public/robots.txt` (root for static).
- **SvelteKit:** `static/robots.txt`. **Remix:** `public/robots.txt` or a resource route.
- Add `Allow` (or remove the stray `Disallow`) for the crawler list above; keep the `Sitemap:`
  line intact.

## Auto-fix vs flag
**Preserve intentional disallows** (evidence/comments marking a real block — staging, private
areas). Only correct clearly-accidental blocks on primary content.

## Verify
robots resolves 200, parses, AI crawlers no longer disallowed, sitemap line intact, build passes.

## Skip or flag when
Already allowing all AI crawlers → no-op (`already_satisfied`). Disallow looks intentional → flag,
don't edit.
