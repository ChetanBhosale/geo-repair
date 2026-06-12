import { ENDPOINTS } from "@/lib/endpoint"
import type {
  CreateProjectRequest,
  ListAccountsResponse,
  ListProjectsResponse,
  Project,
  ProjectResponse,
} from "@repo/types/project"
import type { ListReposResponse, GithubRepo } from "@repo/types/github"
import type {
  ListScrapingsResponse,
  ListWorkerStatusResponse,
  ScrapingDetail,
  ScrapingDetailResponse,
  ScrapingSummary,
  StartScanResponse,
  WorkerStatusItem,
  WorkerStatusResponse,
} from "@repo/types/scraping"
import type {
  AgentRunDetail,
  AgentRunDetailResponse,
  AgentRunSummary,
  AgentPlanAnswer,
  ChatResponse,
  CompleteRunResponse,
  ListAgentRunsResponse,
  StartAgentPlanResponse,
  StartFixResponse,
} from "@repo/types/agent"
import type {
  FeatureInterestResponse,
  FeatureInterestState,
} from "@repo/types/feature-interest"

export interface AuthUser {
  id: string
  email: string | null
  name: string | null
  username: string | null
  avatarUrl: string | null
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

export function getMe(): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>(ENDPOINTS.me)
}

export function logout(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(ENDPOINTS.logout, { method: "POST" })
}

// --- Feature interests ---

export async function getAiVisibilityInterest(): Promise<FeatureInterestState> {
  const data = await request<FeatureInterestResponse>(
    ENDPOINTS.aiVisibilityInterest
  )
  return data.interest
}

export async function markAiVisibilityInterest(): Promise<FeatureInterestState> {
  const data = await request<FeatureInterestResponse>(
    ENDPOINTS.aiVisibilityInterest,
    { method: "POST" }
  )
  return data.interest
}

// --- Accounts (linked providers) ---

export async function getAccounts(): Promise<ListAccountsResponse["accounts"]> {
  const data = await request<ListAccountsResponse>(ENDPOINTS.accounts)
  return data.accounts
}

// --- GitHub ---

export async function getRepos(): Promise<GithubRepo[]> {
  const data = await request<ListReposResponse>(ENDPOINTS.githubRepos)
  return data.repos
}

// --- Projects ---

export async function getProjects(): Promise<Project[]> {
  const data = await request<ListProjectsResponse>(ENDPOINTS.projects)
  return data.projects
}

export async function createProject(
  payload: CreateProjectRequest
): Promise<Project> {
  const data = await request<ProjectResponse>(ENDPOINTS.projects, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return data.project
}

export async function getProject(id: string): Promise<Project> {
  const data = await request<ProjectResponse>(ENDPOINTS.project(id))
  return data.project
}

export async function deleteProject(id: string): Promise<void> {
  await request<{ success: boolean }>(ENDPOINTS.project(id), {
    method: "DELETE",
  })
}

// --- Scraping ---

export async function startScan(projectId: string): Promise<ScrapingSummary> {
  const data = await request<StartScanResponse>(ENDPOINTS.projectScan(projectId), {
    method: "POST",
  })
  return data.scraping
}

export async function getProjectScraping(
  projectId: string
): Promise<ScrapingDetail | null> {
  const res = await fetch(ENDPOINTS.projectScraping(projectId), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  })
  if (res.status === 404) return null
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`)
  }
  return (body as ScrapingDetailResponse).scraping
}

export async function getProjectScrapings(
  projectId: string
): Promise<ScrapingSummary[]> {
  const data = await request<ListScrapingsResponse>(
    ENDPOINTS.projectScrapings(projectId)
  )
  return data.scrapings
}

export async function getScraping(id: string): Promise<ScrapingDetail> {
  const data = await request<ScrapingDetailResponse>(ENDPOINTS.scraping(id))
  return data.scraping
}

export async function reconcileScraping(id: string): Promise<ScrapingDetail> {
  const data = await request<ScrapingDetailResponse>(
    ENDPOINTS.scrapingReconcile(id)
  )
  return data.scraping
}

// --- Agent (fix-plan runs) ---

export async function startAgentPlan(
  projectId: string
): Promise<StartAgentPlanResponse> {
  return request<StartAgentPlanResponse>(ENDPOINTS.projectAgentPlan(projectId), {
    method: "POST",
  })
}

export async function getProjectAgentRuns(
  projectId: string
): Promise<AgentRunSummary[]> {
  const data = await request<ListAgentRunsResponse>(
    ENDPOINTS.projectAgentRuns(projectId)
  )
  return data.agentRuns
}

export async function getAgentRun(id: string): Promise<AgentRunDetail> {
  const data = await request<AgentRunDetailResponse>(ENDPOINTS.agentRun(id))
  return data.agentRun
}

export async function startFix(
  agentRunId: string,
  answers: AgentPlanAnswer[]
): Promise<StartFixResponse> {
  return request<StartFixResponse>(ENDPOINTS.agentRunFix(agentRunId), {
    method: "POST",
    body: JSON.stringify({ answers }),
  })
}

export async function sendAgentChat(
  agentRunId: string,
  message: string
): Promise<ChatResponse> {
  return request<ChatResponse>(ENDPOINTS.agentRunChat(agentRunId), {
    method: "POST",
    body: JSON.stringify({ message }),
  })
}

export async function completeAgentRun(
  agentRunId: string
): Promise<CompleteRunResponse> {
  return request<CompleteRunResponse>(ENDPOINTS.agentRunComplete(agentRunId), {
    method: "POST",
  })
}

export async function getWorkerStatus(
  projectId?: string
): Promise<WorkerStatusItem[]> {
  const data = await request<ListWorkerStatusResponse>(
    ENDPOINTS.workerStatus(projectId)
  )
  return data.workers
}

// API 2: sync one workflow with Temporal, return the refreshed worker item.
export async function reconcileWorker(
  workflowId: string
): Promise<WorkerStatusItem | null> {
  const res = await fetch(ENDPOINTS.workerStatusByWorkflow(workflowId), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  })
  if (res.status === 404) return null
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`
    )
  }
  return (body as WorkerStatusResponse).worker
}
