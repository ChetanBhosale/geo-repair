import type { SiteReport } from "./functions/checkup/crawler";

// Task queues. Each maps to its own worker.
export const TASK_QUEUES = {
  checkup: "checkup",
  fixSite: "fix-site",
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];

// Free-checkup limit: refuse to re-check the same site more than this.
export const MAX_CHECKUPS_PER_SITE = 5;

export type CheckupRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | "timed_out";

export type CheckupPhase =
  | "queued"
  | "fetching_homepage"
  | "reading_crawl_files"
  | "discovering_pages"
  | "scoring_pages"
  | "aggregating_report"
  | "saving_report"
  | "completed"
  | "failed";

export interface RecentCheckupPage {
  url: string;
  status: "completed" | "failed";
  score?: number;
}

export interface CheckupProgressEvent {
  sequence: number;
  phase: CheckupPhase;
  type: string;
  message: string;
  pageUrl?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface CheckupProgress {
  workflowId: string;
  website: string;
  status: CheckupRunStatus;
  phase: CheckupPhase;
  percent: number;
  pagesTotal: number;
  pagesCompleted: number;
  pagesFailed: number;
  checksEvaluated: number;
  issuesFound: number;
  currentPageUrl: string | null;
  recentPages: RecentCheckupPage[];
  events: CheckupProgressEvent[];
  resultKey: string | null;
  error: string | null;
  updatedAt: string;
}

// Request metadata captured at the API boundary and persisted with the report.
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  referer?: string;
  origin?: string;
}

// checkup: evaluate a website's AI-search readiness.
export interface CheckupInput {
  workflowId: string;
  url: string;
  // Single page only (homepage). Default false = full-site checkup.
  singlePage?: boolean;
  // Where the request came from (for analytics / abuse tracking).
  meta?: RequestMeta;
}

// The full report is saved to the DB. The workflow only returns the
// row key + a tiny summary, so the multi-MB report never crosses Temporal's
// payload limit. Fetch the full report from /api/checkup-reports/:key.
export interface CheckupResult {
  key: string;
  website: string;
  websiteType: SiteReport["siteInfo"]["websiteType"];
  overall: number;
  pagesChecked: number;
}

// The full checkup report shape.
export type FullCheckupReport = SiteReport;

// fix-site: open a PR that fixes the failing checks.
// Everything is resolved server-side from a paid order. Never trust a client-supplied plan.
// The run does its own fresh full checkup, so the
// agent acts on every page, not just the sampled ones.
export interface FixSiteInput {
  // The site to fix (origin root). The fix run checks this authoritatively.
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
