/**
 * Scraper output types — the shape of the GEO/AEO readiness audit JSON produced
 * by the scrape-site worker (and stored in `ScrapeGeo.websiteScrapeData`).
 *
 * `SiteReport` is the top-level object. Shared by the backend (worker that
 * produces it), the frontend (renders it), and any future worker that consumes
 * it, so all three agree on one contract.
 *
 * Stability: every key on the report-level interfaces is REQUIRED. Unknown
 * values are `null` (or empty arrays), never missing keys, so the JSON shape is
 * stable. The optional (`?`) low-level parse types (MetaTag, PageModel, etc.)
 * are intentionally NOT part of this contract; they don't appear in SiteReport.
 *
 * Meanings: check IDs, categories, tiers, and weights are canonical in
 * /RUBRIC.md (single source of truth). Pillar membership mirrors /scraper.md.
 * Look there for what each check actually inspects and why it's scored.
 */

// The three scoring pillars. See /RUBRIC.md for what each rolls up.
// - seo: classic search hygiene
// - geo: Generative Engine Optimization (reachable/parseable by AI crawlers)
// - aeo: Answer Engine Optimization (extractable direct answers)
export type Pillar = "seo" | "geo" | "aeo";

// The 7 check categories. See /RUBRIC.md for the checks under each.
export type Category =
  | "Rendering"
  | "Structured data"
  | "Metadata"
  | "Crawl surface"
  | "Semantics"
  | "Content"
  | "Answerability";

// A check's status. pass = full weight, partial = half, fail = 0,
// inconclusive / not-applicable = excluded from the denominator.
export type Status = "pass" | "partial" | "fail" | "inconclusive" | "not-applicable";

// Capability tier from /RUBRIC.md: A = markup, B = derived content,
// C = net-new (gated, opt-in), out-of-scope = flag-only (never auto-fixed).
export type Tier = "A" | "B" | "C" | "out-of-scope";

// Coarse, deterministic page classification (drives which checks apply).
export type PageType =
  | "article"
  | "listing"
  | "product"
  | "documentation"
  | "legal"
  | "utility"
  | "generic";

// Score for one pillar (0-100), plus the raw earned/applicable breakdown.
export interface PillarScore {
  score: number;
  earned: number;
  applicable: number;
  checks: number;
}

// Score for one category (0-100), plus the raw earned/applicable breakdown.
export interface CategoryScore {
  score: number;
  earned: number;
  applicable: number;
}

// How the crawler discovered candidate pages and which it chose to scrape.
export interface CrawlInfo {
  source: "sitemap" | "sitemap-index" | "homepage-links" | "single";
  totalDiscovered: number;
  pagesScraped: number;
  maxPages: number;
  // Per-section candidate counts, e.g. { "/": 1, "/blog": 412 }.
  sections: Record<string, number>;
  scrapedUrls: string[];
  // A capped sample of candidate URLs we deliberately skipped.
  skippedSample: string[];
}

// Compact per-page index entry (no per-check detail). For the page-list UI.
// Per-check detail lives in `findings`.
export interface PageIndexEntry {
  url: string;
  finalUrl: string;
  ok: boolean;
  blocked: boolean;
  pageType: PageType;
  title: string | null;
  overall: number;
  pillars: Record<Pillar, PillarScore>;
}

// Where a check is fixed: one shared file/template (site-wide) vs route content.
export type FindingScope = "site-wide" | "per-page";

// One affected page under a finding (compact: status + evidence pointer).
export interface RubricFindingPage {
  url: string;
  status: Status;
  evidence: string | null;
}

/**
 * Rubric-centric finding: ONE record per check across the whole site, regardless
 * of page count. THE primary structure of a SiteReport and the direct input to
 * the fix agent's plan. A check failing on 1000 pages is a single finding with
 * `affectedCount: 1000` and a capped `pages` sample, so the report stays bounded.
 * See /RUBRIC.md for what each check `id` means.
 */
export interface RubricFinding {
  id: string;
  category: Category;
  pillars: Pillar[];
  tier: Tier;
  fixableByAgent: boolean;
  weight: number;
  scope: FindingScope;
  // Roll-up across the site. `mixed` = some pages pass, some fail/partial.
  siteStatus: "pass" | "partial" | "fail" | "mixed" | "not-applicable";
  counts: {
    pass: number;
    partial: number;
    fail: number;
    inconclusive: number;
    notApplicable: number;
  };
  // Exact total of failed/partial pages, even when `pages` is a capped sample.
  affectedCount: number;
  // First offending file/route — the agent's starting clue for a fix.
  representativeEvidence: string | null;
  // Capped sample of affected pages (fail/partial), each with an evidence pointer.
  pages: RubricFindingPage[];
  // Fix tracking. Starts false for actionable findings (fail/partial/mixed); the
  // fix agent flips it true and writes a short fixNote when the check is fixed.
  fixed: boolean;
  fixNote: string | null;
}

// Advisory diagnostics: surfaced but NEVER folded into the 0-100 score (CWV,
// off-site citations, Tier-1 signals). See /RUBRIC.md "Advisory, never scored".
export type AdvisoryStatus = "not-measured" | "planned" | "flag-only";

export interface AdvisoryItem {
  id: string;
  label: string;
  status: AdvisoryStatus;
  detail: string;
  // What unlocks it (e.g. "Tier 1 Playwright"); null when none.
  needs: string | null;
  // Anything observable statically that hints at the answer; null when none.
  observed: string | null;
}

// Descriptive profile of the site (identity, tech, contacts, page mix, content).
// Every field is always present; unknowns are null/empty for a stable shape.
export interface SiteInfo {
  name: string | null;
  description: string | null;
  language: string | null;
  logo: string | null;
  favicon: string | null;
  socialProfiles: string[];
  emails: string[];
  phones: string[];
  // Detected tech / framework hints (e.g. "Next.js", "WordPress", "Cloudflare").
  techStack: string[];
  // Distinct JSON-LD @types seen across scraped pages.
  schemaTypes: string[];
  pageTypes: Record<PageType, number>;
  hasSitemap: boolean;
  hasRobots: boolean;
  hasLlmsTxt: boolean;
  sitemapUrlCount: number;
  content: {
    totalWords: number;
    avgWordsPerPage: number;
    pagesWithStructuredData: number;
    pagesScored: number;
  };
}

// Good/bad/missing rollup, one line per check (for the summary lists).
export interface PillarSummary {
  good: string[];
  bad: string[];
  missing: string[];
}

/**
 * Site-level audit report (rubric-centric). The top-level scraper output and the
 * value stored in `ScrapeGeo.websiteScrapeData`. Bounded regardless of page
 * count: ~one `findings` record per check + a compact `pageIndex`.
 */
export interface SiteReport {
  url: string;
  origin: string;
  fetchedAt: string;
  durationMs: number;
  // Rubric version (e.g. "v1") so a re-check can't disagree with what was sold.
  rubricVersion: string;
  crawl: CrawlInfo;
  siteInfo: SiteInfo;
  // Site score 0-100 (mean of readable pages).
  overall: number;
  pillars: Record<Pillar, PillarScore>;
  categories: Record<Category, CategoryScore>;
  // THE primary structure: one finding per check across the whole site.
  findings: RubricFinding[];
  // Compact per-page index for the page-list UI and pagination.
  pageIndex: PageIndexEntry[];
  // Signals surfaced but never scored.
  advisories: AdvisoryItem[];
  summary: {
    good: string[];
    bad: string[];
    missing: string[];
    inconclusive: string[];
  };
  // Good/bad/missing grouped by pillar (SEO / GEO / AEO).
  pillarSummary: Record<Pillar, PillarSummary>;
}
