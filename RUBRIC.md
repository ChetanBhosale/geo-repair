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
| **C** | Net-new content (competitor comparison pages, invented FAQ Q&A, keyword copy) + optional on-brand generated thumbnails (≤ ~$0.10 each, opt-in) | **Only when `approved === true`**, set via the user's ~10-question MCQ intake (click-to-answer, optional free text per question; see `plan.md` → Tier C content gate) |
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
| 14 | `interactive-labels` | Semantics | Low | A | true |
| 15 | `indexability` | Crawl surface | High | A | partial |
| 16 | `citation-quality` | Content | Medium | A (link existing refs) / C (net-new sourcing) | partial |
| 17 | `definitions` | Answerability | Medium | A (mark up existing) / C (net-new) | partial |
| 18 | `charset` | Rendering | Low | A | true |
| 19 | `doctype` | Rendering | Low | A | true |
| 20 | `favicon` | Metadata | Low | A | true (wire existing asset) / flag if none |
| 21 | `hreflang` | Metadata | Low | A | partial (only when locales exist) |
| 22 | `social-image-size` | Metadata | Low | A | true |
| 23 | `markdown-twins` | Content | Low | B | true |

**Check intent**

1. **`ssr-visibility`** — Fetch raw no-JS HTML; if primary content only appears after
   hydration, the site is largely invisible to AI crawlers. *The* critical custom-site
   failure — measured but flag-only (CSR→SSR is out of scope for the agent).
2. **`structured-data`** — JSON-LD presence + validity: `Organization`, `WebSite` site-wide;
   `Article` on article routes; `BreadcrumbList` on hierarchical pages. Real data only.
3. **`meta-tags`** — `<title>` + meta description present on every route (framework-idiomatic)
   **and graded on attribute quality, not just presence**: title ~50–60 chars (≤ ~600px, no SERP
   truncation), description ~120–160 chars, both non-empty, unique per route, not a generic /
   duplicated placeholder. `pass` = present + in range; `partial` = present but off-length /
   truncating / duplicated; `fail` = missing. Auto-fix = add a **missing** tag or safely derive one
   (`<h1>` / frontmatter); **never silently reword existing human-written copy to hit a length**
   (that's a meaning change → flag, score `partial`).
4. **`open-graph`** — Open Graph + Twitter cards **graded for completeness**, not mere presence:
   core OG (`og:title`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:image` +
   `og:image:alt`; `og:locale` where applicable), a **correct `og:type`** (`website` site-wide,
   `article` on article routes, `product` on product routes), and Twitter (`twitter:card` =
   `summary_large_image` when a large image exists, else `summary`; `twitter:title` /
   `twitter:description` / `twitter:image`). Plus a resolvable OG image (wire an existing image, else
   a templated card; never AI-generated imagery). `partial` when tags exist but are incomplete or
   `og:type` is wrong/missing.
5. **`canonical-urls`** — Self-referential, absolute canonical per route.
6. **`robots-ai-crawlers`** — robots allows AI crawlers (GPTBot, ChatGPT-User, OAI-SearchBot,
   ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, CCBot); never accidentally block;
   preserve intentional disallows.
7. **`sitemap`** — Present, valid, referenced from robots. **Also drives pricing** (page count).
8. **`llms-txt`** — `/llms.txt` (Markdown): site name, description, curated key-page links.
9. **`semantic-html`** — One `<h1>`, correct heading hierarchy, landmarks
   (`<header>/<nav>/<main>/<footer>`), and a sound accessibility tree (valid roles, correct
   parent/child nesting). Text-preserving structural fixes only.
10. **`image-alt-text`** — Meaningful images have accurate `alt`; decorative → `alt=""`. No
    keyword-stuffing.
11. **`internal-linking`** — Descriptive anchor text (no "click here"); no orphan pages.
12. **`answerability` (AEO core)** — Question-shaped headings + FAQ blocks; `FAQPage` schema
    when Q&A already renders (Tier A). Net-new FAQ authoring is Tier C (gated).
13. **`freshness-eeat`** — Visible dates, author, about/contact signals.
14. **`interactive-labels`** — Every interactive element (button, link, input, select) has a
    programmatic accessible name; no focusable control hidden from the accessibility tree
    (`aria-hidden`); valid roles. The a11y tree is the "machine-eye view" AI agents use to
    operate a page, and accessible names are a WCAG requirement — a dual SEO + agentic win.
15. **`indexability`** — The page is *eligible* to appear in traditional search (and thus Google
    AI Overviews): no `noindex` (meta robots **or** `X-Robots-Tag` response header), `robots.txt`
    doesn't block Googlebot/Bingbot on real routes, self-referential canonical (not canonicalizing
    the page away), 200 status. Distinct from `robots-ai-crawlers` (which targets GPTBot/ClaudeBot/
    etc.) — a page can be open to AI crawlers yet `noindex` to Google. We check *eligibility*, not
    live index status (querying Google for actual indexing is unreliable + against ToS).
    **Preserve intentional `noindex`** (staging, private, thin/utility routes): auto-fix only
    clearly-accidental blocks on primary content, else flag.
    > _Advisory (not scored, not auto-fixed):_ surface whether a `google-site-verification` (or
    > Bing `msvalidate.01`) meta tag is present. **Presence** hints Search Console / Webmaster
    > Tools was set up via the meta method; **absence is inconclusive** (DNS / HTML-file /
    > Analytics / Tag-Manager verification leave no HTML trace) and we can't add it (the token is
    > the owner's). Use it only to nudge "consider setting up Search Console," never to move the score.
16. **`citation-quality`** — Does the page's content **cite trusted external sources** (links to
    research, `.gov`/`.edu`, standards bodies, primary data)? In a large citation study this was the
    #2 predictor of whether ChatGPT/Perplexity/Claude *quote* a page. Tier A: where the prose already
    names a source ("according to a 2024 Pew study"), wire the real outbound link. Tier C (gated):
    adding net-new sourced claims — never invent a source or a statistic; only from intake/existing
    content. Measured/flagged everywhere; auto-fix is link-wiring only. **Weighted conservatively
    (single study) and never a citation promise** — see Honesty guardrail.
17. **`definitions`** — Is key content **answer-first and defines its terms** ("X is Y" up front,
    the question answered in the first sentence)? Top study predictors were direct answerability and
    plain definitions. Tier A: structural only — surface an existing definition/answer to the top of
    its section, mark it up (e.g. `DefinedTerm`) when the text already says it. Tier C (gated): writing
    net-new definitions/answer-first intros. Overlaps with `answerability` (#12) but scores the
    *definitional/answer-first* signal specifically; never rewrite meaning, only reorder/mark up
    existing text unless Tier C is approved.
18. **`charset`** — `<meta charset="utf-8">` declared early in `<head>` (within the first ~1024
    bytes). Prevents mojibake across languages; trivial, deterministic structural fix.
19. **`doctype`** — HTML5 `<!DOCTYPE html>` present so the browser renders in standards mode (not
    quirks mode). Document-level structural fix; never touches content.
20. **`favicon`** — Favicon + Apple touch icon wired (`<link rel="icon">`, `apple-touch-icon`).
    Tier A: wire **existing** icon assets already in the repo; **flag only** when no asset exists
    (never generate imagery — same rule as the OG image in `open-graph`). Low-weight branding signal.
21. **`hreflang`** — When the site already serves multiple locales / translated routes, emit
    `hreflang` annotations (+ `x-default`) mapping each page to its language variants. Tier A markup
    **only when translated routes already exist** — never invent locales or translations; partial /
    flag-only otherwise.
22. **`social-image-size`** — The OG/Twitter image is fit for unfurling: dimensions ≥ 1200×630
    (~1.91:1; ≥ 600×315 minimum), a web format (PNG/JPG/WebP — **not** SVG, which platforms reject),
    a sane **file size** (under platform caps — ~5 MB Twitter / ~8 MB Facebook; aim < 1 MB for fast
    unfurl), and declared `og:image:width` / `og:image:height` (+ `og:image:type`). Extends
    `open-graph` (#4): it **validates / annotates the already-wired image**, it does **not** select,
    resize, or generate one — wired image too small / heavy / wrong-format with no better asset → flag.
23. **`markdown-twins`** — Does each primary page expose a clean **Markdown "twin"** — the same
    rendered content served as `text/markdown` at a predictable URL (`<path>.md`), linked from the
    HTML via `<link rel="alternate" type="text/markdown">` and indexed in `/llms.txt`? AI crawlers and
    answer engines parse Markdown far more reliably than a JS-heavy DOM, so a faithful twin is the
    cleanest possible "machine-eye view" of a page. **The only Tier B check** (derived content): the
    twin is a *faithful reformat of the page's existing rendered content* — same headings, prose, FAQ,
    and lists, **no new claims, no invented copy** (that would be Tier C). `pass` = twin present,
    reachable (200, correct content-type), discoverable (alternate link + llms.txt entry), and faithful;
    `partial` = twin exists but isn't linked/indexed, or covers only some primary pages; `fail` = none.
    Auto-fix = generate twins from the page's own content source (Markdown/MDX raw, or the structured
    content the page renders from) and wire discovery; **never** paraphrase or add material the page
    doesn't already say. Pairs with `llms-txt` (#8) — llms.txt is the *index*, the twins are the *pages*.

## Planned expansions (not yet scored in v1)

The rubric is **not frozen** — keep checker, agent fix-targets, and re-check in sync as these
land. Add them here first, then to `@repo/checker` and the agent playbook.

| ID | Category | Tier | Notes |
|----|----------|------|-------|
| `comparison-pages` | Content | C | Net-new competitor comparison; interview-gated, no unverifiable claims. |
| `keywords` | Content | C | Keyword copy; gated; never invent lists. |
| `mobile-responsive` | Rendering | Out of scope | Measured, flag-only (CSS layout — not agent-safe). |

## Off-site citation placement (diagnostic — not scored, not fixable by a PR)

Independent of everything on-page: AI often cites a **third-party comparison / roundup page you're
not on**, or pulls from a handful of external sources in your category where you're absent. That's a
**placement** problem, not a writing problem — and it's the most common honest answer to "why doesn't
AI cite me." A repo PR **cannot fix it** (that content lives on sites we don't control), so we
**diagnose and flag — never auto-fix, never score it.**

- **What we surface:** for a set of key questions in the customer's category, the **URLs an AI engine
  cites** (ChatGPT / Perplexity), whether the customer's domain appears, and **which external sources
  got cited instead** — i.e. "for these N questions you're missing from, here's who got cited and the
  pages you'd need to land on."
- **Why advisory only:** results are **non-deterministic** (engine answers vary run to run), so — exactly
  like Agentic readiness below — this is **never folded into the 0–100 score, the subscores, or anything
  we commit to the customer.** It's a separate, clearly-labeled diagnostic, and `fixable_by_agent: false`.
- **Honesty:** present it as "the off-site half we can *show* you but can't fix for you," paired with the
  on-site fixes we *do* ship. Never imply landing on those sources is guaranteed, or that we can place
  you there. Respect engine ToS + rate limits when querying.

## Agentic readiness (experimental — not in the headline score)

A second, emerging axis: how well the site can be **operated** by AI agents that click, fill
forms, and transact — distinct from being **read/cited**, which every check above covers.
Chrome's Lighthouse now ships an experimental "Agentic Browsing" category for exactly this.
Because the standards are unsettled (and some signals are non-deterministic), we report these
as a **separate pass/fail checklist (X of N)** — **never** folded into the 0–100 AI-search
score we sell, and **never** part of what we commit to the customer.

| ID | Category | Tier | fixable_by_agent | Notes |
|----|----------|------|------------------|-------|
| `interactive-labels` | Semantics | A | true | Already scored in v1 above (it's also a classic a11y win); the a11y tree is the agent's primary data model. |
| `layout-stability` (CLS) | Rendering | Out of scope | false (flag only) | Visual stability so agents don't mis-click moving elements. CSS/loading concern — measured, never auto-edited (same class as `mobile-responsive`). |
| `webmcp` | Crawl surface | roadmap | false (advisory) | Expose forms/logic as agent-callable tools via the WebMCP API. Net-new runtime behavior + a *proposed* standard — advisory only, a candidate future "agent-operable" premium line, never auto-added in v1. |

These do **not** affect `score`, subscores, or anything we commit to the customer. Keep anything scored
deterministic; runtime/JS-timing-dependent signals stay informational (Chrome warns agentic
results fluctuate with JS-registration timing, DOM/a11y-tree variance, and CLS).

## Anti-abuse / crawler etiquette (free checkup)

- Upstash Redis rate-limit (per-IP **and** per-domain); cache results per domain (~24h).
- Fetch timeouts + response size caps; concurrency-limit our crawler.
- **Respect the target site's `robots.txt`.**

## Honesty guardrail

The rubric measures **technical readiness**, not outcomes. Neither the score nor the re-check
may promise traffic, rankings, or AI citations — only that readiness improved. See `AGENTS.md`.

**Page type caps citations — be honest about it.** Independent research shows informational /
how-to / explainer pages get quoted by AI several times more than transactional pages; product,
pricing, and shop pages have a structural citation ceiling **regardless of how clean their
markup is**. So a high readiness score on a SaaS/ecommerce page does **not** imply it will get
cited. `citation-quality` and `definitions` improve readiness on any page, but the durable
citation win is *educational content* — surface that as guidance, never as a promise.
