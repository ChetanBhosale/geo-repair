---
id: indexability
name: Indexability (search-eligible)
category: Crawl surface
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: high
---

# indexability — eligible for Google / traditional search (and AI Overviews)

## What it checks & why
The page must be *eligible* to appear in traditional search (and thus Google AI Overviews):
no accidental `noindex` (meta robots **or** `X-Robots-Tag` header), robots.txt not blocking
Googlebot/Bingbot on real routes, a self-referential canonical (not canonicalizing the page away),
200 status. Distinct from `robots-ai-crawlers` — a page can be open to AI crawlers yet `noindex`
to Google. We check **eligibility**, not live index status.

## Pass bar
pass = indexable + self-canonical + 200. partial = a mixed/ambiguous signal. fail = a clear block
on primary content.

## How to fix
- Remove a **stray** `noindex` from a real content page; unblock Googlebot where there's no intent
  to hide.
- `X-Robots-Tag` lives in server/host config you may not control headlessly → **flag** if you
  can't change it safely.

## Auto-fix vs flag
**Preserve intentional `noindex`** (staging, private, thin/utility, paginated routes; anything
`evidence` marks deliberate) → flag, don't edit. When intent is ambiguous, flag rather than
unblock — never expose a page the owner meant to keep private. (Search Console verification is the
owner's private setup; never claim to add it.)

## Verify
Build + type-check pass; the page no longer carries an accidental block; intentional blocks intact.

## Skip or flag when
Already indexable → no-op. Block looks intentional or lives in host config → flag with reason.
