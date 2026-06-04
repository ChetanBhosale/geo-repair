---
id: markdown-twins
name: Markdown twins + content negotiation
category: Content
pillars: [geo]
tier: B
fixable: true
scope: per-page
priority: low
---

# markdown-twins — faithful Markdown twin per primary page

## What it checks & why
Each primary page should expose a faithful Markdown "twin" (the same rendered content as
`text/markdown` at `<path>.md`, `/index.md` for home), linked via
`<link rel="alternate" type="text/markdown">` and indexed in `/llms.txt`. AI crawlers parse
Markdown far more reliably than a JS-heavy DOM. **Tier B = derived content:** a faithful reformat
of EXISTING content — same headings/prose/FAQ/links, **no new claims** (new claims would be Tier C).

## Pass bar
pass = twin present, 200 + `text/markdown`, discoverable (alternate link + llms.txt entry), faithful.
partial = exists but unlinked/unindexed, or only some primary pages. fail = none.

## How to fix (by framework)
Generate from the page's **structured source** (MDX/collections/CMS, or the content module it
renders), not by scraping HTML, so twin and page stay in sync. Serve via `public/` / `static/` when
content is static, else a small route handler / middleware that reads the same source. Add the
`<link rel="alternate">` on the HTML page and a `/llms.txt` entry (pairs with the `llms-txt` skill).
Add `Accept` / User-Agent negotiation only when the framework makes it easy.

## Auto-fix vs flag
Twins must **round-trip existing content** — never paraphrase or add material the page doesn't
already say (that's Tier C). Respect the file cap (only flagged pages).

## Verify
Twin reachable + correct content-type; alternate link present; llms.txt lists it; content matches
the page; build passes.

## Skip or flag when
No structured content source (pure design page) → flag. Twins already present + discoverable → no-op.
