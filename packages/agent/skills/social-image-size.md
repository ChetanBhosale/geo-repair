---
id: social-image-size
name: Social image dimensions
category: Metadata
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: low
---

# social-image-size — validate/annotate the wired OG image

## What it checks & why
The OG/Twitter image must be fit for unfurling: ≥ 1200×630 (~1.91:1), a web format (PNG/JPG/WebP —
**not** SVG, which platforms reject), a sane file size (< platform caps; aim < 1 MB), and declared
`og:image:width` / `og:image:height` (+ `og:image:type`). Extends `open-graph`: it **validates /
annotates the already-wired image**, it does not select/resize/generate one.

## Pass bar
pass = image meets size/format + dimensions declared. partial = wired but undeclared dimensions /
borderline size. fail = too small / wrong format / missing.

## How to fix
Declare `og:image:width` / `og:image:height` / `og:image:type` for the already-wired image; set
`twitter:card=summary_large_image` when a large image is present.

## Auto-fix vs flag
Validate/annotate only. Wired image too small / heavy / wrong-format with no better asset in the
repo → **flag** (don't re-encode, resize, upscale, or generate). See `_og-image-card` for the card
path when no asset exists.

## Verify
Build + type-check pass; dimension/type tags match the actual image; image resolves.

## Skip or flag when
Image already valid + annotated → no-op. No adequate asset → flag.
