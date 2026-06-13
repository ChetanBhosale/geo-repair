"use client"

import { useParams } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { useProjectAgentRunBySlug } from "@/query/agent.query"
import { useProjectBySlug } from "@/query/project.query"
import { AgentRunScreen } from "@/components/dashboard/agent-run-screen"

export default function ProjectAgentRunSlugPage() {
  const params = useParams<{ projectSlug: string; agentSlug: string }>()
  const project = useProjectBySlug(params.projectSlug)
  const run = useProjectAgentRunBySlug(project.data?.id ?? "", params.agentSlug)

  if (project.isLoading || run.isLoading) {
    return (
      <div className="px-6 py-6">
        <DashboardInlineLoading rows={2} />
      </div>
    )
  }

  if (!project.data || !run.data) {
    return (
      <div className="grid h-[calc(100svh-3.5rem)] place-items-center px-6 text-center text-sm text-muted-foreground">
        Agent run not found.
      </div>
    )
  }

  return <AgentRunScreen agentRunId={run.data.id} projectId={project.data.id} />
}
