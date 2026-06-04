---
id: structured-data
name: JSON-LD structured data
category: Structured data
pillars: [geo, aeo]
tier: A
fixable: true
scope: per-page
priority: high
---

# structured-data — JSON-LD schema.org

## What it checks & why
JSON-LD presence + validity so engines read explicit entities instead of inferring them from
prose: `Organization` + `WebSite` site-wide, `Article` on article routes, `BreadcrumbList` on
hierarchical pages. **Real data only.**

## Pass bar
pass = valid JSON-LD with the expected types for the page. partial = present but invalid /
incomplete / wrong type. fail = none.

## How to fix (by framework)
- Inject `<script type="application/ld+json">` — JSX `dangerouslySetInnerHTML`, Astro `set:html`,
  framework head as appropriate.
- **Organization + WebSite** → site-wide (root layout / `_app` / shared `.astro` / `+layout.svelte`
  / every static head). **Article** → article routes only, fields from real page data.
  **BreadcrumbList** → pages with a clear hierarchy, derived from nav/segments.
- `FAQPage` only when Q&A pairs already render; `Article` only when article content exists —
  extract verbatim from rendered content / MDX / CMS.

## Auto-fix vs flag
All values from real data; validate the JSON; one graph per type per page. Valid existing schema
→ no-op. Net-new FAQ Q&A authoring is **Tier C** (see `answerability`), never invented here.

## Verify
Build + type-check pass; JSON-LD parses; types match the page; no fabricated fields.

## Skip or flag when
Valid schema already present → no-op. No content to ground a type (e.g. no FAQ) → skip with reason.
