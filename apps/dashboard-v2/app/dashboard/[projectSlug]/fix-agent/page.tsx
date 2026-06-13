"use client"

import { useParams, useRouter } from "next/navigation"
import { RobotIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { PageHeader } from "@/components/dashboard/page-header"
import { projectAgentRunPath } from "@/lib/project-routes"
import { useProjectAgentRuns } from "@/query/agent.query"
import { useProjectBySlug } from "@/query/project.query"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.max(1, Math.round(diff / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function ProjectFixAgentPage() {
  const params = useParams<{ projectSlug: string }>()
  const router = useRouter()
  const project = useProjectBySlug(params.projectSlug)
  const runs = useProjectAgentRuns(project.data?.id ?? "", !!project.data)

  if (project.isLoading || runs.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <DashboardInlineLoading rows={4} />
      </div>
    )
  }

  if (!project.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        Project not found.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Fix Agent"
        description="Fix threads, PR status, and follow-up work for this project."
      />

      {(runs.data?.length ?? 0) > 0 ? (
        <div className="mt-5 grid gap-2 bg-secondary p-2">
          {runs.data!.map((run) => (
            <button
              key={run.id}
              type="button"
              className="flex cursor-pointer items-center justify-between gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
              onClick={() => router.push(projectAgentRunPath(project.data!, run))}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {run.isOpen ? "Active thread" : run.status.toLowerCase()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {timeAgo(run.createdAt)}
                  {run.scoreBefore != null ? `, ${run.scoreBefore} before` : ""}
                  {run.scoreAfter != null ? `, ${run.scoreAfter} after` : ""}
                </p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {run.prUrl ? "PR opened" : run.slug}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid place-items-center bg-card px-6 py-16 text-center">
          <RobotIcon className="size-8 text-muted-foreground" />
          <h2 className="mt-4 text-sm font-medium">No fix thread yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Run a scan, then start the fix agent from Overview.
          </p>
          <Button
            className="mt-5 cursor-pointer"
            onClick={() => router.push(`/dashboard/${project.data.slug}`)}
          >
            Open overview
          </Button>
        </div>
      )}
    </div>
  )
}
