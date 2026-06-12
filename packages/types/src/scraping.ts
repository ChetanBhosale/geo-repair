// Shared shapes for the scraping run, its result, and logs. The backend stores
// the full ScanResult JSON on Scraping.result; the frontend renders it.

export type ScrapingStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export type CheckStatus =
  | "SUCCESS"
  | "MID"
  | "FAILED"
  | "NOT_APPLICABLE"
  | "INCONCLUSIVE";

export interface AffectedPage {
  page: string;
  status: CheckStatus;
  issue: string;
  recommendation: string | null;
}

export interface SiteCheck {
  name: string;
  category: string;
  tier: string;
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
  recommendedAction: string;
  affectedPages: AffectedPage[];
}

export interface CategoryScore {
  score: number;
  status: CheckStatus;
  pointsEarned: number;
  pointsPossible: number;
}

export interface ScanResult {
  url: string;
  finalUrl: string;
  rubricVersion: string;
  status: "completed" | "failed";
  durationMs: number;
  brand: {
    name: string | null;
    faviconUrl: string | null;
    logoUrl: string | null;
  };
  repoMatch: {
    status: CheckStatus;
    confidence: number;
    matchedSignals: string[];
    recommendation: string | null;
  };
  score: {
    overall: number;
    status: CheckStatus;
    pointsEarned: number;
    pointsPossible: number;
    byCategory: Record<string, CategoryScore>;
  };
  crawl: {
    source: string;
    pagesDiscovered: number;
    pagesChecked: number;
    pagesFailed: number;
    sections: Record<string, number>;
  };
  checks: SiteCheck[];
  notes: string[];
  error: string | null;
}

export interface ScrapingLog {
  seq: number;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  createdAt: string;
}

export interface ScrapingSummary {
  id: string;
  projectId: string;
  status: ScrapingStatus;
  websiteUrl: string;
  score: number | null;
  scoreStatus: string | null;
  pagesChecked: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface ScrapingDetail extends ScrapingSummary {
  result: ScanResult | null;
  logs: ScrapingLog[];
}

export interface StartScanResponse {
  scraping: ScrapingSummary;
}

export interface ScrapingDetailResponse {
  scraping: ScrapingDetail;
}

export interface ListScrapingsResponse {
  scrapings: ScrapingSummary[];
}

export type WorkerService = "SCRAPING" | "AGENT";

// Thin cross-project "what's running" row for the live activity panel.
export interface WorkerStatusItem {
  id: string;
  service: WorkerService;
  status: ScrapingStatus;
  title: string | null;
  progress: number | null;
  error: string | null;
  projectId: string | null;
  scrapingId: string | null;
  temporalWorkflowId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface ListWorkerStatusResponse {
  workers: WorkerStatusItem[];
}

export interface WorkerStatusResponse {
  worker: WorkerStatusItem;
}
