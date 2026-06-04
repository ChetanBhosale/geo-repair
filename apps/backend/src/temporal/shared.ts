import type { SiteReport } from "./functions/scrape-site/scraper";

// Task queues. Each maps to its own worker.
export const TASK_QUEUES = {
  scrapeSite: "scrape-site",
  fixSite: "fix-site",
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];

// Free-checkup limit: refuse to re-audit the same site more than this.
export const MAX_SCRAPES_PER_SITE = 5;

// Request metadata captured at the API boundary, persisted with the audit.
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  referer?: string;
  origin?: string;
}

// scrape-site: audit a website's AI-search readiness.
export interface ScrapeSiteInput {
  url: string;
  // Single page only (homepage). Default false = full-site audit.
  singlePage?: boolean;
  // Where the request came from (for analytics / abuse tracking).
  meta?: RequestMeta;
}

// The full report is saved to the DB (ScrapeGeo). The workflow only returns the
// row key + a tiny summary, so the multi-MB report never crosses Temporal's
// payload limit. Fetch the full report from /api/audit-result/:key.
export interface ScrapeSiteResult {
  key: string;
  website: string;
  overall: number;
  pagesScraped: number;
}

// The full audit report shape (what's stored in ScrapeGeo.websiteScrapeData).
export type FullAuditReport = SiteReport;

// fix-site: open a PR that fixes the failing checks.
// Everything is resolved server-side from a paid order — never trust a client-supplied plan.
// The run does its own FRESH full scan (the free checkup's sample only drove the quote), so the
// agent acts on every page, not just the sampled ones.
export interface FixSiteInput {
  // The site to fix (origin root). The fix run re-scans this authoritatively.
  website: string;
  // The GitHub repo that builds the site, e.g. "owner/repo".
  repoFullName: string;
  // Default branch to open the PR against; read from run metadata (do not assume "main").
  defaultBranch?: string;
  // The paid order this run belongs to (for COGS/billing reconciliation).
  orderId?: string;
}

export interface FixSiteResult {
  prUrl: string;
}
