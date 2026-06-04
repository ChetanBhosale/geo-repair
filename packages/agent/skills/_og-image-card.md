---
id: _og-image-card
name: Templated OG card generation
shared: true
---

# Templated OG card generation

Shared by `open-graph` and `social-image-size`. Used **only** when no suitable image asset
already exists in the repo. Deterministic and on-brand — **never an AI image model** for OG
cards on existing pages.

## What "templated" means

Render the page **title + site name + the site's existing logo / colors / fonts** into a
1200×630 card from a code template. Reuse brand assets already in the repo; do **not** design
new artwork. Preferred order overall: (1) wire an existing suitable image; (2) generate a
templated card (below); (3) no image and no brand assets → skip the image and flag.

## By framework

- **Next App Router:** add `opengraph-image.tsx` (root and/or per-route) using `ImageResponse`
  from **`next/og`** — built into Next 13.3+, usually **no new dependency**.
- **Next Pages:** an `@vercel/og` API route (`pages/api/og.tsx`) returning `ImageResponse`;
  reference its URL in `og:image`.
- **Astro / SvelteKit / Remix:** a server endpoint using `satori` + `@vercel/og` / `resvg`
  (or `astro-og-canvas` for Astro) to emit the PNG; wire the route URL.
- **Static HTML:** no runtime renderer — prefer wiring an existing image; only pre-generate a
  static PNG if a logo asset and a clear template exist, otherwise flag.

## Rules

- Any added dependency (`@vercel/og`, `satori`, …) is justified and **called out in the PR body**.
- Output must be a web format (PNG/JPG/WebP — not SVG), ≥ 1200×630, < ~1 MB.
- Use `twitter:card=summary_large_image` when a large image exists.
- **The one allowed AI-image use** is a Tier-C net-new content thumbnail (opt-in via intake,
  budget-capped, listed in the PR) — never for OG cards on existing pages.
