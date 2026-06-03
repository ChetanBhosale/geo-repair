# outputformat.md — what every score is based on

This explains, field by field, **how the scraper produces each number in a `ScoreReport`** and
**what signal each check looks for**. It mirrors the code in `scraper/checks.ts` (the per-check
logic), `scraper/score.ts` (the rollups), and `scraper/parser.ts` (the data each check reads).

- Canonical check IDs / categories / tiers live in [`/RUBRIC.md`](../../RUBRIC.md).
- Fetch + scoring design lives in [`/scraper.md`](../../scraper.md).
- This file is the **read-out**: given a result, where did each value come from.

Customer-facing copy says "AI Search readiness." SEO / GEO / AEO are internal pillar names.

---

## 1) The shape of the output

```jsonc
{
  "url", "finalUrl", "fetchedAt", "durationMs", "rubricVersion",
  "fetch":   { requestedUrl, finalUrl, status, ok, blocked, blockReason?, tier },
  "overall": 0-100,
  "pillars":    { seo: {...}, geo: {...}, aeo: {...} },   // each {score, earned, applicable, checks}
  "categories": { Rendering: {...}, Metadata: {...}, ... }, // each {score, earned, applicable}
  "checks":     [ { id, category, pillars, tier, fixableByAgent, weight, status, reason, good[], bad[], evidence?, fixHint? } ],
  "advisories": [ { id, label, status, detail, needs?, observed? } ],
  "summary":    { good[], bad[], missing[], inconclusive[] }
}
```

Everything rolls up from the `checks` array. Nothing in `advisories` ever affects a score.

### Key stability guarantee

**The set of keys is fixed. Every key is always present, on every run, even when there is no
data.** This is enforced by `scraper/shape.test.ts`. Concretely:

- The 12 top-level keys above are always emitted.
- `pillars` always has exactly `seo`, `geo`, `aeo`.
- `categories` always has all 7 categories (Rendering, Structured data, Metadata, Crawl surface,
  Semantics, Content, Answerability); a category with no applicable checks is
  `{ score: 0, earned: 0, applicable: 0 }`, never missing.
- Every object in `checks` always has all 12 check keys; `evidence` and `fixHint` are `null`
  (not absent) when a check has none.
- Every object in `advisories` always has all 6 keys; `needs` and `observed` are `null` when none.
- `fetch.blockReason` is `null` on a successful fetch and a string when blocked.
- `summary` always has `good`, `bad`, `missing`, `inconclusive` as arrays (possibly empty).

"No data" is represented as an **empty array** (`[]`), `null`, or a zero score, never by dropping
the key. Optional fields use `null` rather than `undefined` precisely because `JSON.stringify`
omits `undefined` keys. An **inconclusive (blocked / unreachable)** run returns the exact same key
set: `checks` and `advisories` are `[]`, all category/pillar scores are 0, and the reason is in
`summary.inconclusive` + `fetch.blockReason`.

---

## 2) How a check becomes points

Every check returns one `status`. Status maps to a fraction of the check's `weight`
(`scraper/score.ts` -> `statusFraction`):

| status | meaning | points earned |
|--------|---------|---------------|
| `pass` | signal fully present/correct | **full weight** |
| `partial` | present but incomplete/wrong | **half weight** |
| `fail` | absent or broken | **0** |
| `inconclusive` | could not be read (blocked) | **excluded from denominator** |
| `not-applicable` | does not apply to this page | **excluded from denominator** |

`inconclusive` and `not-applicable` are dropped from both the numerator and denominator, so we
never penalize a page for something we could not read or that does not apply (e.g. `hreflang` on a
single-locale site).

### Check weight comes from its priority

`scraper/checks.ts` -> `PRIORITY_WEIGHT`:

| priority | weight |
|----------|--------|
| critical | 30 |
| high | 20 |
| medium | 12 |
| low | 6 |

### The formula (same everywhere: pillars, categories)

```
score = round( Σ(earned weight) / Σ(applicable weight) × 100 )
```

---

## 3) Pillars, categories, overall

**Pillar score** = the formula above over the checks whose `pillars` array includes that pillar.
A check can belong to more than one pillar.

| Pillar | Question it answers | Default weight |
|--------|---------------------|----------------|
| **SEO** | Classic search hygiene | 0.25 |
| **GEO** | Can AI crawlers reach + parse the site | 0.40 |
| **AEO** | Can an answer engine extract a direct answer | 0.35 |

**Category score** = the same formula over checks sharing a `category` (Rendering, Structured
data, Metadata, Crawl surface, Semantics, Content, Answerability). Categories are a second lens on
the same checks; they do not feed `overall`.

**Overall** (`scraper/score.ts` -> `overallScore`):

```
Overall = round( Σ(pillarWeight × pillarScore) / Σ(pillarWeight) )   // only pillars with ≥1 applicable check
```

The denominator re-normalizes over pillars that actually had applicable checks, so a pillar with
everything excluded does not drag the total.

**The `summary` buckets** (`scraper/score.ts` -> `buildSummary`):
- `good` = every `pass`.
- `missing` = a `fail` whose `bad[]` reads like absence (matches `missing|no |not found|none|empty`).
- `bad` = every other `fail`, plus every `partial` (present but wrong).
- `inconclusive` = `inconclusive` + `not-applicable`.

---

## 4) Every check: what it looks for and how status is decided

Each entry: **what data it reads** (from the parsed page / domain files / twin probe) and the
**exact pass / partial / fail thresholds** in the code.

### Rendering

**`ssr-visibility`** (GEO, critical, flag-only) — *Is primary content in the raw no-JS HTML?*
Reads `page.wordCount`, `page.spaRootDetected`, `page.scriptCount` from the Tier 0 (static) HTML.
- `fail`: SPA shell detected **and** word count < 100.
- `partial`: word count < 250.
- `pass`: otherwise.
This is `fixable_by_agent: false` (CSR to SSR is out of scope) but still scored.

**`charset`** (SEO, low) — *Is UTF-8 declared early?* Reads `page.charsetValue`, `page.charsetEarly`
(within first ~1024 bytes).
- `fail`: no charset declared.
- `pass`: charset is UTF-8 **and** declared early.
- `partial`: declared but not UTF-8, or declared late.

**`doctype`** (SEO, low) — *Standards-mode doctype?* Reads `page.hasDoctype` (regex for
`<!doctype html>` at the start).
- `pass`: present. `fail`: absent.

**`mobile-viewport`** (SEO, low) — *Mobile-friendly viewport?* Reads `page.viewport`,
`page.viewportResponsive` (`width=device-width`).
- `fail`: no `<meta name="viewport">`.
- `partial`: present but no `width=device-width`, **or** it disables zoom (`user-scalable=no` /
  `maximum-scale=1`, a WCAG issue).
- `pass`: responsive and allows zoom.

### Metadata

**`meta-tags`** (SEO, high) — *Title + description present and well-sized?* Reads `page.title` and
`metaByKey["description"]`.
- `fail`: title **or** description missing.
- `pass`: title 30 to 60 chars **and** description 110 to 160 chars.
- `partial`: both present but one is out of range.

**`open-graph`** (SEO, medium) — *Open Graph + Twitter card complete?* Reads `metaByKey` for the
core set `og:title, og:description, og:url, og:type, og:image` plus `twitter:card`.
- `fail`: none of the core og tags present.
- `partial`: some core og tags missing, **or** no `twitter:card`.
- `pass`: all core og tags **and** a twitter card.

**`canonical-urls`** (SEO, medium) — *Self-referential absolute canonical?* Reads `page.canonical`
vs `page.finalUrl`.
- `fail`: no canonical link.
- `partial`: canonical is relative, **or** points at a different URL (possible accidental
  de-index).
- `pass`: absolute and self-referential.

**`favicon`** (SEO, low) — *Favicon + Apple touch icon wired?* Reads `page.links` for
`rel=icon`/`shortcut icon` and `apple-touch-icon`.
- `pass`: both present. `partial`: one present. `fail`: neither.

**`hreflang`** (SEO, low) — *Locale annotations when multi-locale?* Reads `page.links` with
`rel=alternate` + an `hreflang` attribute.
- `not-applicable`: no hreflang tags (single-locale site; excluded from score).
- `pass`: hreflang tags **and** an `x-default`.
- `partial`: hreflang tags but no `x-default`.

**`social-image-size`** (SEO, low) — *Is the OG/Twitter image fit to unfurl?* Reads
`og:image`/`twitter:image` and `og:image:width`/`og:image:height`.
- `fail`: no social image, **or** the image is an SVG (platforms reject it).
- `pass`: declared dimensions ≥ 1200×630.
- `partial`: dimensions declared but below 1200×630, **or** dimensions not declared at all.

### Crawl surface

**`robots-ai-crawlers`** (GEO, high) — *Does robots.txt allow AI crawlers?* Reads parsed
`domain.robots.aiCrawlerRules` (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai,
PerplexityBot, Google-Extended, CCBot).
- `fail`: one or more AI crawlers disallowed at root.
- `partial`: no robots.txt found (not blocked, but no explicit allow + sitemap).
- `pass`: robots.txt present and blocks none of them.

**`sitemap`** (SEO, medium) — *Valid sitemap, referenced from robots?* Reads `domain.sitemap`
(validity + `<loc>` count + whether robots referenced it).
- `fail`: no valid XML sitemap.
- `partial`: valid sitemap but not referenced in robots.txt.
- `pass`: valid **and** referenced. (URL count also drives pricing elsewhere.)

**`llms-txt`** (GEO, medium) — *Is /llms.txt present with links?* Reads `domain.llmsTxt`.
- `fail`: missing or empty.
- `partial`: present but no Markdown links.
- `pass`: present with curated links.

**`indexability`** (SEO, high) — *Eligible for search/AI Overviews?* Reads `page.metaRobots`,
`page.xRobotsTag` (header), `page.status`.
- `fail`: `noindex` (meta or `X-Robots-Tag`) **or** non-200 status.
- `pass`: 200 and no noindex. (Presence of `google-site-verification` / `msvalidate.01` is noted
  as advisory text only, never scored.)

### Structured data

**`structured-data`** (GEO + AEO, high) — *Valid JSON-LD with foundational schema?* Reads
`page.jsonLd` (each block parsed, `@type`s collected, valid/invalid flagged).
- `fail`: no JSON-LD blocks.
- `partial`: a block fails to parse, **or** no foundational `Organization`/`WebSite`/`WebPage`.
- `pass`: valid blocks including a foundational type.

### Semantics

**`semantic-html`** (SEO + GEO + AEO, medium) — *One H1, sane hierarchy, landmarks?* Reads
`page.headings` (h1 count + level jumps) and `page.landmarks` (header/nav/main/footer).
- `pass`: exactly one `<h1>`, no heading-level skips, and a `<main>`.
- `fail`: no `<h1>`, **or** neither `<main>` nor `<header>`.
- `partial`: in between (e.g. heading skips or some landmarks missing).

**`image-alt-text`** (SEO, low) — *Do content images have alt?* Reads `page.images` (ignoring
`aria-hidden` / `role=presentation`); `alt===null` means the attribute is absent.
- `not-applicable`: no content images.
- `pass`: every content image has an alt attribute.
- `fail`: more than 50% missing alt. `partial`: some missing (≤ 50%).

**`interactive-labels`** (GEO, low) — *Does every control have an accessible name?* Reads
`page.interactives` (a/button/input/select/textarea) and each computed `accessibleName`
(aria-label, text, value, alt, label[for], title, placeholder).
- `not-applicable`: no controls.
- `pass`: none unnamed and none focusable-but-aria-hidden.
- `fail`: more than 40% of controls unnamed. `partial`: some unnamed (≤ 40%) or hidden focusables.

### Content

**`internal-linking`** (SEO, low) — *Descriptive internal anchors, no orphan?* Reads `page.anchors`
filtered to same-origin links and their text/aria-label.
- `fail`: no internal links at all.
- `pass`: no vague anchors ("click here", "read more", "here", etc.).
- `partial`: empty-text links exist, or vague anchors are more than 30% of internal links.

**`freshness-eeat`** (GEO + AEO, low, *heuristic*) — *Date, author, about/contact signals?* Reads
the first 4000 chars of `visibleText` for a date pattern, `metaByKey`/JSON-LD for author, and
`page.anchors` for an about/contact link.
- `pass`: at least 2 of {date, author, about/contact}.
- `partial`: exactly 1. `fail`: none.

**`citation-quality`** (AEO, medium, *heuristic*) — *Does it cite trusted external sources?* Reads
`page.anchors` for outbound (cross-origin) links and matches a trusted-source list
(`.gov`, `.edu`, wikipedia, doi.org, nih, who.int, arxiv, nature, ncbi, oecd, europa.eu).
- `pass`: ≥ 2 trusted outbound links.
- `partial`: exactly 1 trusted, **or** ≥ 3 outbound links overall.
- `fail`: no authoritative outbound citations. (Weighted conservatively; never a citation promise.)

**`markdown-twins`** (GEO, low, Tier B) — *Is a clean Markdown twin served + discoverable?* Reads
the `twin` probe (dualmark spec): `<path>.md` reachable, `text/markdown` content-type, non-empty
body, HTML `rel=alternate` link, `Vary: Accept`, Accept-header negotiation, `X-Robots-Tag: noindex`.
- `fail`: no twin / twin URL not reachable.
- `pass`: twin reachable **and** correct content-type **and** non-empty **and** linked via
  `rel=alternate` **and** Accept negotiation works **and** `Vary: Accept`.
- `partial`: twin exists but missing some discovery/header conventions.

### Answerability

> Example walk-through (the one you asked about): **"Answerability category = 0/100"** means both
> member checks below returned `fail`, so `earned/applicable = 0`. This is common and expected on
> a marketing/landing page, which has a structural citation ceiling regardless of markup. The
> signal is most meaningful on informational / blog / docs pages.

**`answerability`** (AEO, high, *heuristic*) — *Is there extractable Q&A structure?* Reads
`page.jsonLd` for `FAQPage`/`QAPage` schema, and `page.headings` for question-shaped headings
(text ends with `?` or starts with how/what/why/when/where/who/which/can/is/are/does/do/should/will).
- `pass`: FAQ schema **and** at least one question heading.
- `partial`: 2 or more question headings but **no** FAQ schema.
- `fail`: fewer than 2 question headings and no FAQ schema.

**`definitions`** (AEO, medium, *heuristic*) — *Is the content answer-first and term-defining?*
Reads `page.jsonLd` for `DefinedTerm` schema, and the first 400 chars of `visibleText` for an
"X is / are / refers to / means Y" lead pattern.
- `pass`: `DefinedTerm` schema **and** a definitional lead.
- `partial`: definitional lead but no `DefinedTerm` markup.
- `fail`: no answer-first definition detected.

---

## 5) Heuristic vs deterministic

Most checks are **fully deterministic**: pure presence/validity tests on parsed tags and headers,
identical output for identical input. Four are marked `heuristic` in the registry
(`answerability`, `definitions`, `citation-quality`, `freshness-eeat`); they approximate the
quality judgments that are **LLM-assisted in the real `@repo/checker`**, and they say so in their
`reason` text. Treat their pass/partial/fail as a structural proxy, not a content-quality verdict.

Known limits of the heuristic versions:
- They inspect headings + the first few hundred chars, not whether body paragraphs truly answer.
- They cannot judge answer self-containedness ("chunkability") or definition quality.
- The "X is Y" detector expects a capitalized subject early, so rephrased definitions can slip by.

---

## 6) Advisories (reported, never scored)

`report.advisories` lists what a Tier 0 static reader cannot honestly score, so the output is
upfront about scope (per `RUBRIC.md` "Advisory, never scored" + `AGENTS.md` honesty rule). Each
has a `status` (`not-measured` / `planned` / `flag-only`), a `detail`, what would unlock it
(`needs`), and any static hint (`observed`):

- **core-web-vitals** — LCP/INP/CLS/TTFB/page weight. Needs Tier 1 timings or the PageSpeed/CrUX API.
- **multi-page-crawl** — this run scores one page; site-wide issues need a sitemap crawl + aggregation.
- **offsite-citations** — who AI cites in your category; third-party, non-deterministic, not PR-fixable.
- **js-rendering** — Tier 1 headless render; today client-only content surfaces as `ssr-visibility`.

These never change `overall`, the pillars, or the categories.

---

## 7) Inconclusive (blocked / unreachable)

If the first fetch is blocked (HTTP 403/429/503, Cloudflare challenge markers, "just a moment",
suspiciously tiny body) or the network fails, the scraper returns an **inconclusive report**:
`fetch.blocked = true`, `overall = 0`, empty `checks`, and a single `summary.inconclusive` entry
explaining why. Per the honesty guardrail, a blocked fetch is reported as inconclusive, **never**
scored as a failure off a challenge page.

---

## 8) Multi-page (site) report

`scrapeSite(url)` returns a **`SiteReport`** instead of a single `ScoreReport`. **This is the
default**: the user provides only the homepage URL, and the scraper discovers up to 25 major
unique URLs of that same domain and audits all of them. Shape:

```jsonc
{
  "url", "origin", "fetchedAt", "durationMs", "rubricVersion",
  "crawl":    { source, totalDiscovered, pagesScraped, maxPages, sections, scrapedUrls[], skippedSample[] },
  "siteInfo": { name, description, language, logo, favicon, socialProfiles[], emails[], phones[],
                techStack[], schemaTypes[], pageTypes{}, hasSitemap, hasRobots, hasLlmsTxt,
                sitemapUrlCount, content{ totalWords, avgWordsPerPage, pagesWithStructuredData, pagesScored } },
  "overall": 0-100,                 // mean of per-page overall across readable pages
  "pillars":    { seo, geo, aeo },  // each = mean of per-page pillar scores
  "categories": { ...all 7... },    // each = mean of per-page category scores
  "checkRollup": [ { id, category, pillars, pass, partial, fail, inconclusive, notApplicable, failingUrls[] } ],
  "pages":      [ { url, finalUrl, ok, blocked, pageType, title, overall, pillars, report } ],  // report = full per-page ScoreReport
  "advisories": [ ... ],            // from the homepage, apply site-wide
  "summary":    { good[], bad[], missing[], inconclusive[] },  // site-wide rollup, one line per check
  "pillarSummary": { seo: {good[],bad[],missing[]}, geo: {...}, aeo: {...} },  // grouped by pillar
  "fixesRequired": [ { url, pageType, overall, fixes: [ {checkId, pillars, status, issue, fix, evidence, fixableByAgent} ] } ]
}
```

The site `summary` aggregates each check across all readable pages: a check that passes
everywhere lands in `good`; one that fails on every page lands in `missing`; one that fails or is
partial on some pages lands in `bad` with the page counts; a check that is only inconclusive or
not-applicable site-wide lands in `inconclusive`. Per-page good/bad/missing/inconclusive is still
available in full under each `pages[].report.summary`.

### Per-pillar summary + per-page fixes

Two extra views make the result actionable:

- **`pillarSummary`** regroups the same checks by pillar, so you get `seo / geo / aeo`, each with
  `good` (passes everywhere), `missing` (fails everywhere), and `bad` (mixed, with page counts).
  A check that belongs to two pillars (e.g. `structured-data` -> GEO + AEO) appears under both.
- **`fixesRequired`** is the actionable to-do list: one entry per page that has at least one
  `fail`/`partial`, sorted worst-first (most fixes, then lowest score). Each fix carries
  `{ checkId, pillars, status, issue, fix, evidence, fixableByAgent }`. The set of
  `fixableByAgent: true` fixes is exactly the bounded task list the fix agent would act on.

### Site profile (`siteInfo`)

A descriptive, non-scored profile of the site, derived from the pages we scraped (homepage
first). Every field is always present; unknowns are `null` or empty so the shape stays stable.

- **Identity:** `name` (JSON-LD Organization/WebSite name, else `og:site_name`, else `<title>`),
  `description`, `language` (`<html lang>`), `logo`, `favicon`.
- **Reach / contact:** `socialProfiles` (JSON-LD `sameAs` + recognized social links),
  `emails` (`mailto:`), `phones` (`tel:`).
- **Tech:** `techStack`, best-effort framework/CMS/CDN hints from headers + HTML
  (Next.js, Astro, WordPress, Shopify, Webflow, Gatsby, Nuxt, Cloudflare, Vercel, Netlify, ...).
- **Structure:** `schemaTypes` (all distinct JSON-LD `@type`s seen), `pageTypes` (count of pages
  by detected type), `hasSitemap` / `hasRobots` / `hasLlmsTxt`, `sitemapUrlCount` (site size).
- **Content:** `content.totalWords`, `avgWordsPerPage`, `pagesWithStructuredData`, `pagesScored`.

### Page type (`pages[].pageType`)

Each scraped page is classified deterministically into one of `article` | `listing` | `product`
| `documentation` | `generic`, using signals already parsed: JSON-LD `@type`
(`BlogPosting`/`Article` -> article, `Product`/`Offer` -> product, `Blog`/`CollectionPage` ->
listing), `og:type`, `article:*` meta, the URL section, and structure (single H1 + date + body).
This matters for the honesty rule in `RUBRIC.md`: informational/article pages have a higher AI
citation ceiling than transactional product/pricing pages, so the type sets expectations and is
never itself scored.

### Which pages get scraped (page discovery)

1. **Discover candidates.** Read `sitemap.xml` (expanding a sitemap-index). If there is no usable
   sitemap, fall back to same-origin links found on the homepage. If neither yields anything,
   scrape just the one page. The source is reported in `crawl.source`
   (`sitemap` / `sitemap-index` / `homepage-links` / `single`).
2. **Scan all of them.** By default there is no page cap: every unique, same-origin, non-asset URL
   is scraped. `crawl.scrapedUrls` lists every URL visited.
3. **Classify each page** into `article` / `listing` / `product` / `documentation` / `legal` /
   `utility` / `generic`. Counts are in `siteInfo.pageTypes`; each page's type is `pages[].pageType`.

### How many pages

The user provides **one** URL; the scraper finds and scans the rest, **all of them**. `maxPages`
and `maxPerSection` options still exist for callers who want to bound a very large site, but
default to unlimited. Domain files (robots/sitemap/llms.txt) are fetched **once** and shared;
the homepage fetch is reused; `concurrency` (default **8**) bounds parallel fetches.

### Page-type-aware applicability (why a Terms page no longer fails Answerability)

`answerability`, `definitions`, and `citation-quality` only apply to **answer-content** page
types (`article`, `listing`, `documentation`, `generic`). On a `legal` (privacy/terms/DPA) or
`utility` (contact/login/careers) page they return **`not-applicable`** and are dropped from the
denominator, never scored as a fail. This reflects the `RUBRIC.md` rule that page type sets a
ceiling.

### How site scores are computed

- `overall`, `pillars[*].score`, `categories[*].score` = the **mean** across pages, **only
  including pages where that pillar/category had applicable checks**. A page whose Answerability
  checks were all `not-applicable` is excluded from the Answerability mean, so legal/utility pages
  cannot drag it down.
- **Per-page scores**: every page carries `pages[].overall`, `pages[].pillars` (SEO/GEO/AEO),
  `pages[].pageType`, `pages[].title`, and the full `pages[].report`. The formatted report prints
  a per-page `overall | S.. G.. A..` line.
- `checkRollup` = per check ID, how many pages landed in each status, plus `failingUrls` (the
  exact pages where the check failed, the agent's site-wide fix list).
- Key stability: `pillars` always has all 3, `categories` always has all 7, and every
  `pages[].report` is a complete `ScoreReport` with the same guarantees as section 1.
