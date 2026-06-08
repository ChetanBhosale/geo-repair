import type {
  CheckCategory,
  CheckScope,
  CheckTier,
  Fixability,
} from "./check-intent";

// Per-check and overall status vocabulary.
export type CheckStatus =
  | "SUCCESS"
  | "MID"
  | "FAILED"
  | "NOT_APPLICABLE"
  | "INCONCLUSIVE";

// What the user should do about a check.
export type RecommendedAction =
  | "none"
  | "mark_up_existing"
  | "add_content"
  | "add_page"
  | "flag_only";

// One finished check in the output. Every check in check-intent always appears.
export interface CheckResultOut {
  name: string;
  category: CheckCategory;
  tier: CheckTier;
  scope: CheckScope;
  fixableByAgent: Fixability;
  weight: number;
  status: CheckStatus;
  pointsEarned: number;
  pointsPossible: number;
  summary: string;
  evidence: string | null;
  fixHint: string | null;
  recommendation: string | null;
  recommendedAction: RecommendedAction;
  // How the check was judged: deterministic markup, a heuristic, or AI.
  method: "deterministic" | "heuristic" | "ai";
}

export interface CategoryScoreOut {
  score: number;
  status: CheckStatus;
  pointsEarned: number;
  pointsPossible: number;
}

export interface RepoMatchOut {
  status: CheckStatus;
  confidence: number;
  method: "deterministic" | "ai" | "none";
  matchedSignals: string[];
  evidence: string | null;
  recommendation: string | null;
}

// One scanned page with its per-check results.
export interface PageReport {
  url: string;
  pageType: string;
  fetch: { status: number; ok: boolean; blocked: boolean; blockReason: string | null };
  score: { overall: number; status: CheckStatus; pointsEarned: number; pointsPossible: number };
  checks: CheckResultOut[];
}

// A page where a site-level check was not clean (the fix agent's targets).
export interface AffectedPage {
  page: string;
  status: CheckStatus;
  issue: string;
  recommendation: string | null;
}

// Site-level rollup of one check across all scanned pages.
export interface SiteCheck {
  name: string;
  category: CheckCategory;
  tier: CheckTier;
  scope: CheckScope;
  fixableByAgent: Fixability;
  weight: number;
  status: CheckStatus;
  pointsEarned: number;
  pointsPossible: number;
  applicablePages: number;
  counts: {
    success: number;
    mid: number;
    failed: number;
    notApplicable: number;
    inconclusive: number;
  };
  summary: string;
  recommendation: string | null;
  recommendedAction: RecommendedAction;
  affectedPages: AffectedPage[];
}

// One log line: what we checked, ordered, persistable.
export interface LogEntry {
  seq: number;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  page?: string;
  check?: string;
  status?: CheckStatus;
}

export interface ScrapeResult {
  url: string;
  finalUrl: string;
  rubricVersion: string;
  status: "completed" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;

  // Repo <-> website verification (the first activity). "none" when no repo given.
  repoMatch: RepoMatchOut;

  score: {
    overall: number;
    status: CheckStatus;
    pointsEarned: number;
    pointsPossible: number;
    byCategory: Record<CheckCategory, CategoryScoreOut>;
  };

  crawl: {
    source: string;
    pagesDiscovered: number;
    pagesChecked: number;
    pagesFailed: number;
    sections: Record<string, number>;
  };

  // Site-level rollup, one per check.
  checks: SiteCheck[];
  // What we checked, in order.
  logs: LogEntry[];
  notes: string[];
  error: string | null;
}

// What a single check evaluator returns before scoring metadata is attached.
export interface Verdict {
  status: CheckStatus;
  summary: string;
  evidence?: string | null;
  fixHint?: string | null;
  recommendation?: string | null;
  recommendedAction?: RecommendedAction;
  method?: "deterministic" | "heuristic" | "ai";
}

// Optional repo input for the repo-website-match activity.
export interface RepoInput {
  fullName: string;
  // Map of repo file path -> text content (a small curated set: configs, layout, etc.).
  files: Record<string, string>;
}
