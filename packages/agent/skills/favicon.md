---
id: favicon
name: Favicon & touch icons
category: Metadata
pillars: [seo]
tier: A
fixable: true
scope: site-wide
priority: low
---

# favicon — wire existing icon assets

## What it checks & why
Favicon + Apple touch icon wired (`<link rel="icon">`, `apple-touch-icon`). Low-weight branding
signal.

## Pass bar
pass = icon + touch icon linked. partial = one present. fail = none (or asset present but unlinked).

## How to fix
Wire an **existing** icon asset already in the repo (`favicon.ico`, `icon.svg`, `apple-icon.png`,
anything in `public/` / `static/`):
- **Next App Router:** file-based metadata — `app/icon.*` / `app/apple-icon.*` make Next emit the
  links automatically; or set `metadata.icons`.
- **Static / Astro / Pages:** `<link>` in the head, file in `public/`.

## Auto-fix vs flag
Asset present but unlinked → wire it. **No icon asset in the repo → flag only**; never generate
artwork (same rule as the OG image).

## Verify
Build + type-check pass; icon links resolve to a real asset.

## Skip or flag when
Already wired → no-op. No icon asset exists → flag.
