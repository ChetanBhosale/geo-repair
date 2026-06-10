import FrontendSecrets from "@repo/secrets/frontend"

// Backend base URL from secrets (NEXT_PUBLIC_BACKEND_URL), trailing slash stripped.
export const BACKEND_URL = (
  FrontendSecrets.PUBLIC_BACKEND ?? "http://localhost:4000"
).replace(/\/+$/, "")

// All backend endpoints live here so URLs are defined in one place.
export const ENDPOINTS = {
  me: `${BACKEND_URL}/api/auth/me`,
  logout: `${BACKEND_URL}/api/auth/logout`,
  accounts: `${BACKEND_URL}/api/auth/accounts`,
  googleLogin: `${BACKEND_URL}/api/auth/google`,
  githubLogin: `${BACKEND_URL}/api/auth/github`,

  githubRepos: `${BACKEND_URL}/api/github/repos`,

  projects: `${BACKEND_URL}/api/projects`,
  project: (id: string) =>
    `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}`,
  projectScan: (id: string) =>
    `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/scan`,
  projectScraping: (id: string) =>
    `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/scraping`,
  projectScrapings: (id: string) =>
    `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/scrapings`,
  projectAgentPlan: (id: string) =>
    `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/agent-plan`,
  projectAgentRuns: (id: string) =>
    `${BACKEND_URL}/api/projects/${encodeURIComponent(id)}/agent-runs`,
  agentRun: (id: string) =>
    `${BACKEND_URL}/api/agent-runs/${encodeURIComponent(id)}`,
  agentRunFix: (id: string) =>
    `${BACKEND_URL}/api/agent-runs/${encodeURIComponent(id)}/fix`,
  agentRunChat: (id: string) =>
    `${BACKEND_URL}/api/agent-runs/${encodeURIComponent(id)}/chat`,
  agentRunComplete: (id: string) =>
    `${BACKEND_URL}/api/agent-runs/${encodeURIComponent(id)}/complete`,
  scraping: (id: string) =>
    `${BACKEND_URL}/api/scrapings/${encodeURIComponent(id)}`,
  scrapingReconcile: (id: string) =>
    `${BACKEND_URL}/api/scrapings/${encodeURIComponent(id)}/reconcile`,
  workerStatus: (projectId?: string) =>
    projectId
      ? `${BACKEND_URL}/api/worker-status?projectId=${encodeURIComponent(projectId)}`
      : `${BACKEND_URL}/api/worker-status`,
  workerStatusByWorkflow: (workflowId: string) =>
    `${BACKEND_URL}/api/worker-status/${encodeURIComponent(workflowId)}`,
} as const
