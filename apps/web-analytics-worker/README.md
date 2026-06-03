# web-analytics-worker

AI Search readiness scraper. Fetches a website, runs the deterministic GEO/AEO/SEO
checks from [`RUBRIC.md`](../../RUBRIC.md), and returns a 0 to 100 score per pillar plus a
per-check breakdown of what is good, bad, and missing. Fetch and scoring design lives in
[`scraper.md`](../../scraper.md).

## Run

You give it **one** website URL (the homepage). It discovers **every** unique URL of that same
domain (from the sitemap, falling back to homepage links) and analyzes all of them. A full site
audit is the default; there is no page cap.

```bash
bun install
bun run index.ts https://linkrunner.io           # full site audit (every discovered page) [default]
bun run index.ts https://linkrunner.io --page     # single-page report (only the URL given)
bun run index.ts https://linkrunner.io --json     # machine-readable (add to either)
```

## Single page vs whole site

- `scrapeSite(url)` -> `SiteReport` (**default**): from the one URL given, discovers every page
  (sitemap first, falling back to homepage links), scrapes them concurrently, classifies each by
  page type, and aggregates into one site score. Reports a per-page score breakdown.
- `startScraping(url)` -> `ScoreReport`: scores only the single page you give, with its page type.

## Page-type-aware scoring

Each page is classified (article / listing / product / documentation / legal / utility / generic).
Answer-content checks (`answerability`, `definitions`, `citation-quality`) only apply to content
pages (article, listing, documentation, generic). On a legal (privacy/terms) or utility
(contact/login) page they are marked `not-applicable` and **excluded from the denominator**, never
scored as a fail. Site-level pillar/category means only include pages where that check actually
applied, so a Terms page can't drag the site's Answerability score down.

## Layout

`index.ts` is just the entry point. All logic is in `scraper/`:

| File | Role |
|------|------|
| `scraper/index.ts` | `startScraping(url)` + `scrapeSite(url)` orchestrators + public exports |
| `scraper/fetcher.ts` | Tier 0 static fetch, block detector, robots/sitemap/llms.txt |
| `scraper/discover.ts` | sitemap/link page discovery + representative page selection |
| `scraper/parser.ts` | HTML to `PageModel` via Bun `HTMLRewriter` (no deps) |
| `scraper/twin.ts` | Markdown-twin probe (dualmark AEO spec) |
| `scraper/checks.ts` | One evaluator per canonical rubric check |
| `scraper/score.ts` | Weighted rollup into SEO/GEO/AEO + overall |
| `scraper/aggregate.ts` | Combine per-page reports into a site report |
| `scraper/format.ts` | Terminal report formatters (page + site) |
| `scraper/types.ts` | Shared types |

## How it scores

- Per check: `pass` = full weight, `partial` = half, `fail` = 0, `inconclusive` / `not-applicable`
  excluded from the denominator. `score = earned / applicable * 100`.
- Pillars (`scraper.md` section 3): GEO 0.40, AEO 0.35, SEO 0.25, renormalized over pillars that
  had applicable checks.
- ~20 checks are fully deterministic (header/DOM inspection). The four quality judgments
  (`answerability`, `definitions`, `citation-quality`, `freshness-eeat`) run as transparent
  heuristics here and say so in their `reason`; they are LLM-assisted in the real `@repo/checker`.
- A blocked or unreachable site returns an inconclusive report, never a fake low score.

## Advisory diagnostics (reported, never scored)

`report.advisories` surfaces signals a Tier 0 static reader cannot honestly score, so the report
is upfront about scope (per `RUBRIC.md` "Advisory, never scored" + `AGENTS.md` honesty rule):

- **Core Web Vitals / performance** (needs Tier 1 timings or the PageSpeed/CrUX API)
- **Multi-page (site-wide) audit** (needs a sitemap-driven crawl + aggregation)
- **Off-site citation placement** (third-party, non-deterministic, never fixable by a PR)
- **JavaScript-rendered content** (needs Tier 1 headless render)

These are listed with a status (`not-measured` / `planned` / `flag-only`), what would unlock them,
and any static hint already observed. They never affect `overall`, the pillars, or the categories.

> Scope: this is a Tier 0 (static) reader. It does not run a headless browser, so a JS-only SPA
> is reported as a likely `ssr-visibility` failure rather than rendered. See `scraper.md` for the
> planned Tier 1 (Playwright) escalation.
