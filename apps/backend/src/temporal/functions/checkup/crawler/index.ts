// Public entry point for the GEO/AEO readiness crawler.
//
// Two entry points:
//   checkPage(url) -> ScoreReport   single page (homepage), stable shape, cheapest.
//   checkSite(url) -> SiteReport    multi-page: discover key pages from the sitemap
//                                       (or homepage links), check a representative sample
//                                       concurrently, and aggregate into one site score.
//
// Tier 0 (static) only. See /RUBRIC.md (canonical checks) and /scraper.md (fetch + scoring).

import { detectBlock, fetchDomainFiles, rawFetch, type FetchOptions, type RawFetch } from "./fetcher.ts";
import { parsePage } from "./parser.ts";
import { probeTwin } from "./twin.ts";
import { runChecks } from "./checks.ts";
import { buildAdvisories } from "./advisories.ts";
import { discoverPages, urlsFromSitemap } from "./discover.ts";
import { aggregateSite, type ScoredPage } from "./aggregate.ts";
import { classifyPage } from "./pagetype.ts";
import {
  buildSummary,
  overallScore,
  scoreCategories,
  scorePillars,
} from "./score.ts";
import {
  CATEGORIES,
  type Category,
  type CategoryScore,
  type CheckContext,
  type DomainFiles,
  type ScoreReport,
  type SiteReport,
  type TwinProbe,
} from "./types.ts";
import type { CheckupPhase } from "../../../shared.ts";

export const RUBRIC_VERSION = "v1";

export type CheckupProgressSignal =
  | {
      type: "phase";
      phase: CheckupPhase;
      message: string;
      metadata?: unknown;
    }
  | {
      type: "pages_discovered";
      phase: "discovering_pages";
      pagesTotal: number;
      message: string;
      metadata?: unknown;
    }
  | {
      type: "page_started";
      phase: "scoring_pages";
      pageUrl: string;
      message: string;
    }
  | {
      type: "page_completed";
      phase: "scoring_pages";
      pageUrl: string;
      score: number;
      checksEvaluated: number;
      issuesFound: number;
      message: string;
    }
  | {
      type: "page_failed";
      phase: "scoring_pages";
      pageUrl: string;
      message: string;
    };

export interface CheckupOptions extends FetchOptions {
  /** Skip the Markdown-twin probe (saves 3 extra requests per page). Default false. */
  skipTwin?: boolean;
  progress?: (signal: CheckupProgressSignal) => Promise<void> | void;
}

export interface SiteCheckupOptions extends CheckupOptions {
  /** Hard cap on pages to score. Default Infinity (score every discovered page). */
  maxPages?: number;
  /** Max pages sampled per large section (e.g. /blog). Default Infinity (no per-section cap). */
  maxPerSection?: number;
  /** Max pages fetched at once. Default 8. */
  concurrency?: number;
}

function emptyCategories(): Record<Category, CategoryScore> {
  const out = {} as Record<Category, CategoryScore>;
  for (const cat of CATEGORIES) out[cat] = { score: 0, earned: 0, applicable: 0 };
  return out;
}

function emptyTwin(): TwinProbe {
  return {
    attempted: false,
    mdUrl: "",
    reachable: false,
    status: 0,
    contentTypeMarkdown: false,
    tokensHeader: false,
    noindex: false,
    varyAccept: false,
    nonEmptyBody: false,
    aeoVersion: false,
    nosniff: false,
    linkAlternate: false,
    acceptNegotiation: false,
    botUaNegotiation: false,
  };
}

function normalizeUrl(input: string): URL {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const u = new URL(raw); // throws on truly invalid input
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${u.protocol}`);
  }
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.endsWith(".local")) {
    throw new Error("Refusing to check localhost / .local hosts.");
  }
  return u;
}

function inconclusiveReport(
  requestedUrl: string,
  start: number,
  status: number,
  finalUrl: string,
  blockReason: string,
): ScoreReport {
  return {
    url: requestedUrl,
    finalUrl,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    rubricVersion: RUBRIC_VERSION,
    pageType: "generic",
    fetch: { requestedUrl, finalUrl, status, ok: false, blocked: true, blockReason, tier: "static" },
    overall: 0,
    pillars: {
      seo: { score: 0, earned: 0, applicable: 0, checks: 0 },
      geo: { score: 0, earned: 0, applicable: 0, checks: 0 },
      aeo: { score: 0, earned: 0, applicable: 0, checks: 0 },
    },
    categories: emptyCategories(),
    checks: [],
    advisories: [],
    summary: {
      good: [],
      bad: [],
      missing: [],
      inconclusive: [`fetch: Could not read the page (${blockReason}). Scored as inconclusive, not a failure.`],
    },
  };
}

/**
 * Score one already-fetched page using shared domain files. Internal helper so the multi-page
 * crawler can fetch robots/sitemap/llms.txt once and reuse them across every page.
 */
async function scorePage(
  requestedUrl: string,
  raw: RawFetch,
  domain: DomainFiles,
  start: number,
  options: CheckupOptions,
): Promise<ScoredPage> {
  const block = detectBlock(raw);
  if (block || !raw.ok) {
    return {
      report: inconclusiveReport(requestedUrl, start, raw.status, raw.finalUrl, block ?? `HTTP ${raw.status}`),
      page: null,
    };
  }

  const page = await parsePage(raw);
  const twin = options.skipTwin ? emptyTwin() : await probeTwin(page, options);
  const pageType = classifyPage(page);

  const ctx: CheckContext = { url: new URL(page.finalUrl), page, domain, twin, pageType };
  const checks = runChecks(ctx);
  const pillars = scorePillars(checks);

  return {
    report: {
      url: requestedUrl,
      finalUrl: page.finalUrl,
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      rubricVersion: RUBRIC_VERSION,
      pageType,
      fetch: {
        requestedUrl,
        finalUrl: page.finalUrl,
        status: page.status,
        ok: page.ok,
        blocked: false,
        blockReason: null,
        tier: "static",
      },
      overall: overallScore(pillars),
      pillars,
      categories: scoreCategories(checks),
      checks,
      advisories: buildAdvisories(ctx),
      summary: buildSummary(checks),
    },
    page,
  };
}

/**
 * Single-page checkup (homepage / the exact URL given). Never throws on network/parse problems:
 * those come back as an inconclusive report. Only throws for an invalid input URL.
 */
export async function checkPage(
  websiteUrl: string,
  options: CheckupOptions = {},
): Promise<ScoreReport> {
  const start = Date.now();
  const url = normalizeUrl(websiteUrl);

  await options.progress?.({
    type: "phase",
    phase: "fetching_homepage",
    message: "Fetching homepage.",
  });
  const raw = await rawFetch(url.toString(), options);
  if (detectBlock(raw) || !raw.ok) {
    const reason = detectBlock(raw) ?? `HTTP ${raw.status}`;
    return inconclusiveReport(url.toString(), start, raw.status, raw.finalUrl, reason);
  }

  await options.progress?.({
    type: "phase",
    phase: "reading_crawl_files",
    message: "Reading robots, sitemap, and llms.txt.",
  });
  const domain = await fetchDomainFiles(raw.finalUrl, options);
  return (await scorePage(url.toString(), raw, domain, start, options)).report;
}

/** Run async tasks with a bounded concurrency limit, preserving input order in the output. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Multi-page site checkup. Fetches the homepage, discovers key pages (sitemap first, falling back
 * to homepage links), scores a representative sample concurrently, and aggregates into a
 * SiteReport. Domain files (robots/sitemap/llms.txt) are fetched once and shared across pages.
 */
export async function checkSite(
  websiteUrl: string,
  options: SiteCheckupOptions = {},
): Promise<SiteReport> {
  const start = Date.now();
  const url = normalizeUrl(websiteUrl);
  const maxPages = options.maxPages ?? Infinity;
  const maxPerSection = options.maxPerSection ?? Infinity;
  const concurrency = options.concurrency ?? 8;

  // 1) Homepage + shared domain files.
  await options.progress?.({
    type: "phase",
    phase: "fetching_homepage",
    message: "Fetching homepage.",
  });
  const homepageRaw = await rawFetch(url.toString(), options);
  const homepageBlocked = detectBlock(homepageRaw) || !homepageRaw.ok;
  await options.progress?.({
    type: "phase",
    phase: "reading_crawl_files",
    message: "Reading robots, sitemap, and llms.txt.",
  });
  const domain = await fetchDomainFiles(
    homepageBlocked ? url.toString() : homepageRaw.finalUrl,
    options,
  );

  // If the homepage itself is unreadable, return a single inconclusive page (honest, no guessing).
  if (homepageBlocked) {
    const reason = detectBlock(homepageRaw) ?? `HTTP ${homepageRaw.status}`;
    const report = inconclusiveReport(url.toString(), start, homepageRaw.status, homepageRaw.finalUrl, reason);
    await options.progress?.({
      type: "pages_discovered",
      phase: "discovering_pages",
      pagesTotal: 1,
      message: "Homepage selected for scoring.",
    });
    await options.progress?.({
      type: "page_failed",
      phase: "scoring_pages",
      pageUrl: url.toString(),
      message: `Could not read homepage (${reason}).`,
    });
    await options.progress?.({
      type: "phase",
      phase: "aggregating_report",
      message: "Aggregating checkup report.",
    });
    return aggregateSite(
      url.toString(),
      domain,
      start,
      RUBRIC_VERSION,
      {
        source: "single",
        totalDiscovered: 1,
        pagesChecked: 1,
        maxPages,
        sections: {},
        checkedUrls: [url.toString()],
        skippedSample: [],
      },
      [{ report, page: null }],
    );
  }

  // 2) Discover candidate pages. Expand a sitemap-index if needed.
  await options.progress?.({
    type: "phase",
    phase: "discovering_pages",
    message: "Discovering representative pages.",
  });
  let sitemapUrls = domain.sitemap.urls;
  let sitemapSource: "sitemap" | "sitemap-index" | null = domain.sitemap.ok ? "sitemap" : null;
  if (domain.sitemap.isIndex || sitemapUrls.length === 0) {
    const expanded = await urlsFromSitemap(domain.origin, domain.sitemapUrl, options);
    if (expanded) {
      sitemapUrls = expanded.urls;
      sitemapSource = expanded.source;
    }
  }

  const discovery = await discoverPages(
    homepageRaw.finalUrl,
    homepageRaw.body,
    sitemapUrls,
    sitemapSource,
    { ...options, maxPages, maxPerSection },
  );
  await options.progress?.({
    type: "pages_discovered",
    phase: "discovering_pages",
    pagesTotal: discovery.selected.length,
    message: `${discovery.selected.length} page${discovery.selected.length === 1 ? "" : "s"} selected for scoring.`,
    metadata: {
      source: discovery.source,
      totalDiscovered: discovery.totalDiscovered,
      sections: discovery.sections,
    },
  });

  // 3) Score the selected pages. Reuse the homepage fetch for the first URL.
  await options.progress?.({
    type: "phase",
    phase: "scoring_pages",
    message: "Scoring selected pages.",
  });
  const homeFinal = homepageRaw.finalUrl;
  const scored = await mapWithConcurrency(discovery.selected, concurrency, async (pageUrl) => {
    const pageStart = Date.now();
    await options.progress?.({
      type: "page_started",
      phase: "scoring_pages",
      pageUrl,
      message: `Scoring ${pageUrl}`,
    });
    const result =
      pageUrl === homeFinal || pageUrl === url.toString()
        ? await scorePage(pageUrl, homepageRaw, domain, pageStart, options)
        : await scorePage(pageUrl, await rawFetch(pageUrl, options), domain, pageStart, options);
    const failed = result.report.fetch.blocked || !result.report.fetch.ok;
    if (failed) {
      await options.progress?.({
        type: "page_failed",
        phase: "scoring_pages",
        pageUrl,
        message: `Could not read ${pageUrl}.`,
      });
    } else {
      const issuesFound = result.report.checks.filter(
        (check) => check.status === "fail" || check.status === "partial"
      ).length;
      await options.progress?.({
        type: "page_completed",
        phase: "scoring_pages",
        pageUrl,
        score: result.report.overall,
        checksEvaluated: result.report.checks.length,
        issuesFound,
        message: `Finished ${pageUrl}.`,
      });
    }
    return result;
  });

  await options.progress?.({
    type: "phase",
    phase: "aggregating_report",
    message: "Aggregating checkup report.",
  });
  return aggregateSite(
    url.toString(),
    domain,
    start,
    RUBRIC_VERSION,
    {
      source: discovery.source,
      totalDiscovered: discovery.totalDiscovered,
      pagesChecked: scored.length,
      maxPages,
      sections: discovery.sections,
      checkedUrls: discovery.selected,
      skippedSample: discovery.skippedSample,
    },
    scored,
  );
}

export type { ScoreReport, SiteReport } from "./types.ts";
export { CHECK_REGISTRY } from "./checks.ts";
export { formatReport, formatSiteReport } from "./format.ts";
