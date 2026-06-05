// Shared types for the AI-search readiness crawler.
// Check IDs / categories / tiers are canonical in /RUBRIC.md (single source of truth).
// Pillar membership mirrors /scraper.md section 3.
//
// The report-facing types (Pillar, Category, Status, Tier, PageType, scores,
// findings, SiteReport, etc.) are the public output contract and live in
// `@repo/types/scraper`. We re-export them here so the scraper, backend, and
// frontend all share one definition. Only the scraper-internal types (parsed
// page model, domain files, twin probe, check context, single-page ScoreReport)
// are defined locally below.
export type {
  Pillar,
  Category,
  Status,
  Tier,
  PageType,
  PillarScore,
  CategoryScore,
  CrawlInfo,
  PageIndexEntry,
  FindingScope,
  RubricFindingPage,
  RubricFinding,
  AdvisoryStatus,
  AdvisoryItem,
  SiteInfo,
  WebsiteType,
  PillarSummary,
  SiteReport,
} from "@repo/types/scraper";

import type {
  Category,
  Pillar,
  PageType,
  Tier,
  Status,
  PillarScore,
  CategoryScore,
  AdvisoryItem,
} from "@repo/types/scraper";

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

export type Priority = "critical" | "high" | "medium" | "low";

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
