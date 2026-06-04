---
id: meta-tags
name: Title & meta description
category: Metadata
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: high
---

# meta-tags — title & meta description

## What it checks & why
Every route needs a `<title>` + `<meta name="description">`, graded on **quality, not just
presence**: title ~50–60 chars (no SERP truncation), description ~120–160 chars, both non-empty,
unique per route, not a generic/duplicated placeholder. This is the baseline of how search and
AI summarize the page.

## Pass bar
pass = present + in range + unique. partial = present but off-length / truncating / duplicated.
fail = missing.

## How to fix (by framework)
- **Next App Router:** Metadata API — `export const metadata` in `layout.tsx` (defaults +
  `title.template`) and `page.tsx`; dynamic routes → `generateMetadata()`. Don't hand-write
  `<title>` in JSX.
- **Next Pages:** `next/head` with `<title>` + `<meta name="description">`, or a shared `<SEO>`
  component in `_app`.
- **Astro:** layout `<head>` driven by frontmatter props; pages pass props through.
- **Static HTML:** edit each page's `<head>` directly.
- **Remix:** per-route `meta` export. **SvelteKit:** `<svelte:head>`. **Vite SPA:** static shell
  in `index.html`; per-route titles only via an existing head manager — don't add a dep, flag the
  CSR limit.

## Auto-fix vs flag
Auto-fix = add a **missing** tag or derive one from the page's `<h1>` / frontmatter. A
present-but-too-long **human-written** title/description → **flag** and score `partial`. Never
silently reword existing human copy to hit a length (that's a content change, outside Tier A).
Meta keywords are low value — only if explicitly requested; never invent lists (→ Tier C).

## Verify
Build + type-check pass; tags present and unique per edited route; no visible content changed.

## Skip or flag when
Already present + in range → no-op (`already_satisfied`). CSR-only shell with no head manager →
flag the limitation.
