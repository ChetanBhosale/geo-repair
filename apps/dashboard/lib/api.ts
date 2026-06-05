import type { SiteReport } from "@repo/types/scraper"
import type {
  GithubRepo,
  ListReposResponse,
  SavedRepository,
  SelectRepoRequest,
  SelectRepoResponse,
  ListSavedReposResponse,
} from "@repo/types/github"
import type { User } from "@repo/types/user"
import type {
  FixRunSummary,
  FixRunDetail,
  FixRunIntake,
  StartFixResponse,
} from "@repo/types/fix"
import type {
  BillingHistoryResponse,
  BillingInvoiceDetail,
} from "@repo/types/billing"
import type {
  GenerateReportsResponse,
  ListReportsResponse,
  ProjectReportDetail,
  ProjectReportSummary,
  ReportDetailResponse,
  ReportShareResponse,
} from "@repo/types/reports"
import { ENDPOINTS } from "@/lib/endpoint"

// POST /api/audit response
export interface CreateAuditResponse {
  temporalId: string
  website: string
}

// GET /api/temporal-status/:id response (discriminated by `status`)
export type TemporalStatus =
  | { status: "RUNNING" | "PENDING" }
  | { status: "COMPLETED"; result: AuditSummary }
  | {
      status: "FAILED" | "TERMINATED" | "CANCELED" | "TIMED_OUT"
      error: string
    }
  | { status: "NOT_FOUND" }

// Small summary returned by the workflow (full report lives in the DB).
export interface AuditSummary {
  key: string
  website: string
  overall: number
  pagesScraped: number
}

// GET /api/audit-result/:key response (the full saved report)
export interface AuditResultResponse {
  key: string
  website: string
  totalScrapeCount: number
  report: SiteReport | null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    // Cookie session: always send/receive the auth cookie.
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`
    )
  }
  return body as T
}

export function createAudit(
  url: string,
  singlePage = false
): Promise<CreateAuditResponse> {
  return request<CreateAuditResponse>(ENDPOINTS.audit, {
    method: "POST",
    body: JSON.stringify({ url, singlePage }),
  })
}

export function getTemporalStatus(temporalId: string): Promise<TemporalStatus> {
  return request<TemporalStatus>(ENDPOINTS.temporalStatus(temporalId))
}

export function getAuditResult(key: string): Promise<AuditResultResponse> {
  return request<AuditResultResponse>(ENDPOINTS.auditResult(key))
}

// --- Auth ---

export function getMe(): Promise<{ user: User }> {
  return request<{ user: User }>(ENDPOINTS.me)
}

export function logout(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(ENDPOINTS.logout, { method: "POST" })
}

// --- GitHub ---

export async function getRepos(): Promise<GithubRepo[]> {
  const data = await request<ListReposResponse>(ENDPOINTS.repos)
  return data.repos
}

export async function getSavedRepos(): Promise<SavedRepository[]> {
  const data = await request<ListSavedReposResponse>(ENDPOINTS.savedRepos)
  return data.repositories
}

export async function selectRepo(
  payload: SelectRepoRequest
): Promise<SavedRepository> {
  const data = await request<SelectRepoResponse>(ENDPOINTS.selectRepo, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return data.repository
}

// --- Fix runs (premium) ---

export function startFix(
  website: string,
  repositoryId: string,
  intake?: FixRunIntake
): Promise<StartFixResponse> {
  return request<StartFixResponse>(ENDPOINTS.fix, {
    method: "POST",
    body: JSON.stringify({ website, repositoryId, intake }),
  })
}

export async function getFixRuns(): Promise<FixRunSummary[]> {
  const data = await request<{ runs: FixRunSummary[] }>(ENDPOINTS.fixRuns)
  return data.runs
}

export function getFixRun(id: string): Promise<FixRunDetail> {
  return request<FixRunDetail>(ENDPOINTS.fixRun(id))
}

// --- Reports ---

export async function getReports(): Promise<ProjectReportSummary[]> {
  const data = await request<ListReportsResponse>(ENDPOINTS.reports)
  return data.reports
}

export async function generateReports(): Promise<ProjectReportSummary[]> {
  const data = await request<GenerateReportsResponse>(
    ENDPOINTS.generateReports,
    {
      method: "POST",
    }
  )
  return data.reports
}

export async function getReport(id: string): Promise<ProjectReportDetail> {
  const data = await request<ReportDetailResponse>(ENDPOINTS.report(id))
  return data.report
}

export async function getSharedReport(
  token: string
): Promise<ProjectReportDetail> {
  const data = await request<ReportDetailResponse>(
    ENDPOINTS.sharedReport(token)
  )
  return data.report
}

export async function createReportShareLink(
  id: string
): Promise<ReportShareResponse["share"]> {
  const data = await request<ReportShareResponse>(ENDPOINTS.reportShare(id), {
    method: "POST",
  })
  return data.share
}

export function revokeReportShareLink(id: string): Promise<void> {
  return request<void>(ENDPOINTS.reportShare(id), { method: "DELETE" })
}

// --- Billing ---

export function getBillingHistory(): Promise<BillingHistoryResponse> {
  return request<BillingHistoryResponse>(ENDPOINTS.billingHistory)
}

export async function getBillingInvoice(
  orderId: string
): Promise<BillingInvoiceDetail> {
  const data = await request<{ invoice: BillingInvoiceDetail }>(
    ENDPOINTS.billingInvoice(orderId)
  )
  return data.invoice
}
