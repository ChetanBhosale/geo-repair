---
id: ai-delivery-headers
name: AEO delivery headers
category: Crawl surface
pillars: [geo]
tier: A
fixable: true
scope: per-page
priority: low
---

# ai-delivery-headers — the markdown-twin header contract

## What it checks & why
Markdown twins need a small header contract so they're safe to serve and discoverable:
- the twin response must not be indexed as a duplicate page,
- caches must key on the negotiated representation,
- AI clients should be able to budget context and find the twin from the HTML.

## Pass bar (all five)
On the **markdown twin** response:
- `X-Robots-Tag: noindex` (prevents duplicate-content indexing)
- `Vary: Accept` (correct caching across HTML/markdown)
- `X-Markdown-Tokens: <positive integer>` (estimated token count of the body)
On the **HTML** response:
- `Link: <…>; rel="alternate"; type="text/markdown"` **response header** (not only a `<link>` tag)
- `Vary: Accept` — the negotiated URL serves two representations, so **both** must vary on
  Accept or caches can hand markdown to browsers

pass = all five present. partial = some present. fail = none.

## How to fix (hand-written — never add a third-party dependency)
Set the headers where the twin and HTML are served (the same route handler / middleware from
`markdown-twin` and `content-negotiation`):
- Twin handler: add `X-Robots-Tag: noindex`, `Vary: Accept`, and `X-Markdown-Tokens` (estimate with
  a simple whitespace or ~4-chars-per-token heuristic on the body).
- HTML response: append `Vary: Accept` and a `Link: </path.md>; rel="alternate"; type="text/markdown"`
  header. In Next.js this is the middleware/route response headers (the HTML `<link>` tag alone does
  NOT pass).
- `X-Content-Type-Options: nosniff` and `X-AEO-Version: 1.0` are scored separately — see the
  `aeo-conformance` skill; set them in the same handler while you're here.

## Auto-fix vs flag
Pure header/config: safe. If the host cannot set custom response headers (some static hosts), flag
the ones that can't be set.

## Verify
`curl -I` the `.md` shows `X-Robots-Tag: noindex`, `Vary: Accept`, `X-Markdown-Tokens`; `curl -I`
the HTML shows `Vary: Accept` and the `Link` alternate header. Build passes.

## Skip or flag when
Headers already set → no-op. No twin/negotiation yet → fix those first.
