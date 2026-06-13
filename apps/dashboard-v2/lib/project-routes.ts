import type { AgentRunSummary } from "@repo/types/agent"
import type { Project } from "@repo/types/project"
import type { ScrapingSummary } from "@repo/types/scraping"

function withQuery(path: string, query?: string | URLSearchParams | null): string {
  if (!query) return path
  const value = typeof query === "string" ? query.replace(/^\?/, "") : query.toString()
  return value ? `${path}?${value}` : path
}

export function projectOverviewPath(project: Pick<Project, "slug">): string {
  return `/dashboard/${encodeURIComponent(project.slug)}`
}

export function projectAiVisibilityPath(project: Pick<Project, "slug">): string {
  return `${projectOverviewPath(project)}/ai-visibility`
}

export function projectFixAgentPath(project: Pick<Project, "slug">): string {
  return `${projectOverviewPath(project)}/fix-agent`
}

export function projectAgentRunPath(
  project: Pick<Project, "slug">,
  run: Pick<AgentRunSummary, "slug">
): string {
  return `${projectFixAgentPath(project)}/${encodeURIComponent(run.slug)}`
}

export function projectScansPath(project: Pick<Project, "slug">): string {
  return `${projectOverviewPath(project)}/scans`
}

export function projectScanPath(
  project: Pick<Project, "slug">,
  scan: Pick<ScrapingSummary, "slug">
): string {
  return `${projectScansPath(project)}/${encodeURIComponent(scan.slug)}`
}

export function projectUsagePath(project: Pick<Project, "slug">): string {
  return `${projectOverviewPath(project)}/usage`
}

export function projectSettingsPath(project: Pick<Project, "slug">): string {
  return `${projectOverviewPath(project)}/settings`
}

export function projectSupportPath(project: Pick<Project, "slug">): string {
  return `${projectOverviewPath(project)}/support`
}

export function oldProjectPath(projectId: string, query?: string | URLSearchParams | null) {
  return withQuery(`/dashboard/projects/${encodeURIComponent(projectId)}`, query)
}

export function oldAgentRunPath(
  projectId: string,
  agentRunId: string,
  query?: string | URLSearchParams | null
) {
  return withQuery(
    `/dashboard/projects/${encodeURIComponent(projectId)}/agent/${encodeURIComponent(agentRunId)}`,
    query
  )
}

export function routeWithQuery(path: string, query?: string | URLSearchParams | null) {
  return withQuery(path, query)
}
