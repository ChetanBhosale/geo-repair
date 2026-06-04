// Shared types for the GEO/AEO readiness scraper.
// Check IDs / categories / tiers are canonical in /RUBRIC.md (single source of truth).
// Pillar membership mirrors /scraper.md section 3.

export type Pillar = "seo" | "geo" | "aeo";

export type Category =
  | "Rendering"
  | "Structured data"
  | "Metadata"
  | "Crawl surface"
  | "Semantics"
  | "Content"
  | "Answerability";

/** Canonical, ordered list of all categories. The report always emits every one of these keys. */
export const CATEGORIES: Category[] = [
  "Rendering",
  "Structured data",
  "Metadata",
  "Crawl surface",
  "Semantics",
  "Content",
  "Answerability",
];

/** Canonical, ordered list of pillars. */
export const PILLARS: Pillar[] = ["seo", "geo", "aeo"];

/** pass = full weight, partial = half, fail = 0, inconclusive/not-applicable = excluded from denominator. */
export type Status = "pass" | "partial" | "fail" | "inconclusive" | "not-applicable";

/** Capability tier from RUBRIC.md: A markup, B derived content, C net-new (gated), out-of-scope flag-only. */
export type Tier = "A" | "B" | "C" | "out-of-scope";

export type Priority = "critical" | "high" | "medium" | "low";

/**
 * Coarse page classification (deterministic, from schema/og/url/structure).
 * - article: blog post / news / guide article
 * - listing: index/collection page (blog index, glossary index)
 * - documentation: docs / reference
 * - product: product / pricing / features (transactional, citation ceiling)
 * - legal: privacy / terms / DPA / cookie / opt-in-out (not answer content)
 * - utility: contact / login / signup / careers / search (not answer content)
 * - generic: homepage / about / everything else
 */
export type PageType =
  | "article"
  | "listing"
  | "product"
  | "documentation"
  | "legal"
  | "utility"
  | "generic";

/** All page types in a stable order. */
export const PAGE_TYPES: PageType[] = [
  "article",
  "listing",
  "product",
  "documentation",
  "legal",
  "utility",
  "generic",
];

export interface CheckResult {
  id: string;
  category: Category;
  pillars: Pillar[];
  tier: Tier;
  fixableByAgent: boolean;
  weight: number;
  status: Status;
  /** Why this check earned its status. Plain language, no em dashes (may surface to customers). */
  reason: string;
  /** What is good on the page for this check. */
  good: string[];
  /** What is missing or wrong for this check. */
  bad: string[];
  /** The exact offending file/route/snippet, the fix agent's starting clue. null when none. */
  evidence: string | null;
  /** Advisory what-to-do. null when none. */
  fixHint: string | null;
}

// --- Parsed page model ------------------------------------------------------

export interface MetaTag {
  name?: string;
  property?: string;
  httpEquiv?: string;
  content?: string;
  charset?: string;
}

export interface LinkTag {
  rel?: string;
  href?: string;
  type?: string;
  hreflang?: string;
  sizes?: string;
}

export interface Heading {
  level: number;
  text: string;
}

export interface Anchor {
  href: string;
  text: string;
  rel?: string;
  ariaLabel?: string;
  title?: string;
  hasImg: boolean;
  imgAlt?: string;
}

export interface ImageTag {
  src?: string;
  alt?: string | null;
  role?: string;
  ariaHidden: boolean;
}

export interface Interactive {
  tag: "a" | "button" | "input" | "select" | "textarea";
  type?: string;
  accessibleName: string | null;
  role?: string;
  ariaHidden: boolean;
  disabled: boolean;
}

export interface JsonLdBlock {
  raw: string;
  valid: boolean;
  types: string[];
  error?: string;
}

export interface PageModel {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string;
  headers: Record<string, string>;
  rawHtml: string;
  htmlByteLength: number;

  hasDoctype: boolean;
  charsetEarly: boolean;
  charsetValue: string | null;
  htmlLang: string | null;

  /** <meta name="viewport"> content, or null if absent. */
  viewport: string | null;
  /** viewport is present and responsive (has width=device-width). */
  viewportResponsive: boolean;

  title: string | null;
  metas: MetaTag[];
  links: LinkTag[];
  canonical: string | null;
  metaRobots: string | null;
  xRobotsTag: string | null;

  jsonLd: JsonLdBlock[];
  headings: Heading[];
  anchors: Anchor[];
  images: ImageTag[];
  interactives: Interactive[];
  landmarks: { header: boolean; nav: boolean; main: boolean; footer: boolean };
  labelFor: Set<string>;

  visibleText: string;
  wordCount: number;
  scriptCount: number;
  spaRootDetected: boolean;
  noscriptText: string;

  /** Convenience lookup of og and twitter metas plus name'd metas, keyed lowercase. */
  metaByKey: Map<string, string>;
}

// --- Domain-level files -----------------------------------------------------

export interface RobotsInfo {
  fetched: boolean;
  status: number;
  content: string;
  sitemaps: string[];
  blocksGooglebot: boolean;
  /** Per AI crawler: is it disallowed at the site root. */
  aiCrawlerRules: { agent: string; blocked: boolean }[];
}

export interface SitemapInfo {
  fetched: boolean;
  status: number;
  ok: boolean;
  isXml: boolean;
  isIndex: boolean;
  urlCount: number;
  referencedInRobots: boolean;
  /** Page URLs extracted from the sitemap (capped). Used to seed multi-page discovery. */
  urls: string[];
}

export interface LlmsTxtInfo {
  fetched: boolean;
  status: number;
  ok: boolean;
  nonEmpty: boolean;
  hasLinks: boolean;
}

export interface DomainFiles {
  origin: string;
  /** The sitemap URL we resolved (from robots.txt or the conventional path). */
  sitemapUrl: string;
  robots: RobotsInfo;
  sitemap: SitemapInfo;
  llmsTxt: LlmsTxtInfo;
}

// --- Markdown twin (dualmark spec) probe ------------------------------------

export interface TwinProbe {
  attempted: boolean;
  mdUrl: string;
  reachable: boolean; // md.fetch
  status: number;
  contentTypeMarkdown: boolean; // md.contentType
  tokensHeader: boolean; // md.tokensHeader
  noindex: boolean; // md.noindex
  varyAccept: boolean; // md.vary
  nonEmptyBody: boolean; // md.body
  aeoVersion: boolean; // md.aeoVersion
  nosniff: boolean; // md.nosniff
  linkAlternate: boolean; // html.linkAlternate
  acceptNegotiation: boolean; // negotiation.acceptHeader
  botUaNegotiation: boolean; // negotiation.botUa
  error?: string;
}

// --- Check context + final report ------------------------------------------

export interface CheckContext {
  url: URL;
  page: PageModel;
  domain: DomainFiles;
  twin: TwinProbe;
  /** Deterministic page classification, drives per-check applicability. */
  pageType: PageType;
}

export interface PillarScore {
  score: number; // 0-100
  earned: number;
  applicable: number;
  checks: number; // count of applicable checks
}

export interface CategoryScore {
  score: number;
  earned: number;
  applicable: number;
}

export interface FetchInfo {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  blocked: boolean;
  /** Reason the fetch was blocked/failed; null on a successful fetch. */
  blockReason: string | null;
  tier: "static";
}

/**
 * Advisory diagnostics: signals we surface but do NOT fold into the 0-100 score, because a
 * Tier 0 static reader cannot measure them deterministically (or they are out of the agent's
 * safe-fix scope). Mirrors RUBRIC.md "Advisory, never scored" + "Agentic readiness". Each one
 * tells the user what is not covered yet and how it would be fixed/measured later.
 */
export type AdvisoryStatus =
  | "not-measured" // measurable, but needs infra we have not built (e.g. Tier 1 / an API)
  | "planned" // on the roadmap (scraper.md / RUBRIC.md), not built yet
  | "flag-only"; // measured-elsewhere concept the agent must never auto-fix (CSS/layout)

export interface AdvisoryItem {
  id: string;
  label: string;
  status: AdvisoryStatus;
  /** Why it is not in the score yet. Plain language, no em dashes. */
  detail: string;
  /** What unlocks it (e.g. "Tier 1 Playwright", "PageSpeed/CrUX API", "sitemap crawl"). null when none. */
  needs: string | null;
  /** Anything we could already observe statically that hints at the answer. null when none. */
  observed: string | null;
}

export interface ScoreReport {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  durationMs: number;
  rubricVersion: string;
  /** Deterministic classification of this page (drives which checks apply). */
  pageType: PageType;
  fetch: FetchInfo;
  overall: number;
  pillars: Record<Pillar, PillarScore>;
  /** Always contains all categories; a category with no applicable checks scores 0. */
  categories: Record<Category, CategoryScore>;
  checks: CheckResult[];
  /** Signals surfaced but never folded into the score (CWV, multi-page, off-site citations, Tier 1). */
  advisories: AdvisoryItem[];
  summary: {
    good: string[];
    bad: string[];
    missing: string[];
    inconclusive: string[];
  };
}

// --- Multi-page (site-level) report ----------------------------------------

/** How the crawler discovered candidate pages and which it chose to scrape. */
export interface CrawlInfo {
  /** Where candidate URLs came from. */
  source: "sitemap" | "sitemap-index" | "homepage-links" | "single";
  /** Total candidate URLs discovered before selection. */
  totalDiscovered: number;
  /** How many pages we actually scraped. */
  pagesScraped: number;
  /** The cap that was applied. */
  maxPages: number;
  /** Per-section candidate counts, e.g. { "/": 1, "/blog": 412, "/pricing": 1 }. */
  sections: Record<string, number>;
  /** Every URL we scraped, in priority order (homepage first). */
  scrapedUrls: string[];
  /** A capped sample of candidate URLs we deliberately skipped (e.g. extra blog posts). */
  skippedSample: string[];
}

/**
 * Compact per-page index entry for a site report. Cheap to render a page list and paginate;
 * it carries NO per-check detail (that lives in the rubric-centric `findings`, keyed by page
 * URL). This is what replaces the old heavy `PageEntry.report` explosion.
 */
export interface PageIndexEntry {
  url: string;
  finalUrl: string;
  ok: boolean;
  blocked: boolean;
  /** Coarse classification of the page (article, listing, product, documentation, generic). */
  pageType: PageType;
  /** Page title, when present. */
  title: string | null;
  overall: number;
  pillars: Record<Pillar, PillarScore>;
}

/** Where a check is fixed: one shared file/template (site-wide) vs route-specific content (per-page). */
export type FindingScope = "site-wide" | "per-page";

/** One affected page under a rubric finding (compact: status + the agent's evidence pointer). */
export interface RubricFindingPage {
  url: string;
  status: Status;
  evidence: string | null;
}

/**
 * Rubric-centric finding: ONE record per check across the whole site, regardless of page count.
 * The primary unit of a SiteReport — it replaces the per-page check explosion. A check failing
 * on 1000 pages is a single finding with `affectedCount: 1000` and a capped `pages` sample, so
 * the report stays bounded (~23 findings) at any scale and maps straight onto the agent's fix plan.
 */
export interface RubricFinding {
  id: string;
  category: Category;
  pillars: Pillar[];
  tier: Tier;
  fixableByAgent: boolean;
  weight: number;
  /** site-wide (fix one shared file/template) vs per-page (route-specific content). */
  scope: FindingScope;
  /** Roll-up of this check across the site. `mixed` = some pass and some fail/partial. */
  siteStatus: "pass" | "partial" | "fail" | "mixed" | "not-applicable";
  /** Page counts by status for this check across all readable pages. */
  counts: {
    pass: number;
    partial: number;
    fail: number;
    inconclusive: number;
    notApplicable: number;
  };
  /** Total pages where this check failed or was partial (exact, even when `pages` is a sample). */
  affectedCount: number;
  /** First/representative offending file or route — the agent's starting clue for a site-wide fix. */
  representativeEvidence: string | null;
  /** Capped sample of affected (fail/partial) pages, each with the agent's evidence pointer. */
  pages: RubricFindingPage[];
}

/**
 * Site-level descriptive profile: who the site is and what it is built with, derived from the
 * pages we scraped (homepage-first). Every field is always present; unknowns are null/empty so
 * the JSON shape is stable.
 */
export interface SiteInfo {
  /** Organization / site name (from JSON-LD Organization/WebSite, og:site_name, or <title>). */
  name: string | null;
  /** Site description (homepage meta description or og:description). */
  description: string | null;
  /** Primary language from <html lang>. */
  language: string | null;
  /** Logo URL (JSON-LD Organization.logo or apple-touch-icon/icon). */
  logo: string | null;
  /** Favicon URL when discoverable. */
  favicon: string | null;
  /** Social profile URLs found (JSON-LD sameAs + footer/social links). */
  socialProfiles: string[];
  /** Contact emails found in mailto: links. */
  emails: string[];
  /** Contact phone numbers found in tel: links. */
  phones: string[];
  /** Detected tech / framework hints (e.g. "Next.js", "WordPress", "Cloudflare"). */
  techStack: string[];
  /** All distinct JSON-LD @types seen across scraped pages. */
  schemaTypes: string[];
  /** Count of pages by detected type. */
  pageTypes: Record<PageType, number>;
  /** Whether key crawl files exist. */
  hasSitemap: boolean;
  hasRobots: boolean;
  hasLlmsTxt: boolean;
  /** Total URLs the sitemap exposed (site size signal), 0 if unknown. */
  sitemapUrlCount: number;
  /** Aggregate content stats across readable scraped pages. */
  content: {
    totalWords: number;
    avgWordsPerPage: number;
    pagesWithStructuredData: number;
    pagesScored: number;
  };
}

/** Per-pillar good/bad rollup across the site (one line per check). */
export interface PillarSummary {
  /** Checks passing on every applicable page. */
  good: string[];
  /** Checks failing or partial on some pages (with counts). */
  bad: string[];
  /** Checks missing/failing on every applicable page. */
  missing: string[];
}

/**
 * Site-level report (rubric-centric): aggregates several page scrapes into one site score plus
 * ~23 per-check `findings`. The heavy per-page detail is intentionally NOT retained — `pageIndex`
 * is a compact list and per-check status lives inside each finding's `pages` sample.
 */
export interface SiteReport {
  url: string;
  origin: string;
  fetchedAt: string;
  durationMs: number;
  rubricVersion: string;
  crawl: CrawlInfo;
  /** Descriptive profile of the site (identity, tech, contacts, page mix, content stats). */
  siteInfo: SiteInfo;
  /** Site overall = mean of per-page overalls (pages that were readable). */
  overall: number;
  /** Site pillars = mean of per-page pillar scores across readable pages. */
  pillars: Record<Pillar, PillarScore>;
  /** Site categories = mean of per-page category scores across readable pages. */
  categories: Record<Category, CategoryScore>;
  /**
   * Rubric-centric findings: one per check (~23) across the whole site. THE primary structure —
   * bounded regardless of page count, and the direct input to the agent's fix plan. Replaces the
   * old `checkRollup` + per-page `pages[].report` + `fixesRequired`.
   */
  findings: RubricFinding[];
  /** Compact per-page index (no per-check detail) for the page-list UI and pagination. */
  pageIndex: PageIndexEntry[];
  /** Advisories from the homepage scrape (apply site-wide). */
  advisories: AdvisoryItem[];
  /** Site-wide good/bad/missing/inconclusive rollup, one line per check across all pages. */
  summary: {
    good: string[];
    bad: string[];
    missing: string[];
    inconclusive: string[];
  };
  /** Good/bad/missing grouped by pillar (SEO / GEO / AEO). */
  pillarSummary: Record<Pillar, PillarSummary>;
}

