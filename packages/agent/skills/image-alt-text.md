---
id: image-alt-text
name: Image alt text
category: Semantics
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: low
---

# image-alt-text — accurate alt on meaningful images

## What it checks & why
Meaningful images need accurate `alt`; decorative images get `alt=""`. Alt text is how non-visual
crawlers and assistive tech understand imagery. No keyword-stuffing.

## Pass bar
pass = meaningful images have accurate alt, decorative have `alt=""`. partial = some missing.
fail = widespread missing alt.

## How to fix
Find images lacking `alt` (`<img>`, `next/image`, Astro `<img>`/`<Image>`, Markdown `![]()`).
Derive the description from a nearby heading/caption, the humanized filename, or surrounding copy.
Decorative images → `alt=""`.

## Auto-fix vs flag
Accurate to the image's role; no keyword-stuffing. Thin context → `alt=""` for clearly decorative
images, else **flag** for manual review rather than guess a wrong description.

## Verify
Build + type-check pass; edited images carry alt; no visible change.

## Skip or flag when
All meaningful images already have alt → no-op. Ambiguous image purpose with no context → flag.
