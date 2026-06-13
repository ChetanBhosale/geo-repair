"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { projectAgentRunPath, routeWithQuery } from "@/lib/project-routes"
import { useAgentRun } from "@/query/agent.query"
import { useProject } from "@/query/project.query"

export default function AgentRunPage() {
  const params = useParams<{ projectId: string; agentId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const project = useProject(params.projectId)
  const run = useAgentRun(params.agentId)

  React.useEffect(() => {
    if (!project.data || !run.data) return
    router.replace(
      routeWithQuery(projectAgentRunPath(project.data, run.data), searchParams)
    )
  }, [project.data, router, run.data, searchParams])

  if (project.isError || run.isError) {
    return (
      <div className="px-6 py-10 text-sm text-muted-foreground">
        Agent run not found.
      </div>
    )
  }

  return (
    <div className="px-6 py-6">
      <DashboardInlineLoading rows={2} />
    </div>
  )
}
