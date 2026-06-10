---
id: aeo-conformance
name: AEO conformance extras
category: Crawl surface
pillars: [geo]
tier: A
fixable: true
scope: per-page
priority: low
---

# aeo-conformance — the AEO-spec SHOULD/MAY extras

## What it checks & why
Beyond the core delivery contract (`ai-delivery-headers`), the AEO spec recommends a few extras
that make twins safer and easier to discover in bulk:
- `X-Content-Type-Options: nosniff` on the twin — intermediaries must not second-guess
  `text/markdown`,
- `X-AEO-Version: 1.0` on the twin — advertises the implemented spec version to AI clients,
- `.md` twin URLs listed in `sitemap.xml` — bulk discovery for AI crawlers (the per-page `Link`
  header covers one page at a time; the sitemap covers the site).

## Pass bar
pass = both twin headers set AND the sitemap lists the `.md` twin URLs. partial = some present.
fail = none. The sitemap signal is skipped by the scan when the sitemap is a sitemap index or
missing/invalid (that's `sitemap`'s finding).

## How to fix (hand-written — never add a third-party dependency)
- **Twin headers:** in the same route handler / middleware that serves the twin (from
  `markdown-twin` / `content-negotiation`), add `X-Content-Type-Options: nosniff` and
  `X-AEO-Version: 1.0` alongside the `ai-delivery-headers` set.
- **Sitemap:** extend the existing sitemap generator (see `sitemap` skill — e.g. `app/sitemap.ts`
  in Next, the `+server.ts` route in SvelteKit, the static file otherwise) to emit a `<url>` entry
  for each page's `.md` twin next to its HTML entry. Only list twins that are actually served.

## Auto-fix vs flag
Pure header/config + sitemap entries: safe. If the host cannot set custom response headers, flag
the header signals (same rule as `ai-delivery-headers`); the sitemap signal is still fixable.

## Verify
`curl -I` the `.md` shows `X-Content-Type-Options: nosniff` and `X-AEO-Version`; `sitemap.xml`
contains the `.md` URLs and is still valid XML. Build passes.

## Skip or flag when
All signals already present → no-op. No twin/negotiation yet → fix `markdown-twin` and
`content-negotiation` first.
