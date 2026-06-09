---
id: markdown-twin
name: Markdown twin per primary page
category: Content
pillars: [geo]
tier: B
fixable: true
scope: per-page
priority: medium
---

# markdown-twin — faithful Markdown twin per primary page

## What it checks & why
Each primary page should expose a faithful Markdown "twin": the same rendered content served as
`text/markdown` at `<path>.md` (`/index.md` for home). The scan fetches `<path>.md` directly. AI
crawlers and answer engines parse Markdown far more reliably than a JS-heavy DOM, so a clean twin is
the best machine-eye view of a page. **Tier B = derived content:** a faithful reformat of EXISTING
content (same headings/prose/FAQ/links), **no new claims** (new claims would be Tier C).

## Pass bar
pass = `<path>.md` returns 200, `Content-Type: text/markdown; charset=utf-8`, non-empty body.
partial = reachable but wrong content-type or empty body. fail = no twin.

## How to fix (by framework, hand-written — never add a third-party dependency)
Generate from the page's **structured source** (MDX/collections/CMS, or the content module it
renders), not by scraping the rendered HTML, so the twin and page stay in sync.
- **Static content** → emit a `public/<path>.md` / `static/<path>.md` file from the same source.
- **Next.js (App Router)** → a `app/[...]/route.ts` (or `app/md/[...path]/route.ts`) handler that
  renders the content as markdown and returns it with the right `Content-Type`.
- **Astro** → a `src/pages/[...slug].md.ts` endpoint; **SvelteKit** → a `+server.ts` for the `.md`
  path. Read the page's own content source and serialize to markdown.
Pairs with `content-negotiation` (serve it to AI clients) and `ai-delivery-headers` (the headers).

## Auto-fix vs flag
Twins must **round-trip existing content** — never paraphrase or add material the page doesn't
already say (that's Tier C). Respect the file cap (only flagged pages).

## Verify
`<path>.md` reachable, `Content-Type: text/markdown; charset=utf-8`, non-empty, content matches the
page; build passes.

## Skip or flag when
No structured content source (pure design page) → flag. Faithful twins already served → no-op.
