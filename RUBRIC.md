# RUBRIC.md — GEO/AEO Readiness Rubric (`@repo/checker`)

**This file is the single source of truth for the rubric.** The free checkup, the agent's
fix targets (`packages/agent/prompts/geo-fix-agent.md`), the post-merge re-check, and the
compliance bar for our own site (`AGENTS.md`) all derive from here. The re-check must never
disagree with what we sold, so **check IDs, categories, and tiers below are canonical** —
keep `@repo/checker` and the agent playbook identical to this list.

- **Version:** `v1` (the rubric is versioned; every checkup/order stores `rubric_version`).
- **Internal terms only.** "GEO/AEO" appears here and in code; customer-facing copy says
  "AI Search readiness." See `AGENTS.md` → Positioning & honesty guardrails.

## Per-check result schema

Each check returns:

```ts
{
  id,                 // stable kebab-case ID from the table below — never rename casually
  category,           // grouping for subscores
  weight,             // numeric weight; exact value lives in @repo/checker config, must
                      //   match the relative Priority column below
  status,             // "pass" | "partial" | "fail"
  evidence,           // the offending file/route/snippet — the agent's starting clue
  fixable_by_agent,   // false → flag only, never auto-edit (see Out of scope)
  fix_hint,           // advisory; the agent verifies against real code
  tier,               // "A" | "B" | "C" — capability/gating tier (below)
  approved?,          // Tier C acts only when true
  intake?             // Tier C: user's interview answers
}
```

## Scoring

- Weighted **0–100** overall, plus **per-category subscores** (Rendering, Structured data,
  Metadata, Crawl surface, Semantics, Content, Answerability).
- `pass` = full weight, `partial` = half, `fail` = 0.
- Scores must be **reproducible** across runs on unchanged input (deterministic checker).
- The set of `fixable_by_agent: true` failing checks becomes the agent's **bounded task
  list** — the primary cost control (the agent only touches flagged checks, never free-roams).

## Capability tiers

| Tier | Meaning | Runs |
|------|---------|------|
| **A** | Structural / markup (metadata, OG, canonical, JSON-LD, sitemap, robots, llms.txt, alt text, semantic HTML, internal links, schema **for content that already exists**) | Auto |
| **B** | Derived content — Markdown "twin" = faithful reformat of a page's existing rendered content, no new claims | Auto |
| **C** | Net-new content (competitor comparison pages, invented FAQ Q&A, keyword copy) | **Only when `approved === true`**, via the agent's 3–5 question interview |
| **Out of scope** | CSR→SSR conversion; mobile-responsive / CSS layout | **Never edited — flagged only** (can break the build, not build/typecheck-verifiable) |

## Canonical checks (v1)

Priority drives the numeric `weight` in `@repo/checker`. `fixable_by_agent: false` items are
measured and scored but only flagged, never auto-edited.

| # | ID | Category | Priority | Tier | fixable_by_agent |
|---|----|----------|----------|------|------------------|
| 1 | `ssr-visibility` | Rendering | **Critical** | Out of scope | **false** (flag only) |
| 2 | `structured-data` | Structured data | High | A | true |
| 3 | `meta-tags` | Metadata | High | A | true |
| 4 | `open-graph` | Metadata | Medium | A | true |
| 5 | `canonical-urls` | Metadata | Medium | A | true |
| 6 | `robots-ai-crawlers` | Crawl surface | High | A | true |
| 7 | `sitemap` | Crawl surface | Medium | A | true |
| 8 | `llms-txt` | Crawl surface | Medium | A | true |
| 9 | `semantic-html` | Semantics | Medium | A | true |
| 10 | `image-alt-text` | Semantics | Low | A | true |
| 11 | `internal-linking` | Content | Low | A | true |
| 12 | `answerability` | Answerability | High | A (schema when Q&A exists) / C (net-new FAQ) | partial |
| 13 | `freshness-eeat` | Content | Low | A (where dates/author derivable) | partial |

**Check intent**

1. **`ssr-visibility`** — Fetch raw no-JS HTML; if primary content only appears after
   hydration, the site is largely invisible to AI crawlers. *The* critical custom-site
   failure — measured but flag-only (CSR→SSR is out of scope for the agent).
2. **`structured-data`** — JSON-LD presence + validity: `Organization`, `WebSite` site-wide;
   `Article` on article routes; `BreadcrumbList` on hierarchical pages. Real data only.
3. **`meta-tags`** — `<title>` + meta description on every route (framework-idiomatic).
4. **`open-graph`** — Open Graph + Twitter cards + a resolvable OG image (wire an existing
   image, else a templated card; never AI-generated imagery).
5. **`canonical-urls`** — Self-referential, absolute canonical per route.
6. **`robots-ai-crawlers`** — robots allows AI crawlers (GPTBot, ChatGPT-User, OAI-SearchBot,
   ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, CCBot); never accidentally block;
   preserve intentional disallows.
7. **`sitemap`** — Present, valid, referenced from robots. **Also drives pricing** (page count).
8. **`llms-txt`** — `/llms.txt` (Markdown): site name, description, curated key-page links.
9. **`semantic-html`** — One `<h1>`, correct heading hierarchy, landmarks
   (`<header>/<nav>/<main>/<footer>`). Text-preserving structural fixes only.
10. **`image-alt-text`** — Meaningful images have accurate `alt`; decorative → `alt=""`. No
    keyword-stuffing.
11. **`internal-linking`** — Descriptive anchor text (no "click here"); no orphan pages.
12. **`answerability` (AEO core)** — Question-shaped headings + FAQ blocks; `FAQPage` schema
    when Q&A already renders (Tier A). Net-new FAQ authoring is Tier C (gated).
13. **`freshness-eeat`** — Visible dates, author, about/contact signals.

## Planned expansions (not yet scored in v1)

The rubric is **not frozen** — keep checker, agent fix-targets, and re-check in sync as these
land. Add them here first, then to `@repo/checker` and the agent playbook.

| ID | Category | Tier | Notes |
|----|----------|------|-------|
| `markdown-twins` | Content | B | Faithful `.md` twin per flagged page (no new claims). |
| `comparison-pages` | Content | C | Net-new competitor comparison; interview-gated, no unverifiable claims. |
| `keywords` | Content | C | Keyword copy; gated; never invent lists. |
| `mobile-responsive` | Rendering | Out of scope | Measured, flag-only (CSS layout — not agent-safe). |

## Anti-abuse / crawler etiquette (free checkup)

- Upstash Redis rate-limit (per-IP **and** per-domain); cache results per domain (~24h).
- Fetch timeouts + response size caps; concurrency-limit our crawler.
- **Respect the target site's `robots.txt`.**

## Honesty guardrail

The rubric measures **technical readiness**, not outcomes. Neither the score nor the re-check
may promise traffic, rankings, or AI citations — only that readiness improved. See `AGENTS.md`.
