---
id: open-graph
name: Open Graph & Twitter cards
category: Metadata
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: medium
---

# open-graph — Open Graph + Twitter cards + OG image wiring

## What it checks & why
Open Graph + Twitter cards graded for **completeness**, not mere presence, so links unfurl
correctly across social and chat surfaces. Core OG: `og:title`, `og:description`, `og:url`,
`og:type`, `og:site_name`, `og:image` + `og:image:alt`, `og:locale` (where applicable); a
**correct `og:type`** (`website` site-wide, `article` on article routes, `product` on product
routes); Twitter: `twitter:card` (= `summary_large_image` when a large image exists, else
`summary`), `twitter:title` / `twitter:description` / `twitter:image`; plus a resolvable OG image.

## Pass bar
pass = complete + correct `og:type` + resolvable image. partial = tags exist but incomplete or
`og:type` wrong/missing. fail = absent.

## How to fix (by framework)
- **Next App Router:** `openGraph` / `twitter` in the Metadata API; set `metadataBase`.
- **Next Pages / Astro / static:** `og:*` + `twitter:*` `<meta>` in head; image = absolute URL
  to an asset in `public/` (or site root).
- **OG image, preferred order:** (1) wire an existing suitable image; (2) generate a templated
  card → see the `_og-image-card` skill; (3) no image + no brand assets → skip the image and flag.

## Auto-fix vs flag
Fill missing attributes and correct `og:type`; score `partial` until complete. Never AI-generate
imagery for OG cards on existing pages (use the templated path). Any added dep (e.g. `@vercel/og`)
is justified in the PR body.

## Verify
Build + type-check pass; OG/Twitter tags complete on edited routes; image URL resolves absolute.

## Skip or flag when
Already complete with a valid image → no-op. No image and no brand assets in the repo → wire what
exists or flag; never block the page on a missing image.
