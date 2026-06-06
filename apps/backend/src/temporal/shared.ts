import type { SiteReport } from "./functions/checkup/crawler";
import type { FixRunIntake } from "@repo/types/fix";

// Task queues. Each maps to its own worker.
export const TASK_QUEUES = {
  checkup: "checkup",
  fixSite: "fix-site",
  fixChat: "fix-chat",
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];

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
// Everything is resolved server-side from the authed user's selected repo — never
// trust a client-supplied plan. The run does its own FRESH full scan, so the
// agent acts on every page, not just the sampled ones.
export interface FixSiteInput {
  // Our FixRun row id (the workflow updates it as it progresses).
  fixRunId: string;
  // The site to fix (origin root). The fix run re-scans this authoritatively.
  website: string;
  // The GitHub repo that builds the site, e.g. "owner/repo".
  repoFullName: string;
  // Clone URL of the repo.
  cloneUrl: string;
  // Default branch to open the PR against.
  defaultBranch: string;
  // The user who owns this run (to resolve their GitHub token).
  userId: string;
  // Structured clarification answers requested by the fix workflow.
  intake?: FixRunIntake;
}

export interface FixSiteResult {
  prUrl: string;
  prNumber: number;
  fixedChecks: number;
  totalChecks: number;
}

// fix-chat: an open-ended follow-up turn after the PR is open. The agent reopens
// a sandbox on the run's existing fix branch, applies the user's request, and
// pushes to the same branch so the existing PR updates in place.
export interface FixChatInput {
  fixRunId: string;
  userId: string;
  // The user's message to the agent.
  content: string;
  website: string;
  repoFullName: string;
  cloneUrl: string;
  defaultBranch: string;
  // The existing fix branch the PR tracks (e.g. "geo-repair/fix-xxxxxxxx").
  branch: string;
  // Whether the PR was opened from a fork (push target for the follow-up).
  prViaFork: boolean;
}
